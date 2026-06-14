import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * A recurring weekly class session ("jadwal kuliah"). `hari` is 1=Senin .. 7=Minggu.
 * Powers the weekly timetable and the "Kelas hari ini" widget on the dashboard.
 */
const ClassScheduleSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course" },
  courseName: { type: String, required: true },
  hari: { type: Number, required: true, min: 1, max: 7 },
  jamMulai: { type: String, default: "08:00" }, // HH:MM
  jamSelesai: { type: String, default: "09:40" },
  ruang: { type: String, default: "" },
  dosen: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const ClassSchedule =
  models.ClassSchedule || model("ClassSchedule", ClassScheduleSchema);
