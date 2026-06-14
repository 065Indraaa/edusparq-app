/**
 * Research catalog integration (jurnal / skripsi / tesis / disertasi).
 *
 * Primary source: Crossref REST API — free, keyless, reliable, and rich in
 * Indonesian journal/repository metadata (most ID universities register DOIs
 * through Crossref via OJS). We stay in the "polite pool" by sending a mailto.
 *
 * Indonesian undergraduate/master theses ("skripsi"/"tesis") have no dedicated
 * Crossref type, so for those filters we append the keyword to the query rather
 * than filtering on type. Everything degrades to an empty list on failure.
 */

const CROSSREF = "https://api.crossref.org/works";
const MAILTO = "edusparq.app@gmail.com";
const FETCH_TIMEOUT_MS = 15000;

export interface CatalogItem {
  id: string;
  title: string;
  authors: string[];
  year: string;
  type: string;
  typeLabel: string;
  journal: string;
  publisher: string;
  doi: string;
  url: string;
}

export type CatalogType = "semua" | "jurnal" | "skripsi" | "tesis" | "disertasi" | "buku";

const CROSSREF_TYPE_FILTER: Partial<Record<CatalogType, string>> = {
  jurnal: "journal-article",
  disertasi: "dissertation",
  buku: "book",
};

function labelForType(type: string): string {
  switch (type) {
    case "journal-article":
      return "Jurnal";
    case "dissertation":
      return "Disertasi/Tesis";
    case "book":
    case "monograph":
      return "Buku";
    case "book-chapter":
      return "Bab Buku";
    case "proceedings-article":
      return "Prosiding";
    case "posted-content":
      return "Preprint";
    default:
      return "Artikel";
  }
}

function firstString(v: unknown): string {
  if (Array.isArray(v)) return typeof v[0] === "string" ? v[0] : "";
  return typeof v === "string" ? v : "";
}

interface CrossrefAuthor {
  given?: string;
  family?: string;
  name?: string;
}
interface CrossrefItem {
  title?: string[];
  author?: CrossrefAuthor[];
  published?: { "date-parts"?: number[][] };
  issued?: { "date-parts"?: number[][] };
  DOI?: string;
  "container-title"?: string[];
  type?: string;
  publisher?: string;
  URL?: string;
}

function yearOf(it: CrossrefItem): string {
  const dp =
    it.published?.["date-parts"]?.[0]?.[0] ?? it.issued?.["date-parts"]?.[0]?.[0];
  return dp ? String(dp) : "";
}

function mapItem(it: CrossrefItem): CatalogItem {
  const title = firstString(it.title);
  const authors = Array.isArray(it.author)
    ? it.author
        .map((a) => a.name || [a.given, a.family].filter(Boolean).join(" "))
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const doi = (it.DOI || "").trim();
  const type = (it.type || "").trim();
  return {
    id: doi || `${title}-${yearOf(it)}`.toLowerCase(),
    title,
    authors,
    year: yearOf(it),
    type,
    typeLabel: labelForType(type),
    journal: firstString(it["container-title"]),
    publisher: (it.publisher || "").trim(),
    doi,
    url: doi ? `https://doi.org/${doi}` : (it.URL || "").trim(),
  };
}

export async function searchCatalog(opts: {
  q: string;
  type?: CatalogType;
  yearFrom?: string;
  yearTo?: string;
  rows?: number;
}): Promise<CatalogItem[]> {
  const base = (opts.q || "").trim();
  if (base.length < 2) return [];

  let query = base;
  const type = opts.type || "semua";
  if (type === "skripsi") query = `${base} skripsi`;
  else if (type === "tesis") query = `${base} tesis`;

  const params = new URLSearchParams();
  params.set("query", query);
  params.set("rows", String(Math.min(Math.max(opts.rows || 20, 1), 30)));
  params.set(
    "select",
    "title,author,published,issued,DOI,container-title,type,publisher,URL"
  );
  params.set("mailto", MAILTO);

  const filters: string[] = [];
  const tf = CROSSREF_TYPE_FILTER[type];
  if (tf) filters.push(`type:${tf}`);
  if (opts.yearFrom && /^\d{4}$/.test(opts.yearFrom))
    filters.push(`from-pub-date:${opts.yearFrom}-01-01`);
  if (opts.yearTo && /^\d{4}$/.test(opts.yearTo))
    filters.push(`until-pub-date:${opts.yearTo}-12-31`);
  if (filters.length) params.set("filter", filters.join(","));

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${CROSSREF}?${params.toString()}`, {
      headers: {
        "User-Agent": `EduSparq/1.0 (mailto:${MAILTO})`,
        Accept: "application/json",
      },
      signal: controller.signal,
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { message?: { items?: CrossrefItem[] } };
    const items = json?.message?.items;
    if (!Array.isArray(items)) return [];
    return items.map(mapItem).filter((i) => i.title.length > 0);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}
