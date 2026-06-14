import mongoose, { Schema, models, model, Types } from "mongoose";

const ChatMessageSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["user", "assistant"], required: true },
  content: { type: String, required: true },
  mode: { type: String, enum: ["socratic", "helper", "research"], default: "helper" },
  courseName: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

export const ChatMessage = models.ChatMessage || model("ChatMessage", ChatMessageSchema);
