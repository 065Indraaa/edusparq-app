import mongoose, { Schema, models, model, Types } from "mongoose";

const DeadlineSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course" },
  courseName: { type: String, required: true }, // denormalized for easy display
  title: { type: String, required: true },
  description: { type: String, default: "" },
  dueDate: { type: String, required: true }, // YYYY-MM-DD
  dueTime: { type: String, default: "23:59" },
  weight: { type: String, default: "" }, // e.g. "15%"
  requirements: { type: String, default: "" },
  status: { type: String, enum: ["pending", "done", "overdue"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
});

export const Deadline = models.Deadline || model("Deadline", DeadlineSchema);
