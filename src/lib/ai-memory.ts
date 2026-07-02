import { UserPersona } from "./db/models/UserPersona";
import { ChatMessage } from "./db/models/ChatMessage";
import { User } from "./db/models/User";
import { connectDB } from "./db/mongodb";
import { complete } from "./ai-client";

/**
 * AI Memory / Persona System — per-user persistent memory.
 *
 * Refactored: sekarang memakai `complete()` dari ai-client.ts (provider chain
 * utama: NVIDIA NIM → Groq → Moonshot → OpenAI) daripada client terpisah
 * yang hardcoded baseURL + model lama.
 *
 * Benefit:
 *   - Otomatis pakai model terbaru (DeepSeek V4 / Llama 4 / Kimi K2.6)
 *   - BYOK support (user yang setup key sendiri, extraction pakai key mereka)
 *   - Provider fallback chain berlaku
 *   - UsageLog tercatat untuk analytics
 *
 * Extraction dipanggil sebagai fire-and-forget setelah setiap respons AI
 * (di chat route + orchestrator path). Hanya berjalan tiap 5 pesan untuk
 * hemat token.
 */

// Fungsi ini mengekstrak fakta, gaya bahasa, dan konteks dari percakapan terakhir
export async function extractAndStorePersona(userId: string) {
  try {
    await connectDB();

    // FIX: cek total message count (bukan capped count) untuk threshold akurat.
    const totalMessages = await ChatMessage.countDocuments({ userId });
    if (totalMessages < 5 || totalMessages % 5 !== 0) return; // hanya tiap 5 pesan

    // Ambil 15 chat terakhir untuk analisis.
    const messages = await ChatMessage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(15);

    // Balik urutan menjadi kronologis
    messages.reverse();
    const chatTranscript = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join("\n");

    // Ambil persona yang sudah ada
    let persona = await UserPersona.findOne({ userId });

    const prompt = `Anda adalah analis profil pengguna. Baca transkrip percakapan berikut antara User dan AI.
Tugas Anda adalah mengekstrak fakta penting tentang pengguna tersebut untuk disimpan di profil ingatan (Memory Profile).

Ekstrak fakta ke dalam format JSON berikut secara persis:
{
  "academicProfile": "Jurusan, semester, kampus, atau latar belakang akademik (kosongkan jika tidak ada info)",
  "writingStyle": "Preferensi gaya bahasa, nada, atau cara penulisan yang disukai user (misal: 'Santai, suka pakai kata bro', 'Formal dan akademis kaku')",
  "currentFocus": "Topik spesifik yang sedang dikerjakan user saat ini (misal: 'Bab 3 Skripsi tentang beton', 'Tugas akhir hukum pidana')",
  "newLearnedFacts": ["Fakta 1", "Fakta 2"]
}

JANGAN keluarkan teks apa pun selain JSON.

Transkrip:
${chatTranscript}
`;

    // Pakai provider chain utama (bukan client terpisah).
    const result = await complete({
      feature: "chat",
      system: prompt,
      user: chatTranscript.slice(-3000), // limit context
      temperature: 0.1,
      maxTokens: 800,
    }, userId);

    const content = result.text;
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

    console.log(`[AI Memory] Updated persona for user ${userId} (total msgs: ${totalMessages})`);

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

/**
 * Update upload preferences (dipanggil dari Telegram upload flow).
 * Mencatat courseId yang dipilih user + autoCreateDeadlines preference.
 */
export async function updateUploadPreferences(
  userId: string,
  courseId: string,
  autoCreateDeadlines: boolean
): Promise<void> {
  try {
    await connectDB();
    await UserPersona.findOneAndUpdate(
      { userId },
      {
        $set: {
          "uploadPreferences.autoCreateDeadlines": autoCreateDeadlines,
          lastExtractedAt: new Date(),
        },
        $addToSet: { "uploadPreferences.preferredCourseIds": courseId },
      },
      { upsert: true }
    );
  } catch (error) {
    console.error("[AI Memory] Failed to update upload preferences:", error);
  }
}
