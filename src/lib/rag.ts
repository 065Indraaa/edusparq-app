import { connectDB } from "../lib/db/mongodb";
import { DocumentChunk } from "../lib/db/models/DocumentChunk";
import OpenAI from "openai";
import mongoose from "mongoose";

export interface RetrievedChunk {
  content: string;
  courseName: string;
  documentId: string;
  score: number;
  chunkIndex?: number;
}

/**
 * Splits text into overlapping chunks on whitespace boundaries so words are
 * never cut in half.
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

/**
 * Generates vector embeddings using OpenAI or NVIDIA NIM.
 * Model defaults to text-embedding-3-small (1536 dim).
 */
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    const apiKey = process.env.OPENAI_API_KEY || process.env.NVIDIA_API_KEY;
    const baseURL = process.env.OPENAI_API_KEY 
      ? undefined 
      : (process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1");
    
    if (!apiKey) {
      console.warn("[RAG] No API Key found for generating embedding. Vector Search will be bypassed.");
      return [];
    }

    const openai = new OpenAI({ apiKey, baseURL });
    const model = process.env.OPENAI_API_KEY 
      ? "text-embedding-3-small" 
      : "nvidia/embeddings-nv-embed-qa-4"; // NVIDIA Embedding model

    const response = await openai.embeddings.create({
      model,
      input: text.replace(/\\n/g, " "),
      encoding_format: "float",
    });

    return response.data[0]?.embedding || [];
  } catch (err) {
    console.error("[RAG] Failed to generate embedding:", err);
    return [];
  }
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
 * Retrieves the most relevant chunks using a hybrid approach:
 * 1. MongoDB Atlas Vector Search (if embedding works).
 * 2. Fallback to full-text text score and keyword matching if vector fails.
 */
export async function retrieveChunks(
  userId: string,
  query: string,
  limit = 4,
  courseName?: string
): Promise<RetrievedChunk[]> {
  if (!userId || !query?.trim()) return [];

  try {
    await connectDB();
  } catch {
    return [];
  }

  const queryTokens = tokenize(query);
  const keywords = extractKeywords(query);

  const rescore = (content: string, vectorScore: number, textScore = 0): number => {
    const contentTokens = tokenize(content);
    let overlap = 0;
    for (const t of queryTokens) if (contentTokens.has(t)) overlap++;
    const overlapRatio = queryTokens.size > 0 ? overlap / queryTokens.size : 0;
    
    // Weighted combination of Vector search score (or fallback textScore) and overlap ratio
    return (vectorScore * 1.5) + (textScore * 0.5) + (overlapRatio * 1.2);
  };

  // Primary Strategy: Atlas Vector Search
  const embedding = await getEmbedding(query);
  if (embedding && embedding.length > 0) {
    try {
      const pipeline: any[] = [
        {
          $vectorSearch: {
            index: "vector_index", // Name of Atlas Vector index
            path: "embedding",
            queryVector: embedding,
            numCandidates: 100,
            limit: limit * 2,
          }
        },
        {
          $match: courseName 
            ? { userId: new mongoose.Types.ObjectId(userId), courseName }
            : { userId: new mongoose.Types.ObjectId(userId) }
        }
      ];

      const vectorDocs = await DocumentChunk.aggregate(pipeline);
      if (vectorDocs && vectorDocs.length > 0) {
        return vectorDocs
          .map((d: any) => ({
            content: d.content,
            courseName: d.courseName || "",
            documentId: String(d.documentId),
            chunkIndex: d.chunkIndex,
            score: rescore(d.content || "", d.score || 0.5, 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);
      }
    } catch (err) {
      console.warn("[RAG] Atlas Vector Search failed/not-indexed, falling back to full-text search:", err);
    }
  }

  // Fallback 1: Text Score Match (Full-text index)
  try {
    const filter: any = { userId: new mongoose.Types.ObjectId(userId), $text: { $search: query } };
    if (courseName) filter.courseName = courseName;

    const docs = await DocumentChunk.find(
      filter,
      { score: { $meta: "textScore" } }
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(limit * 3)
      .lean();

    if (docs && docs.length > 0) {
      return docs
        .map((d: any) => {
          const rawScore = typeof d.score === "number" ? d.score : 1;
          return {
            content: d.content,
            courseName: d.courseName || "",
            documentId: String(d.documentId),
            chunkIndex: d.chunkIndex,
            score: rescore(d.content || "", 0, rawScore),
          };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
    }
  } catch {
    // Text search failed or index doesn't exist yet, fall through
  }

  // Fallback 2: Keyword overlap matching
  try {
    if (keywords.length === 0) return [];

    const orFilters = keywords.map((kw) => ({
      content: { $regex: kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" },
    }));

    const filter: any = { userId: new mongoose.Types.ObjectId(userId), $or: orFilters };
    if (courseName) filter.courseName = courseName;

    const docs = await DocumentChunk.find(filter)
      .limit(limit * 4)
      .lean();

    return (docs || [])
      .map((d: any) => ({
        content: d.content,
        courseName: d.courseName || "",
        documentId: String(d.documentId),
        chunkIndex: d.chunkIndex,
        score: rescore(d.content || "", 0, 0),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  } catch {
    return [];
  }
}

/**
 * Heuristic confidence based on top score.
 */
export function computeConfidence(
  chunks: RetrievedChunk[]
): "High" | "Medium" | "Low" | "Unknown" {
  if (!chunks || chunks.length === 0) return "Unknown";

  const top = chunks[0]?.score ?? 0;

  if (chunks.length >= 3 && top >= 1.2) return "High";
  if (chunks.length >= 1 && top >= 0.5) return "Medium";
  if (top > 0) return "Low";
  return "Unknown";
}

/** Formats retrieved chunks into a context block for LLM prompts. */
export function buildContextBlock(chunks: RetrievedChunk[]): string {
  if (!chunks || chunks.length === 0) return "";

  return chunks
    .map(
      (c, i) =>
        `[Sumber ${i + 1}: ${c.courseName || "Materi"} | Block: ${c.chunkIndex ?? 0}]
${c.content.trim()}`
    )
    .join("\\n\\n");
}
