import OpenAI from "openai";
import { UserPersona } from "./db/models/UserPersona";
import { ChatMessage } from "./db/models/ChatMessage";
import { User } from "./db/models/User";
import { connectDB } from "./db/mongodb";

// Menggunakan Moonshot / Kimi client (bisa juga OpenAI)
let aiClient: OpenAI | null = null;
const getAiClient = () => {
  if (!aiClient) {
    aiClient = new OpenAI({ 
      apiKey: process.env.MOONSHOT_API_KEY,
      baseURL: "https://www.phanrouter.com/phanrouter/v1"
    });
  }
  return aiClient;
};

// Fungsi ini akan mengekstrak fakta dari percakapan terakhir dan mengupdate profil
export async function extractAndStorePersona(userId: string) {
  try {
    await connectDB();
    
    // Ambil 15 chat terakhir
    const messages = await ChatMessage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(15);
      
    if (messages.length < 5 || messages.length % 5 !== 0) return; // Ekstrak hanya setiap kelipatan 5 pesan untuk mencegah Rate Limit API

    // Balik urutan menjadi kronologis
    messages.reverse();
    const chatTranscript = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join("\n");

    // Ambil persona yang sudah ada
    let persona = await UserPersona.findOne({ userId });
    
    const prompt = `
Anda adalah analis profil pengguna. Baca transkrip percakapan berikut antara User dan AI.
Tugas Anda adalah mengekstrak fakta penting tentang pengguna tersebut untuk disimpan di profil ingatan (Memory Profile).

Ekstrak fakta ke dalam format JSON berikut secara persis:
{
  "academicProfile": "Jurusan, semester, kampus, atau latar belakang akademik (kosongkan jika tidak ada info)",
  "writingStyle": "Preferensi gaya bahasa, nada, atau cara penulisan yang disukai user (misal: 'Santai, suka pakai kata bro', 'Formal dan akademis kaku')",
  "currentFocus": "Topik spesifik yang sedang dikerjakan user saat ini (misal: 'Bab 3 Skripsi tentang beton', 'Tugas akhir hukum pidana')",
  "newLearnedFacts": ["Fakta 1", "Fakta 2"] // Array string fakta spesifik baru yang dipelajari tentang user
}

JANGAN keluarkan teks apa pun selain JSON.

Transkrip:
${chatTranscript}
`;

    const response = await getAiClient().chat.completions.create({
      model: "moonshot-v1-8k",
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return;

    // Bersihkan output jika dibungkus markdown
    const jsonStr = content.replace(/```json/g, "").replace(/```/g, "").trim();
    const extractedData = JSON.parse(jsonStr);

    if (!persona) {
      persona = new UserPersona({
        userId,
        academicProfile: extractedData.academicProfile || "",
        writingStyle: extractedData.writingStyle || "",
        currentFocus: extractedData.currentFocus || "",
        learnedFacts: extractedData.newLearnedFacts || [],
      });
    } else {
      if (extractedData.academicProfile) persona.academicProfile = extractedData.academicProfile;
      if (extractedData.writingStyle) persona.writingStyle = extractedData.writingStyle;
      if (extractedData.currentFocus) persona.currentFocus = extractedData.currentFocus;
      
      if (extractedData.newLearnedFacts && Array.isArray(extractedData.newLearnedFacts)) {
        const currentFacts = persona.learnedFacts || [];
        const newFacts = extractedData.newLearnedFacts.filter((f: string) => !currentFacts.includes(f));
        persona.learnedFacts = [...currentFacts, ...newFacts].slice(-20); // Simpan maksimal 20 fakta
      }
    }
    
    persona.lastExtractedAt = new Date();
    await persona.save();
    
    console.log(`[AI Memory] Successfully updated persona for user ${userId}`);

  } catch (error) {
    console.error("[AI Memory] Failed to extract persona:", error);
  }
}

export async function getUserPersonaContext(userId: string): Promise<string> {
  try {
    await connectDB();
    const [persona, user] = await Promise.all([
      UserPersona.findOne({ userId }),
      User.findById(userId)
    ]);
    
    const parts = [];
    parts.push("=== INFORMASI PENGGUNA (MEMORI) ===");

    // Data pasti dari database pengguna
    if (user) {
      parts.push(`- Nama Pengguna: ${user.name}`);
      const campusInfo = [user.prodi, user.fakultas, user.universitas].filter(Boolean).join(", ");
      if (campusInfo) {
        parts.push(`- Latar Belakang Studi: Mahasiswa ${campusInfo} (Semester ${user.semester || 1})`);
      }
    }
    
    // Ingatan spesifik hasil ekstraksi AI
    if (persona) {
      if (persona.academicProfile && (!user || !user.prodi)) {
        parts.push(`- Profil Akademik Lanjutan: ${persona.academicProfile}`);
      }
      if (persona.writingStyle) parts.push(`- Gaya Bahasa Favorit: ${persona.writingStyle}`);
      if (persona.currentFocus) parts.push(`- Fokus Pekerjaan Saat Ini: ${persona.currentFocus}`);
      if (persona.learnedFacts && persona.learnedFacts.length > 0) {
        parts.push(`- Fakta Diketahui: ${persona.learnedFacts.map((f: string) => `"${f}"`).join(", ")}`);
      }
    }

    parts.push("Gunakan informasi di atas untuk mempersonalisasi jawaban Anda agar terasa akrab dan sangat relevan dengan pengguna.");
    
    return parts.length > 2 ? parts.join("\n") + "\n\n" : "";
  } catch (error) {
    console.error("[AI Memory] Failed to get persona context:", error);
    return "";
  }
}
