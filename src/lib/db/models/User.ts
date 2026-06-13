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
  createdAt: { type: Date, default: Date.now },
});

export const User = models.User || model("User", UserSchema);
