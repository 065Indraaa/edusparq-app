/**
 * CREDIT_TABLE & pricing — konfigurasi ekonomi EduSparq.
 *
 * Filosofi hemat token:
 *   - 1 credit ≈ 1 token output pada model default (kimi-k2.6).
 *   - Biaya credit dihitung dari (tokensIn × 0.2 + tokensOut × 1.0) × featureWeight.
 *     Output lebih mahal dari input (konsisten dengan tarif AI umum).
 *   - Feature weight: task berat (solver, draft panjang) lebih mahal dari chat.
 *
 * Tujuannya: user bisa kerja banyak dengan credit kecil karena kita memakai
 * model sesuai kompleksitas (orchestrator → model ringan untuk klasifikasi).
 */

export type FeatureName =
  | "chat"
  | "draft"
  | "solver"
  | "grade"
  | "summarize"
  | "quiz"
  | "flashcards"
  | "research"
  | "analyze"
  | "recommend"
  | "outline"
  | "paraphrase"
  | "extract"
  | "agent_classify"
  | "agent_clarifier"
  | "agent_specifier"
  | "agent_planner"
  | "agent_tasker"
  | "agent_implementer"
  | "agent_reviewer"
  | "telegram"
  | "byok_test";

/**
 * Bobot pengali per fitur. 1.0 = biaya dasar token.
 * Fitur ringan (1.0): chat, summarize, paraphrase.
 * Fitur sedang (1.5–2): grade, analyze, outline, agent klasifikasi/klarifikasi.
 * Fitur berat (3–4): draft, solver, research, agent implementer/reviewer.
 */
export const CREDIT_TABLE: Record<FeatureName, number> = {
  chat: 1.0,
  summarize: 1.0,
  paraphrase: 1.0,
  outline: 1.5,
  grade: 2.0,
  analyze: 2.0,
  recommend: 1.5,
  flashcards: 2.0,
  quiz: 2.5,
  draft: 3.0,
  research: 3.0,
  solver: 4.0,
  extract: 2.0,
  // Agent calls — masing-masing bobot relatif terhadap bobot tugas utama.
  agent_classify: 0.5, // klasifikasi ringan, hemat
  agent_clarifier: 1.0,
  agent_specifier: 1.5,
  agent_planner: 1.5,
  agent_tasker: 1.0,
  agent_implementer: 3.0,
  agent_reviewer: 2.5,
  telegram: 1.2,
  byok_test: 0, // test koneksi BYOK tidak potong credit
};

/**
 * Estimasi biaya credit dari token aktual.
 * `estimated=false` = token berasal dari response.usage (akurat).
 */
export interface CostBreakdown {
  tokensIn: number;
  tokensOut: number;
  /** Biaya dasar sebelum bobot fitur. */
  baseCost: number;
  /** Biaya final setelah dikalikan bobot fitur. */
  creditCost: number;
  estimated: boolean;
}

/** Rasio biaya input:output. Input 5× lebih murah dari output. */
const INPUT_RATIO = 0.2;
const OUTPUT_RATIO = 1.0;

export function computeCost(
  feature: FeatureName,
  tokensIn: number,
  tokensOut: number,
  estimated = false
): CostBreakdown {
  const tin = Math.max(0, Math.round(tokensIn || 0));
  const tout = Math.max(0, Math.round(tokensOut || 0));
  const baseCost = tin * INPUT_RATIO + tout * OUTPUT_RATIO;
  const weight = CREDIT_TABLE[feature] ?? 1.0;
  // Pembulatan ke atas ke 0.01 terdekat, minimal 1 credit agar tidak "gratis".
  const creditCost = Math.max(1, Math.ceil(baseCost * weight));
  return { tokensIn: tin, tokensOut: tout, baseCost, creditCost, estimated };
}

/**
 * Estimasi token kasar dari teks (heuristik ~4 char/token untuk campuran
 * Indonesia/Inggris). Dipakai ketika provider tidak mengembalikan usage field.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Paket top up credit (manual invoice). Harga Rupiah per paket.
 * Paket lebih besar = bonus credit lebih banyak (insentif).
 */
export interface CreditPackage {
  id: string;
  name: string;
  credits: number; // total credit termasuk bonus
  baseCredits: number; // credit dasar sebelum bonus
  bonusCredits: number;
  priceIDR: number;
  popular?: boolean;
  description: string;
}

export const CREDIT_PACKAGES: CreditPackage[] = [
  {
    id: "starter_500",
    name: "Starter",
    baseCredits: 500,
    bonusCredits: 0,
    credits: 500,
    priceIDR: 25000,
    description: "Cukup untuk ~50 tugas makalah ringan atau 200+ sesi tanya Tutor.",
  },
  {
    id: "pro_1500",
    name: "Pro",
    baseCredits: 1500,
    bonusCredits: 150,
    credits: 1650,
    priceIDR: 65000,
    popular: true,
    description: "Bonus 150 credit. Cocok satu semester aktif: makalah, solver, riset.",
  },
  {
    id: "scholar_4000",
    name: "Scholar",
    baseCredits: 4000,
    bonusCredits: 800,
    credits: 4800,
    priceIDR: 150000,
    description: "Bonus 800 credit. Untuk mahasiswa tingkat akhir & riset skripsi intensif.",
  },
  {
    id: "genius_10000",
    name: "Genius",
    baseCredits: 10000,
    bonusCredits: 3000,
    credits: 13000,
    priceIDR: 320000,
    description: "Bonus 3000 credit. Paket hemat untuk satu tahun akademik penuh.",
  },
];

export function getPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Credit awal user baru (onboarding bonus). */
export const STARTER_CREDITS = 100;

/**
 * Default platform AI config. Dipakai ketika user TIDAK enable BYOK.
 * Ambil dari env (bisa diganti tanpa kode).
 */
export const PLATFORM_AI = {
  baseURL:
    process.env.PLATFORM_AI_BASE_URL ||
    "https://www.phanrouter.com/phanrouter/v1",
  apiKeyEnv: "MOONSHOT_API_KEY",
  model: process.env.PLATFORM_AI_MODEL || "kimi-k2.6",
  // Model ringan untuk klasifikasi & task hemat token (orchestrator).
  liteModel: process.env.PLATFORM_AI_LITE_MODEL || "kimi-k2.6",
} as const;

export const ADMIN_USER_IDS = (process.env.ADMIN_USER_IDS || "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);
