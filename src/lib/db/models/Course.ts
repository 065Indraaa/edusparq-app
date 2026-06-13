import mongoose, { Schema, models, model, Types } from "mongoose";

const CourseSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  name: { type: String, required: true },
  instructor: { type: String, default: "" },
  credits: { type: Number, default: 3 },
  semester: { type: String, required: true }, // e.g. "Semester 3"
  progress: { type: Number, default: 0, min: 0, max: 100 },
  color: { type: String, default: "indigo" }, // for visual differentiation
  createdAt: { type: Date, default: Date.now },
});

export const Course = models.Course || model("Course", CourseSchema);
