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

  // ─── Legacy AI quota (dipertahankan untuk kompatibilitas mundur) ────────────
  // Sistem lama: 50 request/bulan. Masih dipakai sebagai hard cap fallback
  // untuk fitur yang belum migrasi ke credit system.
  aiQuota: { type: Number, default: 50 },
  quotaResetAt: { type: Date, default: () => {
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    nextMonth.setDate(1);
    nextMonth.setHours(0, 0, 0, 0);
    return nextMonth;
  }},

  // ─── Credit system (Fase 0) ─────────────────────────────────────────────────
  // Saldo credit utama. 1 credit ≈ 1 token output pada model default.
  // Dipotong tiap pemanggilan AI via platform (bukan BYOK).
  credits: { type: Number, default: 100, index: true },
  // Tier langganan: free (default), pro, premium. Tier hanya menentukan
  // benefit seperti refill bulanan & limit BYOK slot, bukan pembayaran otomatis.
  plan: { type: String, enum: ["free", "pro", "premium"], default: "free" },
  planRenewsAt: { type: Date, default: null },
  // Total akumulasi token (semua sumber) untuk statistik & badge hemat.
  totalTokensUsed: { type: Number, default: 0 },
  // Flag: user memilih pakai kunci sendiri (BYOK) → tidak potong credit.
  byokEnabled: { type: Boolean, default: false },
  // Preferensi mode multi-agent: "auto" (orchestrator) atau "simple" (langsung).
  agentMode: { type: String, enum: ["auto", "simple"], default: "auto" },

  createdAt: { type: Date, default: Date.now },
});

export const User = models.User || model("User", UserSchema);
