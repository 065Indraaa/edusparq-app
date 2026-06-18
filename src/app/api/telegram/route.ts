import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../lib/db/mongodb";
import { TelegramLink } from "../../../lib/db/models/TelegramLink";
import { User } from "../../../lib/db/models/User";
import { Deadline } from "../../../lib/db/models/Deadline";
import { ClassSchedule } from "../../../lib/db/models/ClassSchedule";
import {
  sendTelegram,
  sendLongMessage,
  getBot,
  verifyOtp,
  cleanupOtpStore,
  buildMainMenu,
  buildOnboardingMenu,
  buildAkademikMenu,
  buildTugasMenu,
  buildJadwalMenu,
  buildAkunMenu,
  buildModeKeyboard,
  formatCreditBalance,
  formatTrace,
} from "../../../lib/telegram";
import { getBalance } from "../../../lib/credit-billing";
import { InsufficientCreditsError } from "../../../lib/ai-client";

/**
 * POST /api/telegram — Webhook handler untuk Telegram Bot.
 *
 * Flow:
 *   1. Terima update dari Telegram webhook.
 *   2. Identifikasi user via TelegramLink (telegramId → userId).
 *   3. Route ke command handler atau orchestrator.
 *
 * Commands:
 *   /start    — greeting + menu
 *   /help     — daftar command
 *   /link <otp> — hubungkan akun (via OTP dari web)
 *   /unlink   — putuskan hubungan akun
 *   /saldo    — cek saldo credit
 *   /mode     — toggle auto/simple
 *   /tugas    — lihat deadline terdekat
 *   /jadwal   — lihat jadwal hari ini
 *   Pesan lainnya → orchestrator (bila linked)
 */

interface TelegramFrom {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type?: string };
  from?: TelegramFrom;
  text?: string;
  reply_to_message?: { text?: string };
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message: { message_id: number; chat: { id: number }; text?: string };
  data: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// In-memory rate limit: telegramId → last message timestamp.
const chatCooldown = new Map<string, number>();
const COOLDOWN_MS = 3000; // 3 detik antar pesan

function isOnCooldown(telegramId: string): boolean {
  const last = chatCooldown.get(telegramId) || 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  chatCooldown.set(telegramId, Date.now());
  return false;
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();

    // Cleanup OTP store periodically.
    cleanupOtpStore().catch(console.error);

    // Handle callback queries (inline keyboard buttons).
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return NextResponse.json({ status: "ok" });
    }

    // Must be a text message.
    if (!update.message?.text) {
      return NextResponse.json({ status: "ok" });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text.trim();
    const from = update.message.from;

    // Route commands.
    if (text.startsWith("/")) {
      await handleCommand(text, chatId, from);
    } else {
      // Natural language → orchestrator (bila user sudah linked).
      await handleMessage(text, chatId, from);
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[telegram webhook] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleCommand(
  text: string,
  chatId: number,
  from?: TelegramFrom
) {
  const parts = text.split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ");

  switch (cmd) {
    case "/start": {
      // Cek apakah user sudah linked.
      const linked = await resolveUserId(from);
      if (!linked) {
        // BELUM LOGIN — tampilkan onboarding popup.
        await sendTelegram(
          chatId,
          "👋 *Selamat datang di EduSparq AI!*\n\n" +
            "Saya asisten akademik AI untuk mahasiswa Indonesia. Untuk mulai mengobrol \\& menggunakan semua fitur, Anda perlu *menghubungkan akun EduSparq* Anda dulu.\n\n" +
            "💡 *Belum punya akun?* Daftar gratis — dapat 1.000 credit percobaan!\n\n" +
            "Setelah login di web, buka *Pengaturan → Telegram* untuk dapatkan kode OTP, lalu kirim:\n" +
            "`/link <kode-otp>`",
          { replyMarkup: buildOnboardingMenu() }
        );
      } else {
        // SUDAH LINKED — menu utama kategori.
        await connectDB();
        const user = await User.findById(linked).lean();
        const name = user?.name || "Pengguna";
        await sendTelegram(
          chatId,
          "👋 Halo *" + name + "*! 👋\n\n" +
            "Pilih kategori menu di bawah ini, atau langsung *ketik pertanyaan* apapun untuk chat dengan AI.\n\n" +
            "🤖 Orchestrator otomatis pilih jalur terbaik (Simple/Medium/Complex).",
          { replyMarkup: buildMainMenu(from?.id ? String(from.id) : "unknown") }
        );
      }
      break;
    }

    case "/help":
      await sendTelegram(
        chatId,
        "📋 *Daftar Command*\n\n" +
          "/start — Pesan pembuka\n" +
          "/link `<otp>` — Hubungkan akun web\n" +
          "/unlink — Putuskan hubungan akun\n" +
          "/saldo — Cek saldo credit\n" +
          "/mode — Ubah mode agent (auto/simple)\n" +
          "/tugas — Deadline \\& tugas terdekat\n" +
          "/jadwal — Jadwal kuliah hari ini\n\n" +
          "💡 *Ketik pertanyaan apapun* untuk langsung chat dengan AI.\n" +
          "Orchestrator akan memilih jalur terbaik otomatis."
      );
      break;

    case "/link":
      if (!arg) {
        await sendTelegram(chatId, "⚠️ Kode OTP diperlukan.\n\nBuka EduSparq web → Pengaturan → Telegram → Dapatkan OTP.\nLalu kirim: `/link <kode>`");
        return;
      }
      await handleLink(arg, chatId, from);
      break;

    case "/unlink":
      await handleUnlink(chatId, from);
      break;

    case "/saldo":
      await handleSaldo(chatId, from);
      break;

    case "/mode":
      await sendTelegram(chatId, "⚙️ Pilih mode agent:", {
        replyMarkup: buildModeKeyboard(from?.id ? String(from.id) : "unknown"),
      });
      break;

    case "/tugas":
      await handleTugas(chatId, from);
      break;

    case "/jadwal":
      await handleJadwal(chatId, from);
      break;

    default:
      await sendTelegram(chatId, "❓ Command tidak dikenali. Ketik `/help` untuk bantuan.");
  }
}

// ─── Link Handler ───────────────────────────────────────────────────────────

async function handleLink(
  otp: string,
  chatId: number,
  from?: TelegramFrom
) {
  const userId = await verifyOtp(otp);
  if (!userId) {
    await sendTelegram(chatId, "❌ Kode OTP tidak valid atau sudah kadaluarsa.\nCoba generate ulang di web.");
    return;
  }

  await connectDB();

  // Deactivate any existing link for this telegramId.
  await TelegramLink.updateMany({ telegramId: String(from?.id), active: true }, { active: false });

  // Create new link.
  await TelegramLink.create({
    userId,
    telegramId: String(from?.id),
    telegramUsername: from?.username || "",
    chatId: String(chatId),
    active: true,
  });

  const user = await User.findById(userId).lean();
  const name = user?.name || "Pengguna";

  await sendTelegram(
    chatId,
    "✅ Akun berhasil terhubung!\n\n" +
      `👤 *${name}*\n` +
      `🔗 Telegram ID: ${from?.id}\n` +
      `${from?.username ? `@${from.username}` : ""}\n\n` +
      "Sekarang Anda bisa mengakses semua fitur EduSparq langsung dari Telegram.\nKetik pertanyaan atau tugas untuk mulai!"
  );
}

// ─── Unlink Handler ─────────────────────────────────────────────────────────

async function handleUnlink(chatId: number, from?: TelegramFrom) {
  if (!from?.id) return;
  await connectDB();
  const result = await TelegramLink.updateMany(
    { telegramId: String(from.id), active: true },
    { active: false }
  );
  if (result.modifiedCount > 0) {
    await sendTelegram(chatId, "🔓 Akun berhasil diputuskan dari EduSparq.\nKirim `/link <otp>` untuk menghubungkan kembali.");
  } else {
    await sendTelegram(chatId, "ℹ️ Tidak ada akun yang terhubung dengan Telegram ini.");
  }
}

// ─── Saldo Handler ──────────────────────────────────────────────────────────

async function handleSaldo(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const balance = await getBalance(userId);
  const user = await User.findById(userId).lean();
  const plan = (user?.plan || "free").toUpperCase();
  await sendTelegram(
    chatId,
    formatCreditBalance(balance) +
      "\n📋 Plan: *" + plan + "*\n" +
      "\nTop up credit di: web EduSparq → Billing"
  );
}

// ─── Tugas Handler ──────────────────────────────────────────────────────────

async function handleTugas(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const deadlines = await Deadline.find({ userId })
    .sort({ dueDate: 1 })
    .limit(5)
    .lean();

  if (deadlines.length === 0) {
    await sendTelegram(chatId, "📋 Belum ada tugas terdaftar.\nTambahkan di web EduSparq → Tugas \\& Tenggat.");
    return;
  }

  const now = Date.now();
  const lines = ["📋 *Tugas \\& Tenggat Terdekat*\n"];
  for (const d of deadlines) {
    const due = new Date(d.dueDate);
    const daysLeft = Math.ceil((due.getTime() - now) / (1000 * 60 * 60 * 24));
    const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 3 ? "🟡" : "🟢";
    const dateStr = due.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    lines.push(urgency + " *" + (d.title || "Tugas") + "* — " + dateStr + " (" + daysLeft + " hari lagi)");
    if (d.courseName) lines.push("   📚 " + d.courseName);
  }
  await sendTelegram(chatId, lines.join("\n"));
}

// ─── Jadwal Handler ─────────────────────────────────────────────────────────

async function handleJadwal(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const schedules = await ClassSchedule.find({
    userId,
    day: today,
  })
    .sort({ startTime: 1 })
    .limit(10)
    .lean();

  if (schedules.length === 0) {
    await sendTelegram(chatId, "🗓️ Tidak ada jadwal hari ini (" + today + ").\nKelola jadwal di web EduSparq → Jadwal.");
    return;
  }

  const lines = ["🗓️ *Jadwal Hari Ini (" + today + ")*\n"];
  for (const s of schedules) {
    lines.push("⏰ " + (s.startTime || "") + "–" + (s.endTime || "") + " — *" + (s.courseName || "Mata Kuliah") + "*");
    if (s.room) lines.push("   📍 " + s.room);
  }
  await sendTelegram(chatId, lines.join("\n"));
}

// ─── Natural Message Handler → Orchestrator ─────────────────────────────────

async function handleMessage(
  text: string,
  chatId: number,
  from?: TelegramFrom
) {
  // Rate limit per user.
  const tid = String(from?.id || chatId);
  if (isOnCooldown(tid)) {
    await sendTelegram(chatId, "⏳ Tunggu sebentar ya, pesan terlalu cepat.");
    return;
  }

  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(
      chatId,
      "👋 Bot EduSparq bisa membantu tugas kuliah Anda!\n\nHubungkan akun dulu dengan:\n`/link <kode OTP>`\n\nDapatkan OTP di: web EduSparq → Pengaturan → Telegram."
    );
    return;
  }

  // Check credit.
  await connectDB();
  const balance = await getBalance(userId);
  if (balance <= 0) {
    await sendTelegram(
      chatId,
      "⚠️ Credit Anda habis.\nIsi ulang di web EduSparq → Billing, atau aktifkan BYOK di Pengaturan AI."
    );
    return;
  }

  // Send "typing" indicator.
  const bot = getBot();
  if (bot) {
    try { await bot.sendChatAction(chatId, "typing"); } catch {}
  }

  try {
    // Call orchestrator directly (internal, no HTTP overhead).
    const { runOrchestrator } = await import("../../../lib/agents/orchestrator");
    const result = await runOrchestrator({ userId, request: text });

    // Build response with trace summary.
    let response = result.output;
    if (result.pendingClarification?.length) {
      response += "\n\n❓ *Pertanyaan Klarifikasi:*\n" +
        result.pendingClarification.map((q, i) => (i + 1) + ". " + q).join("\n") +
        "\n\n_Balas dengan jawaban, atau ketik lanjut untuk pakai asumsi._";
    }

    // Append trace (compact, only if multi-agent).
    if (result.trace.length > 1) {
      response += formatTrace(result.trace);
      response += "\n💰 *Total*: " + result.totalCreditCost.toFixed(1) + " credit";
    }

    await sendLongMessage(chatId, response);
  } catch (err) {
    console.error("[telegram] orchestrator error:", err);
    let msg = "❌ Gagal memproses permintaan. Coba lagi.";
    if (err instanceof InsufficientCreditsError) {
      msg = "⚠️ Credit tidak cukup untuk operasi ini. Isi ulang di Billing.";
    }
    await sendTelegram(chatId, msg);
  }
}

// ─── Callback Query Handler (Inline Keyboard) ────────────────────────────────

async function handleCallback(callback: TelegramCallbackQuery) {
  const chatId = callback.message.chat.id;
  const data = callback.data;

  // Acknowledge callback.
  const bot = getBot();
  if (bot) {
    try { bot.answerCallbackQuery(callback.id); } catch {}
  }

  // Extract userId from callback data (last segment after _).
  const segments = data.split("_");
  const callbackType = segments[0];
  const cbUserId = segments[segments.length - 1];

  if (callbackType === "chat" || callbackType === "saldo" || callbackType === "deadline" || callbackType === "schedule" || callbackType === "help" || callbackType === "menu") {
    // These need actual linked user — try to resolve.
    const userId = await resolveUserIdById(cbUserId);
    if (!userId) {
      await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>`.");
      return;
    }
    await connectDB();
  }

  if (callbackType === "menu") {
    await sendTelegram(chatId, "🏠 *Menu Utama* — pilih aksi:", {
      replyMarkup: buildMainMenu(cbUserId),
    });
  } else if (callbackType === "cat") {
    // Kategori menu: cat_<akademik|tugas|jadwal|akun>_<telegramId>
    const sub = segments[1];
    if (sub === "akademik") {
      await sendTelegram(chatId, "📚 *Akademik* — pilih fitur:", { replyMarkup: buildAkademikMenu(cbUserId) });
    } else if (sub === "tugas") {
      await sendTelegram(chatId, "📋 *Tugas & Tenggat* — pilih aksi:", { replyMarkup: buildTugasMenu(cbUserId) });
    } else if (sub === "jadwal") {
      await sendTelegram(chatId, "🗓️ *Jadwal* — pilih aksi:", { replyMarkup: buildJadwalMenu(cbUserId) });
    } else if (sub === "akun") {
      await sendTelegram(chatId, "💰 *Akun* — pilih aksi:", { replyMarkup: buildAkunMenu(cbUserId) });
    }
  } else if (callbackType === "saldo") {
    await handleSaldo(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "deadline") {
    await handleTugas(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "schedule") {
    await handleJadwal(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "help") {
    await sendTelegram(chatId, "📋 Ketik `/help` untuk daftar lengkap command.");
  } else if (callbackType === "setmode") {
    // data = "setmode_auto_<telegramId>" or "setmode_simple_<telegramId>"
    const mode = segments[1]; // "auto" or "simple"
    const telegramId = segments[segments.length - 1];
    await connectDB();
    // Resolve real MongoDB userId via TelegramLink (cbUserId is telegramId, NOT _id).
    const link = await TelegramLink.findOne({ telegramId, active: true }).lean();
    if (link) {
      await User.findByIdAndUpdate(link.userId, { agentMode: mode }).catch(() => {});
    }
    const modeLabel = mode === "auto" ? "*Auto (Orchestrator)*" : "*Simple (Langsung)*";
    const modeDesc = mode === "auto"
      ? "Bot akan memilih jalur agent terbaik otomatis."
      : "Bot akan menjawab langsung tanpa multi-agent pipeline.";
    await sendTelegram(chatId, "✅ Mode diubah ke " + modeLabel + ".\n" + modeDesc, {
      replyMarkup: buildMainMenu(telegramId),
    });
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Resolve userId dari Telegram from object. */
async function resolveUserId(from?: TelegramFrom): Promise<string | null> {
  if (!from?.id) return null;
  await connectDB();
  const link = await TelegramLink.findOne({
    telegramId: String(from.id),
    active: true,
  }).lean();
  return link ? String(link.userId) : null;
}

/** Resolve userId dari string ID (untuk callback queries). */
async function resolveUserIdById(id?: string): Promise<string | null> {
  if (!id) return null;
  await connectDB();
  const link = await TelegramLink.findOne({
    telegramId: id,
    active: true,
  }).lean();
  return link ? String(link.userId) : null;
}
