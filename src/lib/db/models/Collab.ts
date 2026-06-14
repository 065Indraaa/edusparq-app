import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Real, persisted collaboration primitives.
 *
 * A CollabGroup is a study group identified by a short human-friendly joinCode.
 * Membership is stored as an array of user references. Tasks, the shared doc,
 * and the poll all reference a groupId and are only readable/writable by members
 * (enforced in the API layer).
 */

const CollabGroupSchema = new Schema({
  name: { type: String, required: true },
  ownerId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  joinCode: { type: String, required: true, unique: true, index: true },
  members: [
    {
      userId: { type: Types.ObjectId, ref: "User", required: true },
      name: { type: String, default: "" },
      joinedAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

const CollabTaskSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, index: true },
  title: { type: String, required: true },
  assignee: { type: String, default: "" },
  dueDate: { type: String, default: "" },
  completed: { type: Boolean, default: false },
  createdBy: { type: Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
  // Extended fields
  assigneeUserId: { type: Types.ObjectId, ref: "User" },
  bobotKontribusi: { type: Number, default: 1 },
  hasilUrl: { type: String, default: "" },
});

const CollabDocSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, unique: true, index: true },
  content: { type: String, default: "" },
  updatedBy: { type: String, default: "" },
  updatedAt: { type: Date, default: Date.now },
});

const CollabPollSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, index: true },
  question: { type: String, default: "" },
  options: [
    {
      label: { type: String, required: true },
      voterIds: [{ type: Types.ObjectId, ref: "User" }],
    },
  ],
  createdBy: { type: Types.ObjectId, ref: "User" },
  createdAt: { type: Date, default: Date.now },
});

// --- New models ---

const CollabDocLinkSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, index: true },
  judul: { type: String, required: true },
  googleDocUrl: { type: String, required: true },
  createdByNama: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

const CollabReviewSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, index: true },
  taskId: { type: Types.ObjectId, ref: "CollabTask" },
  reviewerId: { type: Types.ObjectId, ref: "User" },
  reviewerNama: { type: String, default: "" },
  komentar: { type: String, default: "" },
  rating: { type: Number, default: 5 },
  createdAt: { type: Date, default: Date.now },
});

const CollabConflictSchema = new Schema({
  groupId: { type: Types.ObjectId, ref: "CollabGroup", required: true, index: true },
  isu: { type: String, required: true },
  status: {
    type: String,
    enum: ["terbuka", "diskusi", "selesai"],
    default: "terbuka",
  },
  dibuatNama: { type: String, default: "" },
  riwayat: [
    {
      aksi: { type: String },
      oleh: { type: String },
      pada: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

export const CollabGroup = models.CollabGroup || model("CollabGroup", CollabGroupSchema);
export const CollabTask = models.CollabTask || model("CollabTask", CollabTaskSchema);
export const CollabDoc = models.CollabDoc || model("CollabDoc", CollabDocSchema);
export const CollabPoll = models.CollabPoll || model("CollabPoll", CollabPollSchema);
export const CollabDocLink = models.CollabDocLink || model("CollabDocLink", CollabDocLinkSchema);
export const CollabReview = models.CollabReview || model("CollabReview", CollabReviewSchema);
export const CollabConflict = models.CollabConflict || model("CollabConflict", CollabConflictSchema);

// Suppress unused import warning — mongoose is required by the pattern contract.
void mongoose;
