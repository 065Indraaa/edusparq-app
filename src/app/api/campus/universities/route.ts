import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { searchUniversities } from "../../../../lib/campus";

export const runtime = "nodejs";

// GET /api/campus/universities?q=... — autocomplete for the university picker.
// Returns { configured, results }. When the API key is not set, `configured` is
// false and the UI falls back to a plain manual text input.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const { configured, results } = await searchUniversities(q);
  return NextResponse.json({ configured, results });
}
