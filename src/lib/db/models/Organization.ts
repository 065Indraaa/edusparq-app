import mongoose, { Schema, models, model, Types } from "mongoose";

const OrganizationSchema = new Schema({
  ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  nama: { type: String, required: true },
  prodi: { type: String },
  fakultas: { type: String },
  universitas: { type: String },
  visi: { type: String },
  misi: { type: String },
  logoUrl: { type: String },
  joinCode: { type: String, required: true, unique: true, index: true },
  createdAt: { type: Date, default: Date.now },
});

export const Organization = models.Organization || model("Organization", OrganizationSchema);
