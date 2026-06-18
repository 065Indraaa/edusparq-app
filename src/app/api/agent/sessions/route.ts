import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { AgentSession } from "../../../../lib/db/models/AgentSession";

/**
 * GET /api/agent/sessions
 *
 * Mengambil riwayat sesi agent untuk user yang login.
 * Query params:
 *   - limit (number, default 20)
 *   - status (string, opsional) — filter: running, completed, error, clarification
 *
 * Response: array AgentSession (ringkas — tanpa output full untuk hemat bandwidth).
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 50);
  const statusFilter = url.searchParams.get("status");

  const query: Record<string, unknown> = { userId: session.user.id };
  if (statusFilter) query.status = statusFilter;

  const sessions = await AgentSession.find(query)
    .sort({ createdAt: -1 })
    .limit(limit)
    .select(
      "request courseName tutorMode tier status totalCreditCost trace pendingClarification createdAt"
    )
    .lean();

  return NextResponse.json(sessions);
}
