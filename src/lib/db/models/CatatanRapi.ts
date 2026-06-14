import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * A note the user wrote roughly and the AI tidied + expanded into a clean,
 * structured form (document / presentation outline / key points). Stored per
 * user so they build a personal, organized note library.
 */
const CatatanRapiSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseName: { type: String, default: "" },
  judul: { type: String, default: "" },
  formatType: { type: String, enum: ["dokumen", "presentasi", "poin"], default: "dokumen" },
  rawInput: { type: String, default: "" },
  content: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const CatatanRapi =
  models.CatatanRapi || model("CatatanRapi", CatatanRapiSchema);
