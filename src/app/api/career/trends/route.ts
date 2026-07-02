import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { careerTrend2026, trendingRoles, recommendedCertifications } from "../../../../lib/career-data";

export const runtime = "nodejs";

/**
 * GET /api/career/trends
 *
 * Returns curated 2026 Indonesia career trend data based on real market research.
 * No DB required; data is compiled from research-backed sources.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json({
      trend: careerTrend2026,
      roles: trendingRoles,
      certifications: recommendedCertifications,
    });
  } catch (err) {
    console.error("[api/career/trends] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch trends" }, { status: 500 });
  }
}
