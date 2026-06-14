import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import {
  searchUniversities,
  searchProdi,
  searchMahasiswa,
  getMahasiswaDetail,
  estimateSemester,
} from "@/lib/pddikti";

export const runtime = "nodejs";

// GET /api/campus/pddikti?kind=pt|prodi|mhs|detail
//   kind=pt     &q=...            -> { results: PddiktiPT[] }
//   kind=prodi  &q=...&pt=...     -> { results: PddiktiProdi[] }  (pt narrows results)
//   kind=mhs    &q=...            -> { results: PddiktiMhs[] }
//   kind=detail &id=...          -> { detail, semesterEstimate }
// All data is REAL public PDDIKTI data, no API key. Degrades to empty results.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const kind = searchParams.get("kind") || "";
  const q = searchParams.get("q") || "";

  try {
    if (kind === "pt") {
      return NextResponse.json({ results: await searchUniversities(q) });
    }
    if (kind === "prodi") {
      const pt = searchParams.get("pt") || undefined;
      return NextResponse.json({ results: await searchProdi(q, pt) });
    }
    if (kind === "mhs") {
      return NextResponse.json({ results: await searchMahasiswa(q) });
    }
    if (kind === "detail") {
      const detail = await getMahasiswaDetail(searchParams.get("id") || "");
      if (!detail) return NextResponse.json({ detail: null });
      return NextResponse.json({
        detail,
        semesterEstimate: estimateSemester(detail.tanggalMasuk),
      });
    }
    return NextResponse.json({ error: "Unknown kind" }, { status: 400 });
  } catch {
    return NextResponse.json({ results: [], detail: null });
  }
}
