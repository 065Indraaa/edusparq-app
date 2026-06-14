import mongoose, { Schema, models, model, Types } from "mongoose";

const QuizSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Types.ObjectId, ref: "Document", index: true },
  courseName: { type: String, default: "" },
  questions: [
    {
      question: { type: String },
      options: [{ type: String }],
      correctIndex: { type: Number },
      explanation: { type: String },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export const Quiz = models.Quiz || model("Quiz", QuizSchema);
