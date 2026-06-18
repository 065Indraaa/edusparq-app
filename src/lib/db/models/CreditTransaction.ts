import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * CreditTransaction — Audit ledger semua pergerakan credit user.
 *
 * Tiap baris = satu mutasi credit (boleh positif maupun negatif):
 *   - purchase  : top up via invoice (manual/admin approval)
 *   - usage     : dipotong karena pakai AI (bisa banyak per hari)
 *   - bonus     : hadiah/referral/onboarding
 *   - admin     : penyesuaian manual oleh admin
 *   - refund    : pengembalian karena error/gagal
 *
 * `balanceAfter` disimpan agar historian bisa direkonstruksi tanpa join ke User.
 */
const CreditTransactionSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  amount: { type: Number, required: true }, // positif = kredit masuk, negatif = dipakai
  type: {
    type: String,
    enum: ["purchase", "usage", "bonus", "admin", "refund"],
    required: true,
  },
  balanceAfter: { type: Number, required: true },
  note: { type: String, default: "" },
  // Untuk type=purchase: link ke Invoice. Untuk type=usage: link ke UsageLog.
  refId: { type: String, default: "" },
  createdAt: { type: Date, default: Date.now },
});

CreditTransactionSchema.index({ userId: 1, createdAt: -1 });

export const CreditTransaction =
  models.CreditTransaction || model("CreditTransaction", CreditTransactionSchema);
