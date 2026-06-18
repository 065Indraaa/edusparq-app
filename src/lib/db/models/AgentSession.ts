import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * AgentSession — Menyimpan jejak eksekusi multi-agen (orchestrator).
 *
 * Setiap kali user menjalankan orchestrator (mode auto), satu dokumen AgentSession
 * dibuat. Trace step disimpan sebagai embedded array sehingga bisa ditampilkan
 * di UI stepper tanpa join tambahan.
 *
 * Dipakai untuk:
 *   - History sesi agent di /agents
 *   - Audit credit per sesi
 *   - Debug jalur eksekusi (mana agen yang jalan, berapa cost)
 *   - Resuming clarification (bila pendingClarification)
 */
const TraceStepSchema = new Schema(
  {
    agent: { type: String, required: true },
    startedAt: { type: String, required: true },
    finishedAt: { type: String, default: "" },
    status: {
      type: String,
      enum: ["pending", "running", "done", "skipped", "error"],
      default: "pending",
    },
    summary: { type: String, default: "" },
    creditCost: { type: Number, default: 0 },
    tokensOut: { type: Number, default: 0 },
    error: { type: String, default: "" },
  },
  { _id: false }
);

const AgentSessionSchema = new Schema(
  {
    userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
    /** Permintaan asli user (apa adanya). */
    request: { type: String, required: true },
    /** Mata kuliah / konteks akademik (opsional). */
    courseName: { type: String, default: "" },
    /** Persona tutor yang dipakai. */
    tutorMode: { type: String, default: "helper" },
    /** Tier klasifikasi: simple | medium | complex. */
    tier: {
      type: String,
      enum: ["simple", "medium", "complex"],
      required: true,
    },
    /** Output final yang diberikan ke user. */
    output: { type: String, default: "" },
    /** Total credit yang dipotong untuk sesi ini. */
    totalCreditCost: { type: Number, default: 0 },
    /** Jejak eksekusi tiap agen (embedded). */
    trace: [TraceStepSchema],
    /** Status sesi: running, completed, error, clarification. */
    status: {
      type: String,
      enum: ["running", "completed", "error", "clarification"],
      default: "running",
    },
    /** Bila clarifier butuh input user — pertanyaan klarifikasi. */
    pendingClarification: [{ type: String }],
    /** Asumsi yang diambil bila user lanjut tanpa jawab. */
    assumptions: [{ type: String }],
    /** Spesifikasi output dari specifier (disimpan ringkas). */
    specification: { type: String, default: "" },
    /** Plan output dari planner (disimpan ringkas). */
    plan: { type: String, default: "" },
    /** Review verdict dari reviewer. */
    reviewVerdict: { type: String, enum: ["approve", "revise", ""], default: "" },
    reviewScore: { type: Number, default: 0 },
    /** Sesi parent bila ini adalah lanjutan clarification. */
    parentSessionId: { type: Types.ObjectId, ref: "AgentSession" },
  },
  { timestamps: true }
);

// Index untuk query "sesi user terbaru".
AgentSessionSchema.index({ userId: 1, createdAt: -1 });
// Index untuk mencari sesi yang masih running / pending clarification.
AgentSessionSchema.index({ userId: 1, status: 1 });

export const AgentSession =
  models.AgentSession || model("AgentSession", AgentSessionSchema);
