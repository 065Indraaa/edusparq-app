import { registerAgent } from "./registry";
import { parseLooseJSON } from "../../lib/ai";
import type { SessionContext, AgentName } from "./context";

/**
 * Definisi semua agen EduSparq.
 *
 * Dipanggil sekali saat modul pertama kali di-import (di orchestrator & API).
 * Tiap agen: persona brief + execute yang mem-parse output ke field context.
 *
 * Filosofi prompt: POSITIF, prosedural, output contract eksplisit (sama dengan
 * gaya ai-prompts.ts yang sudah ada) supaya konsisten & hemat token.
 */

// ─────────────────────────────────────────────────────────────────────────────
// CLASSIFIER — menentukan jalur (simple/medium/complex)
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "classifier",
  label: "Pengarah",
  description:
    "Menilai kompleksitas permintaan untuk memilih jalur eksekusi yang hemat.",
  feature: "agent_classify",
  buildPrompt: (ctx) => `Anda adalah router pintar untuk sistem multi-agen akademik.
Tentukan tingkat kompleksitas permintaan mahasiswa Indonesia agar sistem bisa memilih jalur eksekusi paling hemat.

Kembalikan HANYA JSON (mulai dari "{"):
{"tier":"simple|medium|complex","reason":"satu kalimat"}

Kriteria:
- "simple": pertanyaan definisi/fakta/jelaskan singkat, bisa dijawab langsung dalam 1 langkah. Contoh: "Apa itu inflasi?", "Jelaskan fungsi UI pada React".
- "medium": penjelasan konsep menengah, perlu struktur argumen tapi satu output cukup. Contoh: "Bandingkan regresi linear vs logistik", "Jelaskan teori motivasi Herzberg".
- "complex": tugas multi-langkah, dokumen panjang, makalah/solver/coding, perlu spesifikasi+rencana+eksekusi+review. Contoh: "Buatkan saya bab 3 skripsi", "Selesaikan soal studi kasus ini lengkap", "Buat ERD untuk sistem perpustakaan".

Pakai Bahasa Indonesia. ${ctx.courseName ? `Konteks mata kuliah: ${ctx.courseName}.` : ""}`,

  async execute(_ctx) {
    // execute di-override di runAgent via complete(); dummy untuk type.
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// KLARIFIER — identifikasi ambiguitas
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "clarifier",
  label: "Klarifikasi",
  description:
    "Mendeteksi ambiguitas dalam permintaan & mengajukan pertanyaan esensial (atau menyimpulkan asumsi).",
  feature: "agent_clarifier",
  buildPrompt: (ctx) => `Anda adalah agen Klarifikasi dalam tim multi-agen akademik.

[MISI] Pastikan permintaan user cukup spesifik untuk dieksekusi tanpa salah arah. Anda BUKAN menjawab pertanyaan user — Anda hanya mengklarifikasi.

[PROSEDUR]
1. Baca permintaan user. Identifikasi apa yang TIDAK jelas (format output, panjang, batasan, audience, standar sitasi).
2. Bila ada ambiguitas KRITIS: ajukan maksimal 3 pertanyaan singkat & tajam.
3. Bila permintaan sudah cukup jelas: JANGAN ajukan pertanyaan, langsung tulis asumsi yang akan diambil executor.

[OUTPUT CONTRACT] HANYA JSON:
{"needsClarification": true|false, "questions": ["...","..."], "assumptions": ["asumsi 1","asumsi 2"]}

Jika needsClarification=false, questions=[] dan assumptions terisi. Maks 3 questions. ${ctx.courseName ? `Mata kuliah: ${ctx.courseName}.` : ""}`,

  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// SPESIFIER — ubah permintaan jadi spec teknis
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "specifier",
  label: "Spesifikasi",
  description:
    "Mengubah permintaan menjadi spesifikasi terstruktur: tujuan, scope, batasan, kriteria sukses.",
  feature: "agent_specifier",
  buildPrompt: (ctx) => `Anda adalah agen Spesifikasi dalam tim multi-agen akademik.

[MISI] Ubah permintaan user menjadi SPESIFIKASI TEKNIS yang jadi kontrak untuk Planner & Implementer.

[PROSEDUR]
1. Tujuan: apa output akhir yang diminta (format, panjang, gaya).
2. Scope: apa yang termasuk, apa yang di-EXCLUDE.
3. Batasan: bahasa Indonesia formal, sitasi ${ctx.courseName ? "sesuai bidang" : "APA/IEEE"}, tanpa mengarang data.
4. Kriteria sukses: bagaimana output dianggap memenuhi.
5. Pertimbangkan asumsi & jawaban klarifikasi yang ada.

[OUTPUT CONTRACT] Tulis spec sebagai teks naratif terstruktur (bukan JSON) dengan heading:
## TUJUAN
## SCOPE
## BATASAN
## KRITERIA SUKSES
Maksimal 250 kata total. Padat & operasional.${buildContextSuffix(ctx)}`,

  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// PLANNER — pecah spec jadi urutan langkah
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "planner",
  label: "Perencanaan",
  description:
    "Memecah spesifikasi menjadi urutan langkah/bagian logis (outline).",
  feature: "agent_planner",
  buildPrompt: (ctx) => `Anda adalah agen Perencanaan dalam tim multi-agen akademik.

[MISI] Berdasarkan SPESIFIKASI, susun urutan LANGKAH pembuatan output. Bukan isi akhir, tapi struktur eksekusi.

[PROSEDUR]
1. Pecah spesifikasi jadi 3-8 langkah berurutan yang logis.
2. Tiap langkah: judul singkat + detail apa yang dihasilkan langkah itu.
3. Urutkan agar dependensi terpenuhi (dasar dulu, detail kemudian, penutup terakhir).

[OUTPUT CONTRACT] HANYA JSON array:
[{"order":1,"title":"...","detail":"..."},{"order":2,"title":"...","detail":"..."}]
Maks 8 langkah. Detail maks 1 kalimat per langkah.`,

  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// TASKER — pecah plan jadi task atomic
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "tasker",
  label: "Penugasasan",
  description:
    "Mengubah rencana menjadi task atomic siap-eksekusi untuk Implementer.",
  feature: "agent_tasker",
  buildPrompt: (ctx) => `Anda adalah agen Penugasasan dalam tim multi-agen akademik.

[MISI] Konversi RENCANA jadi TASK atomic yang bisa dieksekusi satu per satu oleh Implementer.

[PROSEDUR]
1. Tiap task = satu unit kerja yang menghasilkan bagian output.
2. Gabungkan langkah rencana yang terlalu kecil; pecah yang terlalu besar.
3. Tetapkan order eksekusi.

[OUTPUT CONTRACT] HANYA JSON array:
[{"order":1,"agent":"implementer","title":"...","description":"apa yang harus dihasilkan task ini, batasan panjang/konten"}]
Maks 6 task. Description operasional (Implementer bisa langsung kerjakan tanpa bertanya).`,

  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// IMPLEMENTER — eksekusi semua task, rangkai output
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "implementer",
  label: "Implementasi",
  description:
    "Mengeksekusi semua task sesuai spec & rencana, menghasilkan output final.",
  feature: "agent_implementer",
  buildPrompt: (ctx) => `Anda adalah agen Implementasi dalam tim multi-agen akademik — executor utama.

[MISI] Hasilkan OUTPUT AKHIR berkualitas universitas dengan memenuhi SPESIFIKASI dan mengeksekusi semua TASK secara runtut.

[PROSEDUR]
1. Kerjakan setiap task sesuai order. Pertahankan koherensi antar bagian.
2. Prioritaskan [KONTEKS/REFERENSI] sebagai fondasi. Kutip eksplisit bila mengutip.
3. Gunakan Bahasa Indonesia formal & metodis. Rumus sebagai teks tebal (**F=ma**).
4. Jangan mengarang data/peneliti/referensi. Bila tidak yakin, nyatakan jujur atau pakai placeholder "[perlu referensi]".
5. Sebelum finalisasi: cek semua task terjawab, tidak ada kontradiksi internal.

[OUTPUT CONTRACT] Output langsung siap pakai dalam format yang diminta spesifikasi (HTML bersih bila dokumen, narasi bila esai, langkah bila hitungan). Tanpa meta-komentar di luar konten.${buildContextSuffix(ctx)}`,
  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// REVIEWER (QUALITY) — audit output vs spec, revisi bila perlu
// ─────────────────────────────────────────────────────────────────────────────
registerAgent({
  name: "reviewer",
  label: "Kualitas",
  description:
    "Mengaudit output Implementer terhadap spesifikasi, menilai kualitas, & merevisi bila ada masalah.",
  feature: "agent_reviewer",
  buildPrompt: (ctx) => `Anda adalah agen Kualitas (Reviewer) dalam tim multi-agen akademik.

[MISI] Audit OUTPUT Implementer terhadap SPESIFIKASI awal. Pastikan kualitas akademik & kelengkapan sebelum diserahkan ke user.

[PROSEDUR]
1. Cek kelengkapan: apakah semua task/scope terpenuhi?
2. Cek akurasi: ada klaim tidak terdukung, data mengarang, atau kontradiksi?
3. Cek struktur & bahasa: runtut, formal, bebas simbol dekoratif.
4. Beri skor kualitas 0-100. Bila <75 atau ada masalah KRITIS: revisi output.

[OUTPUT CONTRACT] HANYA JSON:
{"verdict":"approve"|"revise","qualityScore":85,"issues":["..."],"strengths":["..."],"revisedOutput":"<output revisi HANYA bila verdict=revise; kosongkan bila approve>"}
revisedOutput berisi output final lengkap yang sudah diperbaiki (jika revisi). issues & strengths maks 4 item.`,
  async execute(_ctx) {
    return { output: "", summary: "" };
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// Context suffix helper — inject jurusan-aware context ke prompt agen.
// Dipakai oleh specifier & implementer (agen yang menghasilkan output final).
// ─────────────────────────────────────────────────────────────────────────────
function buildContextSuffix(ctx: SessionContext): string {
  const parts: string[] = [];

  // Persona memory — injected for all agents that use this suffix.
  if (ctx.personaMemory) {
    parts.push(ctx.personaMemory.trim());
  }

  // Profil kampus user
  if (ctx.studentProfile) {
    const p = ctx.studentProfile;
    const bits: string[] = [];
    if (p.university) bits.push(`Kampus: ${p.university}`);
    if (p.faculty) bits.push(`Fakultas: ${p.faculty}`);
    if (p.major) bits.push(`Prodi: ${p.major}`);
    if (p.semester) bits.push(`Semester: ${p.semester}`);
    if (bits.length > 0) {
      parts.push(
        `KONTEKS MAHASISWA — sesuaikan kedalaman, analogi, terminologi, dan contoh:\n` +
          bits.map((b) => `- ${b}`).join("\n")
      );
    }
  }

  // Konteks jurusan spesifik (terminologi, gaya jawaban, dll)
  if (ctx.jurusanPromptExtra) {
    parts.push(ctx.jurusanPromptExtra);
  }

  return parts.length > 0 ? "\n\n" + parts.join("\n\n") : "";
}

// ─────────────────────────────────────────────────────────────────────────────
// Parser helper — ekstrak struktur JSON dari output agen ke field context
// ─────────────────────────────────────────────────────────────────────────────
export function parseClassifierOutput(
  raw: string
): { tier: "simple" | "medium" | "complex"; reason: string } {
  const p = parseLooseJSON<{ tier?: string; reason?: string }>(raw);
  const tier = (p?.tier || "medium") as "simple" | "medium" | "complex";
  return {
    tier: ["simple", "medium", "complex"].includes(tier) ? tier : "medium",
    reason: p?.reason || "",
  };
}

export function parseClarifierOutput(raw: string): {
  needsClarification: boolean;
  questions: string[];
  assumptions: string[];
} {
  const p = parseLooseJSON<{
    needsClarification?: boolean;
    questions?: string[];
    assumptions?: string[];
  }>(raw);
  return {
    needsClarification: Boolean(p?.needsClarification),
    questions: Array.isArray(p?.questions) ? p!.questions!.slice(0, 3) : [],
    assumptions: Array.isArray(p?.assumptions) ? p!.assumptions! : [],
  };
}

export function parsePlannerOutput(
  raw: string
): { order: number; title: string; detail: string }[] {
  const p = parseLooseJSON<
    { order?: number; title?: string; detail?: string }[]
  >(raw);
  if (!Array.isArray(p)) return [];
  return p.slice(0, 8).map((item, i) => ({
    order: typeof item.order === "number" ? item.order : i + 1,
    title: String(item.title || `Langkah ${i + 1}`),
    detail: String(item.detail || ""),
  }));
}

export function parseTaskerOutput(
  raw: string
): {
  order: number;
  agent: AgentName;
  title: string;
  description: string;
}[] {
  const p = parseLooseJSON<
    { order?: number; agent?: string; title?: string; description?: string }[]
  >(raw);
  if (!Array.isArray(p)) return [];
  return p.slice(0, 6).map((item, i) => ({
    order: typeof item.order === "number" ? item.order : i + 1,
    agent: (String(item.agent || "implementer")) as AgentName,
    title: String(item.title || `Task ${i + 1}`),
    description: String(item.description || ""),
  }));
}

export function parseReviewerOutput(raw: string): {
  verdict: "approve" | "revise";
  qualityScore: number;
  issues: string[];
  strengths: string[];
  revisedOutput?: string;
} {
  const p = parseLooseJSON<{
    verdict?: string;
    qualityScore?: number;
    issues?: string[];
    strengths?: string[];
    revisedOutput?: string;
  }>(raw);
  const verdict = p?.verdict === "revise" ? "revise" : "approve";
  return {
    verdict,
    qualityScore: Math.min(
      100,
      Math.max(0, Math.round(Number(p?.qualityScore) || 0))
    ),
    issues: Array.isArray(p?.issues) ? p!.issues!.slice(0, 4) : [],
    strengths: Array.isArray(p?.strengths) ? p!.strengths!.slice(0, 4) : [],
    revisedOutput: p?.revisedOutput?.trim() || undefined,
  };
}
