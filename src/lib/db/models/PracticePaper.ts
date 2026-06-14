import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * A practice exam paper generated for the student — a mix of multiple-choice and
 * essay questions, grounded in their course/topic or an uploaded document.
 * Stored per user so they can re-open papers, re-attempt them (spaced practice),
 * and track scores over time.
 */
const PracticeQuestionSchema = new Schema(
  {
    type: { type: String, enum: ["mc", "essay"], default: "mc" },
    question: { type: String, required: true },
    options: { type: [String], default: [] }, // mc only
    correctIndex: { type: Number, default: 0 }, // mc only
    explanation: { type: String, default: "" },
    points: { type: Number, default: 10 },
    // Essay grading hint / model answer used by the AI grader.
    idealAnswer: { type: String, default: "" },
  },
  { _id: false }
);

const PracticePaperSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Types.ObjectId, ref: "Document", index: true },
  title: { type: String, default: "Latihan Soal" },
  courseName: { type: String, default: "" },
  topic: { type: String, default: "" },
  questions: { type: [PracticeQuestionSchema], default: [] },
  // Spaced-repetition: when this paper should next be reviewed.
  attempts: { type: Number, default: 0 },
  lastScore: { type: Number, default: 0 }, // 0-100
  nextReviewAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

PracticePaperSchema.index({ userId: 1, updatedAt: -1 });

export const PracticePaper =
  models.PracticePaper || model("PracticePaper", PracticePaperSchema);
