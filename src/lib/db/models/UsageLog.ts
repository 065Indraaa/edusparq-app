import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * UsageLog — Catatan setiap pemanggilan AI (token metering).
 *
 * Menyimpan token masuk/keluar, model, biaya credit, dan fitur pemicunya.
 * Dipakai untuk: grafik usage di /billing, audit hemat token, debugging.
 */
const UsageLogSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  feature: {
    type: String,
    required: true,
    // fitur pemicu: chat, draft, solver, grade, summarize, quiz, flashcards,
    // research, analyze, recommend, agent:<name>, telegram, byok-test, ...
  },
  // Identifikasi sesi/agent run tertentu (opsional, untuk trace).
  taskId: { type: String, default: "", index: true },
  // Sumber kunci: "platform" (pake credit EduSparq) atau "byok" (kunci user sendiri).
  source: { type: String, enum: ["platform", "byok"], default: "platform" },
  model: { type: String, default: "" },
  // Token aktual dari response usage (jika tersedia).
  tokensIn: { type: Number, default: 0 },
  tokensOut: { type: Number, default: 0 },
  // Estimasi token bila provider tidak mengembalikan usage.
  estimated: { type: Boolean, default: false },
  // Credit yang dipotong (0 untuk BYOK, karena gratis buat user).
  creditCost: { type: Number, default: 0 },
  // Status eksekusi: ok = sukses, error = gagal, partial = sebagian.
  status: { type: String, enum: ["ok", "error", "partial"], default: "ok" },
  // Pesan error singkat bila status != ok (dipangkas).
  error: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

// Index komposit untuk query "usage user X bulan ini" yang cepat.
UsageLogSchema.index({ userId: 1, createdAt: -1 });
// Index untuk aggregate per fitur.
UsageLogSchema.index({ userId: 1, feature: 1, createdAt: -1 });

export const UsageLog = models.UsageLog || model("UsageLog", UsageLogSchema);
