import mongoose, { Schema, models, model, Types } from "mongoose";

const FlashcardSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course" },
  courseName: { type: String, default: "Umum" },
  front: { type: String, required: true },
  back: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },
  lastReviewed: { type: Date },
  createdAt: { type: Date, default: Date.now },
});

export const Flashcard = models.Flashcard || model("Flashcard", FlashcardSchema);
