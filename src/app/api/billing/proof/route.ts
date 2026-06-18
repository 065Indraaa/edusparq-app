import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Invoice } from "../../../../lib/db/models/Invoice";

/**
 * POST /api/billing/proof — user upload bukti transfer untuk invoice (via nomor).
 * Body: { invoiceNumber, proofUrl }
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { invoiceNumber, proofUrl } = await req.json();
    if (!invoiceNumber || !proofUrl) {
      return NextResponse.json(
        { error: "Nomor invoice dan bukti wajib diisi" },
        { status: 400 }
      );
    }
    await connectDB();
    const invoice = await Invoice.findOne({ invoiceNumber });
    if (!invoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }
    if (invoice.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (invoice.status !== "pending") {
      return NextResponse.json(
        { error: "Invoice sudah diproses" },
        { status: 400 }
      );
    }
    invoice.proofUrl = proofUrl;
    await invoice.save();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[billing proof] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
