/**
 * Jurusan-Aware Context Builder — mengambil profil user dari DB dan menambahkan
 * konteks jurusan spesifik ke StudentContext untuk sistem prompt AI.
 *
 * Dipakai oleh: chat route, orchestrator, dan semua AI endpoint yang membutuhkan
 * personalisasi berbasis jurusan.
 */

import { connectDB } from "../lib/db/mongodb";
import { User } from "../lib/db/models/User";
import { Course } from "../lib/db/models/Course";
import { matchJurusan } from "../lib/jurusan-catalog";
import type { StudentContext } from "../lib/ai-prompts";

/**
 * Build full StudentContext from user ID.
 * Mengambil universitas, fakultas, prodi dari User model, lalu match ke
 * jurusan catalog untuk mendapatkan prompt context tambahan.
 *
 * Parameter extraJurusanPrompt: blok string tambahan yang akan di-append
 * ke StudentContext.sourceBlock (bukan ke jurusan prompt, agar tidak tumpuk).
 */
export async function buildJurusanAwareContext(
  userId: string,
  options?: {
    courseName?: string;
    sourceBlock?: string;
    /** Sertakan daftar nama mata kuliah aktif user. */
    includeCourses?: boolean;
  }
): Promise<{
  studentContext: StudentContext;
  jurusanPromptExtra: string;
}> {
  await connectDB();
  const user = await User.findById(userId).lean();

  if (!user) {
    return {
      studentContext: {},
      jurusanPromptExtra: "",
    };
  }

  // Build base StudentContext from user profile
  const courses: string[] = [];

  if (options?.includeCourses) {
    const userCourses = await Course.find({ userId: user._id })
      .select("name")
      .limit(20)
      .lean();
    userCourses.forEach((c: any) => {
      if (c.name) courses.push(c.name);
    });
  }

  if (options?.courseName && !courses.includes(options.courseName)) {
    courses.unshift(options.courseName);
  }

  const studentContext: StudentContext = {
    name: user.name || undefined,
    university: user.universitas || undefined,
    faculty: user.fakultas || undefined,
    major: user.prodi || undefined,
    semester: typeof user.semester === "number" && user.semester > 0 ? user.semester : undefined,
    courses: courses.length > 0 ? courses : undefined,
    sourceBlock: options?.sourceBlock,
  };

  // Match jurusan and get extra prompt context
  let jurusanPromptExtra = "";
  const jurusan = matchJurusan(user.prodi || "");
  if (jurusan) {
    jurusanPromptExtra = jurusan.promptContext;
  }

  return { studentContext, jurusanPromptExtra };
}

/**
 * Quick version — hanya mengambil jurusan prompt string untuk user tertentu.
 * Tidak fetch courses (lebih hemat DB call).
 */
export async function getJurusanPromptForUser(userId: string): Promise<string> {
  await connectDB();
  const user = await User.findById(userId).select("prodi").lean();
  if (!user?.prodi) return "";
  const jurusan = matchJurusan(user.prodi);
  return jurusan?.promptContext ?? "";
}
