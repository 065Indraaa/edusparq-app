import mongoose, { Schema, models, model, Types } from "mongoose";

const StudyNoteSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  documentId: { type: Types.ObjectId, ref: "Document", index: true },
  courseName: { type: String, default: "" },
  title: { type: String, default: "" },
  content: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

export const StudyNote = models.StudyNote || model("StudyNote", StudyNoteSchema);
