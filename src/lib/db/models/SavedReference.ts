import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * A reference the user saved to their personal research library ("Pustaka Saya"),
 * Mendeley-style. Sourced from the real Crossref catalog. `refId` (DOI when
 * present, otherwise a content hash) is unique per user to prevent duplicates.
 */
const SavedReferenceSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  refId: { type: String, required: true },
  title: { type: String, required: true },
  authors: { type: [String], default: [] },
  year: { type: String, default: "" },
  type: { type: String, default: "" },
  typeLabel: { type: String, default: "" },
  journal: { type: String, default: "" },
  publisher: { type: String, default: "" },
  doi: { type: String, default: "" },
  url: { type: String, default: "" },
  savedAt: { type: Date, default: Date.now },
});

SavedReferenceSchema.index({ userId: 1, refId: 1 }, { unique: true });

export const SavedReference =
  models.SavedReference || model("SavedReference", SavedReferenceSchema);
