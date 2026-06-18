import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { extractTextFromUrl } from "@/lib/server-extract";
import { complete, InsufficientCreditsError } from "@/lib/ai-client";
import { parseLooseJSON } from "@/lib/ai";
import { sanitizeOutput } from "@/lib/sanitize-output";
import { connectDB } from "@/lib/db/mongodb";
import { Deadline } from "@/lib/db/models/Deadline";
import { Course } from "@/lib/db/models/Course";

export const maxDuration = 60;

export async function POST(req: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { fileUrl, fileType } = await req.json();
    if (!fileUrl) {
      return NextResponse.json({ error: "fileUrl is required" }, { status: 400 });
    }

    const clientIp = req.headers.get("x-forwarded-for") || session.user.id || "unknown";
    const rl = checkRateLimit("deadlines:" + clientIp, 10, 60_000);
    if (!rl.allowed) {
      return NextResponse.json({ error: "Terlalu banyak permintaan." }, { status: 429 });
    }

    // 1. Extract text from the uploaded syllabus
    const syllabusText = await extractTextFromUrl(fileUrl, fileType);
    if (!syllabusText.trim()) {
      return NextResponse.json({ error: "Gagal mengekstrak teks dari dokumen." }, { status: 400 });
    }

    // 2. Request JSON extraction from Kimi
    const systemPrompt = `Anda adalah asisten akademik ahli pengekstrak silabus (RPS).
Tugas Anda adalah membaca teks silabus yang diberikan, dan mengekstrak informasi MATA KULIAH serta jadwal TUGAS (kuis, UTS, UAS, presentasi) ke dalam format JSON.

Aturan ketat:
- Hasil HANYA boleh berupa JSON berformat objek tunggal dengan 2 properti utama: "course" dan "deadlines".
- Properti "course" adalah objek dengan field:
  - "name": Nama mata kuliah (WAJIB).
  - "instructor": Nama dosen pengampu (jika ada).
  - "credits": Jumlah SKS berupa angka (misal: 3). Jika tidak disebutkan, isi null.
  - "semester": Semester mata kuliah ini (misal: "Semester 5"). Jika tidak disebutkan, isi string kosong "".
- Properti "deadlines" adalah array di mana tiap objek memiliki field:
  - "title": Nama tugas (misal: "Kuis 1", "UTS", "Tugas Makalah").
  - "dueDate": Tanggal tenggat dalam format "YYYY-MM-DD". Jika tahun tidak disebutkan, asumsikan tahun saat ini (${new Date().getFullYear()}). Jika tanggal tidak spesifik, buat estimasi atau gunakan tanggal hari ini sebagai fallback.
  - "dueTime": Waktu dalam format "HH:MM". Jika tidak ada, gunakan "23:59".
  - "requirements": Catatan tambahan, bobot persentase, atau "Minggu ke-X".

JSON murni tanpa markdown, tanpa penjelasan! DILARANG KERAS menggunakan simbol aneh atau emoji.`;

    // 2. Extract JSON from syllabus via AI (with metering).
    let resultStr = "";
    try {
      const { text } = await complete(
        {
          feature: "extract",
          system: systemPrompt,
          user: `Teks Silabus:\n\n${syllabusText.slice(0, 20000)}`,
          temperature: 0.1,
          maxTokens: 2048,
          json: true,
        },
        session.user.id
      );
      resultStr = text;
    } catch (err) {
      if (err instanceof InsufficientCreditsError) {
        return NextResponse.json(
          { error: "Credit tidak cukup. Isi ulang di /billing atau aktifkan BYOK.", code: "INSUFFICIENT_CREDITS" },
          { status: 402 }
        );
      }
      return NextResponse.json({ error: "Gagal menghubungi AI." }, { status: 502 });
    }

    let extractedCourse: any = null;
    let deadlinesToSave: any[] = [];

    try {
      const parsed = parseLooseJSON<{ course?: any; deadlines?: any[] }>(
        sanitizeOutput(resultStr, { stripCodeFences: true })
      );
      extractedCourse = parsed?.course || null;
      deadlinesToSave = parsed?.deadlines || [];
    } catch (e) {
      return NextResponse.json({ error: "Gagal memproses JSON dari AI" }, { status: 500 });
    }

    if (deadlinesToSave.length === 0) {
      return NextResponse.json({ error: "Tidak ada jadwal tugas yang ditemukan di dokumen ini." }, { status: 400 });
    }

    // 3. Save to MongoDB
    await connectDB();
    
    // Auto-create or update Course profile
    let actualCourseName = extractedCourse?.name || "Mata Kuliah Baru";
    if (extractedCourse?.name) {
      const existingCourse = await Course.findOne({ 
        userId: session.user.id, 
        name: { $regex: new RegExp(`^${extractedCourse.name}$`, "i") } 
      });

      if (!existingCourse) {
        // Create new course
        await Course.create({
          userId: session.user.id,
          name: extractedCourse.name,
          instructor: extractedCourse.instructor || "",
          credits: extractedCourse.credits || 3,
          semester: extractedCourse.semester || "Semester Berjalan",
        });
      } else {
        // Update instructor if missing
        if (!existingCourse.instructor && extractedCourse.instructor) {
          existingCourse.instructor = extractedCourse.instructor;
          await existingCourse.save();
        }
        actualCourseName = existingCourse.name; // Keep consistent casing
      }
    }

    const savedDeadlines = [];
    for (const dl of deadlinesToSave) {
      const newDl = await Deadline.create({
        userId: session.user.id,
        courseName: actualCourseName,
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
