import mongoose, { Schema, models, model, Types } from "mongoose";

const MentoringSessionSchema = new Schema({
  orgId: { type: Types.ObjectId, ref: "Organization", required: true, index: true },
  mentorId: { type: Types.ObjectId },
  mentorNama: { type: String },
  menteeId: { type: Types.ObjectId },
  menteeNama: { type: String },
  courseName: { type: String },
  jadwal: { type: String },
  status: {
    type: String,
    enum: ["dijadwalkan", "selesai", "batal"],
    default: "dijadwalkan",
  },
  catatan: { type: String },
  createdAt: { type: Date, default: Date.now },
});

export const MentoringSession =
  models.MentoringSession || model("MentoringSession", MentoringSessionSchema);
