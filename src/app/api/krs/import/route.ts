import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import {
  parseKRSFromText,
  parseKRSFromJSON,
  importKRS,
  type ParsedKRS,
  type ParsedKRSCourse,
} from "../../../../lib/krs";
import { KRS } from "../../../../lib/db/models/KRS";

/**
 * POST /api/krs/import
 *
 * Accepts KRS data either as pasted `text` (parsed by the tolerant text parser)
 * or as structured `json` (parsed by the JSON parser), persists it via
 * `importKRS`, and returns the parsed courses together with the import summary.
 *
 * Body shape (any of):
 *   { text: string }
 *   { json: object }
 *   { format: "text" | "json", data: string | object }
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Body permintaan bukan JSON yang valid." },
      { status: 400 }
    );
  }

  // Decide which parser to run based on what the client sent.
  let parsed: ParsedKRS;
  try {
    if (body?.format === "json" || body?.json !== undefined) {
      const data = body.json ?? body.data;
      if (!data || typeof data !== "object") {
        return NextResponse.json(
          { error: "Field 'json' kosong atau bukan object." },
          { status: 400 }
        );
      }
      parsed = parseKRSFromJSON(data);
    } else {
      const text = typeof body?.text === "string" ? body.text : typeof body?.data === "string" ? body.data : "";
      if (!text.trim()) {
        return NextResponse.json(
          { error: "Field 'text' kosong. Tempel teks KRS terlebih dahulu." },
          { status: 400 }
        );
      }
      parsed = parseKRSFromText(text);
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal memparse KRS." },
      { status: 400 }
    );
  }

  if (!parsed.courses.length) {
    return NextResponse.json(
      {
        error: "Tidak ada mata kuliah yang terdeteksi. Periksa format teks KRS Anda.",
        warnings: parsed.warnings,
      },
      { status: 422 }
    );
  }

  // Persist: creates/links Course docs + upserts the KRS document.
  let result;
  try {
    result = await importKRS(session.user.id, parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Gagal mengimpor KRS." },
      { status: 400 }
    );
  }

  // Pull the freshly imported KRS so we can return the exact stored courses.
  await connectDB();
  const krs = await KRS.findById(result.krsId).lean();

  const courses: ParsedKRSCourse[] = (krs?.courses ?? []).map((c: any) => ({
    courseName: c.courseName ?? "",
    sks: Number(c.sks) ?? 0,
    lecturer: c.lecturer ?? "",
    schedule: c.schedule ?? "",
    courseId: c.courseId ? String(c.courseId) : undefined,
  }));

  return NextResponse.json(
    {
      courses,
      warnings: parsed.warnings,
      academicYear: parsed.academicYear,
      semester: parsed.semester,
      import: result,
    },
    { status: 201 }
  );
}
