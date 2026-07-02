/**
 * Prompts for AI-powered Career Center features.
 *
 * Designed to be used with src/lib/ai-client.ts `complete()`.
 */

import type { StudentContext } from "./student-profile";

export interface SkillGapInput {
  targetRole: string;
  userSkills: string[];
  major: string;
  semester: number;
  gpa?: number | null;
}

export function buildSkillGapSystemPrompt(): string {
  return `Kamu adalah Career Advisor AI untuk mahasiswa Indonesia. Tugasmu menganalisis skill gap antara profil mahasiswa dan target karir yang dipilih.

Gunakan data pasar kerja 2026 Indonesia yang sudah kamu ketahui. Berikan output dalam format JSON berikut:
{
  "summary": "ringkasan singkat 2-3 kalimat",
  "matchedSkills": ["skill yang sudah dimiliki user dan relevan"],
  "missingSkills": ["skill penting yang belum dimiliki"],
  "suggestedCertifications": ["sertifikasi/kursus yang direkomendasikan"],
  "learningPath": ["langkah belajar 1", "langkah belajar 2", "langkah belajar 3"],
  "timelineMonths": 3,
  "confidence": "high" // high | medium | low
}

Panduan:
- matchedSkills: skill yang user miliki dan juga dibutuhkan target role.
- missingSkills: skill yang umumnya wajib untuk target role tapi belum ada di user.
- suggestedCertifications: sertifikasi/layanan gratis atau terjangkau (Google, Coursera, Dicoding, freeCodeCamp, AWS, Meta, dll).
- learningPath: 3-5 langkah konkret yang bisa dikerjakan.
- timelineMonths: estimasi waktu belajar untuk menutup gap utama (1-12 bulan).
- confidence: high jika data role jelas, medium/low jika role tidak umum.

Balas hanya dengan JSON valid tanpa markdown code block.`;
}

export function buildSkillGapUserPrompt(input: SkillGapInput): string {
  const gpaText = input.gpa ? `IPK: ${input.gpa}\n` : "";
  return `Target karir: ${input.targetRole}
Jurusan: ${input.major || "Belum diisi"}
Semester: ${input.semester || 1}
${gpaText}Skill yang sudah dimiliki: ${input.userSkills.length > 0 ? input.userSkills.join(", ") : "Belum ada data"}

Analisis skill gap saya dan berikan rekomendasi belajar.`;
}

export interface CvBuilderInput {
  name: string;
  email: string;
  phone?: string;
  major: string;
  semester: number;
  university?: string;
  gpa?: number | null;
  skills: string[];
  experiences: string[];
  projects: string[];
  organizations: string[];
  targetRole?: string;
}

export function buildCvSystemPrompt(): string {
  return `Kamu adalah CV Writer AI untuk mahasiswa Indonesia. Tugasmu membuat CV ATS-friendly dalam format Markdown berdasarkan data yang diberikan user.

Aturan:
- Gunakan Bahasa Indonesia yang profesional.
- Struktur: Profil Singkat, Pendidikan, Skill, Pengalaman/Proyek, Organisasi (jika ada).
- Maksimal 1 halaman A4 (singkat dan padat).
- Gunakan bullet points untuk pencapaian/skill.
- Jangan membuat data palsu. Jika data kosong, abaikan bagian tersebut.
- Tambahkan tips perbaikan singkat di akhir sebagai komentar (setelah garis pemisah ---).

Output hanya berupa Markdown CV + tips. Tidak perlu json.`;
}

export function buildCvUserPrompt(input: CvBuilderInput): string {
  return `Buatkan CV ATS-friendly untuk saya:

Nama: ${input.name || "Belum diisi"}
Email: ${input.email || "Belum diisi"}
${input.phone ? `Telepon: ${input.phone}\n` : ""}Universitas: ${input.university || "Belum diisi"}
Jurusan: ${input.major || "Belum diisi"}
Semester: ${input.semester || 1}
${input.gpa ? `IPK: ${input.gpa}\n` : ""}Target karir: ${input.targetRole || "Belum ditentukan"}

Skill: ${input.skills.length > 0 ? input.skills.join(", ") : "Belum ada data"}

Pengalaman/Proyek:
${input.projects.length > 0 ? input.projects.map((p) => `- ${p}`).join("\n") : "Belum ada data"}

Organisasi/Kepanitiaan:
${input.organizations.length > 0 ? input.organizations.map((o) => `- ${o}`).join("\n") : "Belum ada data"}

Pengalaman kerja/magang:
${input.experiences.length > 0 ? input.experiences.map((e) => `- ${e}`).join("\n") : "Belum ada data"}`;
}

export type InterviewType = "behavioral" | "technical" | "case-study";

export interface InterviewInput {
  targetRole: string;
  interviewType: InterviewType;
  userBackground?: string;
}

export function buildInterviewSystemPrompt(): string {
  return `Kamu adalah Interview Coach AI untuk mahasiswa Indonesia. Tugasmu membuat pertanyaan wawancara yang relevan dengan target role dan jenis wawancara yang dipilih user.

Output dalam format JSON:
{
  "questions": [
    {
      "id": 1,
      "question": "teks pertanyaan",
      "type": "behavioral|technical|case-study",
      "intent": "apa yang dievaluasi dari pertanyaan ini",
      "tips": "tips singkat cara menjawab"
    }
  ]
}

Buat 5 pertanyaan. Pertanyaan harus realistis untuk pasar kerja Indonesia 2026. Balas hanya dengan JSON valid tanpa markdown code block.`;
}

export function buildInterviewUserPrompt(input: InterviewInput): string {
  return `Target role: ${input.targetRole}
Jenis wawancara: ${input.interviewType}
${input.userBackground ? `Latar belakang saya: ${input.userBackground}` : ""}

Buatkan 5 pertanyaan wawancara beserta tips menjawabnya.`;
}

export function buildInterviewFeedbackSystemPrompt(): string {
  return `Kamu adalah Interview Coach AI. Evaluasi jawaban wawancara user dan berikan feedback konstruktif.

Output dalam format JSON:
{
  "score": 7,
  "strengths": ["poin kuat 1", "poin kuat 2"],
  "improvements": ["saran perbaikan 1", "saran perbaikan 2"],
  "modelAnswer": "contoh jawaban yang lebih baik singkat",
  "encouragement": "kata motivasi singkat"
}

Score 1-10. Berikan feedback dalam Bahasa Indonesia. Balas hanya dengan JSON valid tanpa markdown code block.`;
}

export function buildInterviewFeedbackUserPrompt(
  question: string,
  answer: string
): string {
  return `Pertanyaan wawancara:\n${question}\n\nJawaban saya:\n${answer}\n\nEvaluasi jawaban saya.`;
}

/**
 * Build a rich user context string for career AI prompts.
 */
export function buildCareerContextString(context: StudentContext): string {
  const courses = context.activeCourses.map((c) => c.name).join(", ") || "Belum ada data";
  return `Konteks mahasiswa:
- Universitas: ${context.university || "Belum diisi"}
- Fakultas: ${context.faculty || "Belum diisi"}
- Jurusan: ${context.major || "Belum diisi"}
- Semester: ${context.semester || 1}
- IPK: ${context.gpa.ipk ?? "Belum ada data"}
- SKS total: ${context.gpa.totalSks || 0}
- Mata kuliah aktif: ${courses}`;
}
