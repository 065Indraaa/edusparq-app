import mongoose, { Schema, models, model, Types } from "mongoose";

const OrganizationDocumentSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  periode: { type: String },
  jenis: { type: String },
  judul: { type: String, required: true },
  fileUrl: { type: String },
  uploadedByNama: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const OrganizationDocument =
  models.OrganizationDocument || model("OrganizationDocument", OrganizationDocumentSchema);
