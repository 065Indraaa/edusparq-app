import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { TelegramLink } from "../../../../lib/db/models/TelegramLink";
import { storeOtp, sendTelegram } from "../../../../lib/telegram";

/**
 * POST /api/telegram/link
 *
 * Generate OTP 6-digit untuk menghubungkan akun Telegram.
 * User memanggil ini dari web (sudah login), mendapat OTP,
 * lalu mengirim "/link <otp>" ke bot Telegram.
 *
 * Response: { otp: "123456", expiresIn: 300 }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  // Cek apakah user sudah pernah link (boleh re-link, deactivate lama).
  const existing = await TelegramLink.findOne({
    userId: session.user.id,
    active: true,
  });
  if (existing) {
    return NextResponse.json({
      error:
        "Akun Anda sudah terhubung ke Telegram @" +
        (existing.telegramUsername || existing.telegramId) +
        ". Kirim /unlink ke bot untuk memutuskan, lalu coba lagi.",
    });
  }

  const otp = await storeOtp(session.user.id);

  return NextResponse.json({
    otp,
    expiresIn: 300,
    message:
      "Kirim kode ini ke bot Telegram EduSparq:\n/link " +
      otp +
      "\n\nKode berlaku 5 menit.",
  });
}

/**
 * DELETE /api/telegram/link
 *
 * Putuskan hubungan Telegram (unlink).
 * Dipanggil dari web atau via bot command /unlink.
 */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const result = await TelegramLink.updateMany(
    { userId: session.user.id, active: true },
    { active: false }
  );

  return NextResponse.json({
    success: true,
    unlinked: result.modifiedCount,
  });
}

/**
 * GET /api/telegram/link
 *
 * Cek status linking Telegram untuk user yang login.
 * Response: { linked: boolean, username?: string, linkedAt?: string }
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const link = await TelegramLink.findOne({
    userId: session.user.id,
    active: true,
  }).lean();

  return NextResponse.json({
    linked: !!link,
    username: link?.telegramUsername || null,
    linkedAt: link?.linkedAt || null,
  });
}
