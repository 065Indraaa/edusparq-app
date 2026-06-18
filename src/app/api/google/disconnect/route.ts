import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { User } from "../../../../lib/db/models/User";

export const runtime = "nodejs";

// POST /api/google/disconnect — clear stored Google tokens.
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  await User.findByIdAndUpdate(session.user.id, {
    $set: {
      googleAccessToken: "",
      googleRefreshToken: "",
      googleTokenExpiry: 0,
      connectedGoogleCalendar: false,
      googleEmail: "",
    },
  });

  return NextResponse.json({ success: true });
}
