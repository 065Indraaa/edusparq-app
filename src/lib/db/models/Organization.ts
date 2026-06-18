import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Organisasi mahasiswa (HIMA, BEM, UKM, dll).
 *
 * Sebelumnya bernama "HIMA" — di-generalize menjadi "Organisasi" supaya
 * mendukung berbagai jenis organisasi kemahasiswaan.
 */
const OrganizationSchema = new Schema({
  ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  nama: { type: String, required: true },
  /** Jenis organisasi. */
  jenis: {
    type: String,
    enum: ["hima", "bem", "ukm", "komunitas", "lainnya"],
    default: "hima",
  },
  prodi: { type: String },
  fakultas: { type: String },
  universitas: { type: String },
  visi: { type: String },
  misi: { type: String },
  logoUrl: { type: String },
  joinCode: { type: String, required: true, unique: true, index: true },

  // ─── Struktur Kepengurusan ────────────────────────────────────────────────
  /** Ketua organisasi. */
  ketuaUserId: { type: Types.ObjectId, ref: "User" },
  /** Wakil ketua organisasi. */
  wakilKetuaUserId: { type: Types.ObjectId, ref: "User" },
  /** Target/jumlah divisi yang direncanakan. */
  jumlahDivisiTarget: { type: Number, default: 0 },
  /** Periode kepengurusan (mis. "2025/2026"). */
  periode: { type: String },

  createdAt: { type: Date, default: Date.now },
});

export const Organization = models.Organization || model("Organization", OrganizationSchema);
