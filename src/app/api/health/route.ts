import { NextResponse } from "next/server";

// Force the full Node.js runtime (NOT an edge runtime). MongoDB's driver needs
// raw TCP/TLS sockets, which edge runtimes do not provide.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — open https://<your-app>/api/health in the browser.
 *
 * It NEVER throws and returns a JSON report so you can see, from the client,
 * exactly why login/register is failing in production (missing env vars vs.
 * the database being unreachable from the host).
 *
 * Safe to keep: it does not leak secret values, only whether they are present.
 */
export async function GET() {
  const report: Record<string, unknown> = {
    ok: true,
    build: "2026-06-15-exams-fix-8",
    timestamp: new Date().toISOString(),
    runtime: "nodejs",
    node: typeof process !== "undefined" ? process.version : "unknown",
    env: {
      MONGODB_URI: present(process.env.MONGODB_URI),
      NEXTAUTH_SECRET: present(process.env.NEXTAUTH_SECRET),
      AUTH_SECRET: present(process.env.AUTH_SECRET),
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || null,
      AUTH_TRUST_HOST: process.env.AUTH_TRUST_HOST || null,
      GOOGLE_CLIENT_ID: present(process.env.GOOGLE_CLIENT_ID),
      GOOGLE_CLIENT_SECRET: present(process.env.GOOGLE_CLIENT_SECRET),
      GROQ_API_KEY: present(process.env.GROQ_API_KEY),
      MOONSHOT_API_KEY: present(process.env.MOONSHOT_API_KEY),
      GEMINI_API_KEY: present(process.env.GEMINI_API_KEY),
    },
    database: { attempted: false, connected: false, error: null as string | null },
  };

  // Try a real DB connection so you can tell whether Mongo is reachable from
  // the host (the #1 cause of 500s on register/login when behind serverless).
  if (process.env.MONGODB_URI) {
    (report.database as Record<string, unknown>).attempted = true;
    try {
      const { connectDB } = await import("@/lib/db/mongodb");
      await connectDB();
      (report.database as Record<string, unknown>).connected = true;
    } catch (err) {
      (report.database as Record<string, unknown>).connected = false;
      (report.database as Record<string, unknown>).error =
        err instanceof Error ? `${err.name}: ${err.message}` : String(err);
      report.ok = false;
    }
  } else {
    report.ok = false;
    (report.database as Record<string, unknown>).error = "MONGODB_URI tidak diset";
  }

  // A missing auth secret will break NextAuth even if the DB works.
  if (!process.env.NEXTAUTH_SECRET && !process.env.AUTH_SECRET) {
    report.ok = false;
  }

  return NextResponse.json(report, { status: report.ok ? 200 : 503 });
}

function present(v: string | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0 && !v.includes("your") && !v.includes("GANTI");
}
