import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { searchCatalog, CatalogType } from "@/lib/catalog";

export const runtime = "nodejs";

const TYPES: CatalogType[] = ["semua", "jurnal", "skripsi", "tesis", "disertasi", "buku"];

// GET /api/catalog/search?q=...&type=...&from=YYYY&to=YYYY
// Real academic catalog search via Crossref. Returns { results }.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";
  const rawType = (searchParams.get("type") || "semua") as CatalogType;
  const type = TYPES.includes(rawType) ? rawType : "semua";

  try {
    const results = await searchCatalog({
      q,
      type,
      yearFrom: searchParams.get("from") || undefined,
      yearTo: searchParams.get("to") || undefined,
    });
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
