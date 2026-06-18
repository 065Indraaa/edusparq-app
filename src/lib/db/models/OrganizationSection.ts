import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Divisi/Departemen dalam organisasi (HIMA, BEM, dll).
 *
 * Setiap divisi punya Kepala Divisi (kadiv) + opsional Wakil Kepala Divisi.
 * Pembuat divisi (createdBy) bisa siapa saja anggota aktif organisasi —
 * tidak harus ketua organisasi.
 */
const OrganizationSectionSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  nama: { type: String, required: true },
  deskripsi: { type: String },
  /** Kepala divisi — user yang memimpin divisi ini. */
  kepalaUserId: { type: Types.ObjectId, ref: "User" },
  /** Wakil kepala divisi — opsional, mendampingi kepala. */
  wakilKepalaUserId: { type: Types.ObjectId, ref: "User" },
  /** User yang membuat divisi ini (bisa anggota biasa, bukan harus ketua). */
  createdBy: { type: Types.ObjectId, ref: "User" },
  /** Status divisi. */
  status: { type: String, enum: ["aktif", "nonaktif"], default: "aktif" },
  createdAt: { type: Date, default: Date.now },
});

export const OrganizationSection =
  models.OrganizationSection || model("OrganizationSection", OrganizationSectionSchema);
