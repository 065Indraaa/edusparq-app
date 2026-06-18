import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Program Kerja (Proker) organisasi.
 *
 * Pembuat (createdBy) bisa siapa saja anggota aktif organisasi —
 * TIDAK harus ketua organisasi. Setiap progja punya daftar tugas (checklist)
 * yang bisa diisi oleh pembuat atau PIC.
 */

const ProkerTaskSchema = new Schema({
  judul: { type: String, required: true },
  deskripsi: { type: String, default: "" },
  /** User yang ditugaskan. */
  assigneeId: { type: Types.ObjectId, ref: "User" },
  assigneeNama: { type: String, default: "" },
  status: {
    type: String,
    enum: ["todo", "in_progress", "done", "blocked"],
    default: "todo",
  },
  deadline: { type: Date },
  createdBy: { type: Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ProgramKerjaSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  sectionId: { type: Types.ObjectId, ref: "OrganizationSection" },
  nama: { type: String, required: true },
  deskripsi: { type: String },
  tujuan: { type: String },
  mulai: { type: String },
  selesai: { type: String },
  anggaran: { type: Number, default: 0 },
  realisasi: { type: Number, default: 0 },
  picNama: { type: String },
  picUserId: { type: Types.ObjectId, ref: "User" },
  status: {
    type: String,
    enum: ["rencana", "berjalan", "selesai", "batal"],
    default: "rencana",
  },
  /** Prioritas progja. */
  prioritas: {
    type: String,
    enum: ["tinggi", "sedang", "rendah"],
    default: "sedang",
  },
  /** User yang membuat progja ini — bisa anggota biasa. */
  createdBy: { type: Types.ObjectId, ref: "User", required: true },
  /** Daftar tugas/checklist di dalam progja. */
  tasks: { type: [ProkerTaskSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

export const ProgramKerja = models.ProgramKerja || model("ProgramKerja", ProgramKerjaSchema);
