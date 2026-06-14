import mongoose, { Schema, models, model, Types } from "mongoose";

const AlumniSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  nama: { type: String, required: true },
  tahunLulus: { type: String },
  pekerjaan: { type: String },
  perusahaan: { type: String },
  posisi: { type: String },
  kontak: { type: String },
  linkedin: { type: String },
  bersediaKonsultasi: { type: Boolean, default: false },
  createdBy: { type: Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});

export const Alumni = models.Alumni || model("Alumni", AlumniSchema);
