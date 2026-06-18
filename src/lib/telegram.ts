import TelegramBot from "node-telegram-bot-api";
import { generateOtp } from "@/lib/crypto";

/**
 * Telegram helper — fungsi kirim pesan, format, & OTP store.
 *
 * Semua komunikasi bot ke Telegram lewat fungsi-fungsi ini supaya konsisten.
 * OTP store (in-memory) untuk linking akun Telegram ↔ EduSparq.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

/** Inline keyboard markup untuk tombol callback di Telegram. */
export interface InlineKeyboardMarkup {
  inline_keyboard: Array<
    Array<{
      text: string;
      callback_data?: string;
      url?: string;
    }>
  >;
}

type ParseMode = "Markdown" | "HTML" | "MarkdownV2";

interface SendOptions {
  parseMode?: ParseMode;
  replyMarkup?: InlineKeyboardMarkup;
  disableWebPagePreview?: boolean;
}

// ─── OTP Store (in-memory, TTL 5 menit) ─────────────────────────────────────

interface OtpEntry {
  otp: string;
  userId: string;
  expiresAt: number; // epoch ms
}

const otpStore = new Map<string, OtpEntry>();

const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit

/** Simpan OTP untuk user tertentu. Menghapus OTP lama bila ada. */
export function storeOtp(userId: string): string {
  const otp = generateOtp();
  // Hapus OTP lama user ini bila ada.
  for (const [key, entry] of otpStore.entries()) {
    if (entry.userId === userId) otpStore.delete(key);
  }
  otpStore.set(otp, { otp, userId, expiresAt: Date.now() + OTP_TTL_MS });
  return otp;
}

/** Verifikasi OTP & kembalikan userId. Hapus OTP setelah dipakai. */
export function verifyOtp(otp: string): string | null {
  const entry = otpStore.get(otp);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    otpStore.delete(otp);
    return null; // expired
  }
  otpStore.delete(otp);
  return entry.userId;
}

/** Cleanup expired OTP secara berkala (dipanggil dari webhook). */
export function cleanupOtpStore(): void {
  const now = Date.now();
  for (const [key, entry] of otpStore.entries()) {
    if (now > entry.expiresAt) otpStore.delete(key);
  }
}

// ─── Bot Instance ─────────────────────────────────────────────────────────────

let _bot: TelegramBot | null = null;

export function getBot(): TelegramBot | null {
  if (_bot) return _bot;
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) return null;
  _bot = new TelegramBot(token);
  return _bot;
}

// ─── Send Helpers ───────────────────────────────────────────────────────────

export async function sendTelegram(
  chatId: number | string,
  text: string,
  opts: SendOptions = {}
): Promise<void> {
  const bot = getBot();
  if (!bot) {
    console.error("[telegram] TELEGRAM_BOT_TOKEN not set, cannot send.");
    return;
  }
  try {
    await bot.sendMessage(Number(chatId), text, {
      parse_mode: opts.parseMode || "Markdown",
      reply_markup: opts.replyMarkup as any,
    });
  } catch (err) {
    console.error("[telegram] sendMessage error:", err);
  }
}

/** Kirim pesan panjang dengan auto-split (Telegram max 4096 chars). */
export async function sendLongMessage(
  chatId: number | string,
  text: string,
  opts: SendOptions = {}
): Promise<void> {
  const MAX_LEN = 4000; // leave margin
  if (text.length <= MAX_LEN) {
    await sendTelegram(chatId, text, opts);
    return;
  }
  // Split by paragraph boundary.
  const chunks: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= MAX_LEN) {
      chunks.push(remaining);
      break;
    }
    // Find last newline before MAX_LEN.
    let splitIdx = remaining.lastIndexOf("\n", MAX_LEN);
    if (splitIdx < MAX_LEN * 0.5) splitIdx = MAX_LEN;
    chunks.push(remaining.slice(0, splitIdx));
    remaining = remaining.slice(splitIdx).replace(/^\n+/, "");
  }
  for (const chunk of chunks) {
    await sendTelegram(chatId, chunk, opts);
  }
}

// ─── Format Helpers ────────────────────────────────────────────────────────

export function formatCreditBalance(credits: number): string {
  return "💰 *Saldo Credit*: " + credits.toLocaleString("id-ID") + " credit";
}

export function formatAgentTier(tier: string): string {
  const map: Record<string, string> = {
    simple: "🟢 Simple (1 agen)",
    medium: "🟡 Medium (2 agen)",
    complex: "🟣 Complex (6–7 agen)",
  };
  return map[tier] || tier;
}

/** Format trace steps untuk Telegram. */
export function formatTrace(
  trace: Array<{
    agent: string;
    status: string;
    summary?: string;
    creditCost?: number;
  }>
): string {
  if (!trace.length) return "";
  return (
    "\n\n*📊 Jejak Eksekusi:*\n" +
    trace
      .map((s) => {
        const statusIcon = s.status === "done" ? "✅" : s.status === "error" ? "❌" : "⏳";
        const cost = s.creditCost ? " (" + s.creditCost.toFixed(1) + " cr)" : "";
        return statusIcon + " *" + s.agent + "*" + cost;
      })
      .join("\n")
  );
}

// ─── Keyboard Builders ───────────────────────────────────────────────────────

export function buildMainMenu(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "💬 Tanya AI (Agent)", callback_data: "chat_" + userId },
        { text: "💰 Cek Saldo", callback_data: "saldo_" + userId },
      ],
      [
        { text: "📋 Tugas & Tenggat", callback_data: "deadline_" + userId },
        { text: "🗓️ Jadwal Kuliah", callback_data: "schedule_" + userId },
      ],
      [
        { text: "⚙️ Mode Agent", callback_data: "mode_" + userId },
        { text: "❓ Bantuan", callback_data: "help_" + userId },
      ],
    ],
  };
}

export function buildModeKeyboard(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🤖 Auto (Orchestrator)", callback_data: "setmode_auto_" + userId }],
      [{ text: "⚡ Simple (Langsung)", callback_data: "setmode_simple_" + userId }],
      [{ text: "🔙 Kembali", callback_data: "menu_" + userId }],
    ],
  };
}
