import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * KRS (Kartu Rencana Studi) — a student's study plan for one academic period.
 *
 * One document per user per (academicYear + semester). Each entry stores the
 * courses the student enrolled in for that period, optionally linked to a
 * Course document (created on import) so deadlines/materials attach normally.
 */

const KRSCourseSchema = new Schema(
  {
    courseId: { type: Types.ObjectId, ref: "Course" },
    courseName: { type: String, required: true },
    sks: { type: Number, default: 0, min: 0 },
    lecturer: { type: String, default: "" },
    // Human-readable schedule, e.g. "Senin 08:00-09:40 B.2.123"
    schedule: { type: String, default: "" },
  },
  { _id: false }
);

const KRSSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  academicYear: { type: String, required: true }, // e.g. "2024/2025"
  semester: {
    type: String,
    enum: ["Ganjil", "Genap", "Pendek"],
    required: true,
  },
  courses: [KRSCourseSchema],
  status: { type: String, enum: ["active", "archived"], default: "active" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

KRSSchema.pre("save", function () {
  this.updatedAt = new Date();
});

// A student has one active KRS per period; look it up fast.
KRSSchema.index({ userId: 1, academicYear: 1, semester: 1 }, { unique: true });

export const KRS = models.KRS || model("KRS", KRSSchema);
