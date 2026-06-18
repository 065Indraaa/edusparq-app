import { connectDB } from "../lib/db/mongodb";
import { UniversityCache } from "../lib/db/models/UniversityCache";
import { searchUniversities as searchUniversitiesPddikti } from "../lib/pddikti";

/**
 * Indonesia University Data API integration (https://use.api.co.id).
 *
 * Degrades gracefully: if `API_CO_ID_KEY` is not set, search returns
 * `{ configured: false, results: [] }` and the UI falls back to manual input.
 * Results are cached in MongoDB (TTL below) to respect the free tier.
 */

export interface UniversityResult {
  name: string;
  shortName: string;
  province: string;
  regency: string;
  type: string;
}

const CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const API_BASE = "https://use.api.co.id/regional/indonesia/universities";

/** True only when a real API key is present (placeholders ignored). */
export function isCampusApiConfigured(): boolean {
  const key = process.env.API_CO_ID_KEY;
  return Boolean(key && key.trim().length > 0 && !key.toLowerCase().includes("your"));
}

function normalizeQuery(q: string): string {
  return (q || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === null || v === undefined) return "";
  return String(v);
}

// The API uses Indonesian field names; map defensively to our shape and also
// accept already-normalized English keys in case the payload shape changes.
function mapRow(row: Record<string, unknown>): UniversityResult {
  return {
    name: toStr(row.name ?? row.nama_pt),
    shortName: toStr(row.short_name ?? row.nm_singkat),
    province: toStr(row.province ?? row.provinsi_pt),
    regency: toStr(row.regency ?? row.kab_kota_pt),
    type: toStr(row.university_type ?? row.nm_bp),
  };
}

export async function searchUniversities(
  rawQuery: string
): Promise<{ configured: boolean; results: UniversityResult[] }> {
  const configured = isCampusApiConfigured();
  const query = normalizeQuery(rawQuery);
  if (query.length < 2) return { configured, results: [] };

  // 1. Cache lookup (best-effort).
  try {
    await connectDB();
    const cached = (await UniversityCache.findOne({ query }).lean()) as
      | { results?: UniversityResult[]; cachedAt?: Date }
      | null;
    if (
      cached &&
      cached.cachedAt &&
      Date.now() - new Date(cached.cachedAt).getTime() < CACHE_TTL_MS
    ) {
      return {
        configured,
        results: Array.isArray(cached.results) ? cached.results : [],
      };
    }
  } catch {
    // ignore cache errors — fall through to live fetch / empty
  }

  if (!configured) {
    // No api.co.id key — fall back to PDDIKTI (keyless) so the picker still
    // returns real universities for every user.
    const pt = await searchUniversitiesPddikti(rawQuery);
    const fallback: UniversityResult[] = pt.map((u) => ({
      name: u.nama,
      shortName: u.namaSingkat,
      province: "",
      regency: "",
      type: "",
    }));
    if (fallback.length > 0) {
      try {
        await UniversityCache.findOneAndUpdate(
          { query },
          { $set: { results: fallback, cachedAt: new Date() } },
          { upsert: true }
        );
      } catch {
        // ignore cache write errors
      }
    }
    return { configured: false, results: fallback };
  }

  // 2. Live fetch.
  try {
    const url = `${API_BASE}?name=${encodeURIComponent(rawQuery.trim())}&size=10`;
    const res = await fetch(url, {
      headers: { "x-api-co-id": process.env.API_CO_ID_KEY as string },
    });
    if (!res.ok) return { configured, results: [] };

    const json: unknown = await res.json();
    let rows: unknown[] = [];
    if (Array.isArray(json)) {
      rows = json;
    } else if (json && typeof json === "object") {
      const obj = json as Record<string, unknown>;
      if (Array.isArray(obj.data)) rows = obj.data;
      else if (Array.isArray(obj.results)) rows = obj.results;
    }

    const results = rows
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map(mapRow)
      .filter((r) => r.name.length > 0)
      .slice(0, 10);

    // 3. Cache upsert (best-effort).
    try {
      await UniversityCache.findOneAndUpdate(
        { query },
        { $set: { results, cachedAt: new Date() } },
        { upsert: true }
      );
    } catch {
      // ignore cache write errors
    }

    return { configured, results };
  } catch {
    return { configured, results: [] };
  }
}
