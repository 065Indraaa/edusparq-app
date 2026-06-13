import mongoose, { Schema, models, model, Types } from "mongoose";

const CitationSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  type: { type: String, enum: ["Jurnal", "Buku", "Website", "Prosiding"], default: "Jurnal" },
  author: { type: String, required: true },
  title: { type: String, required: true },
  year: { type: String, required: true },
  journal: { type: String, default: "" },
  volume: { type: String, default: "" },
  issue: { type: String, default: "" },
  pages: { type: String, default: "" },
  publisher: { type: String, default: "" },
  url: { type: String, default: "" },
  doi: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const Citation = models.Citation || model("Citation", CitationSchema);
