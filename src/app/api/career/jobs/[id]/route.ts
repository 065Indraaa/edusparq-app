import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { connectDB } from "../../../../../lib/db/mongodb";
import { CareerJob } from "../../../../../lib/db/models/CareerJob";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await connectDB();
    const job = await CareerJob.findById(params.id).lean();

    if (!job) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    return NextResponse.json(job);
  } catch (err) {
    console.error("[api/career/jobs/[id]] GET error:", err);
    return NextResponse.json({ error: "Failed to fetch job" }, { status: 500 });
  }
}
