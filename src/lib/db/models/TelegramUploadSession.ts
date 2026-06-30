import mongoose, { Schema, models, model, Types, Document } from "mongoose";

export interface ITelegramUploadSession extends Document {
  telegramId: string;
  userId: Types.ObjectId;
  step: string;
  tempFileUrl: string;
  tempFileName: string;
  tempFileType: string;
  extractedText: string;
  selectedCourseId?: Types.ObjectId;
  selectedCourseName: string;
  analysisResult?: Record<string, unknown>;
  detectedTasks: Array<Record<string, unknown>>;
  createdAt: Date;
  expiresAt: Date;
}

const TelegramUploadSessionSchema = new Schema<ITelegramUploadSession>(
  {
    telegramId: { type: String, required: true, index: true },
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    step: {
      type: String,
      enum: [
        "awaiting_course",
        "awaiting_confirm",
        "processing",
        "awaiting_deadline_decision",
        "done",
      ],
      default: "awaiting_course",
    },
    tempFileUrl: { type: String, default: "" },
    tempFileName: { type: String, default: "" },
    tempFileType: { type: String, default: "" },
    extractedText: { type: String, default: "" },
    selectedCourseId: { type: Types.ObjectId, ref: "Course", default: null },
    selectedCourseName: { type: String, default: "" },
    analysisResult: { type: Object, default: null },
    detectedTasks: { type: [Object], default: [] },
    createdAt: { type: Date, default: Date.now },
    expiresAt: { type: Date, default: () => new Date(Date.now() + 60 * 60 * 1000) },
  },
  { timestamps: false }
);

// TTL: auto-delete setelah 1 jam.
TelegramUploadSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
TelegramUploadSessionSchema.index({ telegramId: 1, step: 1 });

export const TelegramUploadSession: mongoose.Model<ITelegramUploadSession> =
  mongoose.models.TelegramUploadSession ||
  model<ITelegramUploadSession>("TelegramUploadSession", TelegramUploadSessionSchema);
