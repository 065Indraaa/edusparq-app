import { connectDB } from "./db/mongodb";
import { User } from "./db/models/User";
import { CreditTransaction } from "./db/models/CreditTransaction";
import { UsageLog } from "./db/models/UsageLog";
import { STARTER_CREDITS, type FeatureName } from "./credit-config";

export type TxnType = "purchase" | "usage" | "bonus" | "admin" | "refund";

/**
 * Membaca saldo credit user terbaru. Migrasi field lama (credits undefined)
 * ke STARTER_CREDITS sekali bila ditemukan. Tidak melempar.
 */
export async function getBalance(userId: string): Promise<number> {
  try {
    await connectDB();
    const user = await User.findById(userId).lean();
    if (!user) return 0;
    if (typeof user.credits !== "number") {
      await User.updateOne({ _id: userId }, { $set: { credits: STARTER_CREDITS } });
      return STARTER_CREDITS;
    }
    return user.credits;
  } catch {
    return 0;
  }
}

export interface DeductResult {
  ok: boolean;
  remaining: number;
  /** Credit yang dipotong. */
  charged: number;
  reason?: string;
}

/**
 * Memeriksa apakah user punya cukup credit. Tidak memotong.
 * Dipakai endpoint untuk validasi sebelum memanggil AI mahal.
 */
export async function canAfford(
  userId: string,
  amount: number
): Promise<boolean> {
  const balance = await getBalance(userId);
  return balance >= amount;
}

/**
 * Memotong credit user secara atomic (MongoDB findOneAndUpdate dengan
 * kondisi $gte agar tidak minus). Mencatat CreditTransaction + (opsional) UsageLog.
 *
 * Bila saldo kurang → return {ok:false, reason:"insufficient"} tanpa mutasi.
 */
export async function deductCredits(
  userId: string,
  amount: number,
  opts: {
    feature: FeatureName;
    txnNote?: string;
    usageRef?: string; // refId ke UsageLog, diisi setelah log dibuat
    tokensIn?: number;
    tokensOut?: number;
    model?: string;
    source?: "platform" | "byok";
    estimated?: boolean;
    taskId?: string;
  }
): Promise<DeductResult> {
  if (amount <= 0) {
    return { ok: true, remaining: await getBalance(userId), charged: 0 };
  }

  await connectDB();

  // Atomic decrement dengan guard saldo cukup.
  const updated = await User.findOneAndUpdate(
    { _id: userId, credits: { $gte: amount } },
    {
      $inc: { credits: -amount, totalTokensUsed: (opts.tokensIn || 0) + (opts.tokensOut || 0) },
    },
    { new: true }
  ).lean();

  if (!updated) {
    return { ok: false, remaining: await getBalance(userId), charged: 0, reason: "insufficient" };
  }

  // Catat UsageLog (detail pemakaian) lalu link ke transaksi.
  let usageRef = opts.usageRef || "";
  try {
    if (!usageRef) {
      const log = await UsageLog.create({
        userId,
        feature: opts.feature,
        source: opts.source || "platform",
        model: opts.model || "",
        tokensIn: opts.tokensIn || 0,
        tokensOut: opts.tokensOut || 0,
        estimated: opts.estimated ?? false,
        creditCost: amount,
        status: "ok",
      });
      usageRef = String(log._id);
    } else {
      // Update UsageLog yang sudah ada dengan creditCost final.
      await UsageLog.updateOne(
        { _id: usageRef },
        { $set: { creditCost: amount, status: "ok" } }
      );
    }
  } catch (err) {
    console.error("[billing] gagal catat UsageLog:", err);
  }

  // Catat ledger audit.
  try {
    await CreditTransaction.create({
      userId,
      amount: -amount,
      type: "usage",
      balanceAfter: updated.credits,
      note: opts.txnNote || opts.feature,
      refId: usageRef,
    });
  } catch (err) {
    console.error("[billing] gagal catat CreditTransaction:", err);
  }

  return { ok: true, remaining: updated.credits, charged: amount };
}

/**
 * Menambah credit user (top up / bonus / refund / admin). Mencatat ledger.
 * Return saldo baru, atau null bila gagal.
 */
export async function addCredits(
  userId: string,
  amount: number,
  type: TxnType,
  opts: { note?: string; refId?: string } = {}
): Promise<number | null> {
  if (amount <= 0) return getBalance(userId);

  await connectDB();
  const updated = await User.findOneAndUpdate(
    { _id: userId },
    { $inc: { credits: amount } },
    { new: true }
  ).lean();
  if (!updated) return null;

  try {
    await CreditTransaction.create({
      userId,
      amount,
      type,
      balanceAfter: updated.credits,
      note: opts.note || type,
      refId: opts.refId || "",
    });
  } catch (err) {
    console.error("[billing] gagal catat addCredits:", err);
  }

  return updated.credits;
}

/**
 * Refund credit karena operasi AI gagal. Idempoten: refund sekali per usageRef.
 */
export async function refundCredits(
  userId: string,
  amount: number,
  usageRef: string,
  note = "Refund: operasi AI gagal"
): Promise<void> {
  if (amount <= 0 || !usageRef) return;
  // Cek apakah sudah pernah di-refund untuk usageRef ini.
  const existing = await CreditTransaction.findOne({
    userId,
    refId: usageRef,
    type: "refund",
  }).lean();
  if (existing) return;
  await addCredits(userId, amount, "refund", { note, refId: usageRef });
}
