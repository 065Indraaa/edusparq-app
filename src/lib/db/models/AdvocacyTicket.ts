import mongoose, { Schema, models, model, Types } from "mongoose";

const AdvocacyTicketSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  pelaporId: { type: Types.ObjectId },
  pelaporNama: { type: String, default: "Anonim" },
  kategori: { type: String },
  judul: { type: String, required: true },
  isi: { type: String },
  status: { type: String, enum: ["baru", "diproses", "selesai"], default: "baru" },
  nomorTiket: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const AdvocacyTicket =
  models.AdvocacyTicket || model("AdvocacyTicket", AdvocacyTicketSchema);
