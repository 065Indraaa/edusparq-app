import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { isPusherConfigured, getPusherServer } from "../../../lib/pusher";

interface CollabBody {
  channel?: unknown;
  event?: unknown;
  data?: unknown;
}

/**
 * Sanitize a channel name to a safe, namespaced room. Only keeps a small set of
 * allowed characters and guarantees a `collab-` prefix so clients can only emit
 * into collaboration rooms.
 */
function sanitizeChannel(raw: string): string {
  const cleaned = raw.trim().replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 100);
  return cleaned.startsWith("collab-") ? cleaned : `collab-${cleaned}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isPusherConfigured()) {
    return NextResponse.json(
      { error: "Realtime belum dikonfigurasi (Pusher)." },
      { status: 503 }
    );
  }

  try {
    const body = (await req.json()) as CollabBody;
    const { channel, event, data } = body;

    if (typeof channel !== "string" || channel.trim().length === 0) {
      return NextResponse.json(
        { error: "Parameter 'channel' wajib berupa teks." },
        { status: 400 }
      );
    }
    if (typeof event !== "string" || event.trim().length === 0) {
      return NextResponse.json(
        { error: "Parameter 'event' wajib berupa teks." },
        { status: 400 }
      );
    }

    const safeChannel = sanitizeChannel(channel);
    const payload =
      data && typeof data === "object" ? (data as Record<string, unknown>) : {};

    const pusherServer = getPusherServer();
    await pusherServer.trigger(safeChannel, event, {
      ...payload,
      senderId: session.user.id,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[collab] gagal mengirim event realtime:", err);
    return NextResponse.json(
      { error: "Gagal mengirim pembaruan realtime. Coba lagi nanti." },
      { status: 500 }
    );
  }
}
