import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { ADMIN_USER_IDS } from "@/lib/credit-config";

/**
 * GET /api/telegram/setup?action=set|delete|status
 *
 * Mengelola webhook Telegram bot. HANYA ADMIN yang bisa akses.
 * User biasa tidak perlu setup webhook — webhook adalah konfigurasi global
 * satu kali oleh admin/dev. User cukup paste OTP untuk connect.
 *
 * - action=set&url=<WEBHOOK_URL>    → daftarkan webhook
 * - action=delete                   → hapus webhook (bot pakai polling mode)
 * - action=status                   → cek info webhook saat ini
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized — login diperlukan." }, { status: 401 });
  }

  // Hanya admin yang boleh kelola webhook.
  if (!ADMIN_USER_IDS.includes(session.user.id)) {
    return NextResponse.json(
      { error: "Forbidden — hanya admin yang bisa mengelola webhook." },
      { status: 403 }
    );
  }

  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: "TELEGRAM_BOT_TOKEN belum dikonfigurasi di .env.local" },
      { status: 503 }
    );
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "status";
  const webhookUrl = searchParams.get("url");

  const baseUrl = `https://api.telegram.org/bot${token}`;

  try {
    // 1. Verifikasi token valid via getMe.
    const meRes = await fetch(`${baseUrl}/getMe`);
    const meData = await meRes.json();
    if (!meData.ok) {
      return NextResponse.json(
        {
          error: "Token bot TIDAK VALID. Cek TELEGRAM_BOT_TOKEN di .env.local",
          telegramError: meData.description,
        },
        { status: 400 }
      );
    }

    const botInfo = {
      id: meData.result.id,
      username: meData.result.username,
      firstName: meData.result.first_name,
      canJoinGroups: meData.result.can_join_groups,
      supportsInlineQueries: meData.result.supports_inline_queries,
    };

    // 2. Eksekusi action.
    if (action === "set") {
      if (!webhookUrl) {
        return NextResponse.json(
          {
            error: 'Parameter "url" wajib untuk action=set. Contoh: ?action=set&url=https://domain-anda.com/api/telegram',
            hint: "URL harus HTTPS publik, dan mengarah ke endpoint POST /api/telegram",
          },
          { status: 400 }
        );
      }
      if (!webhookUrl.startsWith("https://")) {
        return NextResponse.json(
          { error: "Webhook URL harus HTTPS (syarat Telegram)." },
          { status: 400 }
        );
      }
      const setRes = await fetch(`${baseUrl}/setWebhook?url=${encodeURIComponent(webhookUrl)}&drop_pending_updates=true`);
      const setData = await setRes.json();
      return NextResponse.json({
        ok: setData.ok,
        action: "set",
        bot: botInfo,
        webhookUrl,
        telegramResponse: setData.description,
      });
    }

    if (action === "delete") {
      const delRes = await fetch(`${baseUrl}/deleteWebhook`);
      const delData = await delRes.json();
      return NextResponse.json({
        ok: delData.ok,
        action: "delete",
        bot: botInfo,
        telegramResponse: delData.description,
      });
    }

    // action=status (default)
    const infoRes = await fetch(`${baseUrl}/getWebhookInfo`);
    const infoData = await infoRes.json();
    return NextResponse.json({
      ok: true,
      action: "status",
      bot: botInfo,
      webhook: infoData.ok ? infoData.result : null,
      hint: infoData.result?.pending_update_count > 0
        ? `Ada ${infoData.result.pending_update_count} update pending. Bila webhook gagal, cek last_error_message.`
        : undefined,
    });
  } catch (err) {
    console.error("[telegram setup] error:", err);
    return NextResponse.json(
      { error: "Gagal menghubungi Telegram API. Cek koneksi internet.", detail: String(err) },
      { status: 502 }
    );
  }
}
