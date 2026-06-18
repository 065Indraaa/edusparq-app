import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "../../../../lib/db/mongodb";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public DB health probe — does NOT leak secrets. Reports whether MONGODB_URI is
 * present and whether a live connection succeeds, surfacing the exact error
 * class/message when it fails so deployment issues can be diagnosed from the
 * browser without digging through host logs.
 *
 * GET /api/health/db
 */
export async function GET() {
  const uri = process.env.MONGODB_URI || "";
  const hasUri = uri.length > 0;

  // Safe, non-secret hints about the URI shape (no credentials revealed).
  let scheme = "";
  let hasDbName = false;
  if (hasUri) {
    scheme = uri.startsWith("mongodb+srv://")
      ? "mongodb+srv"
      : uri.startsWith("mongodb://")
        ? "mongodb"
        : "unknown";
    // path segment after the host (the db name) — present if there's a "/" after the host
    const afterHost = uri.split("@").pop() || "";
    hasDbName = /\/[^/?]+(\?|$)/.test("/" + afterHost.split("/").slice(1).join("/"));
  }

  if (!hasUri) {
    return NextResponse.json({
      ok: false,
      hasUri: false,
      hint: "MONGODB_URI tidak terbaca di environment Render. Pastikan variabel ada di service yang benar lalu redeploy.",
    });
  }

  try {
    await connectDB();
    const state = mongoose.connection.readyState; // 1 = connected
    return NextResponse.json({
      ok: true,
      hasUri: true,
      scheme,
      hasDbName,
      readyState: state,
      dbName: mongoose.connection.name || null,
    });
  } catch (err) {
    const e = err as Error;
    return NextResponse.json({
      ok: false,
      hasUri: true,
      scheme,
      hasDbName,
      errorName: e?.name || "Error",
      errorMessage: (e?.message || String(err)).slice(0, 400),
    });
  }
}
