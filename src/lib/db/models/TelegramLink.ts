import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * TelegramLink — Penghubung akun EduSparq ↔ akun Telegram.
 *
 * Dibuat saat user menyelesaikan OTP linking di bot:
 *   1. User buka /settings → generate OTP 6-digit (disimpan di memory/Redis sementara).
 *   2. User kirim "/link <otp>" ke bot Telegram.
 *   3. Webhook `/api/telegram` cocokkan OTP → buat TelegramLink (active=true).
 *
 * Setelah linked, webhook mengenali user via telegramId → semua command &
 * pesan natural language memakai konteks akun user (credit, jadwal, deadline).
 */
const TelegramLinkSchema = new Schema({
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  telegramId: { type: String, required: true, unique: true, index: true },
  telegramUsername: { type: String, default: "" },
  // chatId untuk push message proaktif (deadline reminder, dsb).
  chatId: { type: String, required: true },
  active: { type: Boolean, default: true },
  linkedAt: { type: Date, default: Date.now },
});

export const TelegramLink =
  models.TelegramLink || model("TelegramLink", TelegramLinkSchema);
