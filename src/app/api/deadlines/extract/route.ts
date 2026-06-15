import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractTextFromUrl } from "@/lib/server-extract";
import { getKimiClient, AI_MODEL } from "@/lib/ai";
import { connectDB } from "@/lib/db/mongodb";
import { Deadline } from "@/lib/db/models/Deadline";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileUrl, fileType, courseName = "Tugas Baru" } = await req.json();
    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
    }

    const clientIp = req.headers.get("x-forwarded-for") || "unknown";
    const { allowed, isRateLimited } = await checkRateLimit(clientIp);
    if (!allowed && isRateLimited) {
      return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
    }

    // 1. Extract text from the uploaded syllabus
    const text = await extractTextFromUrl(fileUrl, fileType);
    if (!text.trim()) {
      return NextResponse.json({ error: "Gagal mengekstrak teks dari dokumen." }, { status: 400 });
    }

    // 2. Request JSON extraction from Kimi
    const systemPrompt = `Anda adalah asisten akademik ahli pengekstrak silabus (RPS).
Tugas Anda adalah membaca teks silabus yang diberikan, dan mengekstrak semua jadwal tugas, kuis, UTS, UAS, atau presentasi ke dalam format JSON.

Aturan ketat:
- Hasil HANYA boleh berupa JSON berformat objek tunggal dengan properti "deadlines" yang berisi array.
- Tiap objek di dalam "deadlines" memiliki field:
  - "title": Nama tugas (misal: "Kuis 1", "UTS", "Tugas Makalah").
  - "dueDate": Tanggal tenggat dalam format "YYYY-MM-DD". Jika tahun tidak disebutkan, asumsikan tahun saat ini (${new Date().getFullYear()}). Jika tanggal tidak spesifik (misal: "Minggu 3"), buat estimasi tanggal atau gunakan tanggal hari ini saja sebagai fallback.
  - "dueTime": Waktu dalam format "HH:MM". Jika tidak ada, gunakan "23:59".
  - "requirements": Catatan tambahan, bobot persentase, format tugas, atau "Minggu ke-X" jika tanggal spesifik tidak ada.

JSON murni tanpa markdown, tanpa penjelasan!`;

    const kimiClient = await getKimiClient();
    const response = await kimiClient.chat.completions.create({
      model: AI_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Teks Silabus:\n\n${text.slice(0, 20000)}` }
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const resultStr = response.choices[0]?.message?.content || "";
    let deadlinesToSave = [];
    
    try {
      const parsed = JSON.parse(resultStr);
      deadlinesToSave = parsed.deadlines || [];
    } catch (e) {
      return NextResponse.json({ error: "Gagal memproses JSON dari AI" }, { status: 500 });
    }

    if (deadlinesToSave.length === 0) {
      return NextResponse.json({ error: "Tidak ada jadwal tugas yang ditemukan di dokumen ini." }, { status: 400 });
    }

    // 3. Save to MongoDB
    await connectDB();
    const savedDeadlines = [];
    for (const dl of deadlinesToSave) {
      const newDl = await Deadline.create({
        userEmail: session.user.email,
        courseName: courseName,
        title: dl.title || "Tugas",
        dueDate: dl.dueDate || new Date().toISOString().split("T")[0],
        dueTime: dl.dueTime || "23:59",
        requirements: dl.requirements || "",
        status: "pending",
      });
      savedDeadlines.push(newDl);
    }

    return NextResponse.json({ success: true, count: savedDeadlines.length, deadlines: savedDeadlines });
  } catch (error: any) {
    console.error("[deadlines/extract] Route Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
