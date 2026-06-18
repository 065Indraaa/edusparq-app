import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongodb";
import { TelegramLink } from "../../../../lib/db/models/TelegramLink";
import { User } from "../../../../lib/db/models/User";
import { Deadline } from "../../../../lib/db/models/Deadline";
import { sendTelegram } from "../../../../lib/telegram";
import { getBalance } from "../../../../lib/credit-billing";
import { ClassSchedule } from "../../../../lib/db/models/ClassSchedule";

/**
 * GET /api/telegram/notify?token=<CRON_SECRET>&type=deadline|morning
 *
 * Cron job endpoint untuk notifikasi proaktif ke user Telegram yang sudah linked.
 * Dijalankan oleh external cron (Vercel Cron, GitHub Actions, cron-job.org, dll).
 *
 * Notifikasi yang dikirim:
 *   type=deadline (default):
 *     1. Deadline reminder — tugas yang jatuh tempo dalam 1-3 hari.
 *     2. Low credit alert — saldo < 50 credit.
 *   type=morning:
 *     1. Good morning motivation + ringkasan jadwal & tugas hari ini.
 *
 * Keamanan: butuh header Authorization Bearer atau ?token= yang cocok
 * TELEGRAM_NOTIFY_TOKEN (env). Mencegah trigger publik spam.
 *
 * Cron rekomendasi:
 *   - deadline: setiap 12 jam (08:00 & 20:00 WIB)
 *   - morning: 07:00 WIB harian
 */

const LOW_CREDIT_THRESHOLD = 50;
const DEADLINE_REMINDER_DAYS = 3;

export async function GET(req: NextRequest) {
  // Auth via token (header atau query).
  const authHeader = req.headers.get("authorization") || "";
  const bearerToken = authHeader.replace(/^Bearer\s+/i, "").trim();
  const queryToken = new URL(req.url).searchParams.get("token") || "";
  const token = bearerToken || queryToken;

  const expectedToken = process.env.TELEGRAM_NOTIFY_TOKEN;
  if (!expectedToken) {
    return NextResponse.json(
      { error: "TELEGRAM_NOTIFY_TOKEN belum dikonfigurasi di env." },
      { status: 503 }
    );
  }
  if (token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "deadline";

  // Ambil semua link Telegram aktif.
  const links = await TelegramLink.find({ active: true })
    .lean<{ _id: string; userId: string; chatId: string; telegramUsername: string }[]>();

  const stats = {
    processed: 0,
    deadlineReminders: 0,
    lowCreditAlerts: 0,
    morningMessages: 0,
    errors: 0,
  };

  const now = new Date();
  const todayStr = now.toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

  for (const link of links) {
    stats.processed++;
    const userId = String(link.userId);
    const chatId = link.chatId;

    try {
      if (type === "morning") {
        await sendMorningMessage(chatId, userId, todayStr);
        stats.morningMessages++;
      } else {
        await sendDeadlineAndCreditAlerts(chatId, userId, now);
      }
    } catch (err) {
      console.error("[telegram/notify] error for user", userId, err);
      stats.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    type,
    stats,
    timestamp: new Date().toISOString(),
  });
}

async function sendDeadlineAndCreditAlerts(chatId: string, userId: string, now: Date) {
  const reminderWindowMs = DEADLINE_REMINDER_DAYS * 24 * 60 * 60 * 1000;
  const nowTs = now.getTime();

  // ─── 1. Deadline reminder ────────────────────────────────────────────
  const deadlines = await Deadline.find({ userId })
    .sort({ dueDate: 1 })
    .lean<{ title: string; dueDate: string; courseName: string }[]>();

  const upcoming = deadlines.filter((d) => {
    const due = new Date(d.dueDate).getTime();
    const diff = due - nowTs;
    return diff >= 0 && diff <= reminderWindowMs;
  });

  if (upcoming.length > 0) {
    const lines = ["⏰ *Pengingat Tugas Terdekat*\n"];
    for (const d of upcoming.slice(0, 5)) {
      const due = new Date(d.dueDate);
      const daysLeft = Math.max(0, Math.ceil((due.getTime() - nowTs) / (1000 * 60 * 60 * 24)));
      const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 2 ? "🟡" : "🟢";
      const dateStr = due.toLocaleDateString("id-ID", { day: "2-digit", month: "short" });
      lines.push(urgency + " *" + (d.title || "Tugas") + "*\n   " + dateStr + " (" + daysLeft + " hari)");
      if (d.courseName) lines.push("   📚 " + d.courseName);
    }
    await sendTelegram(chatId, lines.join("\n"));
  }

  // ─── 2. Low credit alert ─────────────────────────────────────────────
  const balance = await getBalance(userId);
  if (balance < LOW_CREDIT_THRESHOLD) {
    await sendTelegram(
      chatId,
      "⚠️ *Saldo Credit Rendah*\n\n" +
        "Saldo Anda tinggal *" + balance + " credit*.\n" +
        "Isi ulang di web EduSparq → Billing agar bisa lanjut pakai AI.\n\n" +
        "_Atau aktifkan BYOK (kunci sendiri) di Pengaturan AI untuk pakai gratis._"
    );
  }
}

async function sendMorningMessage(chatId: string, userId: string, todayStr: string) {
  const [user, deadlines, schedules] = await Promise.all([
    User.findById(userId).lean<{ name?: string }>(),
    Deadline.find({ userId, status: "pending" }).sort({ dueDate: 1 }).lean<{ title: string; dueDate: string; courseName: string }[]>(),
    ClassSchedule.find({ userId }).sort({ startTime: 1 }).lean<{ courseName?: string; day?: string; startTime?: string; room?: string }[]>(),
  ]);

  const name = user?.name ? user.name.split(" ")[0] : "Sobat";
  const quotes = [
    "Hari baru, peluang baru. Mulai dengan satu langkah kecil yang konsisten.",
    "Produktivitas bukan tentang sempurna, tapi tentang tetap berjalan.",
    "Fokus pada progress, bukan perfection. Kamu sudah lebih baik dari kemarin.",
    "Setiap tugas yang diselesaikan adalah investasi untuk masa depanmu.",
    "Jangan tunggu mood yang tepat — bangun mood itu dengan aksi.",
  ];
  const quote = quotes[Math.floor(Math.random() * quotes.length)];

  const todayEn = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const todaySchedules = schedules.filter((s) => s.day?.toLowerCase() === todayEn).slice(0, 5);
  const todayDeadlines = deadlines.filter((d) => {
    const due = new Date(d.dueDate).toDateString();
    return due === new Date().toDateString();
  });
  const upcomingDeadlines = deadlines.filter((d) => {
    const due = new Date(d.dueDate).getTime();
    const diff = due - Date.now();
    return diff > 0 && diff <= 3 * 24 * 60 * 60 * 1000;
  }).slice(0, 3);

  const lines = [
    `🌅 *Selamat pagi, ${name}!*`,
    `📅 ${todayStr}\n`,
    `💬 *Motivasi Hari Ini:*\n_${quote}_\n`,
  ];

  if (todaySchedules.length > 0) {
    lines.push("🗓️ *Jadwal Kuliah Hari Ini:*");
    for (const s of todaySchedules) {
      lines.push(`⏰ ${s.startTime || ""} — *${s.courseName || "Matkul"}*${s.room ? ` (📍 ${s.room})` : ""}`);
    }
    lines.push("");
  }

  if (todayDeadlines.length > 0) {
    lines.push("🔴 *Tenggat Hari Ini:*");
    for (const d of todayDeadlines) {
      lines.push(`• *${d.title}*${d.courseName ? ` — ${d.courseName}` : ""}`);
    }
    lines.push("");
  } else if (upcomingDeadlines.length > 0) {
    lines.push("⏰ *Tenggat 3 Hari ke Depan:*");
    for (const d of upcomingDeadlines) {
      const due = new Date(d.dueDate);
      const daysLeft = Math.ceil((due.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      lines.push(`• *${d.title}* — ${daysLeft} hari lagi${d.courseName ? ` (${d.courseName})` : ""}`);
    }
    lines.push("");
  }

  lines.push("Semangat berproduktif! 🚀");

  await sendTelegram(chatId, lines.join("\n"));
}
