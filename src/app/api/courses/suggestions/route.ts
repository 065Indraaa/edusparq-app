import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Course } from "@/lib/db/models/Course";
import { DefaultCourse } from "@/lib/db/models/DefaultCourse";
import { User } from "@/lib/db/models/User";

export const runtime = "nodejs";

interface Suggestion {
  name: string;
  semester: string;
  sks: number | null;
  source: "mine" | "default";
}

// GET /api/courses/suggestions — real course options for any "pick a mata kuliah"
// dropdown: the user's own courses first, then crowdsourced DefaultCourse entries
// for their prodi (so a fresh student still gets relevant suggestions by semester).
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  const [userDoc, myCourses] = await Promise.all([
    User.findById(session.user.id).lean(),
    Course.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean(),
  ]);

  const prodi = (userDoc as { prodi?: string } | null)?.prodi?.trim() || "";

  const out: Suggestion[] = [];
  const seen = new Set<string>();

  for (const c of myCourses as Array<{ name?: string; semester?: string; credits?: number }>) {
    const name = (c.name || "").trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      name,
      semester: c.semester != null ? String(c.semester) : "",
      sks: typeof c.credits === "number" ? c.credits : null,
      source: "mine",
    });
  }

  if (prodi) {
    const defaults = (await DefaultCourse.find({ prodi })
      .sort({ semester: 1 })
      .limit(200)
      .lean()) as Array<{ namaMatkul?: string; semester?: number; sks?: number }>;
    for (const d of defaults) {
      const name = (d.namaMatkul || "").trim();
      if (!name) continue;
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({
        name,
        semester: d.semester != null ? `Semester ${d.semester}` : "",
        sks: typeof d.sks === "number" ? d.sks : null,
        source: "default",
      });
    }
  }

  return NextResponse.json({ courses: out });
}
