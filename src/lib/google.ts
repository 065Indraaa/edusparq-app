import { connectDB } from "../lib/db/mongodb";
import { User } from "../lib/db/models/User";

/**
 * Google Calendar integration via plain OAuth 2.0 + REST (no SDK dependency).
 *
 * Degrades gracefully: if GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set,
 * `isGoogleConfigured()` returns false and all connect endpoints short-circuit
 * to a friendly "belum dikonfigurasi" state — the build and app never break.
 *
 * Required env:
 *   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET   (Google Cloud Console OAuth client)
 *   GOOGLE_REDIRECT_URI  (optional; defaults to <NEXTAUTH_URL>/api/google/callback)
 * Enable "Google Calendar API" in the same Cloud project.
 * Authorized redirect URI must be exactly <app-url>/api/google/callback.
 */

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const CALENDAR_EVENTS_URL =
  "https://www.googleapis.com/calendar/v3/calendars/primary/events";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
  "openid",
].join(" ");

export function isGoogleConfigured(): boolean {
  const id = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.GOOGLE_CLIENT_SECRET;
  return Boolean(
    id &&
      secret &&
      id.trim().length > 0 &&
      secret.trim().length > 0 &&
      !id.toLowerCase().includes("your")
  );
}

export function getRedirectUri(origin?: string): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = origin || process.env.NEXTAUTH_URL || "http://localhost:3000";
  return `${base.replace(/\/$/, "")}/api/google/callback`;
}

export function buildAuthUrl(state: string, origin?: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID as string,
    redirect_uri: getRedirectUri(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    include_granted_scopes: "true",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export interface TokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

export async function exchangeCode(
  code: string,
  origin?: string
): Promise<TokenResponse> {
  try {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      redirect_uri: getRedirectUri(origin),
      grant_type: "authorization_code",
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return (await res.json()) as TokenResponse;
  } catch {
    return { error: "exchange_failed" };
  }
}

export async function refreshAccessToken(
  refreshToken: string
): Promise<TokenResponse> {
  try {
    const body = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID as string,
      client_secret: process.env.GOOGLE_CLIENT_SECRET as string,
      grant_type: "refresh_token",
    });
    const res = await fetch(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    return (await res.json()) as TokenResponse;
  } catch {
    return { error: "refresh_failed" };
  }
}

interface GoogleUserDoc {
  googleAccessToken?: string;
  googleRefreshToken?: string;
  googleTokenExpiry?: number;
}

/** Returns a valid access token, refreshing (and persisting) if near expiry. */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  await connectDB();
  const user = (await User.findById(userId).lean()) as GoogleUserDoc | null;
  if (!user) return null;
  const now = Date.now();
  if (
    user.googleAccessToken &&
    user.googleTokenExpiry &&
    user.googleTokenExpiry > now + 60_000
  ) {
    return user.googleAccessToken;
  }
  if (!user.googleRefreshToken) return user.googleAccessToken || null;

  const refreshed = await refreshAccessToken(user.googleRefreshToken);
  if (!refreshed.access_token) return null;
  const expiry = now + (refreshed.expires_in || 3600) * 1000;
  await User.findByIdAndUpdate(userId, {
    $set: { googleAccessToken: refreshed.access_token, googleTokenExpiry: expiry },
  });
  return refreshed.access_token;
}

/** Creates a Calendar event. Returns the event id, or null on failure. */
export async function createCalendarEvent(
  token: string,
  ev: { summary: string; description?: string; date: string; time?: string }
): Promise<string | null> {
  try {
    let start: Record<string, string>;
    let end: Record<string, string>;
    if (ev.time && /^\d{2}:\d{2}/.test(ev.time)) {
      start = { dateTime: `${ev.date}T${ev.time}:00`, timeZone: "Asia/Jakarta" };
      end = { dateTime: `${ev.date}T${ev.time}:00`, timeZone: "Asia/Jakarta" };
    } else {
      start = { date: ev.date };
      end = { date: ev.date };
    }
    const res = await fetch(CALENDAR_EVENTS_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: ev.summary,
        description: ev.description || "",
        start,
        end,
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { id?: string };
    return data.id || null;
  } catch {
    return null;
  }
}
