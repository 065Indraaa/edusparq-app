import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { complete } from "../../../../lib/ai-client";
import { getStudentContext } from "../../../../lib/student-profile";
import {
  buildInterviewSystemPrompt,
  buildInterviewUserPrompt,
  buildInterviewFeedbackSystemPrompt,
  buildInterviewFeedbackUserPrompt,
  type InterviewType,
} from "../../../../lib/career-prompts";

export const runtime = "nodejs";

const VALID_TYPES: InterviewType[] = ["behavioral", "technical", "case-study"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;
  const body = await req.json().catch(() => ({}));
  const targetRole = String(body?.targetRole || "").trim();
  const type = String(body?.type || "behavioral").toLowerCase() as InterviewType;
  const question = String(body?.question || "").trim();
  const answer = String(body?.answer || "").trim();

  if (!targetRole) {
    return NextResponse.json({ error: "targetRole is required" }, { status: 400 });
  }

  if (!VALID_TYPES.includes(type)) {
    return NextResponse.json(
      { error: `type must be one of ${VALID_TYPES.join(", ")}` },
      { status: 400 }
    );
  }

  try {
    await connectDB();

    // If question + answer provided, return feedback instead of generating questions.
    if (question && answer) {
      const result = await complete(
        {
          feature: "analyze",
          system: buildInterviewFeedbackSystemPrompt(),
          user: buildInterviewFeedbackUserPrompt(question, answer),
          temperature: 0.4,
          maxTokens: 1200,
        },
        userId
      );

      let feedback: unknown = null;
      try {
        const { parseLooseJSON } = await import("@/lib/ai");
        feedback = parseLooseJSON(result.text);
        if (!feedback) {
          const cleaned = result.text.replace(/```json|```/g, "").trim();
          feedback = JSON.parse(cleaned);
        }
      } catch {
        feedback = { raw: result.text, parseError: true };
      }

      return NextResponse.json({ feedback });
    }

    const ctx = await getStudentContext(userId);
    const background = `Jurusan ${ctx.major}, semester ${ctx.semester}, IPK ${ctx.gpa.ipk ?? "belum ada"}.`;

    const result = await complete(
      {
        feature: "recommend",
        system: buildInterviewSystemPrompt(),
        user: buildInterviewUserPrompt({
          targetRole,
          interviewType: type,
          userBackground: background,
        }),
        temperature: 0.5,
        maxTokens: 1400,
      },
      userId
    );

    let questions: unknown = null;
    try {
      const { parseLooseJSON } = await import("@/lib/ai");
      questions = parseLooseJSON(result.text);
      if (!questions) {
        const cleaned = result.text.replace(/```json|```/g, "").trim();
        questions = JSON.parse(cleaned);
      }
    } catch {
      questions = { raw: result.text, parseError: true };
    }

    return NextResponse.json({ targetRole, type, questions });
  } catch (err) {
    console.error("[api/career/interview] error:", err);
    const message = err instanceof Error ? err.message : "Interview prep failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
