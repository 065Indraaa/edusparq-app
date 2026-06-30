import { connectDB } from "./db/mongodb";
import { User } from "./db/models/User";
import { CreditTransaction } from "./db/models/CreditTransaction";
import { UsageLog } from "./db/models/UsageLog";
import { type FeatureName } from "./credit-config";

export type TxnType = "purchase" | "usage" | "bonus" | "admin" | "refund";

/**
 * ⚠️ CREDIT SYSTEM DISABLED — AI gratis untuk semua user.
 *
 * Semua fungsi billing di-bypass. Credit tidak pernah dipotong.
 * Metering tetap jalan via UsageLog (real token count).
 */

const UNLIMITED = 999_999_999;

/** Selalu return unlimited (credit system disabled). */
export async function getBalance(_userId: string): Promise<number> {
  return UNLIMITED;
}

export interface DeductResult {
  ok: boolean;
  remaining: number;
  charged: number;
  reason?: string;
}

/** Selalu true (AI gratis). */
export async function canAfford(_userId: string, _amount: number): Promise<boolean> {
  return true;
}

/**
 * Bypass — tidak memotong credit.
 * Hanya log UsageLog untuk tracking token.
 */
export async function deductCredits(
  userId: string,
  _amount: number,
  opts: {
    feature: FeatureName;
    txnNote?: string;
    usageRef?: string;
    tokensIn?: number;
    tokensOut?: number;
    model?: string;
    source?: "platform" | "byok";
    estimated?: boolean;
    taskId?: string;
  }
): Promise<DeductResult> {
  // Tetap log UsageLog (tanpa credit cost).
  try {
    await connectDB();
    await UsageLog.create({
      userId,
      feature: opts.feature,
      source: opts.source || "platform",
      model: opts.model || "",
      tokensIn: opts.tokensIn || 0,
      tokensOut: opts.tokensOut || 0,
      estimated: opts.estimated ?? false,
      creditCost: 0,
      status: "ok",
      provider: opts.txnNote?.includes("via") ? opts.txnNote.split("via ")[1] : undefined,
    });
  } catch (err) {
    console.error("[billing] gagal catat UsageLog:", err);
  }

  return { ok: true, remaining: UNLIMITED, charged: 0 };
}

/** No-op (credit system disabled). */
export async function addCredits(
  _userId: string,
  _amount: number,
  _type: TxnType,
  _opts?: { note?: string; refId?: string }
): Promise<number | null> {
  return UNLIMITED;
}

/** No-op (credit system disabled). */
export async function refundCredits(
  _userId: string,
  _amount: number,
  _usageRef: string,
  _note?: string
): Promise<void> {
  return;
}
