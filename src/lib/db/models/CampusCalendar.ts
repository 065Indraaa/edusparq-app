import mongoose, { Schema, models, model, Types } from "mongoose";

const EventSchema = new Schema(
  {
    jenis: { type: String },
    judul: { type: String },
    mulai: { type: String },
    selesai: { type: String },
  },
  { _id: false }
);

const CampusCalendarSchema = new Schema({
  universitas: { type: String, required: true, index: true },
  tahunAjaran: { type: String },
  events: { type: [EventSchema], default: [] },
  sumber: { type: String, enum: ["manual", "crowdsource"], default: "crowdsource" },
  verified: { type: Boolean, default: false },
  createdByNama: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const CampusCalendar = models.CampusCalendar || model("CampusCalendar", CampusCalendarSchema);
