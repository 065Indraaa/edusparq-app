import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * ApiKey — Kunci AI milik user (BYOK = Bring Your Own Key).
 *
 * Kunci disimpan dalam bentuk TERENKRIPSI (AES-256-GCM) via src/lib/crypto.ts.
 * User boleh punya beberapa kunci tapi hanya satu yang `active` dipakai.
 *
 * Saat aktif, semua pemanggilan AI user akan:
 *   - pakai baseURL + model dari kunci ini (via OpenAI-compatible SDK)
 *   - TIDAK memotong credit EduSparq (gratis buat user)
 *   - tetap di-metering di UsageLog (source="byok") untuk statistik
 */
const ApiKeySchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  label: { type: String, default: "Kunci saya" }, // nama friendly, mis. "OpenAI personal"
  // Id preset BYOK (lihat src/lib/byok-providers.ts) atau "custom".
  provider: { type: String, default: "custom" },
  baseURL: { type: String, required: true },
  model: { type: String, default: "" },
  // Kunci terenkripsi (format: iv:tag:ciphertext dalam base64).
  encryptedKey: { type: String, required: true },
  // 4 karakter terakhir kunci asli, untuk ditampilkan (key=••••1234).
  keyHint: { type: String, default: "" },
  active: { type: Boolean, default: false, index: true },
  lastValidated: { type: Date, default: null },
  // Status validasi terakhir: ok | invalid | unknown.
  validationStatus: {
    type: String,
    enum: ["ok", "invalid", "unknown"],
    default: "unknown",
  },
  createdAt: { type: Date, default: Date.now },
});

// Hanya satu kunci aktif per user (dijaga juga di level aplikasi saat setActive).
ApiKeySchema.index({ userId: 1, active: 1 });

export const ApiKey = models.ApiKey || model("ApiKey", ApiKeySchema);
