import TelegramBot from "node-telegram-bot-api";
import { generateOtp } from "../lib/crypto";

/**
 * Telegram helper — fungsi kirim pesan, format, & OTP store.
 *
 * Semua komunikasi bot ke Telegram lewat fungsi-fungsi ini supaya konsisten.
 * OTP store menggunakan MongoDB untuk kompatibilitas multi-worker / stateless.
 */

import { connectDB } from "./db/mongodb";
import { TelegramOtp } from "./db/models/TelegramOtp";

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

// ─── OTP Store (MongoDB) ──────────────────────────────────────────────────

const OTP_TTL_MS = 5 * 60 * 1000; // 5 menit

/** Simpan OTP untuk user tertentu. Menghapus OTP lama bila ada. */
export async function storeOtp(userId: string): Promise<string> {
  await connectDB();

  // Hapus OTP lama untuk user ini.
  await TelegramOtp.deleteMany({ userId });

  const otp = generateOtp();
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await TelegramOtp.create({
    otp,
    userId,
    expiresAt,
  });

  console.log(`[OTP STORE] Generated OTP ${otp} for userId ${userId}. Expires at: ${expiresAt.toISOString()}`);
  return otp;
}

/** Verifikasi OTP & kembalikan userId. Hapus OTP setelah dipakai. */
export async function verifyOtp(rawOtp: string): Promise<string | null> {
  const otp = rawOtp.replace(/\s+/g, "").trim();
  console.log(`[OTP VERIFY] Attempting to verify OTP: "${otp}"`);
  if (!otp) return null;

  await connectDB();

  const entry = await TelegramOtp.findOne({ otp });
  if (!entry) {
    console.log(`[OTP VERIFY] OTP "${otp}" not found in MongoDB.`);
    return null;
  }

  if (Date.now() > entry.expiresAt.getTime()) {
    console.log(`[OTP VERIFY] OTP "${otp}" expired at ${entry.expiresAt.toISOString()}.`);
    await TelegramOtp.deleteOne({ _id: entry._id });
    return null;
  }

  console.log(`[OTP VERIFY] OTP "${otp}" is valid! Belonging to userId: ${entry.userId}`);
  await TelegramOtp.deleteOne({ _id: entry._id });
  return entry.userId;
}

/** Cleanup expired OTP secara berkala (MongoDB TTL otomatis, tapi bisa dipanggil bila perlu). */
export async function cleanupOtpStore(): Promise<void> {
  await connectDB();
  await TelegramOtp.deleteMany({ expiresAt: { $lt: new Date() } });
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

/**
 * Menu utama untuk user BELUM login/linked.
 * Tampilkan popup onboarding dengan tombol login/daftar.
 */
export function buildOnboardingMenu(): InlineKeyboardMarkup {
  const webAppUrl = process.env.NEXTAUTH_URL || "https://edusparq.app";
  return {
    inline_keyboard: [
      [
        { text: "🔐 Masuk / Login", url: `${webAppUrl}/login` },
        { text: "✨ Daftar Baru", url: `${webAppUrl}/login` },
      ],
      [
        { text: "📚 Pelajari EduSparq", url: `${webAppUrl}/docs` },
        { text: "💰 Lihat Harga", url: `${webAppUrl}/pricing` },
      ],
      [{ text: "🔗 Cara Hubungkan Akun", callback_data: "howto_link" }],
    ],
  };
}

/**
 * Menu utama kategori — user linked.
 * Tiap kategori expandable (klik → submenu detail).
 */
export function buildMainMenu(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "💬 Tanya AI", callback_data: "chat_" + userId },
        { text: "📚 Akademik", callback_data: "cat_akademik_" + userId },
      ],
      [
        { text: "📋 Tugas", callback_data: "cat_tugas_" + userId },
        { text: "🗓️ Jadwal", callback_data: "cat_jadwal_" + userId },
      ],
      [
        { text: "💰 Akun", callback_data: "cat_akun_" + userId },
        { text: "❓ Bantuan", callback_data: "help_" + userId },
      ],
    ],
  };
}

/** Submenu kategori: Akademik (mata kuliah, materi, tutor). */
export function buildAkademikMenu(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🤖 Tanya Tutor AI", callback_data: "chat_" + userId }],
      [{ text: "📖 Mata Kuliah Saya", callback_data: "matkul_" + userId }],
      [{ text: "🧠 Agent AI (Tugas Kompleks)", callback_data: "agent_" + userId }],
      [{ text: "🔙 Menu Utama", callback_data: "menu_" + userId }],
    ],
  };
}

/** Submenu kategori: Tugas & Tenggat. */
export function buildTugasMenu(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📋 Lihat Tugas Mendatang", callback_data: "deadline_" + userId }],
      [{ text: "➕ Tambah Tugas Baru", callback_data: "addtugas_" + userId }],
      [{ text: "🔙 Menu Utama", callback_data: "menu_" + userId }],
    ],
  };
}

/** Submenu kategori: Jadwal. */
export function buildJadwalMenu(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "📅 Jadwal Hari Ini", callback_data: "schedule_" + userId }],
      [{ text: "📆 Jadwal Minggu Ini", callback_data: "week_" + userId }],
      [{ text: "🔙 Menu Utama", callback_data: "menu_" + userId }],
    ],
  };
}

/** Submenu kategori: Akun (saldo, byok, mode, profile). */
export function buildAkunMenu(userId: string): InlineKeyboardMarkup {
  const webAppUrl = process.env.NEXTAUTH_URL || "https://edusparq.app";
  return {
    inline_keyboard: [
      [{ text: "💰 Cek Saldo Credit", callback_data: "saldo_" + userId }],
      [{ text: "⚡ Atur Mode Agent", callback_data: "mode_" + userId }],
      [{ text: "🔑 Pengaturan BYOK", url: `${webAppUrl}/settings/ai` }],
      [{ text: "👤 Profil Saya", url: `${webAppUrl}/profile` }],
      [{ text: "🔓 Putuskan Akun", callback_data: "unlink_" + userId }],
      [{ text: "🔙 Menu Utama", callback_data: "menu_" + userId }],
    ],
  };
}

export function buildModeKeyboard(userId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [{ text: "🤖 Auto (Orchestrator)", callback_data: "setmode_auto_" + userId }],
      [{ text: "⚡ Simple (Langsung)", callback_data: "setmode_simple_" + userId }],
      [{ text: "🔙 Kembali", callback_data: "cat_akun_" + userId }],
    ],
  };
}

// ─── File Upload Helpers ────────────────────────────────────────────────────

/** Download file dari Telegram server menggunakan file_id. */
export async function downloadTelegramFile(fileId: string): Promise<Buffer | null> {
  const bot = getBot();
  if (!bot) return null;
  try {
    const file = await bot.getFile(fileId);
    if (!file.file_path) return null;
    const url = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    return buf;
  } catch (err) {
    console.error("[telegram] downloadTelegramFile error:", err);
    return null;
  }
}

/** Upload buffer ke Cloudinary. */
export async function uploadToCloudinary(
  buffer: Buffer,
  filename: string,
  folder: string
): Promise<{ secure_url: string; public_id: string } | null> {
  try {
    const cloudinary = await import("cloudinary").then((m) => m.v2);
    const result = await new Promise<any>((resolve, reject) => {
      cloudinary.uploader.upload_stream(
        {
          folder,
          resource_type: "auto",
          public_id: filename.replace(/[^a-zA-Z0-9]/g, "_").slice(0, 60),
        },
        (err, res) => {
          if (err) reject(err);
          else resolve(res);
        }
      ).end(buffer);
    });
    return {
      secure_url: result.secure_url,
      public_id: result.public_id,
    };
  } catch (err) {
    console.error("[telegram] uploadToCloudinary error:", err);
    return null;
  }
}

// ─── Upload Wizard Keyboards ────────────────────────────────────────────────

/** Inline keyboard untuk pilih mata kuliah. */
export function buildCoursePickerMenu(
  courses: Array<{ _id: string; name: string }>,
  telegramId: string
): InlineKeyboardMarkup {
  const rows = courses.map((c) => [
    { text: "📚 " + c.name, callback_data: `upcourse_${c._id}_${telegramId}` },
  ]);
  rows.push([{ text: "🔙 Batal", callback_data: `upcancel_${telegramId}` }]);
  return { inline_keyboard: rows };
}

/** Inline keyboard konfirmasi upload. */
export function buildUploadConfirmMenu(telegramId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Upload", callback_data: `upconfirm_${telegramId}` },
        { text: "❌ Batal", callback_data: `upcancel_${telegramId}` },
      ],
    ],
  };
}

/** Inline keyboard untuk aksi setelah analisis (deadline). */
export function buildDeadlineActionMenu(telegramId: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: "✅ Buat Deadline", callback_data: `deadline_yes_${telegramId}` },
        { text: "❌ Lewati", callback_data: `deadline_no_${telegramId}` },
      ],
    ],
  };
}
