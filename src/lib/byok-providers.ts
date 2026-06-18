/**
 * BYOK (Bring Your Own Key) — daftar provider preset populer.
 *
 * User bisa pilih preset (otomatis isi baseURL + model default) atau
 * masukkan Custom (base URL + model bebas). Semua via OpenAI-compatible SDK.
 *
 * Format ini ramah pemula: tidak perlu hafal endpoint, cukup pilih nama provider.
 */

export interface ByokProvider {
  id: string;
  name: string;
  /** Base URL endpoint OpenAI-compatible. */
  baseURL: string;
  /** Model default yang masuk ke field model (user bisa edit). */
  defaultModel: string;
  /** Beberapa model umum untuk dropdown. */
  models: string[];
  /** Link cara dapatkan API key. */
  keyUrl: string;
  /** Catatan singkat untuk ditampilkan. */
  note: string;
  /** Apakah gratis tier tersedia (info saja). */
  freeTier?: boolean;
}

export const BYOK_PROVIDERS: ByokProvider[] = [
  {
    id: "openai",
    name: "OpenAI",
    baseURL: "https://api.openai.com/v1",
    defaultModel: "gpt-4o-mini",
    models: ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini", "o4-mini"],
    keyUrl: "https://platform.openai.com/api-keys",
    note: "Standar industri. gpt-4o-mini paling hemat untuk mahasiswa.",
  },
  {
    id: "gemini",
    name: "Google Gemini (OpenAI-compatible)",
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    defaultModel: "gemini-2.0-flash",
    models: ["gemini-2.0-flash", "gemini-2.5-flash", "gemini-2.5-pro"],
    keyUrl: "https://aistudio.google.com/app/apikey",
    note: "Free tier besar. Pakai endpoint OpenAI-compatible agar kompatibel.",
    freeTier: true,
  },
  {
    id: "groq",
    name: "Groq (super cepat)",
    baseURL: "https://api.groq.com/openai/v1",
    defaultModel: "llama-3.3-70b-versatile",
    models: ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "deepseek-r1-distill-llama-70b"],
    keyUrl: "https://console.groq.com/keys",
    note: "Inferensi paling cepat. Free tier tersedia. Bagus untuk chat realtime.",
    freeTier: true,
  },
  {
    id: "openrouter",
    name: "OpenRouter (multi-model)",
    baseURL: "https://openrouter.ai/api/v1",
    defaultModel: "anthropic/claude-3.5-sonnet",
    models: [
      "anthropic/claude-3.5-sonnet",
      "openai/gpt-4o-mini",
      "google/gemini-2.0-flash-001",
      "meta-llama/llama-3.3-70b-instruct",
      "deepseek/deepseek-chat",
    ],
    keyUrl: "https://openrouter.ai/keys",
    note: "Satu kunci akses 200+ model. Bayar per-pakai ke OpenRouter.",
  },
  {
    id: "deepseek",
    name: "DeepSeek",
    baseURL: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    models: ["deepseek-chat", "deepseek-reasoner"],
    keyUrl: "https://platform.deepseek.com/api_keys",
    note: "Sangat murah, kuat di coding & reasoning. Bagus untuk Teknik/Informatika.",
  },
  {
    id: "moonshot",
    name: "Moonshot (Kimi)",
    baseURL: "https://api.moonshot.ai/v1",
    defaultModel: "moonshot-v1-8k",
    models: ["moonshot-v1-8k", "moonshot-v1-32k", "moonshot-v1-128k"],
    keyUrl: "https://platform.moonshot.cn/console/api-keys",
    note: "Konteks panjang (sampai 128k token). Bagus untuk dokumen besar.",
  },
  {
    id: "together",
    name: "Together AI",
    baseURL: "https://api.together.xyz/v1",
    defaultModel: "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    models: ["meta-llama/Llama-3.3-70B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
    keyUrl: "https://api.together.xyz/settings/api-keys",
    note: "Open-source model dengan harga kompetitif.",
  },
  {
    id: "ollama",
    name: "Ollama (lokal — gratis 100%)",
    baseURL: "http://localhost:11434/v1",
    defaultModel: "llama3.2",
    models: ["llama3.2", "qwen2.5", "gemma2", "phi3"],
    keyUrl: "https://ollama.com/download",
    note: "Jalan di komputer Anda sendiri. Gratis total, tapi butuh RAM/GPU.",
    freeTier: true,
  },
  {
    id: "custom",
    name: "Custom (OpenAI-compatible)",
    baseURL: "",
    defaultModel: "",
    models: [],
    keyUrl: "",
    note: "Pakai endpoint OpenAI-compatible apa pun (LM Studio, vLLM, proxy sendiri).",
    freeTier: true,
  },
];

export function getProvider(id: string): ByokProvider | undefined {
  return BYOK_PROVIDERS.find((p) => p.id === id);
}
