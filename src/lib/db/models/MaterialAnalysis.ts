import mongoose, { Schema, models, model, Types } from "mongoose";

const MaterialAnalysisSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Types.ObjectId, ref: "Document", index: true },
  courseName: { type: String, default: "" },
  keywords: [{ type: String }],
  concepts: [{ nama: String, definisi: String }],
  relations: [{ dari: String, ke: String, hubungan: String }],
  contentTypes: [{ type: String }],
  createdAt: { type: Date, default: Date.now },
});

export const MaterialAnalysis =
  models.MaterialAnalysis || model("MaterialAnalysis", MaterialAnalysisSchema);
