import { Schema, models, model, Types } from "mongoose";

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

export const CollabGroup = models.CollabGroup || model("CollabGroup", CollabGroupSchema);
export const CollabTask = models.CollabTask || model("CollabTask", CollabTaskSchema);
export const CollabDoc = models.CollabDoc || model("CollabDoc", CollabDocSchema);
export const CollabPoll = models.CollabPoll || model("CollabPoll", CollabPollSchema);
