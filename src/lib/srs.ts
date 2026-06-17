/**
 * Spaced Repetition engine — a clean SM-2 implementation.
 *
 * Rating scale (Anki-like, simplified to 4 buttons):
 *   0 = Again (forgot)   -> reset reps to 0, interval short, ease -0.2
 *   1 = Hard             -> interval * 1.2, ease -0.15
 *   2 = Good             -> standard SM-2 growth, ease unchanged
 *   3 = Easy             -> interval * 1.3 * ease, ease +0.15
 *
 * Ease is clamped to a minimum of 1.3. The function is pure: given the current
 * SRS state + a rating, it returns the next state (reps, ease, interval, due).
 */

export type SrsRating = 0 | 1 | 2 | 3;

export interface SrsState {
  reps: number;
  ease: number;
  interval: number; // days
  lapses: number;
}

export interface SrsResult extends SrsState {
  due: Date;
  intervalDays: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function applySrs(
  prev: SrsState,
  rating: SrsRating,
  now: Date = new Date()
): SrsResult {
  let { reps, ease, interval, lapses } = prev;

  // Again: treat as a lapse.
  if (rating === 0) {
    reps = 0;
    lapses = lapses + 1;
    ease = Math.max(1.3, ease - 0.2);
    interval = 1; // re-show tomorrow (or same session handled client-side)
  } else {
    // First successful review.
    if (reps === 0) {
      interval = rating === 3 ? 3 : 1;
    } else if (reps === 1) {
      interval = rating === 3 ? 6 : 3;
    } else {
      const factor =
        rating === 1 ? 1.2 : rating === 3 ? ease * 1.3 : ease;
      interval = Math.round(interval * factor);
    }

    reps = reps + 1;

    if (rating === 1) ease = Math.max(1.3, ease - 0.15);
    else if (rating === 3) ease = ease + 0.15;
  }

  // Clamp interval to a sane max (~6 months).
  if (interval > 180) interval = 180;
  if (interval < 1) interval = 1;

  const due = new Date(now.getTime() + interval * DAY_MS);

  return { reps, ease, interval, lapses, due, intervalDays: interval };
}

/** Human-readable label for the next review, e.g. "Besok" or "dalam 7 hari". */
export function formatDue(due: Date, now: Date = new Date()): string {
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((due.getTime() - now.getTime()) / dayMs);
  if (diffDays <= 0) return "Ulangi sekarang";
  if (diffDays === 1) return "Besok";
  if (diffDays < 7) return `dalam ${diffDays} hari`;
  if (diffDays < 30) return `dalam ${Math.round(diffDays / 7)} minggu`;
  return `dalam ${Math.round(diffDays / 30)} bulan`;
}
