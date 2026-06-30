import { NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Document } from "../../../../lib/db/models/Document";
import { DocumentChunk } from "../../../../lib/db/models/DocumentChunk";
import { complete } from "../../../../lib/ai-client";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { documentIds, focusArea = "General Comparison" } = await req.json();
    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return NextResponse.json({ error: "No documents provided" }, { status: 400 });
    }

    await connectDB();

    // Fetch documents and their text
    const docsData = [];
    for (const docId of documentIds) {
      const doc = await Document.findOne({ _id: docId, userId: session.user.id });
      if (!doc) continue;
      
      // Get first 10 chunks (around 10k words) to avoid blowing up context window
      const chunks = await DocumentChunk.find({ documentId: docId })
        .sort({ chunkIndex: 1 })
        .limit(10);
      
      const fullText = chunks.map((c: any) => c.content).join("\\n\\n");
      docsData.push({
        id: docId,
        title: doc.originalName,
        text: fullText
      });
    }

    if (docsData.length === 0) {
      return NextResponse.json({ error: "Documents not found or empty" }, { status: 404 });
    }

    // Build the prompt for matrix extraction
    const prompt = `Anda adalah asisten riset (EduSparq Scholar). Saya memiliki ${docsData.length} dokumen jurnal/materi.
Buatkan Literature Matrix (Matriks Tinjauan Pustaka) yang membandingkan dokumen-dokumen ini, dengan fokus pada: ${focusArea}.

Dokumen yang dianalisis:
${docsData.map(d => `--- [DOKUMEN: ${d.title}] ---\\n${d.text.substring(0, 15000)}...\\n`).join("\\n")}

Format output harus murni berupa Markdown Table dengan kolom:
| Judul Dokumen | Tujuan/Fokus | Metodologi | Temuan Utama | Limitasi/Gap |

Tuliskan tabel tersebut dan berikan 2 paragraf kesimpulan sintesis di bawah tabel.`;

    const response = await complete(
      {
        feature: "research",
        system: "Anda adalah EduSparq Scholar. Jawab langsung dengan tabel matriks tanpa basa-basi.",
        user: prompt,
      },
      session.user.id
    );

    return NextResponse.json({ matrix: response.text });
  } catch (error: any) {
    console.error("[matrix api]", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
