import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Indonesian 4.0 grading scale (skala nilai nasional).
 *
 * Many Indonesian universities (e.g. UI, ITB, UGM, UNPAD) use the half-step
 * A/AB/B/BC/C/D/E scale instead of the A-/B+/B-/C+ scale. This is the scale used
 * by the KRS & IPS/IPK tracking flow. The legacy `Course.grade` field keeps the
 * A-/B+ scale (see `src/lib/gpa.ts`); the two systems coexist so existing pages
 * keep working while imported transcript grades use the national scale.
 */
export const GRADE_SCALE: Record<string, number> = {
  A: 4.0,
  AB: 3.5,
  B: 3.0,
  BC: 2.5,
  C: 2.0,
  D: 1.0,
  E: 0.0,
};

export const GRADE_LETTERS = Object.keys(GRADE_SCALE);

/** Map a grade letter to its grade point. Invalid letters map to null. */
export function gradeLetterToPoint(letter: string): number | null {
  const point = GRADE_SCALE[(letter || "").trim().toUpperCase()];
  return typeof point === "number" ? point : null;
}

const GradeSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course", index: true },
  // Denormalized for easy display without an extra join (mirrors Deadline).
  courseName: { type: String, default: "" },
  gradeLetter: {
    type: String,
    enum: GRADE_LETTERS,
    required: true,
  },
  gradePoint: { type: Number, required: true, min: 0, max: 4 },
  // SKS (credits) the course was worth when graded — denormalized here so the
  // IPK/IPS computation never depends on the Course doc still existing.
  sks: { type: Number, default: 0, min: 0 },
  // e.g. "2024/2025 Ganjil" — drives per-semester IPS grouping.
  semester: { type: String, required: true },
  academicYear: { type: String, default: "" }, // e.g. "2024/2025"
  semesterType: { type: String, enum: ["Ganjil", "Genap", "Pendek", ""], default: "" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

GradeSchema.pre("save", function () {
  this.updatedAt = new Date();
});

GradeSchema.index({ userId: 1, semester: 1 });

export const Grade = models.Grade || model("Grade", GradeSchema);
