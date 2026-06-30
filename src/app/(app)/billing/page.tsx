"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Wallet,
  TrendingUp,
  Coins,
  Zap,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
  Sparkles,
  Cpu,
  KeyRound,
  Receipt,
  Upload,
} from "lucide-react";
import Link from "next/link";

interface BillingData {
  balance: number;
  plan: string;
  byokEnabled: boolean;
  agentMode: string;
  activeByok: {
    label: string;
    provider: string;
    model: string;
    keyHint: string;
    baseURL: string;
  } | null;
  monthUsage: {
    tokensIn: number;
    tokensOut: number;
    creditCost: number;
    byokCalls: number;
    platformCalls: number;
  };
  recentTransactions: Array<{
    amount: number;
    type: string;
    balanceAfter: number;
    note: string;
    createdAt: string;
  }>;
  pendingInvoices: Array<{
    invoiceNumber: string;
    packageId: string;
    credits: number;
    amountIDR: number;
    status: string;
    method: string;
    proofUrl: string;
    createdAt: string;
    expiresAt: string;
  }>;
}

const PACKAGES = [
  { id: "daily_500", name: "Daily", credits: 500, priceIDR: 5000, popular: false, desc: "~20 chat + 5 upload file" },
  { id: "weekly_3000", name: "Weekly", credits: 3300, priceIDR: 25000, popular: false, desc: "~100 chat + 20 upload file" },
  { id: "semester_15000", name: "Semester", credits: 18000, priceIDR: 100000, popular: true, desc: "Bonus 3.000 — cukup 1 semester" },
  { id: "genius_50000", name: "Genius", credits: 65000, priceIDR: 300000, popular: false, desc: "Bonus 15.000 — setahun penuh" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

function formatIDR(n: number) {
  return "Rp " + n.toLocaleString("id-ID");
}
function formatNumber(n: number) {
  return n.toLocaleString("id-ID");
}
function formatDate(s: string) {
  return new Date(s).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const BANK_DETAILS = {
  transfer_bank: "Transfer Bank: BCA 1234567890 a.n. EduSparq\nMandiri 0987654321 a.n. EduSparq",
  qris_manual: "Scan QRIS di bawah (muncul setelah invoice dibuat). Konfirmasi via WhatsApp.",
  ewallet_manual: "GoPay/OVO/DANA: 0812-3456-7890 (EduSparq)",
};

export default function BillingPage() {
  const [data, setData] = useState<BillingData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [topupPkg, setTopupPkg] = useState<string | null>(null);
  const [topupMethod, setTopupMethod] = useState("transfer_bank");
  const [topupLoading, setTopupLoading] = useState(false);
  const [activeInvoice, setActiveInvoice] = useState<{
    invoiceNumber: string;
    credits: number;
    amountIDR: number;
    method: string;
    expiresAt: string;
  } | null>(null);
  const [proofUrl, setProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/billing");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
      // Tampilkan invoice pending paling baru untuk follow-up.
      if (d.pendingInvoices?.length > 0 && !activeInvoice) {
        const inv = d.pendingInvoices[0];
        setActiveInvoice({
          invoiceNumber: inv.invoiceNumber,
          credits: inv.credits,
          amountIDR: inv.amountIDR,
          method: inv.method,
          expiresAt: inv.expiresAt,
        });
      }
    } catch {
      setError("Gagal memuat data billing.");
    } finally {
      setLoading(false);
    }
  }, [activeInvoice]);

  useEffect(() => {
    load();
  }, [load]);

  const handleTopup = async () => {
    if (!topupPkg) return;
    setTopupLoading(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: topupPkg, method: topupMethod }),
      });
      if (!res.ok) throw new Error();
      const { invoice } = await res.json();
      setActiveInvoice({
        invoiceNumber: invoice.invoiceNumber,
        credits: invoice.credits,
        amountIDR: invoice.amountIDR,
        method: invoice.method,
        expiresAt: invoice.expiresAt,
      });
      setTopupPkg(null);
      await load();
    } catch {
      setError("Gagal membuat invoice.");
    } finally {
      setTopupLoading(false);
    }
  };

  const handleUploadProof = async () => {
    if (!proofUrl || !activeInvoice) return;
    setUploadingProof(true);
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageId: topupPkg, method: topupMethod }),
      });
      // Cari invoice id lewat GET untuk PATCH (nomor invoice → id).
      const listRes = await fetch("/api/billing");
      const d = await listRes.json();
      const inv = d.pendingInvoices?.find(
        (i: any) => i.invoiceNumber === activeInvoice.invoiceNumber
      );
      // Karena route PATCH butuh _id, dan /api/billing tidak mengembalikan _id,
      // gunakan endpoint dengan invoice number via path fallback.
      // Pendekatan: cari langsung di array pending (id internal tidak di-expose).
      // Solusi sederhana: buat endpoint proof yang menerima invoiceNumber.
      await fetch("/api/billing/proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          invoiceNumber: activeInvoice.invoiceNumber,
          proofUrl,
        }),
      });
      setProofUrl("");
      await load();
    } catch {
      setError("Gagal upload bukti.");
    } finally {
      setUploadingProof(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <p className="text-muted-foreground">{error}</p>
        <button onClick={load} className="px-4 py-2 rounded-xl bg-foreground text-background font-semibold">
          Coba lagi
        </button>
      </div>
    );
  }

  const monthTotal =
    (data?.monthUsage.tokensIn || 0) + (data?.monthUsage.tokensOut || 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
            <Wallet className="w-7 h-7" /> Billing &amp; Credit
          </h1>
          <p className="text-muted-foreground mt-1">
            Kelola saldo credit, lihat pemakaian AI, dan isi ulang. Hemat dengan BYOK atau credit.
          </p>
        </div>
        <Link
          href="/settings/ai"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-card hover:bg-accent transition-colors text-sm font-semibold"
        >
          <KeyRound className="w-4 h-4" /> Kelola BYOK
        </Link>
      </motion.div>

      {/* Stats grid */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Coins className="w-5 h-5 text-foreground/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Saldo</span>
          </div>
          <p className="text-3xl font-black mt-3">{formatNumber(data?.balance ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">credit tersedia</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Zap className="w-5 h-5 text-foreground/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bulan ini</span>
          </div>
          <p className="text-3xl font-black mt-3">{formatNumber(data?.monthUsage.creditCost ?? 0)}</p>
          <p className="text-xs text-muted-foreground mt-1">credit terpakai</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <TrendingUp className="w-5 h-5 text-foreground/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Token</span>
          </div>
          <p className="text-3xl font-black mt-3">{formatNumber(monthTotal)}</p>
          <p className="text-xs text-muted-foreground mt-1">total bulan ini</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <Cpu className="w-5 h-5 text-foreground/60" />
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">BYOK</span>
          </div>
          <p className="text-3xl font-black mt-3">
            {data?.byokEnabled ? (
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-6 h-6" /> On
              </span>
            ) : (
              "Off"
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {data?.activeByok ? data.activeByok.provider : "pakai platform"}
          </p>
        </div>
      </motion.div>

      {/* Top up packages */}
      <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5" /> Isi Ulang Credit
          </h2>
          <span className="text-xs text-muted-foreground">Manual invoice · konfirmasi admin</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {PACKAGES.map((pkg) => (
            <button
              key={pkg.id}
              onClick={() => {
                setTopupPkg(pkg.id);
                setTopupMethod("transfer_bank");
              }}
              className={`relative text-left rounded-2xl border-2 p-5 transition-all hover:scale-[1.02] ${
                topupPkg === pkg.id
                  ? "border-foreground bg-foreground/5"
                  : "border-border hover:border-foreground/40"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-2.5 left-4 px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-black uppercase tracking-wider">
                  Populer
                </span>
              )}
              <p className="font-black text-lg">{pkg.name}</p>
              <p className="text-3xl font-black mt-2">{formatNumber(pkg.credits)}</p>
              <p className="text-xs text-muted-foreground">credit</p>
              <p className="font-bold mt-3">{formatIDR(pkg.priceIDR)}</p>
              <p className="text-[11px] text-muted-foreground mt-1">{pkg.desc}</p>
            </button>
          ))}
        </div>

        {topupPkg && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-5 pt-5 border-t border-border space-y-3"
          >
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Metode Pembayaran
              </label>
              <select
                value={topupMethod}
                onChange={(e) => setTopupMethod(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
              >
                <option value="transfer_bank">Transfer Bank (BCA/Mandiri)</option>
                <option value="qris_manual">QRIS (manual)</option>
                <option value="ewallet_manual">E-Wallet (GoPay/OVO/DANA)</option>
              </select>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={handleTopup}
                disabled={topupLoading}
                className="px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50"
              >
                {topupLoading ? "Membuat..." : "Buat Invoice"}
              </button>
              <button
                onClick={() => setTopupPkg(null)}
                className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold"
              >
                Batal
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>

      {/* Active invoice / upload proof */}
      {activeInvoice && (
        <motion.div variants={itemVariants} className="rounded-2xl border-2 border-dashed border-foreground/30 bg-foreground/[0.02] p-6">
          <div className="flex items-start justify-between flex-wrap gap-3 mb-3">
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Receipt className="w-5 h-5" /> Invoice Menunggu Pembayaran
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Nomor: <span className="font-mono font-bold">{activeInvoice.invoiceNumber}</span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-2xl font-black">{formatIDR(activeInvoice.amountIDR)}</p>
              <p className="text-xs text-muted-foreground">
                {formatNumber(activeInvoice.credits)} credit · berlaku sampai{" "}
                {formatDate(activeInvoice.expiresAt)}
              </p>
            </div>
          </div>
          <div className="rounded-xl bg-card border border-border p-4 mb-4">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Instruksi Pembayaran
            </p>
            <pre className="text-sm whitespace-pre-wrap font-sans leading-relaxed">
              {BANK_DETAILS[activeInvoice.method as keyof typeof BANK_DETAILS] || BANK_DETAILS.transfer_bank}
            </pre>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={proofUrl}
              onChange={(e) => setProofUrl(e.target.value)}
              placeholder="Tempel URL bukti transfer (link gambar/PDF)..."
              className="flex-1 rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            />
            <button
              onClick={handleUploadProof}
              disabled={!proofUrl || uploadingProof}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50 whitespace-nowrap"
            >
              <Upload className="w-4 h-4" />
              {uploadingProof ? "Mengirim..." : "Upload Bukti"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Setelah upload, admin akan verifikasi &amp; credit masuk otomatis ke saldo Anda (biasanya &lt; 24 jam).
          </p>
        </motion.div>
      )}

      {/* Usage breakdown + transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <Cpu className="w-5 h-5" /> Pemakaian Bulan Ini
          </h2>
          <div className="space-y-3">
            <UsageBar label="Token masuk (prompt)" value={data?.monthUsage.tokensIn || 0} total={monthTotal} />
            <UsageBar label="Token keluar (output)" value={data?.monthUsage.tokensOut || 0} total={monthTotal} />
          </div>
          <div className="grid grid-cols-2 gap-3 mt-5">
            <div className="rounded-xl bg-background p-3">
              <p className="text-2xl font-black">{formatNumber(data?.monthUsage.platformCalls || 0)}</p>
              <p className="text-xs text-muted-foreground">panggilan platform</p>
            </div>
            <div className="rounded-xl bg-background p-3">
              <p className="text-2xl font-black">{formatNumber(data?.monthUsage.byokCalls || 0)}</p>
              <p className="text-xs text-muted-foreground">panggilan BYOK (gratis)</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="rounded-2xl border border-border bg-card p-6">
          <h2 className="font-bold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" /> Riwayat Transaksi
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto">
            {data?.recentTransactions?.length === 0 && (
              <p className="text-sm text-muted-foreground py-8 text-center">Belum ada transaksi.</p>
            )}
            {data?.recentTransactions?.map((t, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      t.amount >= 0 ? "bg-foreground/10" : "bg-foreground/5"
                    }`}
                  >
                    {t.amount >= 0 ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.note}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(t.createdAt)}</p>
                  </div>
                </div>
                <span className={`text-sm font-bold ${t.amount >= 0 ? "" : "text-muted-foreground"}`}>
                  {t.amount >= 0 ? "+" : ""}
                  {formatNumber(t.amount)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}

function UsageBar({ label, value, total }: { label: string; value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1.5">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          {formatNumber(value)} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-foreground/5 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="h-full bg-foreground rounded-full"
        />
      </div>
    </div>
  );
}
