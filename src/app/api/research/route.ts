import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { getKimiClient, AI_MODEL } from "@/lib/ai";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { query, prodi = "" } = await req.json();
    if (!query?.trim()) return NextResponse.json({ error: "Query required" }, { status: 400 });

    const clientIp = req.headers.get("x-forwarded-for") || session.user.id || "unknown";
    const rl = checkRateLimit("research:" + clientIp, 20, 60_000);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Sistem mendeteksi aktivitas berlebihan. Tunggu 1 menit ya." },
        { status: 429 }
      );
    }

    // 1. Fetch real data from Crossref
    let crossrefData = "";
    try {
      const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&select=title,author,abstract,URL,published-print,published-online&rows=5`;
      const crossRes = await fetch(url);
      if (crossRes.ok) {
        const json = await crossRes.json();
        const items = json.message?.items || [];
        
        if (items.length > 0) {
          crossrefData = items.map((item: any, idx: number) => {
            const title = item.title?.[0] || "Tanpa Judul";
            const url = item.URL || "-";
            const authors = (item.author || []).map((a: any) => `${a.given || ""} ${a.family || ""}`.trim()).join(", ") || "Penulis tidak diketahui";
            
            // Crossref abstracts sometimes have JATS XML tags. Strip them out roughly.
            let abstract = item.abstract || "Tidak ada abstrak tersedia.";
            abstract = abstract.replace(/<[^>]*>/g, ""); 
            
            return `Jurnal ${idx + 1}:\nJudul: ${title}\nPenulis: ${authors}\nLink/DOI: ${url}\nAbstrak: ${abstract.slice(0, 1000)}`;
          }).join("\n\n");
        }
      }
    } catch (err) {
      console.error("[research] Crossref fetch error:", err);
    }

    // 2. Build the system prompt
    let systemMessage = `Anda adalah asisten riset akademik kelas dunia yang objektif dan sangat teliti.
Tugas Anda adalah merespons kueri riset pengguna secara mendalam dan terstruktur.
Gunakan Bahasa Indonesia yang baku dan formal.`;

    if (crossrefData) {
      systemMessage += `\n\n[PERHATIAN: DATA JURNAL ASLI DARI DATABASE CROSSREF]
Berikut adalah 5 jurnal sungguhan yang berhasil ditarik dari database global berdasarkan kata kunci pengguna. 
JADIKAN INI SEBAGAI SUMBER UTAMA (TIDAK BOLEH MENGARANG REFERENSI LAIN):
---
${crossrefData}
---
Berdasarkan data jurnal asli di atas, berikan:
1. 3-5 sudut pandang (angle) penelitian yang menarik.
2. Daftar referensi kunci (sebutkan penulis, judul, dan DOI/Link persis seperti data di atas).
3. Ringkasan tinjauan literatur (1-2 paragraf) yang mensintesis temuan dari abstrak di atas.
- JANGAN menggunakan simbol-simbol aneh, emoji berlebihan, atau format yang berantakan.
- Pastikan hasil BERSIH (clean), sangat profesional, dan murni akademis dengan menggunakan standar Markdown yang rapi.`;
    } else {
      systemMessage += `\n\nSayangnya, database jurnal eksternal sedang tidak dapat diakses atau tidak ada hasil spesifik.
Berikan saran 3-5 sudut pandang penelitian umum terkait topik pengguna, namun TEGASKAN di awal bahwa Anda tidak dapat menyertakan referensi jurnal spesifik karena sistem database sedang luring.`;
    }

    if (prodi) {
      systemMessage += `\n\nPenanya adalah mahasiswa program studi ${prodi}. Sesuaikan sudut pandang agar relevan dengan bidang ini jika memungkinkan.`;
    }

    const kimiClient = await getKimiClient();

    // 3. Request streaming completion
    const response = await kimiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: `Kueri Riset: "${query}"` }
      ],
      stream: true,
      temperature: 0.3,
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of response) {
            const content = chunk.choices[0]?.delta?.content || "";
            if (content) {
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ text: content })}\n\n`)
              );
            }
          }
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        } catch (err) {
          console.error("Stream processing error:", err);
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: "\n[Sistem] Koneksi ke asisten terputus." })}\n\n`)
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });

  } catch (error: any) {
    console.error("[research] Route Error:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: 500 }
    );
  }
}
