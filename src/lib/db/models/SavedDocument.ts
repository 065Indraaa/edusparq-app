import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * A document the student writes inside EduSparq's Writing Studio — an editable,
 * Word/Docs-style document. `content` holds rich HTML produced by the in-app
 * editor (and/or an AI-generated draft). Stored per user so each student builds
 * a personal library of papers, essays, and reports they can re-open, edit,
 * and export to .doc / PDF.
 */
const SavedDocumentSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, default: "Dokumen Tanpa Judul" },
  // Rich HTML body from the editor.
  content: { type: String, default: "" },
  // Document kind, drives the AI draft structure.
  docType: {
    type: String,
    enum: ["makalah", "esai", "laporan", "proposal", "artikel", "umum"],
    default: "makalah",
  },
  courseName: { type: String, default: "" },
  citationStyle: { type: String, default: "APA" },
  // Snapshot of plain-text length for quick listing previews.
  wordCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

SavedDocumentSchema.index({ userId: 1, updatedAt: -1 });

export const SavedDocument =
  models.SavedDocument || model("SavedDocument", SavedDocumentSchema);
