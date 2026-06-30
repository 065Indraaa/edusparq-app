/**
 * Verification Layer — Anti-hallucination engine for EduSparq AI.
 *
 * This module provides:
 * 1. Citation tracking — maps AI output claims to source chunks/URLs
 * 2. Claim extraction — parses AI output for factual claims that need sourcing
 * 3. Source verification — checks if a DOI/Crossref work is real
 * 4. Confidence scoring — measures how well-grounded an answer is
 * 5. Hallucination detection — flags unsupported claims
 *
 * Design: pure functions, no React, no side effects except network calls
 * for verification (Crossref DOI check). All functions are best-effort.
 */

import { retrieveChunks, type RetrievedChunk } from "./rag";
import { fetchCrossrefWorks, type CrossrefWork } from "./rag-grounding";
import { searchWeb } from "./web-search";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface SourceReference {
  id: string;
  type: "document" | "web" | "journal";
  title: string;
  content: string;
  url?: string;
  doi?: string;
  score: number;
  /** Which part of the AI output this source supports */
  supportsClaim?: string;
}

export interface Claim {
  text: string;
  startIndex: number;
  endIndex: number;
  hasSource: boolean;
  sourceIds: string[];
  verified: boolean;
}

export interface VerificationResult {
  claims: Claim[];
  sources: SourceReference[];
  confidenceScore: number;
  confidenceLevel: "High" | "Medium" | "Low" | "No Sources";
  unsupportedCount: number;
  verifiedCount: number;
  totalClaims: number;
  warnings: string[];
}

// ─── Claim Extraction ──────────────────────────────────────────────────────

/**
 * Extracts factual claims from AI output text.
 * A "claim" is a sentence that asserts a fact, statistic, definition, or
 * causal relationship — statements that SHOULD have a source.
 *
 * Heuristic-based (free, no LLM call):
 * - Sentences with numbers/percentages/stats
 * - Sentences with "menurut", "berdasarkan", "penelitian menunjukkan"
 * - Sentences with causal markers: "karena", "sehingga", "menyebabkan"
 * - Definition sentences: "X adalah Y", "X merupakan Y"
 * - Sentences with proper nouns + factual assertion
 */
export function extractClaims(text: string): Claim[] {
  if (!text || !text.trim()) return [];

  // Split into sentences (Indonesian + English sentence boundaries)
  const sentences = text
    .replace(/\n+/g, " ")
    .split(/(?<=[.!?])\s+(?=[A-Z0-9"'])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15);

  const claims: Claim[] = [];

  // Patterns that indicate a factual claim needing a source
  const claimPatterns = [
    /\d+[%\s]*(persen|persen|percent)/i, // statistics
    /\d{4}/, // years (historical claims)
    /menurut\s+/i, // "according to"
    /berdasarkan\s+(penelitian|studi|data|jurnal)/i, // "based on research"
    /penelitian\s+(menunjukkan|membuktikan|menemukan)/i, // "research shows"
    /(adalah|merupakan|ialah)\s+/i, // definitions
    /(karena|sebab|akibat)\s+/i, // causation
    /(menyebabkan|mengakibatkan|berdampak)/i, // causation
    /(ditemukan|ditemukan\s+oleh)/i, // discovery claims
    /(teori|hukum|prinsip|konsep)\s+/i, // theoretical claims
  ];

  let searchIndex = 0;
  for (const sentence of sentences) {
    const isClaim = claimPatterns.some((p) => p.test(sentence));
    if (!isClaim) continue;

    // Find the actual position in original text
    const startIndex = text.indexOf(sentence, searchIndex);
    if (startIndex === -1) continue;
    searchIndex = startIndex + sentence.length;

    claims.push({
      text: sentence,
      startIndex,
      endIndex: startIndex + sentence.length,
      hasSource: false,
      sourceIds: [],
      verified: false,
    });
  }

  return claims;
}

// ─── Source Gathering ───────────────────────────────────────────────────────

/**
 * Gathers all sources used to ground an AI response.
 * Combines: user documents (RAG), web search results, and Crossref journals.
 *
 * @param userId - for RAG document retrieval
 * @param query - the original user question
 * @param options - which source types to include
 */
export async function gatherSources(
  userId: string,
  query: string,
  options: {
    useDocuments?: boolean;
    useWeb?: boolean;
    useJournals?: boolean;
    maxPerType?: number;
  } = {}
): Promise<{ sources: SourceReference[]; sourceBlock: string }> {
  const {
    useDocuments = true,
    useWeb = false,
    useJournals = false,
    maxPerType = 4,
  } = options;

  const sources: SourceReference[] = [];
  const blocks: string[] = [];

  // 1. User documents (RAG)
  if (useDocuments && userId) {
    try {
      const chunks = await retrieveChunks(userId, query, maxPerType);
      for (const chunk of chunks) {
        const id = `doc_${chunk.documentId}_${chunk.chunkIndex ?? 0}`;
        sources.push({
          id,
          type: "document",
          title: chunk.courseName || "Materi Kuliah",
          content: chunk.content,
          score: chunk.score,
        });
      }
      if (chunks.length > 0) {
        blocks.push(
          "REFERENSI DARI MATERI KULIAH PENGGUNA (prioritaskan sebagai fondasi):\n" +
            chunks
              .map(
                (c, i) =>
                  `[Sumber ${i + 1}: ${c.courseName || "Materi"}]\n${c.content.trim()}`
              )
              .join("\n\n")
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  // 2. Web search
  if (useWeb && query.trim()) {
    try {
      const webResult = await searchWeb(query, maxPerType);
      if (webResult && !webResult.includes("tidak mengembalikan")) {
        blocks.push(webResult);
        // Parse web results into SourceReference objects
        const lines = webResult.split("\n");
        let currentTitle = "";
        let currentUrl = "";
        let currentSnippet = "";
        let webIdx = 0;
        for (const line of lines) {
          if (line.startsWith("[Sumber:")) {
            if (currentTitle && currentSnippet) {
              webIdx++;
              sources.push({
                id: `web_${webIdx}`,
                type: "web",
                title: currentTitle,
                content: currentSnippet,
                url: currentUrl,
                score: 0.5, // web results get lower default score
              });
            }
            const match = line.match(/\[Sumber:\s*(.+?)\]\s*\((.+?)\)/);
            currentTitle = match?.[1] || `Sumber Web ${webIdx + 1}`;
            currentUrl = match?.[2] || "";
            currentSnippet = "";
          } else if (line.trim() && !line.startsWith("HASIL PENCARIAN")) {
            currentSnippet += line + " ";
          }
        }
        // Last entry
        if (currentTitle && currentSnippet) {
          webIdx++;
          sources.push({
            id: `web_${webIdx}`,
            type: "web",
            title: currentTitle,
            content: currentSnippet.trim(),
            url: currentUrl,
            score: 0.5,
          });
        }
      }
    } catch {
      /* non-fatal */
    }
  }

  // 3. Crossref journals
  if (useJournals && query.trim()) {
    try {
      const works = await fetchCrossrefWorks(query, maxPerType);
      for (let i = 0; i < works.length; i++) {
        const w = works[i];
        sources.push({
          id: `journal_${i + 1}`,
          type: "journal",
          title: w.title,
          content: w.abstract || `${w.authors} (${w.year}). ${w.title}.`,
          url: w.url,
          doi: w.doi,
          score: 0.8, // peer-reviewed journals get high score
        });
      }
      if (works.length > 0) {
        blocks.push(
          "REFERENSI JURNAL ASLI DARI CROSSREF (hanya sebutkan dari daftar ini):\n" +
            works
              .map(
                (w, i) =>
                  `Jurnal ${i + 1}: ${w.title}\nPenulis: ${w.authors}\nTahun: ${w.year}\nDOI: ${w.doi ? "https://doi.org/" + w.doi : w.url}\nAbstrak: ${w.abstract}`
              )
              .join("\n\n")
        );
      }
    } catch {
      /* non-fatal */
    }
  }

  return {
    sources,
    sourceBlock: blocks.join("\n\n"),
  };
}

// ─── Claim-to-Source Matching ──────────────────────────────────────────────

/**
 * Matches each extracted claim to relevant sources.
 * Uses keyword overlap to determine which source supports which claim.
 */
export function matchClaimsToSources(
  claims: Claim[],
  sources: SourceReference[]
): Claim[] {
  if (claims.length === 0 || sources.length === 0) return claims;

  return claims.map((claim) => {
    const claimWords = new Set(
      claim.text
        .toLowerCase()
        .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, " ")
        .split(/\s+/)
        .filter((w) => w.length > 3)
    );

    const matchedSources: { id: string; score: number }[] = [];

    for (const source of sources) {
      const sourceWords = new Set(
        source.content
          .toLowerCase()
          .replace(/[^a-z0-9\u00C0-\u024F\s]/gi, " ")
          .split(/\s+/)
          .filter((w) => w.length > 3)
      );

      let overlap = 0;
      for (const w of claimWords) {
        if (sourceWords.has(w)) overlap++;
      }
      const overlapRatio = claimWords.size > 0 ? overlap / claimWords.size : 0;

      if (overlapRatio > 0.15) {
        matchedSources.push({
          id: source.id,
          score: overlapRatio * source.score,
        });
      }
    }

    matchedSources.sort((a, b) => b.score - a.score);

    if (matchedSources.length > 0) {
      return {
        ...claim,
        hasSource: true,
        sourceIds: matchedSources.slice(0, 3).map((m) => m.id),
        verified: matchedSources[0].score > 0.3,
      };
    }
    return claim;
  });
}

// ─── Confidence Scoring ─────────────────────────────────────────────────────

/**
 * Calculates overall confidence score for an AI response.
 * Based on:
 * - Ratio of claims that have sources
 * - Average source relevance score
 * - Whether any peer-reviewed sources were used
 * - Number of unsupported claims (penalty)
 */
export function calculateConfidence(
  claims: Claim[],
  sources: SourceReference[]
): {
  score: number;
  level: "High" | "Medium" | "Low" | "No Sources";
  unsupportedCount: number;
  verifiedCount: number;
} {
  if (sources.length === 0 && claims.length === 0) {
    return { score: 0, level: "No Sources", unsupportedCount: 0, verifiedCount: 0 };
  }

  if (sources.length === 0) {
    return {
      score: 10,
      level: "No Sources",
      unsupportedCount: claims.length,
      verifiedCount: 0,
    };
  }

  const totalClaims = claims.length || 1;
  const sourcedClaims = claims.filter((c) => c.hasSource).length;
  const verifiedClaims = claims.filter((c) => c.verified).length;
  const unsupportedCount = claims.filter((c) => !c.hasSource).length;

  const claimCoverage = sourcedClaims / totalClaims;
  const avgSourceScore =
    sources.reduce((sum, s) => sum + s.score, 0) / sources.length;
  const hasJournal = sources.some((s) => s.type === "journal");

  // Weighted score: coverage 40%, source quality 30%, journal bonus 15%, verified ratio 15%
  let score = claimCoverage * 40 + Math.min(avgSourceScore, 1) * 30;
  if (hasJournal) score += 15;
  score += (verifiedClaims / totalClaims) * 15;

  // Penalty for unsupported claims
  if (unsupportedCount > 2) score -= 10;

  score = Math.max(0, Math.min(100, score));

  let level: "High" | "Medium" | "Low" | "No Sources";
  if (score >= 75) level = "High";
  else if (score >= 50) level = "Medium";
  else if (score >= 25) level = "Low";
  else level = "No Sources";

  return {
    score: Math.round(score),
    level,
    unsupportedCount,
    verifiedCount: verifiedClaims,
  };
}

// ─── Hallucination Detection ───────────────────────────────────────────────

/**
 * Detects potential hallucination markers in AI output.
 * Returns warnings for suspicious patterns.
 */
export function detectHallucinationMarkers(text: string): string[] {
  const warnings: string[] = [];
  if (!text) return warnings;

  // Pattern: fabricated DOI-like strings
  const doiPattern = /10\.\d{4,}\/[^\s]+/g;
  const dois = text.match(doiPattern);
  if (dois) {
    // Real DOIs have at least a slash followed by alphanumeric
    for (const doi of dois) {
      if (!/^10\.\d{4,}\/[a-zA-Z0-9.\-]+$/.test(doi)) {
        warnings.push(`DOI mencurigakan terdeteksi: ${doi}`);
      }
    }
  }

  // Pattern: suspiciously specific statistics without context
  const statPattern = /(\d+\.?\d*)\s*(persen|%)/gi;
  const stats = text.match(statPattern);
  if (stats && stats.length > 5) {
    warnings.push(
      `${stats.length} statistik disebutkan — verifikasi bahwa setiap angka memiliki sumber`
    );
  }

  // Pattern: fabricated author names (common hallucination)
  const authorPattern = /menurut\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g;
  const authors = text.match(authorPattern);
  if (authors && authors.length > 3) {
    warnings.push(
      `${authors.length} nama peneliti disebutkan — pastikan semua nyata dan dapat diverifikasi`
    );
  }

  // Pattern: hedging language indicating uncertainty
  const hedgePattern = /mungkin|kemungkinan|sepertinya|nampaknya|diduga/gi;
  const hedges = text.match(hedgePattern);
  if (hedges && hedges.length > 4) {
    warnings.push(
      "Banyak bahasa hedging terdeteksi — jawaban mungkin kurang yakin. Pertimbangkan grounding yang lebih kuat."
    );
  }

  return warnings;
}

// ─── DOI Verification ──────────────────────────────────────────────────────

/**
 * Verifies that a DOI actually exists in Crossref.
 * @returns true if the DOI resolves to a real work
 */
export async function verifyDOI(doi: string): Promise<{
  valid: boolean;
  title?: string;
  error?: string;
}> {
  if (!doi) return { valid: false, error: "DOI kosong" };

  const cleanDoi = doi.replace(/^https?:\/\/doi\.org\//i, "").trim();
  try {
    const url = `https://api.crossref.org/works/${encodeURIComponent(cleanDoi)}`;
    const res = await fetch(url, {
      headers: { "User-Agent": "EduSparq/1.0 (mailto:hello@edusparq.app)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      return { valid: false, error: `DOI tidak ditemukan (HTTP ${res.status})` };
    }
    const json = await res.json();
    const title = json?.message?.title?.[0];
    return { valid: true, title };
  } catch (err) {
    return {
      valid: false,
      error: err instanceof Error ? err.message.slice(0, 100) : "Verifikasi gagal",
    };
  }
}

// ─── Full Verification Pipeline ─────────────────────────────────────────────

/**
 * Full verification pipeline for an AI response.
 * Call this AFTER the AI generates output to produce a verification report.
 *
 * @param aiOutput - the text the AI generated
 * @param userId - for RAG document retrieval
 * @param query - original user question
 * @param sourcesUsed - sources that were provided to the AI (from gatherSources)
 */
export function verifyResponse(
  aiOutput: string,
  query: string,
  sourcesUsed: SourceReference[]
): VerificationResult {
  // 1. Extract claims from AI output
  const claims = extractClaims(aiOutput);

  // 2. Match claims to sources
  const matchedClaims = matchClaimsToSources(claims, sourcesUsed);

  // 3. Calculate confidence
  const confidence = calculateConfidence(matchedClaims, sourcesUsed);

  // 4. Detect hallucination markers
  const warnings = detectHallucinationMarkers(aiOutput);

  // 5. Add warning if many unsupported claims
  if (confidence.unsupportedCount > 3) {
    warnings.push(
      `${confidence.unsupportedCount} klaim tidak memiliki sumber pendukung — jawaban mungkin kurang grounded`
    );
  }

  return {
    claims: matchedClaims,
    sources: sourcesUsed,
    confidenceScore: confidence.score,
    confidenceLevel: confidence.level,
    unsupportedCount: confidence.unsupportedCount,
    verifiedCount: confidence.verifiedCount,
    totalClaims: claims.length,
    warnings,
  };
}

// ─── Citation Rendering Helpers ─────────────────────────────────────────────

/**
 * Generates inline citation markers [1], [2] for sources.
 * Returns the AI output with citation markers inserted after relevant claims.
 */
export function addCitationMarkers(
  aiOutput: string,
  claims: Claim[],
  sources: SourceReference[]
): string {
  if (claims.length === 0 || sources.length === 0) return aiOutput;

  // Build source index map
  const sourceIndexMap = new Map<string, number>();
  sources.forEach((s, i) => sourceIndexMap.set(s.id, i + 1));

  // Process claims from end to start (so indices don't shift)
  const sortedClaims = [...claims]
    .filter((c) => c.hasSource && c.sourceIds.length > 0)
    .sort((a, b) => b.startIndex - a.startIndex);

  let result = aiOutput;
  for (const claim of sortedClaims) {
    const citationNums = claim.sourceIds
      .map((id) => sourceIndexMap.get(id))
      .filter((n): n is number => n !== undefined)
      .map((n) => `[${n}]`)
      .join("");

    if (citationNums) {
      // Insert citation marker after the claim's sentence
      const insertPos = claim.endIndex;
      result =
        result.slice(0, insertPos) + ` ${citationNums}` + result.slice(insertPos);
    }
  }

  return result;
}

/**
 * Generates a source list (bibliography) from sources.
 * Formatted for display in the SourcesPanel.
 */
export function generateSourceList(sources: SourceReference[]): string[] {
  return sources.map((s, i) => {
    const num = `[${i + 1}]`;
    const typeLabel =
      s.type === "journal"
        ? "Jurnal"
        : s.type === "web"
          ? "Web"
          : "Materi";
    const detail = s.doi
      ? `DOI: ${s.doi}`
      : s.url
        ? s.url
        : s.content.slice(0, 80) + "...";
    return `${num} (${typeLabel}) ${s.title} — ${detail}`;
  });
}
