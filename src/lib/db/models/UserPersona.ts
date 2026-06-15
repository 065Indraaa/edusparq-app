import mongoose, { Document, Model, Schema } from "mongoose";

export interface IUserPersona extends Document {
  userId: string;
  academicProfile?: string; // e.g. "Mahasiswa Hukum Semester 8"
  writingStyle?: string; // e.g. "Santai, menggunakan kata bro, tapi akademik"
  currentFocus?: string; // e.g. "Sedang pusing revisi Bab 3 Skripsi"
  learnedFacts: string[]; // e.g. ["Suka begadang", "Kesulitan metodologi penelitian kualitatif"]
  lastExtractedAt: Date; // Kapan terakhir kali AI mengekstrak data dari chat
  createdAt: Date;
  updatedAt: Date;
}

const UserPersonaSchema = new Schema<IUserPersona>(
  {
    userId: { type: String, required: true, unique: true, index: true },
    academicProfile: { type: String, default: "" },
    writingStyle: { type: String, default: "" },
    currentFocus: { type: String, default: "" },
    learnedFacts: { type: [String], default: [] },
    lastExtractedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

export const UserPersona: Model<IUserPersona> =
  mongoose.models.UserPersona || mongoose.model<IUserPersona>("UserPersona", UserPersonaSchema);
