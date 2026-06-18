import mongoose, { Schema, models, model, Types } from "mongoose";

/**
 * Invoice — Tagihan top up credit (sistem manual approval).
 *
 * Alur:
 *   1. User pilih paket di /billing → POST /api/billing/topup → buat Invoice
 *      status="pending", tampilkan instruksi transfer + nomor VA manual.
 *   2. User transfer + upload bukti (proofUrl via Cloudinary / link).
 *   3. Admin (lihat ADMIN_USER_IDS) review di /admin/invoices → approve.
 *      status="paid" → credit otomatis masuk via CreditTransaction (purchase).
 *   4. Atau reject → status="rejected".
 *
 * Sengaja TANPA payment gateway otomatis (keputusan user: manual approval dulu),
 * payment gateway bisa dicolok nanti tanpa mengubah model ini.
 */
const InvoiceSchema = new Schema({
  invoiceNumber: { type: String, required: true, unique: true, index: true },
  userId: { type: Types.ObjectId, ref: "User", required: true, index: true },
  // Paket yang dipilih (mis. "starter_1000", "pro_5000", "custom").
  packageId: { type: String, required: true },
  // Jumlah credit yang akan didapat jika dibayar.
  credits: { type: Number, required: true },
  // Harga dalam Rupiah.
  amountIDR: { type: Number, required: true },
  // Metode instruksi pembayaran yang ditampilkan ke user.
  method: {
    type: String,
    enum: ["transfer_bank", "qris_manual", "ewallet_manual", "other"],
    default: "transfer_bank",
  },
  status: {
    type: String,
    enum: ["pending", "paid", "rejected", "expired"],
    default: "pending",
    index: true,
  },
  // URL bukti transfer yang diupload user (Cloudinary / link eksternal).
  proofUrl: { type: String, default: "" },
  // Catatan admin saat approve/reject.
  adminNote: { type: String, default: "" },
  paidAt: { type: Date, default: null },
  // TTL: invoice pending auto-expire setelah 3 hari.
  expiresAt: { type: Date, required: true },
  createdAt: { type: Date, default: Date.now },
});

InvoiceSchema.index({ userId: 1, createdAt: -1 });
InvoiceSchema.index({ status: 1, createdAt: -1 });

export const Invoice = models.Invoice || model("Invoice", InvoiceSchema);
