import mongoose, { Schema, models, model, Types } from "mongoose";

const CampusGuidelineSchema = new Schema({
  universitas: { type: String, required: true, index: true },
  margin: { type: String },
  spasi: { type: String },
  font: { type: String },
  ukuranFont: { type: String },
  formatHeading: { type: String },
  formatDaftarPustaka: { type: String },
  rules: { type: [String], default: [] },
  verified: { type: Boolean, default: false },
  createdByNama: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const CampusGuideline = models.CampusGuideline || model("CampusGuideline", CampusGuidelineSchema);
