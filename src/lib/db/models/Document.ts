import mongoose, { Schema, models, model, Types } from "mongoose";

const DocumentSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  courseId: { type: Types.ObjectId, ref: "Course" },
  courseName: { type: String, required: true },
  filename: { type: String, required: true },
  originalName: { type: String, required: true },
  fileUrl: { type: String, required: true }, // Cloudinary URL
  publicId: { type: String }, // Cloudinary public_id for deletion
  fileType: { type: String, enum: ["pdf", "docx", "audio", "video", "image"], required: true },
  fileSize: { type: String, default: "" },
  status: { type: String, enum: ["processing", "indexed", "failed"], default: "processing" },
  uploadedAt: { type: Date, default: Date.now },
});

export const Document = models.Document || model("Document", DocumentSchema);
