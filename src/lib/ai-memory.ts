import OpenAI from "openai";
import { UserPersona } from "./db/models/UserPersona";
import { ChatMessage } from "./db/models/ChatMessage";
import { User } from "./db/models/User";
import { connectDB } from "./db/mongodb";

// Menggunakan Moonshot / Kimi client atau fallback ke OpenAI/NVIDIA API key
let aiClient: OpenAI | null = null;
const getAiClient = () => {
  if (!aiClient) {
    const apiKey = process.env.MOONSHOT_API_KEY || process.env.NVIDIA_API_KEY || process.env.OPENAI_API_KEY;
    const baseURL = process.env.MOONSHOT_API_KEY 
      ? "https://www.phanrouter.com/phanrouter/v1" 
      : (process.env.NVIDIA_API_KEY ? "https://integrate.api.nvidia.com/v1" : undefined);
    
    aiClient = new OpenAI({ 
      apiKey: apiKey || "placeholder-key",
      baseURL
    });
  }
  return aiClient;
};

// Fungsi ini mengekstrak fakta, gaya bahasa, bahasa, aktivitas, dan tipe belajar dari percakapan
export async function extractAndStorePersona(userId: string) {
  try {
    await connectDB();
    
    // Ambil 15 chat terakhir
    const messages = await ChatMessage.find({ userId })
      .sort({ createdAt: -1 })
      .limit(15);
      
    if (messages.length < 5 || messages.length % 5 !== 0) return; // Ekstrak hanya setiap kelipatan 5 pesan

    // Balik urutan menjadi kronologis
    messages.reverse();
    const chatTranscript = messages.map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content}`).join("\\n");

    // Ambil persona yang sudah ada
    let persona = await UserPersona.findOne({ userId });
    
    const prompt = `
Anda adalah analis profil pengguna akademik cerdas. Analisis transkrip percakapan berikut.
Tugas Anda adalah mengekstrak memori, preferensi belajar, bahasa, dan aktivitas pengguna secara akurat.

Ekstrak ke dalam format JSON berikut secara persis:
{
  "academicProfile": "Jurusan, semester, kampus, atau latar belakang akademik (kosongkan jika tidak ada info)",
  "writingStyle": "Preferensi gaya bahasa user (misal: 'Santai menggunakan lo-gue', 'Formal akademis', 'Campuran bahasa Inggris')",
  "currentFocus": "Topik spesifik yang sedang dipelajari/dikerjakan saat ini",
  "language": "Kode bahasa/dialek (misal: 'id-informal', 'id-formal', 'en', 'jav')",
  "newLearnedFacts": ["Fakta spesifik baru 1", "Fakta spesifik baru 2"],
  "learningStyle": {
    "prefersStepByStep": true/false (apakah user menyukai penjelasan bertahap?),
    "prefersExamples": true/false (apakah user menyukai contoh konkret/kode?),
    "prefersVisual": true/false (apakah user menyukai ilustrasi/visual?),
    "responseLength": "short" | "medium" | "long"
  }
}

JANGAN keluarkan teks penjelasan apa pun selain JSON valid tersebut.

Transkrip:
${chatTranscript}
`;

    // Pilih model hemat token untuk ekstraksi memori
    // Jika menggunakan Kimi/Moonshot pakai moonshot-v1-8k, jika NVIDIA pakai meta/llama-3.1-8b-instruct
    const model = process.env.MOONSHOT_API_KEY ? "moonshot-v1-8k" : "meta/llama-3.1-8b-instruct";

    const response = await getAiClient().chat.completions.create({
      model: model,
      messages: [{ role: "system", content: prompt }],
      temperature: 0.1,
      response_format: { type: "json_object" }
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
        language: extractedData.language || "id-informal",
        learnedFacts: extractedData.newLearnedFacts || [],
        learningStyle: {
          prefersStepByStep: extractedData.learningStyle?.prefersStepByStep ?? true,
          prefersExamples: extractedData.learningStyle?.prefersExamples ?? true,
          prefersVisual: extractedData.learningStyle?.prefersVisual ?? false,
          responseLength: extractedData.learningStyle?.responseLength ?? "medium",
        },
        activityLog: {
          mostUsedFeatures: ["chat"],
          avgSessionLength: 10,
          peakHour: new Date().getHours(),
          subjectFrequency: new Map()
        }
      });
    } else {
      if (extractedData.academicProfile) persona.academicProfile = extractedData.academicProfile;
      if (extractedData.writingStyle) persona.writingStyle = extractedData.writingStyle;
      if (extractedData.currentFocus) persona.currentFocus = extractedData.currentFocus;
      if (extractedData.language) persona.language = extractedData.language;
      
      if (extractedData.learningStyle) {
        persona.learningStyle = {
          prefersStepByStep: extractedData.learningStyle.prefersStepByStep ?? persona.learningStyle?.prefersStepByStep ?? true,
          prefersExamples: extractedData.learningStyle.prefersExamples ?? persona.learningStyle?.prefersExamples ?? true,
          prefersVisual: extractedData.learningStyle.prefersVisual ?? persona.learningStyle?.prefersVisual ?? false,
          responseLength: extractedData.learningStyle.responseLength ?? persona.learningStyle?.responseLength ?? "medium",
        };
      }

      if (extractedData.newLearnedFacts && Array.isArray(extractedData.newLearnedFacts)) {
        const currentFacts = persona.learnedFacts || [];
        const newFacts = extractedData.newLearnedFacts.filter((f: string) => !currentFacts.includes(f));
        persona.learnedFacts = [...currentFacts, ...newFacts].slice(-20); // Simpan maksimal 20 fakta
      }

      // Update basic activity log
      const currentActivity = persona.activityLog || { mostUsedFeatures: [], avgSessionLength: 10, peakHour: 12, subjectFrequency: new Map() };
      const currentHour = new Date().getHours();
      currentActivity.peakHour = Math.round(((currentActivity.peakHour || 12) + currentHour) / 2);
      persona.activityLog = currentActivity;
    }
    
    persona.lastExtractedAt = new Date();
    await persona.save();
    
    console.log(`[AI Memory] Successfully updated detailed persona for user ${userId}`);

  } catch (error) {
    console.error("[AI Memory] Failed to extract persona:", error);
  }
}

/**
 * Update preferensi upload user setelah upload file.
 * Menambahkan courseId ke preferredCourseIds (max 5, LRU).
 */
export async function updateUploadPreferences(
  userId: string,
  courseId: string,
  autoCreateDeadline: boolean
): Promise<void> {
  try {
    await connectDB();
    let persona = await UserPersona.findOne({ userId });
    if (!persona) {
      persona = new UserPersona({
        userId,
        uploadPreferences: {
          preferredCourseIds: [courseId],
          autoCreateDeadlines: autoCreateDeadline,
          learningStyle: "",
        },
      });
    } else {
      const prefs = persona.uploadPreferences || { preferredCourseIds: [], autoCreateDeadlines: false, learningStyle: "" };
      const ids = prefs.preferredCourseIds || [];
      // Move to front (LRU).
      const filtered = ids.filter((id: string) => id !== courseId);
      filtered.unshift(courseId);
      prefs.preferredCourseIds = filtered.slice(0, 5);
      if (autoCreateDeadline) prefs.autoCreateDeadlines = true;
      persona.uploadPreferences = prefs;
    }
    await persona.save();
  } catch (err) {
    console.error("[AI Memory] Failed to update upload preferences:", err);
  }
}

/**
 * Mengembalikan context memori pengguna dalam format JSON Compact hemat token.
 */
export async function getUserPersonaContext(userId: string): Promise<string> {
  try {
    await connectDB();
    const [persona, user] = await Promise.all([
      UserPersona.findOne({ userId }),
      User.findById(userId)
    ]);
    
    if (!persona && !user) return "";

    // Bangun JSON Compact hemat token (menggunakan singkatan kunci untuk minimisasi token)
    const memo: Record<string, any> = {};
    
    if (user) {
      memo.nama = user.name;
      const campusInfo = [user.prodi, user.fakultas, user.universitas].filter(Boolean).join(", ");
      if (campusInfo) {
        memo.studi = `${campusInfo} (Sem ${user.semester || 1})`;
      }
    }
    
    if (persona) {
      if (persona.academicProfile && (!user || !user.prodi)) {
        memo.profil = persona.academicProfile;
      }
      if (persona.writingStyle) memo.gaya = persona.writingStyle;
      if (persona.currentFocus) memo.fokus = persona.currentFocus;
      if (persona.language) memo.bahasa = persona.language;
      if (persona.learnedFacts && persona.learnedFacts.length > 0) {
        memo.fakta = persona.learnedFacts;
      }
      if (persona.learningStyle) {
        memo.style = {
          step: persona.learningStyle.prefersStepByStep,
          ex: persona.learningStyle.prefersExamples,
          len: persona.learningStyle.responseLength
        };
      }
    }

    return `
[MEMORI_USER_JSON]
${JSON.stringify(memo)}
[INSTRUKSI]: Sesuaikan respon (bahasa, nada, kedalaman materi, contoh) secara halus berdasarkan data MEMORI_USER_JSON di atas tanpa mengulang/menyebutkan isi JSON secara eksplisit.

`;
  } catch (error) {
    console.error("[AI Memory] Failed to get persona context:", error);
    return "";
  }
}
