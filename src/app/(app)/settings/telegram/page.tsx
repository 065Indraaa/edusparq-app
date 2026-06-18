"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Send,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Unlink,
  RefreshCw,
  MessageSquare,
  Zap,
  Shield,
  ExternalLink,
  Clock,
  Webhook,
  AlertTriangle,
} from "lucide-react";

interface LinkStatus {
  linked: boolean;
  username?: string | null;
  linkedAt?: string | null;
}

export default function TelegramSettingsPage() {
  const [status, setStatus] = useState<LinkStatus | null>(null);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);
  const [otp, setOtp] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [error, setError] = useState("");

  // Webhook setup state.
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [webhookLoading, setWebhookLoading] = useState(false);
  const [webhookUrlInput, setWebhookUrlInput] = useState("");
  const [webhookMsg, setWebhookMsg] = useState<{ type: "ok" | "error" | "warn"; text: string } | null>(null);

  const fetchStatus = async () => {
    setIsLoadingStatus(true);
    try {
      const res = await fetch("/api/telegram/link");
      if (res.ok) setStatus(await res.json());
    } catch {}
    setIsLoadingStatus(false);
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleGenerateOtp = async () => {
    setIsGenerating(true);
    setError("");
    setOtp(null);
    try {
      const res = await fetch("/api/telegram/link", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Gagal generate OTP.");
      } else {
        setOtp(data.otp);
      }
    } catch {
      setError("Koneksi gagal. Coba lagi.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!otp) return;
    navigator.clipboard.writeText("/link " + otp);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnlink = async () => {
    if (!confirm("Putuskan hubungan akun Telegram? Anda bisa menghubungkan ulang kapan saja.")) return;
    setIsUnlinking(true);
    try {
      await fetch("/api/telegram/link", { method: "DELETE" });
      await fetchStatus();
      setOtp(null);
    } catch {}
    setIsUnlinking(false);
  };

  // ─── Webhook Setup Handlers (admin) ────────────────────────────────────────

  const checkWebhook = async () => {
    setWebhookLoading(true);
    setWebhookMsg(null);
    try {
      const res = await fetch("/api/telegram/setup?action=status");
      const data = await res.json();
      if (!res.ok) {
        setWebhookMsg({ type: "error", text: data.error || "Gagal cek webhook." });
      } else {
        setWebhookInfo(data);
        if (data.error) {
          setWebhookMsg({ type: "error", text: data.error });
        } else if (data.webhook?.url) {
          setWebhookMsg({ type: "ok", text: `Webhook aktif: ${data.webhook.url}` });
        } else {
          setWebhookMsg({ type: "warn", text: "Webhook belum terdaftar. Bot dalam mode polling (tidak menerima pesan otomatis)." });
        }
      }
    } catch {
      setWebhookMsg({ type: "error", text: "Koneksi gagal." });
    } finally {
      setWebhookLoading(false);
    }
  };

  const setWebhook = async () => {
    const url = webhookUrlInput.trim();
    if (!url) {
      setWebhookMsg({ type: "error", text: "Masukkan URL webhook HTTPS terlebih dahulu." });
      return;
    }
    setWebhookLoading(true);
    setWebhookMsg(null);
    try {
      const res = await fetch(`/api/telegram/setup?action=set&url=${encodeURIComponent(url)}`);
      const data = await res.json();
      if (!res.ok) {
        setWebhookMsg({ type: "error", text: data.error || data.telegramResponse || "Gagal daftar webhook." });
      } else if (data.ok) {
        setWebhookMsg({ type: "ok", text: `✅ Webhook terdaftar: ${url}` });
        await checkWebhook();
      } else {
        setWebhookMsg({ type: "error", text: data.telegramResponse || "Telegram menolak webhook." });
      }
    } catch {
      setWebhookMsg({ type: "error", text: "Koneksi gagal." });
    } finally {
      setWebhookLoading(false);
    }
  };

  const deleteWebhook = async () => {
    if (!confirm("Hapus webhook? Bot tidak akan menerima pesan sampai webhook didaftarkan ulang.")) return;
    setWebhookLoading(true);
    setWebhookMsg(null);
    try {
      const res = await fetch("/api/telegram/setup?action=delete");
      const data = await res.json();
      if (data.ok) {
        setWebhookMsg({ type: "ok", text: "Webhook dihapus. Bot sekarang mode polling." });
        await checkWebhook();
      } else {
        setWebhookMsg({ type: "error", text: data.telegramResponse || "Gagal hapus." });
      }
    } catch {
      setWebhookMsg({ type: "error", text: "Koneksi gagal." });
    } finally {
      setWebhookLoading(false);
    }
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.06 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
  };

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || "EduSparq Bot";

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="font-display tracking-tight text-2xl font-extrabold flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-to-br from-sky-500/15 to-blue-500/15 text-sky-600 dark:text-sky-400">
            <Send size={20} />
          </span>
          Telegram Bot
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Hubungkan akun Telegram Anda untuk mengakses EduSparq AI langsung dari chat.
        </p>
      </motion.div>

      {error && (
        <motion.div variants={itemVariants} className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">
          {error}
        </motion.div>
      )}

      {/* Status card */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <div className="flex items-center justify-between gap-3 mb-4">
          <h2 className="font-bold text-foreground">Status Koneksi</h2>
          <button
            onClick={fetchStatus}
            disabled={isLoadingStatus}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={13} className={isLoadingStatus ? "animate-spin" : ""} />
            Segarkan
          </button>
        </div>

        {isLoadingStatus ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 size={24} className="text-muted-foreground animate-spin" />
          </div>
        ) : status?.linked ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <CheckCircle2 size={24} className="text-emerald-500 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-bold text-emerald-700 dark:text-emerald-300">
                  Akun Terhubung
                </p>
                <p className="text-xs text-emerald-700/80 dark:text-emerald-300/80">
                  {status.username ? `@${status.username}` : "Telegram"}
                  {status.linkedAt && (
                    <span className="ml-2">
                      sejak {new Date(status.linkedAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </p>
              </div>
            </div>

            <button
              onClick={handleUnlink}
              disabled={isUnlinking}
              className="flex items-center gap-2 px-4 min-h-[44px] rounded-2xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-sm font-bold border border-red-500/20 transition-all disabled:opacity-50"
            >
              {isUnlinking ? <Loader2 size={16} className="animate-spin" /> : <Unlink size={16} />}
              Putuskan Hubungan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 border border-border">
              <XCircle size={24} className="text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-bold text-foreground">Belum Terhubung</p>
                <p className="text-xs text-muted-foreground">Generate kode OTP lalu kirim ke bot Telegram.</p>
              </div>
            </div>

            <button
              onClick={handleGenerateOtp}
              disabled={isGenerating}
              className="flex items-center gap-2 px-5 min-h-[44px] rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all shadow-sm shadow-primary/20 disabled:opacity-50"
            >
              {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Zap size={16} />}
              Generate Kode OTP
            </button>
          </div>
        )}
      </motion.div>

      {/* OTP display */}
      {otp && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-3xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-sky-600 dark:text-sky-400" />
            <h2 className="font-bold text-foreground">Kode Penghubung</h2>
          </div>

          <div className="text-center py-6 bg-card rounded-2xl border-2 border-dashed border-sky-500/30">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
              Kirim ini ke bot Telegram
            </p>
            <p className="font-mono text-3xl font-black tracking-[0.3em] text-sky-600 dark:text-sky-400">
              {otp}
            </p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Langkah-langkah:</p>
            <ol className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="grid place-items-center w-5 h-5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold shrink-0 mt-0.5">1</span>
                <span>Buka Telegram, cari bot <strong className="text-foreground">{botUsername}</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="grid place-items-center w-5 h-5 rounded-md bg-sky-500/15 text-sky-600 dark:text-sky-400 text-xs font-bold shrink-0 mt-0.5">2</span>
                <span>Klik <strong className="text-foreground">Start</strong> lalu kirim pesan:</span>
              </li>
            </ol>

            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-3 rounded-xl bg-card border border-border text-sm font-mono text-foreground">
                /link {otp}
              </code>
              <button
                onClick={handleCopy}
                className="grid place-items-center w-12 h-12 shrink-0 bg-sky-500/15 hover:bg-sky-500/25 text-sky-600 dark:text-sky-400 rounded-xl transition-all"
                aria-label="Salin"
              >
                {copied ? <Check size={18} /> : <Copy size={18} />}
              </button>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
              <Clock size={13} />
              Kode berlaku 5 menit. Setelah expired, generate ulang.
            </div>
          </div>
        </motion.div>
      )}

      {/* Webhook Setup (admin) */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <h2 className="font-bold text-foreground mb-1 flex items-center gap-2">
          <Webhook size={18} className="text-primary" />
          Konfigurasi Webhook Bot
        </h2>
        <p className="text-xs text-muted-foreground mb-4">
          Daftarkan URL webhook agar Telegram mengirim pesan ke server EduSparq. Wajib setelah deploy.
        </p>

        {webhookMsg && (
          <div className={`mb-4 p-3 rounded-xl text-xs font-medium flex items-start gap-2 ${
            webhookMsg.type === "ok"
              ? "bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
              : webhookMsg.type === "warn"
              ? "bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300"
              : "bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400"
          }`}>
            {webhookMsg.type === "error" ? <AlertTriangle size={14} className="mt-0.5 shrink-0" /> : <CheckCircle2 size={14} className="mt-0.5 shrink-0" />}
            <span className="flex-1 break-words">{webhookMsg.text}</span>
          </div>
        )}

        {webhookInfo?.bot && (
          <div className="mb-4 p-3 rounded-xl bg-muted/30 border border-border text-xs space-y-1">
            <p className="font-bold text-foreground">@{webhookInfo.bot.username} (ID: {webhookInfo.bot.id})</p>
            {webhookInfo.webhook?.url && (
              <p className="text-muted-foreground break-all">URL: {webhookInfo.webhook.url}</p>
            )}
            {webhookInfo.webhook?.pending_update_count > 0 && (
              <p className="text-amber-600 dark:text-amber-400">
                ⚠️ {webhookInfo.webhook.pending_update_count} update pending
                {webhookInfo.webhook.last_error_message ? ` — error: ${webhookInfo.webhook.last_error_message}` : ""}
              </p>
            )}
          </div>
        )}

        <div className="space-y-3">
          <input
            type="url"
            value={webhookUrlInput}
            onChange={(e) => setWebhookUrlInput(e.target.value)}
            placeholder="https://domain-anda.com/api/telegram"
            className="w-full px-4 py-3 rounded-xl bg-muted/40 border border-border text-sm font-medium placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
          />
          <div className="flex flex-wrap gap-2">
            <button
              onClick={setWebhook}
              disabled={webhookLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all disabled:opacity-50"
            >
              {webhookLoading ? <Loader2 size={13} className="animate-spin" /> : <Webhook size={13} />}
              Daftarkan Webhook
            </button>
            <button
              onClick={checkWebhook}
              disabled={webhookLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-muted/60 hover:bg-muted text-foreground text-xs font-bold transition-all disabled:opacity-50"
            >
              <RefreshCw size={13} className={webhookLoading ? "animate-spin" : ""} />
              Cek Status
            </button>
            <button
              onClick={deleteWebhook}
              disabled={webhookLoading}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 text-xs font-bold border border-red-500/20 transition-all disabled:opacity-50"
            >
              <XCircle size={13} />
              Hapus
            </button>
          </div>
        </div>
      </motion.div>

      {/* Features */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-6 shadow-sm">
        <h2 className="font-bold text-foreground mb-4 flex items-center gap-2">
          <MessageSquare size={18} className="text-primary" />
          Yang Bisa Anda Lakukan via Telegram
        </h2>
        <div className="grid sm:grid-cols-2 gap-3">
          {[
            { cmd: "Pertanyaan bebas", desc: "Tanya materi, selesaikan tugas — orchestrator pilih jalur otomatis" },
            { cmd: "/saldo", desc: "Cek sisa credit EduSparq" },
            { cmd: "/tugas", desc: "Lihat deadline terdekat" },
            { cmd: "/jadwal", desc: "Jadwal kuliah hari ini" },
            { cmd: "/mode", desc: "Ubah mode agent (auto/simple)" },
            { cmd: "/help", desc: "Daftar lengkap command" },
          ].map((f) => (
            <div key={f.cmd} className="p-3 rounded-2xl bg-muted/30 border border-border">
              <p className="text-sm font-bold text-foreground">{f.cmd}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Privacy note */}
      <motion.div variants={itemVariants} className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-muted/30 border border-border text-xs text-muted-foreground leading-relaxed">
        <Shield size={14} className="mt-0.5 shrink-0 text-primary" />
        <span>
          EduSparq hanya menyimpan Telegram ID & username untuk identifikasi. Pesan Anda diproses sesuai
          kebijakan privasi yang sama dengan aplikasi web. Anda bisa memutuskan hubungan kapan saja.
        </span>
      </motion.div>
    </motion.div>
  );
}
