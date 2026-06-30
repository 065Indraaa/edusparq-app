import { connectDB } from "./db/mongodb";
import { User } from "./db/models/User";
import { KRS } from "./db/models/KRS";
import { Grade } from "./db/models/Grade";
import { Deadline } from "./db/models/Deadline";

/**
 * Real student data aggregator.
 *
 * Pulls together everything the AI agent needs to understand a student's actual
 * situation: profile (campus/major/semester), current KRS (active courses),
 * academic performance (IPS per semester + cumulative IPK), upcoming deadlines,
 * and graduation progress. Every field degrades gracefully to a safe empty
 * value so the agent never sees fabricated numbers when data is missing.
 */

export interface StudentCourse {
  name: string;
  sks: number;
  schedule: string;
  lecturer?: string;
}

export interface GpaSummary {
  /** Current semester GPA (Indeks Prestasi Semester). */
  ips: number | null;
  /** Cumulative GPA (Indeks Prestasi Kumulatif). */
  ipk: number | null;
  /** Total graded SKS across all semesters. */
  totalSks: number;
  /** Per-semester breakdown for charts/history. */
  perSemester: Array<{ semester: string; ips: number | null; sks: number }>;
}

export interface UpcomingDeadline {
  title: string;
  dueDate: string;
  priority: "high" | "medium" | "low";
}

export interface GraduationProgress {
  completedSks: number;
  requiredSks: number;
  percentage: number;
}

export interface StudentContext {
  university: string;
  faculty: string;
  major: string;
  semester: number;
  activeCourses: StudentCourse[];
  gpa: GpaSummary;
  upcomingDeadlines: UpcomingDeadline[];
  progressToGraduation: GraduationProgress;
}

const DEFAULT_REQUIRED_SKS = 144; // common S1 total in Indonesia

function priorityFor(daysLeft: number): UpcomingDeadline["priority"] {
  if (daysLeft <= 3) return "high";
  if (daysLeft <= 7) return "medium";
  return "low";
}

/**
 * Aggregate the full student context for a user. Safe to call with any userId;
 * returns a zeroed-out context when the user has imported nothing yet.
 */
export async function getStudentContext(
  userId: string
): Promise<StudentContext> {
  await connectDB();

  const [user, activeKrs, grades, deadlines] = await Promise.all([
    User.findById(userId)
      .select("universitas fakultas prodi semester")
      .lean() as Promise<{
      universitas?: string;
      fakultas?: string;
      prodi?: string;
      semester?: number;
    } | null>,
    KRS.findOne({ userId, status: "active" })
      .sort({ updatedAt: -1 })
      .lean() as Promise<{
      courses?: Array<{
        courseName?: string;
        sks?: number;
        schedule?: string;
        lecturer?: string;
      }>;
    } | null>,
    Grade.find({ userId }).lean() as Promise<
      Array<{
        semester?: string;
        gradePoint?: number;
        sks?: number;
        courseName?: string;
      }>
    >,
    Deadline.find({
      userId,
      status: "pending",
      dueDate: { $gte: todayStr() },
    })
      .sort({ dueDate: 1 })
      .limit(10)
      .lean() as Promise<
      Array<{
        title?: string;
        dueDate?: string;
        courseName?: string;
      }>
    >,
  ]);

  const activeCourses: StudentCourse[] = (activeKrs?.courses ?? []).map((c) => ({
    name: c.courseName || "",
    sks: Number(c.sks) || 0,
    schedule: c.schedule || "",
    lecturer: c.lecturer || "",
  }));

  const gpa = computeGpa(grades);

  const upcomingDeadlines: UpcomingDeadline[] = deadlines.map((d) => ({
    title: d.title || "",
    dueDate: d.dueDate || "",
    priority: priorityFor(daysUntil(d.dueDate || "")),
  }));

  const progressToGraduation = computeProgress(grades);

  return {
    university: user?.universitas || "",
    faculty: user?.fakultas || "",
    major: user?.prodi || "",
    semester: Number(user?.semester) || 1,
    activeCourses,
    gpa,
    upcomingDeadlines,
    progressToGraduation,
  };
}

/**
 * Compute IPS (per-semester), IPK (cumulative), and total graded SKS from a set
 * of Grade documents. Uses the Indonesian A/AB/B/BC/C/D/E scale points already
 * stored on each Grade doc. Returns null IPK/IPS when no graded credits exist.
 */
export function computeGpa(
  grades: Array<{
    semester?: string;
    gradePoint?: number;
    sks?: number;
    courseName?: string;
  }>
): GpaSummary {
  let totalQuality = 0;
  let totalCredits = 0;
  const bySemester = new Map<string, { quality: number; credits: number }>();

  for (const g of grades) {
    const point = Number(g.gradePoint);
    const sks = Number(g.sks) || 0;
    if (!Number.isFinite(point) || sks <= 0) continue;

    totalQuality += point * sks;
    totalCredits += sks;

    const sem = g.semester || "Lainnya";
    const bucket = bySemester.get(sem) || { quality: 0, credits: 0 };
    bucket.quality += point * sks;
    bucket.credits += sks;
    bySemester.set(sem, bucket);
  }

  const ipk = totalCredits > 0 ? round2(totalQuality / totalCredits) : null;

  const perSemester = Array.from(bySemester.entries())
    .map(([semester, b]) => ({
      semester,
      sks: b.credits,
      ips: b.credits > 0 ? round2(b.quality / b.credits) : null,
    }))
    .sort((a, b) => a.semester.localeCompare(b.semester));

  // IPS = latest semester with grades. Prefer the last by sort order.
  const ips =
    perSemester.length > 0 ? perSemester[perSemester.length - 1].ips : null;

  return { ips, ipk, totalSks: totalCredits, perSemester };
}

function computeProgress(
  grades: Array<{ sks?: number; gradePoint?: number }>
): GraduationProgress {
  const completedSks = grades.reduce((sum, g) => {
    const point = Number(g.gradePoint);
    const sks = Number(g.sks) || 0;
    // Only count passed credits (grade point > 0, i.e. not E).
    if (Number.isFinite(point) && point > 0) return sum + sks;
    return sum;
  }, 0);

  const requiredSks = DEFAULT_REQUIRED_SKS;
  const percentage =
    requiredSks > 0
      ? Math.min(Math.round((completedSks / requiredSks) * 1000) / 10, 100)
      : 0;

  return { completedSks, requiredSks, percentage };
}

// ─── date helpers (string-based to avoid TZ surprises) ──────────────────────

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function daysUntil(dateStr: string): number {
  if (!dateStr) return Number.MAX_SAFE_INTEGER;
  const target = new Date(`${dateStr}T00:00:00`);
  if (isNaN(target.getTime())) return Number.MAX_SAFE_INTEGER;
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
