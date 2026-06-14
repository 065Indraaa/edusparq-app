import mongoose, { Schema, models, model, Types } from "mongoose";

const OrganizationSectionSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  nama: { type: String, required: true },
  deskripsi: { type: String },
  kepalaUserId: { type: Types.ObjectId },
  createdAt: { type: Date, default: Date.now },
});

export const OrganizationSection =
  models.OrganizationSection || model("OrganizationSection", OrganizationSectionSchema);
