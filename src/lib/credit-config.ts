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
  | "telegram_upload"
  | "hybrid_analyzer"
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
  telegram_upload: 1.0,
  hybrid_analyzer: 2.5, // Mistral + DeepSeek pipeline
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

/**
 * Rasio biaya input:output. Di-tune agar harga ke user REALISTIS untuk
 * mahasiswa Indonesia tanpa boncos.
 *
 * Target harga:
 *   - 1 chat simple  ≈ Rp 500 - 1.000
 *   - 1 chat complex ≈ Rp 15.000 - 25.000
 *   - 1 hybrid upload≈ Rp 5.000 - 8.000
 *
 * Sebelumnya (0.2 / 1.0) terlalu mahal → 1 chat simple = Rp 25.000 😱
 */
const INPUT_RATIO = 0.004;
const OUTPUT_RATIO = 0.02;

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
    id: "daily_500",
    name: "Daily",
    baseCredits: 500,
    bonusCredits: 0,
    credits: 500,
    priceIDR: 5000,
    description: "~20 chat tanya AI + 5 upload file. Cocok buat jajal seminggu.",
  },
  {
    id: "weekly_3000",
    name: "Weekly",
    baseCredits: 3000,
    bonusCredits: 300,
    credits: 3300,
    priceIDR: 25000,
    description: "~100 chat + 20 upload file + 3 solver. Aktif seminggu penuh.",
  },
  {
    id: "semester_15000",
    name: "Semester",
    baseCredits: 15000,
    bonusCredits: 3000,
    credits: 18000,
    priceIDR: 100000,
    popular: true,
    description: "Bonus 3.000 credit. ~600 chat + 100 upload + 20 solver. Cukup 1 semester.",
  },
  {
    id: "genius_50000",
    name: "Genius",
    baseCredits: 50000,
    bonusCredits: 15000,
    credits: 65000,
    priceIDR: 300000,
    description: "Bonus 15.000 credit. Full bebas 1 tahun akademik. Paling hemat.",
  },
];

export function getPackage(id: string): CreditPackage | undefined {
  return CREDIT_PACKAGES.find((p) => p.id === id);
}

/** Credit awal user baru (onboarding bonus). */
export const STARTER_CREDITS = 500;

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
