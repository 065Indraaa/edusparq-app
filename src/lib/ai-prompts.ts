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
const TONE_RULES = `ATURAN GAYA & KODE ETIK (WAJIB DIIKUTI MUTLAK):
- Anda adalah pakar/profesor akademik kelas atas. Gunakan Bahasa Indonesia formal, lugas, metodis, dan sangat profesional.
- DILARANG KERAS menggunakan basa-basi seperti "Tentu!", "Baiklah!", "Mari kita bahas", atau menyapa secara berlebihan. Langsung ke inti jawaban dengan struktur tingkat tinggi.
- PRIORITAS SUMBER & PENELITIAN MENDALAM: Jika pengguna melampirkan dokumen (di blok [Sumber X]), jadikan dokumen tersebut sebagai fondasi UTAMA jawaban.
- JIKA informasi TIDAK ADA dalam dokumen, Anda DIPERBOLEHKAN dan DIHARAPKAN menggunakan basis pengetahuan akademis Anda yang luas (jurnal, literatur, teori tervalidasi) untuk memberikan analisis riset mendalam. JANGAN menjawab "tidak tahu" jika Anda memiliki pengetahuan valid tentang topik tersebut.
- Selalu berikan analisis yang kritis, komprehensif, dan didukung oleh konsep teoritis yang nyata (bukan karangan). Jika mengambil dari literatur eksternal, sebutkan konteks/teorinya dengan jelas.
- JANGAN pernah mengarang data mahasiswa atau nilai.
- FORMAT & KEBERSIHAN OUTPUT: Gunakan heading dan poin-poin standar Markdown yang terstruktur secara logis. DILARANG KERAS menggunakan simbol-simbol aneh, emoji berlebihan, atau karakter Unicode/simbol dekoratif yang tidak relevan. Pastikan hasil selalu bersih (clean), profesional, dan murni akademis.
- ZERO HALLUCINATION: Selalu dasarkan jawaban Anda HANYA pada data nyata (real data), sumber dokumen, dan fakta akademik yang tervalidasi. Dilarang keras berhalusinasi atau mengarang teori/referensi fiktif.`;

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
      `KUTIPAN DARI MATERI MAHASISWA (PENTING: Jadikan kutipan ini sebagai fondasi utama jawaban. Jika informasi kurang, lengkapi dengan analisis riset akademik Anda yang mendalam dan valid):\n${ctx.sourceBlock.trim()}`;
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
