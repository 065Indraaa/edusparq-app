import { NextRequest, NextResponse } from "next/server";

/**
 * Lightweight route gate (Edge middleware).
 *
 * IMPORTANT: This intentionally does NOT import `@/lib/auth` because that module
 * pulls in mongoose/bcrypt, which are not Edge-runtime compatible and would break
 * middleware. Instead we only check for the *presence* of the NextAuth v5 session
 * cookie. This is a cheap gate to bounce obviously-unauthenticated visitors to the
 * login page — it does NOT validate/verify the token. Real validation (decoding the
 * JWT + DB checks) happens inside the API routes via `await auth()`.
 *
 * TODO: upgrade to a split, edge-safe `auth.config.ts` (providers without the DB
 * adapter) so middleware can verify the JWT instead of just sniffing the cookie.
 */

// NextAuth v5 (Auth.js) session cookie names: dev uses the unprefixed name,
// prod (HTTPS) uses the `__Secure-` prefixed variant.
const SESSION_COOKIES = ["authjs.session-token", "__Secure-authjs.session-token"];

export function middleware(req: NextRequest) {
  const hasSession = SESSION_COOKIES.some((name) => req.cookies.has(name));

  if (!hasSession) {
    const { pathname, search } = req.nextUrl;
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/workspace/:path*",
    "/deadlines/:path*",
    "/tutor/:path*",
    "/writing/:path*",
    "/collab/:path*",
    "/exams/:path*",
    "/analytics/:path*",
    "/research/:path*",
  ],
};
