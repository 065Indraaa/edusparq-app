import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * One "Dosen Virtual" grading: the user submits a question + their answer and
 * the AI scores its accuracy (0–100) like a lecturer, with feedback. Stored
 * per-user so the student can track their progress over time.
 */
const AnswerEvaluationSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseName: { type: String, default: "" },
  question: { type: String, required: true },
  userAnswer: { type: String, required: true },
  score: { type: Number, default: 0, min: 0, max: 100 },
  verdict: { type: String, default: "" },
  feedback: { type: String, default: "" },
  strengths: { type: [String], default: [] },
  missing: { type: [String], default: [] },
  saran: { type: String, default: "" },
  idealAnswer: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const AnswerEvaluation =
  models.AnswerEvaluation || model("AnswerEvaluation", AnswerEvaluationSchema);
