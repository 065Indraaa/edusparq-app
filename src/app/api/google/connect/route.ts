import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isGoogleConfigured, buildAuthUrl } from "@/lib/google";

export const runtime = "nodejs";

// GET /api/google/connect — start the Google OAuth consent flow.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL("/profile?google=unconfigured", req.url));
  }
  const url = buildAuthUrl(session.user.id, req.nextUrl.origin);
  return NextResponse.redirect(url);
}
