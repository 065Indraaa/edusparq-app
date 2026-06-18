import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";

export const runtime = "nodejs";
export const maxDuration = 30;

// GET /api/citations/verify?doi=10.xxxx/... OR ?title=...&author=...
// Returns Crossref verification status + enriched metadata. Real-data only.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const doi = searchParams.get("doi")?.trim();
  const title = searchParams.get("title")?.trim();
  const author = searchParams.get("author")?.trim();

  if (!doi && !title)
    return NextResponse.json(
      { error: "Parameter doi atau title wajib diisi." },
      { status: 400 }
    );

  const headers = { "User-Agent": "EduSparq/1.0 (mailto:hello@edusparq.app)" };

  try {
    // 1. Direct DOI lookup (most reliable).
    if (doi) {
      const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "");
      const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`, { headers });
      if (res.ok) {
        const json = await res.json();
        const item = json?.message;
        if (item) return NextResponse.json({ verified: true, source: "crossref-doi", work: mapWork(item) });
      }
      // DOI not found — fall through to title search, but flag DOI as unverified.
    }

    // 2. Title-based search.
    if (title) {
      let url = `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(title)}&rows=3`;
      if (author) url += `&query.author=${encodeURIComponent(author)}`;
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json = await res.json();
        const items = json?.message?.items || [];
        if (items.length > 0) {
          // Best match = top result. Compare titles loosely for a confidence flag.
          const best = items[0];
          const matchTitle = String(best.title?.[0] || "").toLowerCase();
          const queryTitle = title.toLowerCase();
          const similarity = jaccardSimilarity(tokenize(matchTitle), tokenize(queryTitle));
          return NextResponse.json({
            verified: similarity >= 0.5,
            confidence: similarity,
            source: "crossref-title",
            doiProvided: Boolean(doi),
            doiVerified: false,
            work: mapWork(best),
            alternatives: items.slice(1, 3).map(mapWork),
          });
        }
      }
    }

    return NextResponse.json({
      verified: false,
      source: "none",
      message: "Referensi tidak ditemukan di database Crossref. Periksa kembali judul/DOI atau pastikan ini bukan sumber lokal.",
    });
  } catch (err) {
    console.error("[citations/verify] error:", err);
    return NextResponse.json(
      { verified: false, error: "Gagal menghubungi Crossref. Coba lagi sebentar." },
      { status: 502 }
    );
  }
}

function mapWork(item: any) {
  const authors = (item.author || [])
    .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
    .filter(Boolean)
    .join(", ");
  const year =
    item["published-print"]?.["date-parts"]?.[0]?.[0] ||
    item["published-online"]?.["date-parts"]?.[0]?.[0] || "";
  return {
    title: item.title?.[0] || "",
    authors: authors || "",
    year: year ? String(year) : "",
    doi: item.DOI || "",
    url: item.URL || (item.DOI ? `https://doi.org/${item.DOI}` : ""),
    publisher: item.publisher || "",
    container: item["container-title"]?.[0] || "",
  };
}

function tokenize(s: string): Set<string> {
  return new Set(
    (s || "")
      .toLowerCase()
      .replace(/[^a-z0-9\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 0;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}
