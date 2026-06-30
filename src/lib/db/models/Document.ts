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
  source: { type: String, enum: ["web", "telegram"], default: "web" },
  status: { type: String, enum: ["processing", "indexed", "failed"], default: "processing" },
  analysisStatus: { type: String, enum: ["pending", "analyzed", "failed"], default: "pending" },
  analysisResult: {
    contentType: { type: String, default: "" },
    summary: { type: String, default: "" },
    topics: { type: [String], default: [] },
    keyConcepts: { type: [String], default: [] },
    tasksDetected: { type: [Object], default: [] },
    recommendedActions: { type: [String], default: [] },
  },
  uploadedAt: { type: Date, default: Date.now },
});

export const Document = models.Document || model("Document", DocumentSchema);
