/**
 * env-check — startup validator untuk environment variables.
 *
 * Dipanggil di instrumentation.ts saat server start.
 * Menampilkan warning di console (bukan crash) untuk env yang kosong,
 * kecuali NEXTAUTH_SECRET yang WAJIB.
 */

const REQUIRED = ["NEXTAUTH_SECRET", "MONGODB_URI"] as const;

const RECOMMENDED = [
  "NVIDIA_API_KEY",
  "TELEGRAM_BOT_TOKEN",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
] as const;

const OPTIONAL_PUBLIC = [
  "NEXT_PUBLIC_TELEGRAM_BOT_USERNAME",
] as const;

interface EnvIssue {
  key: string;
  level: "required" | "recommended" | "info";
  message: string;
}

export function validateEnv(): EnvIssue[] {
  const issues: EnvIssue[] = [];

  for (const key of REQUIRED) {
    if (!process.env[key]) {
      issues.push({
        key,
        level: "required",
        message: `WAJIB — app tidak akan berfungsi tanpa ini.`,
      });
    }
  }

  for (const key of RECOMMENDED) {
    if (!process.env[key]) {
      const hints: Record<string, string> = {
        NVIDIA_API_KEY: "AI utama (DeepSeek V4 Pro via NVIDIA NIM). Daftar di build.nvidia.com.",
        TELEGRAM_BOT_TOKEN: "Telegram bot tidak aktif. Set token dari @BotFather.",
        CLOUDINARY_CLOUD_NAME: "Cloud storage untuk upload file. Daftar di cloudinary.com.",
        CLOUDINARY_API_KEY: "Cloudinary API key.",
        CLOUDINARY_API_SECRET: "Cloudinary API secret.",
      };
      issues.push({
        key,
        level: "recommended",
        message: hints[key] || `Disarankan untuk fitur penuh.`,
      });
    }
  }

  // Telegram: token placeholder check
  if (
    process.env.TELEGRAM_BOT_TOKEN &&
    process.env.TELEGRAM_BOT_TOKEN.includes("GANTI_DENGAN")
  ) {
    issues.push({
      key: "TELEGRAM_BOT_TOKEN",
      level: "recommended",
      message: "Masih placeholder. Ganti dengan token valid dari @BotFather.",
    });
  }

  return issues;
}

export function printEnvReport(): void {
  const issues = validateEnv();
  if (issues.length === 0) {
    console.log("[env] ✅ Semua environment variable terverifikasi.");
    return;
  }

  const required = issues.filter((i) => i.level === "required");
  const recommended = issues.filter((i) => i.level === "recommended");
  const info = issues.filter((i) => i.level === "info");

  if (required.length > 0) {
    console.error("\n[env] ❌ REQUIRED env kosong:");
    for (const i of required) {
      console.error(`  • ${i.key} — ${i.message}`);
    }
  }

  if (recommended.length > 0) {
    console.warn("\n[env] ⚠️ RECOMMENDED env kosong:");
    for (const i of recommended) {
      console.warn(`  • ${i.key} — ${i.message}`);
    }
  }

  if (info.length > 0) {
    console.log("\n[env] ℹ️ OPTIONAL env kosong:");
    for (const i of info) {
      console.log(`  • ${i.key} — ${i.message}`);
    }
  }
}
