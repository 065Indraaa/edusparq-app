import mongoose, { Schema, models, model, Types } from "mongoose";

const LecturerDatabaseSchema = new Schema({
  universitas: { type: String, index: true },
  prodi: { type: String, index: true },
  nama: { type: String, required: true },
  matkulDiampu: { type: [String], default: [] },
  researchInterest: { type: String },
  kontak: { type: String },
  verified: { type: Boolean, default: false },
  createdByNama: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const LecturerDatabase = models.LecturerDatabase || model("LecturerDatabase", LecturerDatabaseSchema);
