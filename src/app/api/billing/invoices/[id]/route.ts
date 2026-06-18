import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Invoice } from "@/lib/db/models/Invoice";
import { addCredits } from "@/lib/credit-billing";
import { ADMIN_USER_IDS } from "@/lib/credit-config";

/**
 * PATCH /api/billing/invoices/[id] — update invoice (upload bukti / admin approve).
 *
 * Body:
 *   - { action: "upload_proof", proofUrl }   → user upload bukti transfer
 *   - { action: "approve", adminNote? }      → ADMIN approve → credit masuk
 *   - { action: "reject", adminNote }        → ADMIN reject
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const { action, proofUrl, adminNote } = await req.json();
    const invoice = await Invoice.findById(params.id);
    if (!invoice) {
      return NextResponse.json({ error: "Invoice tidak ditemukan" }, { status: 404 });
    }

    if (action === "upload_proof") {
      // Hanya pemilik invoice.
      if (invoice.userId.toString() !== session.user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
      if (invoice.status !== "pending") {
        return NextResponse.json(
          { error: "Invoice sudah diproses" },
          { status: 400 }
        );
      }
      if (!proofUrl) {
        return NextResponse.json({ error: "Bukti wajib diupload" }, { status: 400 });
      }
      invoice.proofUrl = proofUrl;
      await invoice.save();
      return NextResponse.json({ ok: true, status: invoice.status });
    }

    // Admin-only actions.
    const isAdmin = ADMIN_USER_IDS.includes(session.user.id);
    if (!isAdmin) {
      return NextResponse.json({ error: "Aksi admin only" }, { status: 403 });
    }

    if (action === "approve") {
      if (invoice.status !== "pending") {
        return NextResponse.json(
          { error: "Invoice sudah diproses" },
          { status: 400 }
        );
      }
      invoice.status = "paid";
      invoice.paidAt = new Date();
      invoice.adminNote = adminNote || "Disetujui admin";
      await invoice.save();

      // Kredit masuk ke user.
      await addCredits(String(invoice.userId), invoice.credits, "purchase", {
        note: `Top up ${invoice.invoiceNumber} (${invoice.packageId})`,
        refId: String(invoice._id),
      });

      return NextResponse.json({ ok: true, status: "paid" });
    }

    if (action === "reject") {
      invoice.status = "rejected";
      invoice.adminNote = adminNote || "Ditolak admin";
      await invoice.save();
      return NextResponse.json({ ok: true, status: "rejected" });
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
  } catch (error) {
    console.error("[billing invoice PATCH] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
