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

/** Extracts meaningful keywords from a free-text query (stop-word aware). */
const STOPWORDS = new Set([
  "yang", "dan", "di", "ke", "dari", "untuk", "pada", "dengan", "atau", "ini",
  "itu", "adalah", "akan", "tidak", "juga", "dalam", "agar", "karena", "sebagai",
  "oleh", "para", "the", "and", "for", "with", "that", "this", "are", "from",
  "apa", "bagaimana", "mengapa", "siapa", "kapan", "mana", "jelaskan", "berikan",
  "bantu", "tolong", "saya", "kami", "mereka", "kita", "anda",
]);

function extractKeywords(query: string, max = 8): string[] {
  return (query || "")
    .toLowerCase()
    .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .slice(0, max);
}

/** Tokenize to lowercase words for overlap scoring. */
function tokenize(text: string): Set<string> {
  return new Set(
    (text || "")
      .toLowerCase()
      .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, " ")
      .split(/\s+/)
      .filter((w) => w.length > 1)
  );
}

/**
 * Retrieves the most relevant chunks for a user query using a hybrid strategy:
 *
 * 1. MongoDB $text full-text search (textScore) — recall.
 * 2. Keyword overlap rescoring (Jaccard-like) — precision on meaning.
 * 3. Final score = normalized textScore + overlap weight, then sorted.
 *
 * Falls back to pure regex keyword match if the text index is unavailable.
 * Returns [] on any error — never throws.
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

  const queryTokens = tokenize(query);
  const keywords = extractKeywords(query);

  const rescore = (content: string, textScore: number): number => {
    const contentTokens = tokenize(content);
    let overlap = 0;
    for (const t of queryTokens) if (contentTokens.has(t)) overlap++;
    const overlapRatio = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
    // Normalize textScore (can be >1) and weight overlap meaningfully.
    const normText = textScore > 0 ? Math.min(textScore / 2, 1) : 0;
    return normText + overlapRatio * 1.5;
  };

  // Primary: full-text search.
  try {
    const docs = await DocumentChunk.find(
      { userId, $text: { $search: query } },
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 3) // over-fetch for rescoring
      .lean();

    if (docs && docs.length > 0) {
      const scored = docs
        .map((d: any) => {
          const rawScore = typeof d.score === "number" ? d.score : 1;
          return {
            content: d.content,
            courseName: d.courseName || "",
            documentId: String(d.documentId),
            score: rescore(d.content || "", rawScore),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
      if (scored.length > 0) return scored;
    }
  } catch {
    // text index may not exist yet — fall through to regex fallback.
  }

  // Fallback: regex keyword match + overlap rescore.
  try {
    if (keywords.length === 0) return [];

    const orFilters = keywords.map((kw) => ({
      content: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    }));

    const docs = await DocumentChunk.find({
      userId,
      $or: orFilters,
    })
      .limit(limit * 4)
      .lean();

    return (docs || [])
      .map((d: any) => ({
        content: d.content,
        courseName: d.courseName || "",
        documentId: String(d.documentId),
        score: rescore(d.content || "", 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Heuristic confidence based on the number of retrieved chunks and the top
 * rescored score. Thresholds tuned for the hybrid scoring above.
 */
export function computeConfidence(
  chunks: RetrievedChunk[]
): "High" | "Medium" | "Low" | "Unknown" {
  if (!chunks || chunks.length === 0) return "Unknown";

  const top = chunks[0]?.score ?? 0;

  if (chunks.length >= 3 && top >= 0.9) return "High";
  if (chunks.length >= 1 && top >= 0.4) return "Medium";
  if (top > 0) return "Low";
  return "Unknown";
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
