import { NextRequest, NextResponse } from "next/server";
import { JURUSAN, FAKULTAS, matchJurusan, getJurusanByFakultas } from "@/lib/jurusan-catalog";

/**
 * GET /api/jurusan
 *
 * Daftar jurusan & fakultas yang didukung EduSparq.
 *
 * Query params:
 *   - fakultasId: filter by fakultas (e.g. fti, feb, fhukum, fmipa)
 *   - q: search jurusan by name/keyword
 *   - prodi: match prodi string → return matched jurusan detail + popular courses
 *
 * Response tanpa query:
 *   { fakultas: [...], jurusan: [...] }
 *
 * Response dengan prodi:
 *   { matched: JurusanEntry | null }
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const fakultasId = searchParams.get("fakultasId");
  const q = searchParams.get("q")?.toLowerCase().trim();
  const prodi = searchParams.get("prodi");

  // Match specific prodi string
  if (prodi) {
    const matched = matchJurusan(prodi);
    return NextResponse.json({
      matched: matched
        ? {
            id: matched.id,
            name: matched.name,
            fakultasId: matched.fakultasId,
            fakultasName: matched.fakultasName,
            icon: matched.icon,
            description: matched.description,
            popularCourses: matched.popularCourses || [],
          }
        : null,
    });
  }

  // Filter jurusan list
  let jurusanList = JURUSAN;

  if (fakultasId) {
    jurusanList = getJurusanByFakultas(fakultasId);
  }

  if (q) {
    jurusanList = jurusanList.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.keywords.some((kw) => kw.includes(q))
    );
  }

  // Strip promptContext (internal AI data, not for client)
  const publicJurusan = jurusanList.map((j) => ({
    id: j.id,
    name: j.name,
    fakultasId: j.fakultasId,
    fakultasName: j.fakultasName,
    keywords: j.keywords,
    icon: j.icon,
    color: j.color,
    description: j.description,
    popularCourses: j.popularCourses || [],
  }));

  return NextResponse.json({
    fakultas: fakultasId ? undefined : FAKULTAS,
    jurusan: publicJurusan,
  });
}
