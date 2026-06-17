import mongoose, { Schema, models, model } from "mongoose";

const UserSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String }, // null for OAuth users
  image: { type: String },
  universitas: { type: String, default: "" },
  fakultas: { type: String, default: "" },
  prodi: { type: String, default: "" },
  semester: { type: Number, default: 1 },
  onboardingDismissed: { type: Boolean, default: false },
  seenCoachmarks: { type: [String], default: [] },
  googleEmail: { type: String, default: "" },
  googleAccessToken: { type: String, default: "" },
  googleRefreshToken: { type: String, default: "" },
  googleTokenExpiry: { type: Number, default: 0 },
  connectedGoogleCalendar: { type: Boolean, default: false },
  aiQuota: { type: Number, default: 50 },
  quotaResetAt: { type: Date, default: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }},
  createdAt: { type: Date, default: Date.now },
});

export const User = models.User || model("User", UserSchema);
