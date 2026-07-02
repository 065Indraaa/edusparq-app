import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { complete } from "../../../../lib/ai-client";
import { getStudentContext } from "../../../../lib/student-profile";
import {
  buildSkillGapSystemPrompt,
  buildSkillGapUserPrompt,
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

  if (!targetRole) {
    return NextResponse.json({ error: "targetRole is required" }, { status: 400 });
  }

  try {
    await connectDB();
    const ctx = await getStudentContext(userId);

    // Derive user skills from active courses + major as a simple proxy.
    const courseSkills = ctx.activeCourses.map((c) => c.name);
    const userSkills: string[] = Array.from(
      new Set([ctx.major, ...courseSkills, ...(body?.extraSkills || [])])
    ).filter(Boolean) as string[];

    const result = await complete(
      {
        feature: "recommend",
        system: buildSkillGapSystemPrompt(),
        user: buildSkillGapUserPrompt({
          targetRole,
          userSkills,
          major: ctx.major,
          semester: ctx.semester,
          gpa: ctx.gpa.ipk,
        }),
        temperature: 0.4,
        maxTokens: 1200,
      },
      userId
    );

    let parsed: unknown = null;
    try {
      // Coba parseLooseJSON dulu (robust), fallback ke naive.
      const { parseLooseJSON } = await import("@/lib/ai");
      parsed = parseLooseJSON(result.text);
      if (!parsed) {
        const cleaned = result.text.replace(/```json|```/g, "").trim();
        parsed = JSON.parse(cleaned);
      }
    } catch {
      parsed = { raw: result.text, parseError: true };
    }

    return NextResponse.json({
      targetRole,
      analysis: parsed,
      context: {
        major: ctx.major,
        semester: ctx.semester,
        gpa: ctx.gpa.ipk,
      },
    });
  } catch (err) {
    console.error("[api/career/skill-gap] error:", err);
    const message = err instanceof Error ? err.message : "AI analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
