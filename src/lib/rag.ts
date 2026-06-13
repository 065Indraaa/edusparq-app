import { connectDB } from "@/lib/db/mongodb";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";

export interface RetrievedChunk {
  content: string;
  courseName: string;
  documentId: string;
  score: number;
}

/**
 * Splits text into overlapping chunks on whitespace boundaries so words are
 * never cut in half. Dependency-free (no tokenizer / embeddings).
 */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = (text || "").replace(/\s+/g, " ").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;

  while (start < clean.length) {
    let end = Math.min(start + size, clean.length);

    // Prefer to break on a whitespace boundary when not at the very end.
    if (end < clean.length) {
      const lastSpace = clean.lastIndexOf(" ", end);
      if (lastSpace > start) end = lastSpace;
    }

    chunks.push(clean.slice(start, end).trim());

    if (end >= clean.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks.filter(Boolean);
}

/** Extracts a few meaningful keywords from a free-text query. */
function extractKeywords(query: string, max = 6): string[] {
  return (query || "")
    .toLowerCase()
    .replace(/[^a-z0-9À-ɏ\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .slice(0, max);
}

/**
 * Retrieves the most relevant chunks for a user query.
 * Primary path: MongoDB $text search (textScore). Fallback: case-insensitive
 * regex on extracted keywords. Returns [] on any error — never throws.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  limit = 4
): Promise<RetrievedChunk[]> {
  if (!userId || !query?.trim()) return [];

  try {
    await connectDB();
  } catch {
    return [];
  }

  // Primary: full-text search.
  try {
    const docs = await DocumentChunk.find(
      { userId, $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit)
      .lean();

    if (docs && docs.length > 0) {
      return docs.map((d: any) => ({
        content: d.content,
        courseName: d.courseName || "",
        documentId: String(d.documentId),
        score: typeof d.score === "number" ? d.score : 1,
      }));
    }
  } catch {
    // text index may not exist yet — fall through to regex fallback.
  }

  // Fallback: regex keyword match.
  try {
    const keywords = extractKeywords(query);
    if (keywords.length === 0) return [];

    const orFilters = keywords.map((kw) => ({
      content: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    }));

    const docs = await DocumentChunk.find({
      userId,
      $or: orFilters,
    })
      .limit(limit)
      .lean();

    return (docs || []).map((d: any) => {
      const lc = (d.content || "").toLowerCase();
      const score = keywords.reduce((acc, kw) => (lc.includes(kw) ? acc + 1 : acc), 0);
      return {
        content: d.content,
        courseName: d.courseName || "",
        documentId: String(d.documentId),
        score,
      };
    }).sort((a, b) => b.score - a.score);
  } catch {
    return [];
  }
}

/**
 * Heuristic confidence based on number of retrieved chunks and the top score.
 */
export function computeConfidence(
  chunks: RetrievedChunk[]
): "High" | "Medium" | "Low" | "Unknown" {
  if (!chunks || chunks.length === 0) return "Unknown";

  const top = chunks[0]?.score ?? 0;

  if (chunks.length >= 3 || top >= 1.5) return "High";
  if (chunks.length >= 1 || top > 0) return "Medium";
  return "Low";
}

/**
 * Formats retrieved chunks into a context block for an LLM prompt, with
 * numbered source headers referencing the course.
 */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) return "";

  return chunks
    .map(
      (c, i) =>
        `[Sumber ${i + 1}: ${c.courseName || "Materi"}]\n${c.content.trim()}`
    )
    .join("\n\n");
}
