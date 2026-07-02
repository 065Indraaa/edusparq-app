import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { CareerJob } from "../../../../lib/db/models/CareerJob";
import { careerJobsSeed } from "../../../../lib/career-jobs-seed";

export const runtime = "nodejs";

/**
 * GET /api/career/jobs
 *
 * Query params:
 *   - type: internship | entry | part-time | contract
 *   - workLocation: remote | hybrid | onsite
 *   - category: string
 *   - search: free text (title, company, skills)
 *   - limit: number (default 50)
 *   - page: number (default 1)
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();

    // Seed once if collection is empty (best-effort; safe to call repeatedly).
    const count = await CareerJob.countDocuments();
    if (count === 0) {
      await CareerJob.insertMany(careerJobsSeed);
    }

    const { searchParams } = req.nextUrl;
    const type = searchParams.get("type");
    const workLocation = searchParams.get("workLocation");
    const category = searchParams.get("category");
    const search = searchParams.get("search")?.trim();
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);

    const query: Record<string, unknown> = { active: true };

    if (type) query.type = type;
    if (workLocation) query.workLocation = workLocation;
    if (category) query.category = { $regex: category, $options: "i" };

    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { company: { $regex: search, $options: "i" } },
        { skills: { $regex: search, $options: "i" } },
      ];
    }

    const [jobs, total] = await Promise.all([
      CareerJob.find(query)
        .sort({ postedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      CareerJob.countDocuments(query),
    ]);

    return NextResponse.json({
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error("[api/career/jobs] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch jobs" }, { status: 500 });
  }
}
