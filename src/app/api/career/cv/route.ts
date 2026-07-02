import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { complete } from "../../../../lib/ai-client";
import { User } from "../../../../lib/db/models/User";
import { getStudentContext } from "../../../../lib/student-profile";
import {
  buildCvSystemPrompt,
  buildCvUserPrompt,
} from "../../../../lib/career-prompts";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const targetRole = String(body?.targetRole || "").trim();

  try {
    await connectDB();
    const [dbUser, ctx] = await Promise.all([
      User.findById(userId).select("name email universitas fakultas prodi semester").lean() as Promise<{
        name?: string;
        email?: string;
        universitas?: string;
        fakultas?: string;
        prodi?: string;
        semester?: number;
      } | null>,
      getStudentContext(userId),
    ]);

    const userSkills = Array.from(
      new Set([
        ctx.major,
        ...ctx.activeCourses.map((c) => c.name),
        ...(body?.skills || []),
      ])
    ).filter(Boolean) as string[];

    const input = {
      name: dbUser?.name || session.user.name || "",
      email: dbUser?.email || session.user.email || "",
      university: dbUser?.universitas || ctx.university,
      major: dbUser?.prodi || ctx.major,
      semester: dbUser?.semester || ctx.semester,
      gpa: ctx.gpa.ipk,
      skills: userSkills,
      experiences: Array.isArray(body?.experiences) ? body.experiences : [],
      projects: Array.isArray(body?.projects) ? body.projects : [],
      organizations: Array.isArray(body?.organizations) ? body.organizations : [],
      targetRole,
    };

    const result = await complete(
      {
        feature: "draft",
        system: buildCvSystemPrompt(),
        user: buildCvUserPrompt(input),
        temperature: 0.35,
        maxTokens: 1800,
      },
      userId
    );

    return NextResponse.json({
      cv: result.text,
      targetRole,
      context: {
        name: input.name,
        major: input.major,
        semester: input.semester,
        gpa: input.gpa,
      },
    });
  } catch (err) {
    console.error("[api/career/cv] error:", err);
    const message = err instanceof Error ? err.message : "CV generation failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
