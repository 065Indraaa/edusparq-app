export interface DeadlineContext {
  title: string;
  courseName: string;
  dueDate: string;
  dueTime?: string;
  daysLeft: number;
}

export interface ScheduleItemContext {
  courseName: string;
  jamMulai: string;
  jamSelesai: string;
  ruang?: string;
  dosen?: string;
}

export interface CourseContext {
  name: string;
  sks?: number;
  lecturer?: string;
}

export interface WorkspacePromptContext {
  userName?: string;
  deadlines: DeadlineContext[];
  todaySchedule: ScheduleItemContext[];
  courses: CourseContext[];
}

function formatDeadline(d: DeadlineContext): string {
  const time = d.dueTime && d.dueTime !== "23:59" ? ` ${d.dueTime}` : "";
  return `- ${d.title} (${d.courseName}) — ${d.dueDate}${time}, ${d.daysLeft} hari lagi`;
}

function formatScheduleItem(s: ScheduleItemContext): string {
  const extra = [s.ruang, s.dosen].filter(Boolean).join(" | ");
  return `- ${s.jamMulai}-${s.jamSelesai}: ${s.courseName}${extra ? ` (${extra})` : ""}`;
}

function formatCourse(c: CourseContext): string {
  const extra = [c.sks ? `${c.sks} SKS` : "", c.lecturer].filter(Boolean).join(", ");
  return `- ${c.name}${extra ? ` (${extra})` : ""}`;
}

export function buildWorkspaceSystemPrompt(ctx: WorkspacePromptContext): string {
  const parts: string[] = [];

  parts.push(
    "Kamu adalah asisten akademik pribadi mahasiswa Indonesia bernama EduSparq Workspace Assistant."
  );
  parts.push(
    "Tugasmu membantu mahasiswa merencanakan hari ini, menjawab pertanyaan akademik, dan mengingatkan tugas/jadwal penting."
  );
  parts.push("Jawablah dengan Bahasa Indonesia yang natural, ringkas, dan membantu.");
  parts.push("Jika ada tugas mendesak, sebutkan dan sarankan prioritas.");
  parts.push("Jika tidak tahu jawabannya, katakan dengan jujur dan jangan mengarang fakta.");

  if (ctx.userName) {
    parts.push(`\nNama pengguna: ${ctx.userName}`);
  }

  if (ctx.courses.length > 0) {
    parts.push("\nMata kuliah aktif:");
    parts.push(ctx.courses.map(formatCourse).join("\n"));
  }

  if (ctx.deadlines.length > 0) {
    parts.push("\nTugas/deadline terdekat:");
    parts.push(ctx.deadlines.map(formatDeadline).join("\n"));
  }

  if (ctx.todaySchedule.length > 0) {
    parts.push("\nJadwal kuliah hari ini:");
    parts.push(ctx.todaySchedule.map(formatScheduleItem).join("\n"));
  } else {
    parts.push("\nHari ini tidak ada jadwal kuliah.");
  }

  parts.push(
    "\nGunakan konteks di atas untuk menjawab pertanyaan pengguna. Jangan meminta informasi yang sudah tersedia kecuali perlu klarifikasi."
  );

  return parts.join("\n");
}
