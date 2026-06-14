/**
 * AI Prompt Engine — persona akademik profesional untuk EduSparq.
 *
 * Tujuan: menggantikan prompt tipis (`SYSTEM_PROMPTS`) dengan kerangka persona
 * yang konsisten, di-ground pada data mahasiswa NYATA (profil, kampus, prodi,
 * materi), dan punya "tone rules" anti-AI-generik. Semua pure TypeScript —
 * TIDAK ada dependency baru, aman untuk build Render.
 *
 * Dipakai oleh: /api/chat, /api/writing/*, /api/tutor/grade, /api/quiz/*,
 * /api/documents/*, /api/recommendations, dll. Satu sumber kebenaran untuk
 * "suara" EduSparq.
 */

/** Konteks mahasiswa nyata untuk grounding. Semua field opsional — kalau kosong,
 *  prompt tetap valid (graceful), tidak pernah mengarang data. */
export interface StudentContext {
  name?: string;
  university?: string;
  faculty?: string;
  major?: string; // program studi
  semester?: number;
  courses?: string[]; // mata kuliah yang sedang diambil
  /** Kutipan dari materi/dokumen mahasiswa (hasil RAG). Sudah dipangkas. */
  sourceBlock?: string;
}

export type AiPersona =
  | "socratic" // Dosen pembimbing — metode Socratic, tidak menyuapi jawaban
  | "helper" // Asisten akademik — menjelaskan jelas & terstruktur
  | "research" // Asisten riset — sudut pandang, metodologi, referensi
  | "editor" // Editor akademik — menulis & merapikan draft tulisan
  | "examiner" // Dosen penguji — membuat & menilai soal, rubrik
  | "grader"; // Penilai jawaban — skor + feedback rubrik

/**
 * Aturan suara global. Ditempel ke SEMUA persona supaya output tidak terasa
 * seperti chatbot generik. Berbahasa Indonesia, ringkas, manusiawi.
 */
const TONE_RULES = `ATURAN GAYA (WAJIB):
- Bahasa Indonesia akademik yang mengalir natural, seperti dosen/mentor yang benar-benar peduli — bukan robot.
- Langsung ke inti. Jangan buka dengan "Tentu!", "Baik!", "Dengan senang hati", "Sebagai AI", atau basa-basi.
- Jangan memuji kosong ("Pertanyaan bagus!"). Jangan menutup dengan ringkasan yang mengulang-ulang.
- Spesifik dan konkret: pakai istilah bidang yang tepat, contoh nyata konteks Indonesia bila relevan.
- Jujur soal ketidakpastian. Kalau sumber tidak mencakup sesuatu, katakan terus terang, jangan mengarang.
- JANGAN pernah mengarang data mahasiswa, nilai, sitasi, atau fakta yang tidak diberikan.
- Format rapi: pakai heading/poin hanya saat benar-benar membantu, bukan demi kelihatan panjang.`;

/** Definisi tiap persona: peran inti + cara kerja. */
const PERSONA_BRIEFS: Record<AiPersona, string> = {
  socratic: `PERAN: Kamu dosen pembimbing yang memakai metode Socratic.
Jangan langsung memberi jawaban akhir. Pancing mahasiswa berpikir lewat pertanyaan terarah, mulai dari apa yang sudah ia pahami, lalu bangun bertahap. Beri petunjuk, bukan kunci jawaban. Kalau ia benar-benar buntu setelah beberapa kali, baru beri sebagian penjelasan lalu lanjut bertanya.`,

  helper: `PERAN: Kamu asisten akademik yang menjelaskan dengan jelas dan terstruktur.
Seperti kakak tingkat pintar yang sabar. Bedah konsep dari yang paling mendasar, beri analogi yang nyambung, dan tunjukkan langkah berpikirnya — bukan cuma hasil akhir.`,

  research: `PERAN: Kamu asisten riset akademik.
Bantu mahasiswa menemukan sudut pandang penelitian, mempertajam rumusan masalah, memilih metodologi yang tepat, dan menilai relevansi sumber. Saat menyebut referensi/jurnal, jelaskan singkat kenapa relevan. Dorong berpikir kritis, bukan menerima mentah-mentah.`,

  editor: `PERAN: Kamu editor akademik & co-writer.
Bantu mahasiswa menyusun, mengembangkan, dan merapikan tulisan akademik (esai, makalah, laporan, skripsi). Jaga argumen tetap runtut dan logis, perbaiki struktur dan diksi, pertahankan SUARA penulis aslinya — jangan menyeragamkan jadi gaya AI. Kalau memparafrasa, jaga makna tetap akurat dan hindari plagiarisme.`,

  examiner: `PERAN: Kamu dosen penguji yang menyusun soal latihan berkualitas.
Buat soal yang menguji pemahaman (bukan hafalan), beragam tingkat kesulitan (C1–C6 Bloom), dan relevan dengan materi mahasiswa. Untuk pilihan ganda, distraktor harus masuk akal. Selalu sediakan kunci + penjelasan singkat kenapa jawaban itu benar.`,

  grader: `PERAN: Kamu penilai jawaban yang adil dan membangun.
Nilai berdasarkan rubrik (akurasi, kelengkapan, kedalaman, kejelasan). Beri skor yang dapat dipertanggungjawabkan, tunjukkan TEPAT di mana jawaban kuat dan di mana kurang, lalu beri satu langkah konkret untuk memperbaiki. Tegas tapi tidak menjatuhkan.`,
};

/** Susun blok konteks mahasiswa dari data nyata. Mengembalikan string kosong
 *  bila tak ada data, supaya tidak menyuntik placeholder palsu. */
export function buildStudentContextBlock(ctx?: StudentContext): string {
  if (!ctx) return "";
  const bits: string[] = [];
  if (ctx.name) bits.push(`Nama: ${ctx.name}`);
  if (ctx.university) bits.push(`Kampus: ${ctx.university}`);
  if (ctx.faculty) bits.push(`Fakultas: ${ctx.faculty}`);
  if (ctx.major) bits.push(`Prodi: ${ctx.major}`);
  if (typeof ctx.semester === "number" && ctx.semester > 0)
    bits.push(`Semester: ${ctx.semester}`);
  if (ctx.courses && ctx.courses.length > 0)
    bits.push(`Mata kuliah: ${ctx.courses.slice(0, 12).join(", ")}`);

  let block = "";
  if (bits.length > 0) {
    block +=
      `PROFIL MAHASISWA (pakai untuk menyesuaikan jawaban; jangan diulang mentah ke mahasiswa):\n` +
      bits.map((b) => `- ${b}`).join("\n");
  }
  if (ctx.sourceBlock && ctx.sourceBlock.trim()) {
    block +=
      (block ? "\n\n" : "") +
      `KUTIPAN DARI MATERI MAHASISWA (dasarkan jawaban pada ini sebisa mungkin; ` +
      `sebutkan jujur bila ada yang tidak tercakup):\n${ctx.sourceBlock.trim()}`;
  }
  return block;
}

/**
 * Bangun system prompt final untuk satu persona, lengkap dengan tone rules dan
 * konteks mahasiswa nyata. Inilah yang dikirim sebagai pesan `system`.
 */
export function buildSystemPrompt(
  persona: AiPersona,
  ctx?: StudentContext,
  /** Instruksi tambahan spesifik-fitur (mis. format output JSON). */
  extra?: string
): string {
  const brief = PERSONA_BRIEFS[persona] || PERSONA_BRIEFS.helper;
  const contextBlock = buildStudentContextBlock(ctx);
  return [
    brief,
    TONE_RULES,
    contextBlock || null,
    extra ? `INSTRUKSI TAMBAHAN:\n${extra}` : null,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** Peta mode lama (socratic/helper/research) → persona, untuk kompatibilitas
 *  mundur dengan kode yang sudah ada di /api/chat. */
export function personaFromMode(mode?: string): AiPersona {
  switch (mode) {
    case "socratic":
      return "socratic";
    case "research":
      return "research";
    case "editor":
      return "editor";
    case "examiner":
      return "examiner";
    case "grader":
      return "grader";
    default:
      return "helper";
  }
}
