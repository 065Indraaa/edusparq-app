import mongoose, { Schema, models, model, Types } from "mongoose";

const FlashcardSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course" },
  courseName: { type: String, default: "Umum" },
  front: { type: String, required: true },
  back: { type: String, required: true },
  difficulty: { type: String, enum: ["easy", "medium", "hard"], default: "medium" },

  // ---- Spaced Repetition (SM-2) fields ----
  // SRS rating: 0=again, 1=hard, 2=good, 3=easy
  reps: { type: Number, default: 0 },
  // Ease factor (>= 1.3). Higher = card is easier, interval grows faster.
  ease: { type: Number, default: 2.5 },
  // Current interval in days.
  interval: { type: Number, default: 0 },
  // Number of times the card was forgotten (rating "again").
  lapses: { type: Number, default: 0 },
  // Next due date for review. Defaults to now so new cards are immediately due.
  due: { type: Date, default: () => new Date() },
  lastReviewed: { type: Date },

  createdAt: { type: Date, default: Date.now },
});

// Speed up "due cards" queries per user.
FlashcardSchema.index({ userId: 1, due: 1 });

export const Flashcard = models.Flashcard || model("Flashcard", FlashcardSchema);
