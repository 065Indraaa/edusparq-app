import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { User } from "../../../lib/db/models/User";
import { UsageLog } from "../../../lib/db/models/UsageLog";
import { CreditTransaction } from "../../../lib/db/models/CreditTransaction";
import { Invoice } from "../../../lib/db/models/Invoice";
import { ApiKey } from "../../../lib/db/models/ApiKey";
import { getBalance } from "../../../lib/credit-billing";

/** GET /api/billing — ringkasan saldo, usage bulan ini, & transaksi terakhir. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();
    const userId = session.user.id;

    const balance = await getBalance(userId);
    const user = await User.findById(userId).lean();

    // Aggregate usage bulan ini.
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const [monthUsageAgg, recentTxns, recentUsage, pendingInvoices, activeByok] =
      await Promise.all([
        UsageLog.aggregate([
          { $match: { userId: user!._id, createdAt: { $gte: startOfMonth } } },
          {
            $group: {
              _id: null,
              totalIn: { $sum: "$tokensIn" },
              totalOut: { $sum: "$tokensOut" },
              totalCost: { $sum: "$creditCost" },
              byokCalls: {
                $sum: { $cond: [{ $eq: ["$source", "byok"] }, 1, 0] },
              },
            },
          },
        ]),
        CreditTransaction.find({ userId })
          .sort({ createdAt: -1 })
          .limit(15)
          .lean(),
        UsageLog.find({ userId }).sort({ createdAt: -1 }).limit(10).lean(),
        Invoice.find({ userId, status: "pending" })
          .sort({ createdAt: -1 })
          .lean(),
        ApiKey.findOne({ userId, active: true }).lean(),
      ]);

    const month = monthUsageAgg[0] || {
      totalIn: 0,
      totalOut: 0,
      totalCost: 0,
      byokCalls: 0,
    };

    return NextResponse.json({
      balance,
      plan: user?.plan || "free",
      byokEnabled: user?.byokEnabled || false,
      agentMode: user?.agentMode || "auto",
      activeByok: activeByok
        ? {
            label: activeByok.label,
            provider: activeByok.provider,
            model: activeByok.model,
            keyHint: activeByok.keyHint,
            baseURL: activeByok.baseURL,
          }
        : null,
      monthUsage: {
        tokensIn: month.totalIn,
        tokensOut: month.totalOut,
        creditCost: month.totalCost,
        byokCalls: month.byokCalls,
        platformCalls:
          (await UsageLog.countDocuments({
            userId: user!._id,
            source: "platform",
            createdAt: { $gte: startOfMonth },
          })) || 0,
      },
      recentTransactions: recentTxns,
      recentUsage,
      pendingInvoices: pendingInvoices.map((inv) => ({
        invoiceNumber: inv.invoiceNumber,
        packageId: inv.packageId,
        credits: inv.credits,
        amountIDR: inv.amountIDR,
        status: inv.status,
        method: inv.method,
        proofUrl: inv.proofUrl,
        createdAt: inv.createdAt,
        expiresAt: inv.expiresAt,
      })),
    });
  } catch (error) {
    console.error("[billing GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST /api/billing — buat invoice top up baru (pending). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { packageId, method } = await req.json();
    await connectDB();

    const pkg = await import("../../../lib/credit-config").then((m) => m.getPackage(packageId));
    if (!pkg) {
      return NextResponse.json({ error: "Paket tidak ditemukan" }, { status: 400 });
    }

    // Generate nomor invoice unik.
    const invoiceNumber =
      "INV-" +
      Date.now().toString(36).toUpperCase() +
      "-" +
      Math.random().toString(36).slice(2, 6).toUpperCase();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 3); // 3 hari TTL.

    const invoice = await Invoice.create({
      invoiceNumber,
      userId: session.user.id,
      packageId: pkg.id,
      credits: pkg.credits,
      amountIDR: pkg.priceIDR,
      method: method || "transfer_bank",
      status: "pending",
      expiresAt,
    });

    return NextResponse.json({
      ok: true,
      invoice: {
        invoiceNumber: invoice.invoiceNumber,
        credits: invoice.credits,
        amountIDR: invoice.amountIDR,
        method: invoice.method,
        status: invoice.status,
        expiresAt: invoice.expiresAt,
      },
    });
  } catch (error) {
    console.error("[billing POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
