/**
 * Indonesian academic GPA (IPK) helpers.
 *
 * Grade points follow the common 4.0 scale used across Indonesian universities.
 * Courses without a grade (empty string) or without credits are excluded from
 * the computation so the IPK only reflects real, graded coursework.
 */

export const GRADE_POINTS: Record<string, number> = {
  A: 4.0,
  "A-": 3.7,
  "B+": 3.3,
  B: 3.0,
  "B-": 2.7,
  "C+": 2.3,
  C: 2.0,
  "C-": 1.7,
  D: 1.0,
  E: 0.0,
};

export interface GradedCourse {
  credits?: number;
  grade?: string;
}

/** Total credits (SKS) across all courses, regardless of grade. */
export function totalSks(courses: GradedCourse[]): number {
  return courses.reduce((sum, c) => sum + (Number(c.credits) || 0), 0);
}

/**
 * Weighted GPA (IPK) from graded courses only.
 * Returns null when there is no graded course with credits yet — callers should
 * render an honest empty state instead of a fabricated number.
 */
export function computeIpk(courses: GradedCourse[]): number | null {
  let qualityPoints = 0;
  let gradedCredits = 0;

  for (const c of courses) {
    const credits = Number(c.credits) || 0;
    const grade = (c.grade || "").trim();
    if (!credits || !(grade in GRADE_POINTS)) continue;
    qualityPoints += credits * GRADE_POINTS[grade];
    gradedCredits += credits;
  }

  if (gradedCredits === 0) return null;
  return Math.round((qualityPoints / gradedCredits) * 100) / 100;
}
