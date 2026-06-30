import { Types } from "mongoose";
import { connectDB } from "./db/mongodb";
import { Course } from "./db/models/Course";
import { KRS } from "./db/models/KRS";
import { User } from "./db/models/User";

/**
 * KRS (Kartu Rencana Studi) parsing & import.
 *
 * Indonesian students paste KRS text from many sources (SIAKAD, SIMAK, campus
 * portals, screenshots OCR'd to text). Formats vary wildly, so the text parser
 * is intentionally best-effort: it scans each line for the recognizable tokens
 * (course name, SKS count, day/time schedule, lecturer) and tolerates extra
 * noise (codes, room numbers, footer text). Anything it cannot parse is dropped
 * rather than producing a garbage entry.
 */

export type SemesterType = "Ganjil" | "Genap" | "Pendek";

export interface ParsedKRSCourse {
  courseName: string;
  sks: number;
  lecturer: string;
  schedule: string;
  /** Set during import when an existing Course doc is matched. */
  courseId?: string;
}

export interface ParsedKRS {
  academicYear: string;
  semester: SemesterType;
  courses: ParsedKRSCourse[];
  /** Non-fatal notes about what was skipped/ambiguous — surfaced in the UI. */
  warnings: string[];
}

// ─── helpers ────────────────────────────────────────────────────────────────

const DAY_PATTERNS =
  /(senin|selasa|rabu|kamis|jumat|jum'at|sabtu|minggu|sen|sel|rab|kam|jum|sab|min)/i;

const TIME_PATTERN = /\b(\d{1,2})[:.](\d{2})\s*(?:[-–—]\s*(\d{1,2})[:.](\d{2}))?/;

/** Matches "2024/2025" or "2024-2025". */
const ACADEMIC_YEAR_PATTERN = /(\d{4})\s*[/\-]\s*(\d{4})/;

/** Strip a leading numeric/section code like "1.", "01", "A1", "MK001" */
function stripLeadingCode(text: string): string {
  return text.replace(/^\s*(\d+[\s.)\-]|[A-Z]{1,3}\d+[\s.\-])/, "").trim();
}

function detectSemesterType(text: string): SemesterType | null {
  const t = text.toLowerCase();
  if (/\bganjil\b|gasal|semester\s*1\b|\b1\s*ganjil\b/.test(t)) return "Ganjil";
  if (/\bgenap\b|semester\s*2\b|\b2\s*genap\b/.test(t)) return "Genap";
  if (/\bpendek\b|semester\s*pendek|sp\b/.test(t)) return "Pendek";
  return null;
}

/**
 * Pull SKS out of a line. Accepts "3 SKS", "3 sks", "(3)", or a trailing
 * standalone integer between 1 and 8. Returns null when nothing confident found.
 */
function extractSks(line: string): number | null {
  const explicit = line.match(/(\d+)\s*sks/i);
  if (explicit) {
    const n = parseInt(explicit[1], 10);
    if (n >= 1 && n <= 8) return n;
  }
  const paren = line.match(/\(\s*(\d{1,2})\s*\)/);
  if (paren) {
    const n = parseInt(paren[1], 10);
    if (n >= 1 && n <= 8) return n;
  }
  return null;
}

/** Extract a human-readable schedule fragment (day + time) if present. */
function extractSchedule(line: string): string {
  const dayMatch = line.match(DAY_PATTERNS);
  const timeMatch = line.match(TIME_PATTERN);
  const parts: string[] = [];
  if (dayMatch) {
    // normalize capitalization of the day token
    const raw = dayMatch[0];
    parts.push(raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase());
  }
  if (timeMatch) {
    parts.push(timeMatch[0].trim());
  }
  return parts.join(" ").trim();
}

/**
 * Best-effort course-name extraction. Removes SKS tokens, schedules, and codes
 * so what remains reads as a clean course name. Falls back to the stripped line
 * when no clean token boundary is found.
 */
function extractCourseName(line: string, sks: number | null): string {
  let name = line;
  // drop SKS marker
  name = name.replace(/\(\s*\d{1,2}\s*\)/, "");
  name = name.replace(/\d+\s*sks/i, "");
  // drop schedule tokens
  name = name.replace(DAY_PATTERNS, "");
  name = name.replace(TIME_PATTERN, "");
  // drop leading code
  name = stripLeadingCode(name);
  // drop trailing leftover separators / room codes like "B.2.123"
  name = name.replace(/[|,;].*$/, "").trim();
  // collapse whitespace
  name = name.replace(/\s{2,}/g, " ").trim();
  // strip a stray leading course code token like "IF184101"
  name = name.replace(/^[A-Z]{1,4}\d{3,6}\s*/i, "").trim();
  if (!name) {
    // fallback: use original minus sks marker
    name = line.replace(/\d+\s*sks/i, "").replace(/[|,;].*$/, "").trim();
  }
  return name;
}

/**
 * Guess a lecturer name: a trailing "Dr."/"Prof."/"Nama, S.T." style token, or a
 * run of capitalized words near the end of the line. Best-effort only.
 */
function extractLecturer(line: string): string {
  // Common academic titles — capture the whole trailing name chunk.
  const titleMatch = line.match(
    /((?:Dr\.|Prof\.|Drs\.|Ir\.|Mr\.|S\.T\.|S\.Kom\.|S\.Si\.|S\.Sos\.|S\.Pd\.|M\.T\.|M\.Kom\.|M\.Si\.|M\.Sc\.|M\.Eng\.|M\.M\.|M\.Pd\.|Ph\.D\.)\s*[A-Z][\w.]*(?:\s+[A-Z][\w.]*){0,3})/
  );
  if (titleMatch) return titleMatch[1].trim();

  // Fallback: a run of 2+ capitalized words at the end of the line.
  const capRun = line.match(/([A-Z][a-zA-Z.]+(?:\s+[A-Z][a-zA-Z.]+){1,3})\s*$/);
  if (capRun && capRun[1].length > 4) return capRun[1].trim();
  return "";
}

// ─── public parse API ───────────────────────────────────────────────────────

const NOISE_LINE =
  /^\s*(total|jumlah|semester|tahun\s*ajaran|kartu\s*rencana|krs|halaman|hal|cetak|dicetak|nama\s*:|nim\s*:|npm\s*:|program\s*studi|fakultas|universitas|copyright|©|page|of\s+\d)\b/i;

/**
 * Parse pasted KRS text into a structured ParsedKRS. Detects the academic year
 * and semester type from header lines; each remaining non-noise line that
 * yields a course name (and ideally SKS) becomes a course entry.
 */
export function parseKRSFromText(text: string): ParsedKRS {
  const raw = (text || "").replace(/\r\n/g, "\n");
  const lines = raw.split("\n");

  let academicYear = "";
  let semester: SemesterType = "Ganjil";
  const courses: ParsedKRSCourse[] = [];
  const warnings: string[] = [];

  for (const originalLine of lines) {
    const line = originalLine.trim();
    if (!line) continue;

    const yearMatch = line.match(ACADEMIC_YEAR_PATTERN);
    if (yearMatch && !academicYear) {
      academicYear = `${yearMatch[1]}/${yearMatch[2]}`;
    }
    const sem = detectSemesterType(line);
    if (sem && /semester|tahun|ajaran|ganjil|genap|pendek/i.test(line)) {
      semester = sem;
    }

    if (NOISE_LINE.test(line)) continue;
    // Skip lines that are clearly just a code / single token.
    if (line.length < 4) continue;

    const sks = extractSks(line);
    const courseName = extractCourseName(line, sks);
    if (!courseName || courseName.length < 3) continue;
    // Avoid treating header-ish lines as courses.
    if (/^(semester|tahun|ajaran|nim|nama)\s*[:\-]/i.test(courseName)) continue;

    const schedule = extractSchedule(line);
    const lecturer = extractLecturer(line);

    courses.push({
      courseName,
      sks: sks ?? 3,
      lecturer,
      schedule,
    });

    if (sks === null) {
      warnings.push(`SKS tidak terdeteksi untuk "${courseName}", diisi 3 secara default.`);
    }
  }

  // Default academic year to the current one when nothing was detected.
  if (!academicYear) {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    // Indonesian academic year rolls in August: before Aug = previous/this.
    const start = month < 7 ? year - 1 : year;
    academicYear = `${start}/${start + 1}`;
    warnings.push("Tahun ajaran tidak terdeteksi, memakai periode berjalan.");
  }

  return { academicYear, semester, courses, warnings };
}

/**
 * Parse structured KRS data (e.g. POSTed JSON). Tolerates field-name variants
 * commonly produced by different campus systems and manual entry.
 */
export function parseKRSFromJSON(data: any): ParsedKRS {
  const warnings: string[] = [];
  const academicYear: string =
    (data?.academicYear || data?.academic_year || data?.tahunAjaran || data?.tahun || "")
      .toString()
      .trim() || defaultAcademicYear();

  const rawSemester: string = (
    data?.semester ||
    data?.semesterType ||
    data?.semester_type ||
    data?.periode ||
    ""
  )
    .toString()
    .trim();
  const semester: SemesterType = normalizeSemester(rawSemester) ?? "Ganjil";

  const rawCourses = Array.isArray(data?.courses)
    ? data.courses
    : Array.isArray(data?.mataKuliah)
    ? data.mataKuliah
    : Array.isArray(data?.matkul)
    ? data.matkul
    : [];

  const courses: ParsedKRSCourse[] = rawCourses
    .map((c: any) => normalizeJsonCourse(c, warnings))
    .filter((c: ParsedKRSCourse) => c.courseName.length > 0);

  return { academicYear, semester, courses, warnings };
}

function defaultAcademicYear(): string {
  const now = new Date();
  const year = now.getFullYear();
  const start = now.getMonth() < 7 ? year - 1 : year;
  return `${start}/${start + 1}`;
}

function normalizeSemester(value: string): SemesterType | null {
  if (!value) return null;
  const t = value.toLowerCase();
  if (t.includes("ganjil") || t.includes("gasal")) return "Ganjil";
  if (t.includes("genap")) return "Genap";
  if (t.includes("pendek")) return "Pendek";
  return null;
}

function normalizeJsonCourse(c: any, warnings: string[]): ParsedKRSCourse {
  const courseName = (
    c?.courseName ||
    c?.course_name ||
    c?.name ||
    c?.nama ||
    c?.namaMatkul ||
    c?.mataKuliah ||
    c?.matkul ||
    ""
  )
    .toString()
    .trim();

  const sksRaw = c?.sks ?? c?.credits ?? c?.credit ?? c?.sksTotal;
  const sks = Number(sksRaw);
  const sksFinal = Number.isFinite(sks) && sks > 0 ? sks : 3;
  if (!Number.isFinite(sks) || sks <= 0) {
    warnings.push(`SKS tidak valid untuk "${courseName}", diisi 3 secara default.`);
  }

  const lecturer = (
    c?.lecturer ||
    c?.dosen ||
    c?.pengajar ||
    c?.instructor ||
    ""
  )
    .toString()
    .trim();

  const schedule = (c?.schedule || c?.jadwal || c?.waktu || c?.ruang || "")
    .toString()
    .trim();

  const courseId = c?.courseId || c?.course_id || undefined;

  return { courseName, sks: sksFinal, lecturer, schedule, courseId };
}

// ─── import ─────────────────────────────────────────────────────────────────

export interface ImportResult {
  krsId: string;
  createdCourses: number;
  linkedCourses: number;
  totalCourses: number;
}

/**
 * Persist a parsed KRS: for each course, match an existing Course doc for the
 * user by name (case-insensitive); create one if none exists. Then upsert the
 * KRS document for the (academicYear, semester) period and archive any other
 * active KRS for the same user so only one period is "active" at a time.
 *
 * @param userId  The authenticated user's id (string).
 * @param parsed  Output of parseKRSFromText / parseKRSFromJSON.
 */
export async function importKRS(
  userId: string,
  parsed: ParsedKRS
): Promise<ImportResult> {
  if (!parsed?.courses?.length) {
    throw new Error("Tidak ada mata kuliah yang bisa diimpor.");
  }

  await connectDB();

  // Resolve the user's numeric semester so imported Course docs slot into the
  // existing "Semester N" convention used by autofill/deadlines.
  const user = (await User.findById(userId).select("semester").lean()) as {
    semester?: number;
  } | null;
  const semesterLabel = `Semester ${Math.min(Math.max(Number(user?.semester) || 1), 1)}`;
  const periodLabel = `${parsed.academicYear} ${parsed.semester}`;

  let createdCourses = 0;
  let linkedCourses = 0;

  const krsCourses: Array<{
    courseId?: Types.ObjectId;
    courseName: string;
    sks: number;
    lecturer: string;
    schedule: string;
  }> = [];

  for (const pc of parsed.courses) {
    // Match an existing Course for this user by name (case-insensitive).
    const existing = await Course.findOne({
      userId,
      name: { $regex: `^${escapeRegex(pc.courseName)}$`, $options: "i" },
    });

    let courseRef = existing;
    if (!courseRef) {
      courseRef = await Course.create({
        userId,
        name: pc.courseName,
        credits: pc.sks || 3,
        semester: semesterLabel,
        instructor: pc.lecturer || "",
      });
      createdCourses++;
    } else {
      linkedCourses++;
      // keep credits/instructor fresh from the KRS if they were empty
      let dirty = false;
      if (!courseRef.credits && pc.sks) {
        courseRef.credits = pc.sks;
        dirty = true;
      }
      if (!courseRef.instructor && pc.lecturer) {
        courseRef.instructor = pc.lecturer;
        dirty = true;
      }
      if (dirty) await courseRef.save();
    }

    krsCourses.push({
      courseId: courseRef._id,
      courseName: pc.courseName,
      sks: pc.sks || 3,
      lecturer: pc.lecturer || "",
      schedule: pc.schedule || "",
    });
  }

  // Archive other active KRS periods so only the latest import is "active".
  await KRS.updateMany({ userId, status: "active" }, { $set: { status: "archived" } });

  // Upsert this period's KRS (unique index on userId+year+semester).
  const krs = await KRS.findOneAndUpdate(
    { userId, academicYear: parsed.academicYear, semester: parsed.semester },
    {
      $set: {
        userId,
        academicYear: parsed.academicYear,
        semester: parsed.semester,
        courses: krsCourses,
        status: "active",
        updatedAt: new Date(),
      },
    },
    { upsert: true, new: true }
  );

  // Stash the period label on the KRS for quick display (non-schema field via
  // lean is fine; here we keep the doc).
  void periodLabel;

  return {
    krsId: (krs._id as Types.ObjectId).toString(),
    createdCourses,
    linkedCourses,
    totalCourses: krsCourses.length,
  };
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
