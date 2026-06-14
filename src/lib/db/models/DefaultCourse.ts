import mongoose, { Schema, models, model, Types } from "mongoose";

const DefaultCourseSchema = new Schema({
  prodi: { type: String, required: true, index: true },
  semester: { type: Number },
  namaMatkul: { type: String, required: true },
  sks: { type: Number, default: 3 },
  jumlahKontributor: { type: Number, default: 1 },
  createdAt: { type: Date, default: Date.now },
});

export const DefaultCourse = models.DefaultCourse || model("DefaultCourse", DefaultCourseSchema);
