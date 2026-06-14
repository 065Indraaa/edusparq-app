import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import { exchangeCode } from "@/lib/google";

export const runtime = "nodejs";

// GET /api/google/callback — Google redirects here with ?code=...
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const code = req.nextUrl.searchParams.get("code");
  const err = req.nextUrl.searchParams.get("error");
  if (err || !code) {
    return NextResponse.redirect(new URL("/profile?google=error", req.url));
  }

  const tokens = await exchangeCode(code, req.nextUrl.origin);
  if (!tokens.access_token) {
    return NextResponse.redirect(new URL("/profile?google=error", req.url));
  }

  await connectDB();
  const expiry = Date.now() + (tokens.expires_in || 3600) * 1000;
  const update: Record<string, unknown> = {
    googleAccessToken: tokens.access_token,
    googleTokenExpiry: expiry,
    connectedGoogleCalendar: true,
  };
  // Google only returns a refresh_token on the first consent — keep the old one
  // if this grant didn't include one.
  if (tokens.refresh_token) update.googleRefreshToken = tokens.refresh_token;

  await User.findByIdAndUpdate(session.user.id, { $set: update });

  return NextResponse.redirect(new URL("/profile?google=connected", req.url));
}
