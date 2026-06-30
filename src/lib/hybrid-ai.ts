import { complete } from "./ai-client";
import { getUserPersonaContext } from "./ai-memory";
import { connectDB } from "./db/mongodb";
import { Course } from "./db/models/Course";

/**
 * Hybrid AI Pipeline — DeepSeek V4 Pro via NVIDIA NIM.
 *
 * Flow:
 *   Stage 1: DeepSeek (as Analyzer) → ekstrak struktur JSON dari dokumen.
 *   Stage 2: DeepSeek (as Responder) → buat ringkasan manusiawi.
 *
 * Semua lewat NVIDIA NIM (DeepSeek V4 Pro). AI gratis untuk semua user.
 */

export interface FileAnalysis {
  contentType: "materi" | "tugas" | "campuran" | "soal" | "";
  courseGuess: string;
  topics: string[];
  summary: string;
  tasksDetected: Array<{
    title: string;
    description: string;
    dueDateGuess: string | null;
    type: string;
  }>;
  keyConcepts: string[];
  recommendedActions: string[];
}

export interface HybridResult {
  analysis: FileAnalysis;
  response: string; // narasi manusiawi dari DeepSeek
  creditCost: number;
}

// ─── Stage 1: Mistral Analyzer ──────────────────────────────────────────────

const MISTRAL_SYSTEM = `Anda adalah analis dokumen akademik. Tugas Anda membaca konten materi/tugas kuliah dan mengekstrak informasi terstruktur.

Output HANYA JSON dengan format:
{
  "contentType": "materi|tugas|campuran|soal",
  "courseGuess": "nama mata kuliah yang paling cocok",
  "topics": ["topik 1", "topik 2"],
  "summary": "ringkasan isi dokumen dalam 3-5 kalimat",
  "tasksDetected": [
    {
      "title": "judul tugas",
      "description": "deskripsi singkat",
      "dueDateGuess": "YYYY-MM-DD atau null",
      "type": "essay|quiz|project|presentation|other"
    }
  ],
  "keyConcepts": ["konsep penting 1", "konsep 2"],
  "recommendedActions": ["action untuk user"]
}

Aturan:
- JANGAN mengarang data. Kalau tidak yakin, null.
- dueDateGuess: ekstrak dari teks ("minggu depan", "15 November", dll). Konversi ke YYYY-MM-DD relatif hari ini.
- Jika dokumen adalah soal/ujian, taskDetected bisa berisi latihan yang perlu dikerjakan.
- Bahasa Indonesia.`;

async function runMistralAnalyzer(text: string): Promise<FileAnalysis> {
  const truncated = text.slice(0, 8000);
  const result = await complete(
    {
      feature: "hybrid_analyzer",
      system: MISTRAL_SYSTEM,
      user: truncated,
      temperature: 0.2,
      maxTokens: 1200,
      json: true,
      forceProvider: "nvidia",
      model: "deepseek-ai/deepseek-v4-pro",
      taskId: "mistral-analyzer",
    },
    undefined // system call, no userId billing here; billed later in DeepSeek stage
  );

  try {
    const raw = result.text.replace(/```json/g, "").replace(/```/g, "").trim();
    const parsed = JSON.parse(raw);
    return normalizeAnalysis(parsed);
  } catch {
    return {
      contentType: "",
      courseGuess: "",
      topics: [],
      summary: result.text.slice(0, 500),
      tasksDetected: [],
      keyConcepts: [],
      recommendedActions: [],
    };
  }
}

// ─── Stage 2: DeepSeek Responder ────────────────────────────────────────────

const DEEPSEEK_SYSTEM = `Anda adalah asisten akademik personal untuk mahasiswa Indonesia. User baru saja upload file materi/tugas.

Anda menerima ANALISIS STRUKTUR dari dokumen (hasil analisis tim Anda).
Tugas Anda:
1. Buat ringkasan MENARIK dan HELPFUL dalam Bahasa Indonesia (bukan copy-paste)
2. Identifikasi apakah ada tugas yang perlu diingatkan
3. Berikan 1-2 rekomendasi belajar spesifik
4. Jika ada tugas, sertakan pertanyaan: "Apakah ingin saya buat pengingat tugas?"

Gaya: santai tapi informatif, pakai emoji, bahasa mahasiswa Indonesia.
Jangan terlalu panjang (max 400 token output).`;

async function runDeepSeekResponder(
  analysis: FileAnalysis,
  userId: string,
  courseName: string
): Promise<{ text: string; creditCost: number }> {
  await connectDB();

  // Build memory context.
  const personaMemory = await getUserPersonaContext(userId);

  // Build course history hint.
  const courseCount = await Course.countDocuments({ userId });
  const frequentCourses = await Course.find({ userId })
    .sort({ createdAt: -1 })
    .limit(3)
    .lean();
  const courseHint =
    frequentCourses.length > 0
      ? `User memiliki ${courseCount} mata kuliah. Yang terbaru: ${frequentCourses.map((c) => c.name).join(", ")}. File ini diupload ke: ${courseName}.`
      : `File diupload ke: ${courseName}.`;

  const contextPayload = `
${personaMemory}

${courseHint}

[ANALISIS STRUKTUR DOKUMEN]
- Tipe: ${analysis.contentType || "tidak diketahui"}
- Topik: ${analysis.topics.join(", ") || "-"}
- Konsep Kunci: ${analysis.keyConcepts.join(", ") || "-"}
- Tugas Terdeteksi: ${analysis.tasksDetected.length > 0 ? analysis.tasksDetected.map((t) => `- ${t.title} (${t.type}${t.dueDateGuess ? ", jatuh tempo " + t.dueDateGuess : ""})`).join("\n") : "Tidak ada tugas terdeteksi"}
- Ringkasan Internal: ${analysis.summary}
- Rekomendasi Internal: ${analysis.recommendedActions.join(", ") || "-"}
`;

  const result = await complete(
    {
      feature: "hybrid_analyzer",
      system: DEEPSEEK_SYSTEM,
      user: contextPayload,
      temperature: 0.5,
      maxTokens: 600,
      forceProvider: "nvidia",
      model: "deepseek-ai/deepseek-v4-pro",
      taskId: "deepseek-responder",
    },
    userId
  );

  return { text: result.text, creditCost: result.creditCost };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Jalankan hybrid AI pipeline pada teks dokumen.
 *
 * @param text     Teks hasil ekstraksi file (PDF/DOCX).
 * @param userId   ID user untuk billing & memory.
 * @param courseName Nama mata kuliah tujuan upload.
 * @returns        Hasil analisis + response narasi.
 */
export async function analyzeDocument(
  text: string,
  userId: string,
  courseName: string
): Promise<HybridResult> {
  // Stage 1: Mistral baca.
  const analysis = await runMistralAnalyzer(text);

  // Stage 2: DeepSeek rangkum.
  const { text: response, creditCost } = await runDeepSeekResponder(
    analysis,
    userId,
    courseName
  );

  return {
    analysis,
    response,
    creditCost,
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function normalizeAnalysis(raw: any): FileAnalysis {
  const safeArr = (val: any): string[] =>
    Array.isArray(val) ? val.filter((v) => typeof v === "string") : [];

  const safeTasks = (val: any): FileAnalysis["tasksDetected"] => {
    if (!Array.isArray(val)) return [];
    return val
      .filter((t) => t && typeof t === "object")
      .map((t) => ({
        title: String(t.title || "Tugas"),
        description: String(t.description || ""),
        dueDateGuess: t.dueDateGuess && t.dueDateGuess !== "null" ? String(t.dueDateGuess) : null,
        type: String(t.type || "other"),
      }));
  };

  return {
    contentType: ["materi", "tugas", "campuran", "soal"].includes(raw?.contentType)
      ? raw.contentType
      : "",
    courseGuess: String(raw?.courseGuess || ""),
    topics: safeArr(raw?.topics),
    summary: String(raw?.summary || ""),
    tasksDetected: safeTasks(raw?.tasksDetected),
    keyConcepts: safeArr(raw?.keyConcepts),
    recommendedActions: safeArr(raw?.recommendedActions),
  };
}
