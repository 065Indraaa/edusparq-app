import mongoose, { Schema, models, model, Types } from "mongoose";

const ProgramKerjaSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  sectionId: { type: Types.ObjectId },
  nama: { type: String, required: true },
  deskripsi: { type: String },
  tujuan: { type: String },
  mulai: { type: String },
  selesai: { type: String },
  anggaran: { type: Number, default: 0 },
  picNama: { type: String },
  status: {
    type: String,
    enum: ["rencana", "berjalan", "selesai", "batal"],
    default: "rencana",
  },
  createdBy: { type: Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});

export const ProgramKerja = models.ProgramKerja || model("ProgramKerja", ProgramKerjaSchema);
