import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import { isGoogleConfigured } from "@/lib/google";

export const runtime = "nodejs";

// GET /api/google/status — { configured, connected, email }
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const user = (await User.findById(session.user.id).lean()) as
    | { connectedGoogleCalendar?: boolean; googleEmail?: string }
    | null;

  return NextResponse.json({
    configured: isGoogleConfigured(),
    connected: Boolean(user?.connectedGoogleCalendar),
    email: user?.googleEmail || "",
  });
}
