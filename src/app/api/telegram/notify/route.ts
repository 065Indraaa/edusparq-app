import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongodb";
import { TelegramLink } from "../../../../lib/db/models/TelegramLink";
import { User } from "../../../../lib/db/models/User";
import { Deadline } from "../../../../lib/db/models/Deadline";
import { sendTelegram } from "../../../../lib/telegram";
import { getBalance } from "../../../../lib/credit-billing";

/**
 * GET /api/telegram/notify?token=<CRON_SECRET>
 *
 * Cron job endpoint untuk notifikasi proaktif ke user Telegram yang sudah linked.
 * Dijalankan oleh external cron (Vercel Cron, GitHub Actions, cron-job.org, dll).
 *
 * Notifikasi yang dikirim:
 *   1. Deadline reminder — tugas yang jatuh tempo dalam 1-3 hari.
 *   2. Low credit alert — saldo < 50 credit.
 *
 * Keamanan: butuh header Authorization Bearer atau ?token= yang cocok
 * TELEGRAM_NOTIFY_TOKEN (env). Mencegah trigger publik spam.
 *
 * Cron rekomendasi: setiap 12 jam (08:00 & 20:00 WIB).
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

  // Ambil semua link Telegram aktif.
  const links = await TelegramLink.find({ active: true })
    .lean<{ _id: string; userId: string; chatId: string; telegramUsername: string }[]>();

  const stats = {
    processed: 0,
    deadlineReminders: 0,
    lowCreditAlerts: 0,
    errors: 0,
  };

  const now = Date.now();
  const reminderWindowMs = DEADLINE_REMINDER_DAYS * 24 * 60 * 60 * 1000;

  for (const link of links) {
    stats.processed++;
    const userId = String(link.userId);
    const chatId = link.chatId;

    try {
      // ─── 1. Deadline reminder ────────────────────────────────────────────
      const deadlines = await Deadline.find({ userId })
        .sort({ dueDate: 1 })
        .lean<{ title: string; dueDate: string; courseName: string }[]>();

      const upcoming = deadlines.filter((d) => {
        const due = new Date(d.dueDate).getTime();
        const diff = due - now;
        return diff >= 0 && diff <= reminderWindowMs; // 0-3 hari ke depan
      });

      if (upcoming.length > 0) {
        const lines = ["⏰ *Pengingat Tugas Terdekat*\n"];
        for (const d of upcoming.slice(0, 5)) {
          const due = new Date(d.dueDate);
          const daysLeft = Math.max(
            0,
            Math.ceil((due.getTime() - now) / (1000 * 60 * 60 * 24))
          );
          const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 2 ? "🟡" : "🟢";
          const dateStr = due.toLocaleDateString("id-ID", {
            day: "2-digit",
            month: "short",
          });
          lines.push(
            urgency + " *" + (d.title || "Tugas") + "*\n   " + dateStr + " (" + daysLeft + " hari)"
          );
          if (d.courseName) lines.push("   📚 " + d.courseName);
        }
        await sendTelegram(chatId, lines.join("\n"));
        stats.deadlineReminders++;
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
        stats.lowCreditAlerts++;
      }
    } catch (err) {
      console.error("[telegram/notify] error for user", userId, err);
      stats.errors++;
    }
  }

  return NextResponse.json({
    success: true,
    stats,
    timestamp: new Date().toISOString(),
  });
}
