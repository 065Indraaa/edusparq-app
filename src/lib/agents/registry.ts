import { complete } from "@/lib/ai-client";
import { PLATFORM_AI } from "@/lib/credit-config";
import type { FeatureName } from "@/lib/credit-config";
import type { SessionContext, AgentName, TraceStep } from "./context";

/**
 * Definisi agen — metadata + persona brief + logika eksekusi.
 *
 * Tiap agen adalah fungsi murni: (ctx) => output string (atau struktur).
 * Runner membungkus eksekusi dengan metering, billing, dan trace otomatis.
 */
export interface AgentDefinition {
  name: AgentName;
  label: string; // nama tampilan (Indonesia)
  description: string;
  feature: FeatureName; // untuk bobot credit metering
  /**
   * Bangun system prompt dari context.
   * Dipisah dari execute agar prompt bisa di-preview di docs/UI.
   */
  buildPrompt: (ctx: SessionContext) => string;
  /**
   * Eksekusi: panggil AI & kembalikan output mentah + ringkasan untuk trace.
   * Default implementation memakai complete() dengan feature agen.
   */
  execute: (ctx: SessionContext) => Promise<{ output: string; summary: string }>;
}

/** Map semua agen terdaftar. */
const registry = new Map<AgentName, AgentDefinition>();

export function registerAgent(def: AgentDefinition): void {
  registry.set(def.name, def);
}

export function getAgent(name: AgentName): AgentDefinition | undefined {
  return registry.get(name);
}

export function listAgents(): AgentDefinition[] {
  return Array.from(registry.values());
}

/**
 * Runner universal: jalankan agen dengan metering + trace otomatis.
 * Memodifikasi ctx secara in-place (menambah trace, output agen).
 */
export async function runAgent(
  name: AgentName,
  ctx: SessionContext,
  opts: { maxTokens?: number; temperature?: number; json?: boolean } = {}
): Promise<{ output: string; summary: string; error?: string }> {
  const def = registry.get(name);
  if (!def) {
    return { output: "", summary: "", error: `Agent ${name} tidak terdaftar` };
  }

  // Tandai mulai di trace.
  const step: TraceStep = {
    agent: name,
    startedAt: new Date().toISOString(),
    status: "running",
  };
  ctx.trace.push(step);

  // Agen khusus classifier memakai model lite (hemat token) bila tersedia.
  const modelOverride =
    name === "classifier" && PLATFORM_AI.liteModel
      ? PLATFORM_AI.liteModel
      : undefined;

  try {
    const system = def.buildPrompt(ctx);
    const result = await complete(
      {
        feature: def.feature,
        system,
        user: buildUserPayload(name, ctx),
        temperature: opts.temperature ?? defaultTemp(name),
        maxTokens: opts.maxTokens ?? defaultMaxTokens(name),
        json: opts.json ?? defaultJson(name),
        model: modelOverride,
        taskId: ctx.request.slice(0, 40) + ":" + name,
      },
      ctx.userId
    );

    step.finishedAt = new Date().toISOString();
    step.status = "done";
    step.creditCost = result.creditCost;
    step.tokensOut = result.tokensOut;

    // Ringkasan untuk trace (pangkas agar UI tidak berat).
    const summary = result.text.slice(0, 240).replace(/\s+/g, " ").trim();
    step.summary = summary;

    return { output: result.text, summary };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Agent gagal";
    step.finishedAt = new Date().toISOString();
    step.status = "error";
    step.error = msg.slice(0, 200);
    return { output: "", summary: "", error: msg };
  }
}

/** Default token budget per agen (hemat untuk tahap awal, besar untuk implementer). */
function defaultMaxTokens(name: AgentName): number {
  switch (name) {
    case "classifier":
      return 150;
    case "clarifier":
      return 600;
    case "specifier":
      return 900;
    case "planner":
      return 900;
    case "tasker":
      return 700;
    case "implementer":
      return 3000;
    case "reviewer":
      return 1500;
    default:
      return 1024;
  }
}

function defaultTemp(name: AgentName): number {
  switch (name) {
    case "classifier":
      return 0.1;
    case "clarifier":
      return 0.3;
    case "specifier":
    case "planner":
    case "tasker":
      return 0.4;
    case "implementer":
      return 0.6;
    case "reviewer":
      return 0.3;
    default:
      return 0.3;
  }
}

function defaultJson(name: AgentName): boolean {
  return (
    name === "classifier" ||
    name === "planner" ||
    name === "tasker" ||
    name === "reviewer"
  );
}

/**
 * Susun payload user untuk agen.
 * Agen awal (classifier, clarifier, specifier) hanya butuh request + sedikit
 * konteks. Agen akhir (implementer, reviewer) butuh semua hasil tahap sebelumnya.
 */
function buildUserPayload(name: AgentName, ctx: SessionContext): string {
  const base = `PERMINTAAN USER:\n${ctx.request}`;
  const grounding =
    ctx.sourceBlock || ctx.webContext
      ? `\n\n[KONTEKS/REFERENSI]\n${[ctx.sourceBlock, ctx.webContext]
          .filter(Boolean)
          .join("\n\n")
          .slice(0, 6000)}`
      : "";

  switch (name) {
    case "classifier":
    case "clarifier":
      return base + grounding;
    case "specifier":
      return (
        base +
        grounding +
        (ctx.clarifierQuestions?.length
          ? `\n\n[PERTANYAAN KLARIFIKASI yang muncul]\n${ctx.clarifierQuestions
              .map((q, i) => `${i + 1}. ${q}`)
              .join("\n")}`
          : "") +
        (ctx.assumptions?.length
          ? `\n\n[ASUMSI yang diambil]\n${ctx.assumptions.map((a) => `- ${a}`).join("\n")}`
          : "")
      );
    case "planner":
      return (
        base +
        `\n\n[SPESIFIKASI]\n${ctx.specification || "(belum ada)"}`
      );
    case "tasker":
      return (
        base +
        `\n\n[SPESIFIKASI]\n${ctx.specification || ""}` +
        `\n\n[RENCANA]\n${(ctx.plan || [])
          .map((p) => `${p.order}. ${p.title}: ${p.detail}`)
          .join("\n")}`
      );
    case "implementer":
      return (
        base +
        grounding +
        `\n\n[SPESIFIKASI]\n${ctx.specification || ""}` +
        `\n\n[RENCANA & TASK]\n${(ctx.tasks || [])
          .map((t) => `${t.order}. [${t.agent}] ${t.title}: ${t.description}`)
          .join("\n")}`
      );
    case "reviewer":
      return (
        base +
        `\n\n[SPESIFIKASI awal]\n${ctx.specification || ""}` +
        `\n\n[OUTPUT yang harus direview]\n${(ctx.result || "").slice(0, 4000)}`
      );
    default:
      return base + grounding;
  }
}
