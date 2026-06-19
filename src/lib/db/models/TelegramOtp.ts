import mongoose, { Document, Model, Schema } from "mongoose";

export interface ITelegramOtp extends Document {
  otp: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
}

const TelegramOtpSchema = new Schema<ITelegramOtp>({
  otp: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  userId: {
    type: String,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  expiresAt: {
    type: Date,
    required: true,
  },
});

// TTL Index: MongoDB automatically deletes documents when the current date is > expiresAt.
TelegramOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const TelegramOtp: Model<ITelegramOtp> =
  mongoose.models.TelegramOtp || mongoose.model<ITelegramOtp>("TelegramOtp", TelegramOtpSchema);
