import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { htmlToMarkdown, generateDocx } from "@/lib/file-generator";

/**
 * POST /api/export
 *
 * Generate file download (Markdown atau DOCX) dari content HTML.
 *
 * Body:
 *   {
 *     content: string,         // HTML content
 *     format: "md" | "docx",   // format file
 *     title: string,           // judul dokumen
 *     author?: string,         // nama penulis (untuk cover DOCX)
 *     courseName?: string,     // mata kuliah (untuk cover DOCX)
 *   }
 *
 * Response: file binary dengan Content-Disposition: attachment
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const content = String(body?.content || "").trim();
  const format = String(body?.format || "md").toLowerCase();
  const title = String(body?.title || "Dokumen EduSparq").trim();
  const author = body?.author ? String(body.author) : session.user.name;
  const courseName = body?.courseName ? String(body.courseName) : undefined;

  if (!content) {
    return NextResponse.json({ error: "Content tidak boleh kosong." }, { status: 400 });
  }

  if (format === "md") {
    const markdown = htmlToMarkdown(content);
    const fullMd = `# ${title}\n\n${author ? `**${author}**${courseName ? ` — ${courseName}` : ""}\n\n` : ""}---\n\n${markdown}`;
    const buffer = Buffer.from(fullMd, "utf-8");
    const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "dokumen";

    return new NextResponse(buffer as any, {
      headers: {
        "Content-Type": "text/markdown; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeTitle}.md"`,
      },
    });
  }

  if (format === "docx") {
    try {
      const buffer = await generateDocx({ title, content, author, courseName });
      const safeTitle = title.replace(/[^a-zA-Z0-9-_ ]/g, "").trim() || "dokumen";

      return new NextResponse(buffer as any, {
        headers: {
          "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "Content-Disposition": `attachment; filename="${safeTitle}.docx"`,
        },
      });
    } catch (err) {
      console.error("[export] DOCX generation failed:", err);
      return NextResponse.json(
        { error: "Gagal generate DOCX. Coba format Markdown." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json(
    { error: 'Format tidak didukung. Gunakan "md" atau "docx".' },
    { status: 400 }
  );
}
