/**
 * Reusable grounding helpers for writing/research features.
 *
 * - retrieveUserMaterial(userId, query): pulls RAG context from the student's
 *   own documents, returning a source block string (or "").
 * - fetchCrossrefWorks(query, rows): real journal metadata from Crossref.
 *
 * Both are best-effort and never throw. Centralized so the Writing Studio's
 * draft generator and outline generator share one grounding pipeline.
 */
import { retrieveChunks, buildContextBlock } from "../lib/rag";
import { searchWeb } from "../lib/web-search";

export async function retrieveUserMaterial(
  userId: string,
  query: string,
  limit = 4
): Promise<string> {
  if (!userId || !query?.trim()) return "";
  try {
    const chunks = await retrieveChunks(userId, query, limit);
    if (chunks.length === 0) return "";
    return `REFERENSI DARI MATERI KULIAH PENGGUNA (prioritaskan sebagai fondasi tulisan):\n${buildContextBlock(chunks)}`;
  } catch {
    return "";
  }
}

export interface CrossrefWork {
  title: string;
  authors: string;
  year: string;
  url: string;
  doi: string;
  abstract: string;
}

export async function fetchCrossrefWorks(
  query: string,
  rows = 4
): Promise<CrossrefWork[]> {
  if (!query?.trim()) return [];
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&select=title,author,abstract,URL,published-print,published-online,DOI&rows=${rows}`;
    const res = await fetch(url, { headers: { "User-Agent": "EduSparq/1.0 (mailto:hello@edusparq.app)" } });
    if (!res.ok) return [];
    const json = await res.json();
    const items = json?.message?.items || [];
    return items.map((item: any) => {
      const title = item.title?.[0] || "Tanpa Judul";
      const authors = (item.author || [])
        .map((a: any) => `${a.given || ""} ${a.family || ""}`.trim())
        .join(", ") || "Penulis tidak diketahui";
      const yearRaw = item["published-print"]?.["date-parts"]?.[0]?.[0] ||
        item["published-online"]?.["date-parts"]?.[0]?.[0] || "";
      let abstract = item.abstract || "";
      abstract = abstract.replace(/<[^>]*>/g, "");
      return {
        title,
        authors,
        year: yearRaw ? String(yearRaw) : "n.d.",
        url: item.URL || "",
        doi: item.DOI || "",
        abstract: abstract.slice(0, 800),
      };
    });
  } catch {
    return [];
  }
}

/** Format Crossref works into a grounding block for the LLM. */
export function formatCrossrefBlock(works: CrossrefWork[]): string {
  if (!works || works.length === 0) return "";
  const body = works
    .map(
      (w, i) =>
        `Jurnal ${i + 1}:\nJudul: ${w.title}\nPenulis: ${w.authors}\nTahun: ${w.year}\nDOI/Link: ${w.doi ? "https://doi.org/" + w.doi : w.url}\nAbstrak: ${w.abstract}`
    )
    .join("\n\n");
  return `REFERENSI JURNAL ASLI DARI DATABASE CROSSREF (hanya sebutkan referensi dari daftar ini, jangan mengarang):\n${body}`;
}

/**
 * Combined grounding for a writing task: user material + optional web context.
 * Returns the joined source block and a flag indicating whether any grounding
 * was available.
 */
export async function buildWritingGrounding(
  userId: string,
  topic: string,
  opts: { useWeb?: boolean } = {}
): Promise<{ sourceBlock: string; hasGrounding: boolean }> {
  const parts: string[] = [];

  const material = await retrieveUserMaterial(userId, topic, 4);
  if (material) parts.push(material);

  if (opts.useWeb) {
    try {
      const web = await searchWeb(topic, 3);
      if (web) parts.push(web);
    } catch {
      /* non-fatal */
    }
  }

  return { sourceBlock: parts.join("\n\n"), hasGrounding: parts.length > 0 };
}
