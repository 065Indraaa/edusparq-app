import mongoose, { Schema, models, model, Types } from "mongoose";

const LearningRecommendationSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseName: { type: String, default: "" },
  topik: { type: String },
  alasan: { type: String },
  prioritas: {
    type: String,
    enum: ["tinggi", "sedang", "rendah"],
    default: "sedang",
  },
  createdAt: { type: Date, default: Date.now },
});

export const LearningRecommendation =
  models.LearningRecommendation ||
  model("LearningRecommendation", LearningRecommendationSchema);
