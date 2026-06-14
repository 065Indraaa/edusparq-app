import { connectDB } from "@/lib/db/mongodb";
import { CampusLookupCache } from "@/lib/db/models/CampusLookupCache";

/**
 * PDDIKTI (Pangkalan Data Pendidikan Tinggi) public data integration.
 *
 * Uses the official frontend data endpoints of Kemdiktisaintek — no API key
 * required — to power: university autocomplete, study-program (prodi)
 * autocomplete, and "auto-fill profile from PDDIKTI" (search a student by name
 * then read their university / prodi / entry date to estimate the semester).
 *
 * Everything degrades gracefully: any network/parse failure returns an empty
 * result so the profile form keeps working as plain manual input.
 */

const BASE = "https://api-pddikti.kemdiktisaintek.go.id";
const ORIGIN = "https://pddikti.kemdiktisaintek.go.id";
const UA = "Mozilla/5.0 (compatible; EduSparq/1.0; +https://edusparq)";
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const FETCH_TIMEOUT_MS = 12000;

export interface PddiktiPT {
  id: string;
  kode: string;
  namaSingkat: string;
  nama: string;
}

export interface PddiktiProdi {
  id: string;
  nama: string;
  jenjang: string;
  pt: string;
  ptSingkat: string;
}

export interface PddiktiMhs {
  id: string;
  nama: string;
  nim: string;
  namaPt: string;
  singkatanPt: string;
  namaProdi: string;
}

export interface PddiktiMhsDetail {
  namaPt: string;
  prodi: string;
  nama: string;
  nim: string;
  jenjang: string;
  tanggalMasuk: string;
  statusSaatIni: string;
}

function toStr(v: unknown): string {
  if (typeof v === "string") return v.trim();
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

async function pddiktiFetch(path: string): Promise<unknown | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "User-Agent": UA, Origin: ORIGIN, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function cached<T>(key: string, loader: () => Promise<T[]>): Promise<T[]> {
  try {
    await connectDB();
    const hit = (await CampusLookupCache.findOne({ key }).lean()) as
      | { payload?: T[]; cachedAt?: Date }
      | null;
    if (
      hit &&
      hit.cachedAt &&
      Date.now() - new Date(hit.cachedAt).getTime() < CACHE_TTL_MS &&
      Array.isArray(hit.payload)
    ) {
      return hit.payload;
    }
  } catch {
    // ignore cache read errors — fall through to live fetch
  }

  const data = await loader();

  if (Array.isArray(data) && data.length > 0) {
    try {
      await CampusLookupCache.findOneAndUpdate(
        { key },
        { $set: { payload: data, cachedAt: new Date() } },
        { upsert: true }
      );
    } catch {
      // ignore cache write errors
    }
  }
  return data;
}

/** Autocomplete universities by name/short name. Keyless. */
export async function searchUniversities(rawQuery: string): Promise<PddiktiPT[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];
  return cached<PddiktiPT>(`pt:${query.toLowerCase()}`, async () => {
    const json = await pddiktiFetch(`/pencarian/pt/${encodeURIComponent(query)}`);
    const arr = Array.isArray(json) ? json : [];
    return arr
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map((r) => ({
        id: toStr(r.id),
        kode: toStr(r.kode),
        namaSingkat: toStr(r.nama_singkat),
        nama: toStr(r.nama),
      }))
      .filter((r) => r.nama.length > 0)
      .slice(0, 15);
  });
}

/**
 * Autocomplete study programs by name. When `ptName` is given, results are
 * narrowed to that university (matched on full name or short name) so the prodi
 * list stays relevant to the campus the user already picked.
 */
export async function searchProdi(
  rawQuery: string,
  ptName?: string
): Promise<PddiktiProdi[]> {
  const query = rawQuery.trim();
  if (query.length < 2) return [];
  const list = await cached<PddiktiProdi>(`prodi:${query.toLowerCase()}`, async () => {
    const json = await pddiktiFetch(`/pencarian/prodi/${encodeURIComponent(query)}`);
    const arr = Array.isArray(json) ? json : [];
    return arr
      .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
      .map((r) => ({
        id: toStr(r.id),
        nama: toStr(r.nama),
        jenjang: toStr(r.jenjang),
        pt: toStr(r.pt),
        ptSingkat: toStr(r.pt_singkat),
      }))
      .filter((r) => r.nama.length > 0)
      .slice(0, 60);
  });

  const pt = (ptName || "").trim().toLowerCase();
  if (pt) {
    const filtered = list.filter(
      (p) =>
        (p.pt && p.pt.toLowerCase().includes(pt)) ||
        (p.ptSingkat && pt.includes(p.ptSingkat.toLowerCase()))
    );
    if (filtered.length > 0) return filtered.slice(0, 15);
  }
  return list.slice(0, 15);
}

/** Search students by name (not cached — privacy + freshness). Keyless. */
export async function searchMahasiswa(rawQuery: string): Promise<PddiktiMhs[]> {
  const query = rawQuery.trim();
  if (query.length < 3) return [];
  const json = await pddiktiFetch(`/pencarian/mhs/${encodeURIComponent(query)}`);
  const arr = Array.isArray(json) ? json : [];
  return arr
    .filter((r): r is Record<string, unknown> => Boolean(r) && typeof r === "object")
    .map((r) => ({
      id: toStr(r.id),
      nama: toStr(r.nama),
      nim: toStr(r.nim),
      namaPt: toStr(r.nama_pt),
      singkatanPt: toStr(r.sinkatan_pt),
      namaProdi: toStr(r.nama_prodi),
    }))
    .filter((r) => r.id.length > 0 && r.nama.length > 0)
    .slice(0, 20);
}

/** Read one student's public detail to drive profile auto-fill. */
export async function getMahasiswaDetail(
  id: string
): Promise<PddiktiMhsDetail | null> {
  if (!id) return null;
  const json = (await pddiktiFetch(`/detail/mhs/${id}`)) as Record<string, unknown> | null;
  if (!json || typeof json !== "object") return null;
  const detail: PddiktiMhsDetail = {
    namaPt: toStr(json.nama_pt),
    prodi: toStr(json.prodi),
    nama: toStr(json.nama),
    nim: toStr(json.nim),
    jenjang: toStr(json.jenjang),
    tanggalMasuk: toStr(json.tanggal_masuk),
    statusSaatIni: toStr(json.status_saat_ini),
  };
  if (!detail.namaPt && !detail.prodi) return null;
  return detail;
}

/**
 * Estimate the current semester from the PDDIKTI entry date (`tanggal_masuk`).
 * Indonesian programs run two semesters per year, so ~6 months = 1 semester.
 * Clamped to a sane 1..14 range; the user can always adjust it afterwards.
 */
export function estimateSemester(tanggalMasuk: string): number {
  const d = new Date(tanggalMasuk);
  if (isNaN(d.getTime())) return 1;
  const now = new Date();
  const months =
    (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
  if (months < 0) return 1;
  const sem = Math.floor(months / 6) + 1;
  return Math.min(Math.max(sem, 1), 14);
}

/**
 * Best-effort fakultas inference from a study-program name. PDDIKTI does NOT
 * expose the faculty for a student/prodi, so we map the prodi to the most common
 * Indonesian faculty by keyword. This is a sensible default the user can edit —
 * never presented as official data. Returns "" when no confident match.
 */
export function inferFakultas(prodi: string): string {
  const p = (prodi || "").toLowerCase();
  if (!p) return "";
  const has = (...keys: string[]) => keys.some((k) => p.includes(k));

  if (has("kedokteran gigi")) return "Fakultas Kedokteran Gigi";
  if (has("kedokteran", "dokter")) return "Fakultas Kedokteran";
  if (has("keperawatan", "kebidanan", "farmasi", "gizi", "kesehatan masyarakat", "kesehatan", "kebidan"))
    return "Fakultas Ilmu Kesehatan";
  if (has("hukum")) return "Fakultas Hukum";
  if (has("psikologi")) return "Fakultas Psikologi";
  if (has("akuntansi", "manajemen", "ekonomi", "bisnis", "perbankan", "keuangan"))
    return "Fakultas Ekonomi dan Bisnis";
  if (has("informatika", "ilmu komputer", "sistem informasi", "teknologi informasi", "sains data", "data science", "komputer"))
    return "Fakultas Ilmu Komputer";
  if (has("teknik", "arsitektur", "sipil", "mesin", "elektro", "industri", "perkapalan", "geodesi", "pertambangan", "metalurgi"))
    return "Fakultas Teknik";
  if (has("pendidikan", "keguruan", "pgsd", "paud", "tadris"))
    return "Fakultas Keguruan dan Ilmu Pendidikan";
  if (has("komunikasi", "hubungan internasional", "administrasi", "sosiologi", "politik", "pemerintahan", "kesejahteraan sosial", "kriminologi"))
    return "Fakultas Ilmu Sosial dan Ilmu Politik";
  if (has("sastra", "bahasa", "linguistik", "sejarah", "budaya", "inggris", "jepang", "arab"))
    return "Fakultas Ilmu Budaya";
  if (has("pertanian", "agroteknologi", "agribisnis", "kehutanan", "peternakan", "perikanan", "akuakultur", "pangan"))
    return "Fakultas Pertanian";
  if (has("matematika", "fisika", "kimia", "biologi", "statistika", "geofisika", "aktuaria"))
    return "Fakultas Matematika dan Ilmu Pengetahuan Alam";
  if (has("hubungan masyarakat", "jurnalistik")) return "Fakultas Ilmu Komunikasi";
  return "";
}
