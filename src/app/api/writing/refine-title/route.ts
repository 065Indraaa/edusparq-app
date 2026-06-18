import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { aiComplete } from "../../../../lib/ai";
import { buildSystemPrompt } from "../../../../lib/ai-prompts";
import { getUserPersonaContext } from "../../../../lib/ai-memory";
import { sanitizeOutput } from "../../../../lib/sanitize-output";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const rawTitle = String(body?.title || "").trim();

  if (rawTitle.length < 3)
    return NextResponse.json({ error: "Ketik minimal 3 karakter judul/topik dulu." }, { status: 400 });

  const instruction = `Anda adalah seorang Profesor Akademik yang ahli merumuskan judul penelitian atau dokumen ilmiah yang sangat profesional, elegan, dan komprehensif.
Ubah atau perbaiki ide topik berikut menjadi 1 (satu) judul dokumen/makalah yang jauh lebih spesifik, tajam, dan menggunakan bahasa akademik baku yang sempurna. 

TIDAK BOLEH memberikan pengantar, tanda kutip, atau penjelasan apa pun. HANYA KELUARKAN TEKS JUDULNYA SAJA secara utuh.`;

  let system = buildSystemPrompt("editor", undefined, instruction);

  const personaContext = await getUserPersonaContext(session.user.id);
  if (personaContext) {
    system = personaContext + system;
  }

  try {
    const { text: result } = await aiComplete({
      task: "draft",
      system,
      user: `Ide Topik/Judul Asli: ${rawTitle}`,
      temperature: 0.7,
      maxTokens: 200,
    });
    
    const refinedTitle = sanitizeOutput(result, { stripWrappingQuotes: true });
    if (!refinedTitle)
      return NextResponse.json({ error: "AI gagal merumuskan judul." }, { status: 422 });
      
    return NextResponse.json({ title: refinedTitle });
  } catch (error) {
    console.error("[Refine Title API] Error:", error);
    return NextResponse.json(
      { error: "Gagal menghubungi server AI." },
      { status: 502 }
    );
  }
}
