"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CalendarCheck,
  Link2,
  RefreshCw,
  CheckCircle2,
  Unlink,
  Info,
} from "lucide-react";

interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  email: string;
}

/**
 * Settings card for connecting Google Calendar. Fully gated on server config:
 * when the API keys aren't set, it shows a calm "belum dikonfigurasi" note
 * instead of a broken button.
 */
export function GoogleConnectCard() {
  const [status, setStatus] = useState<GoogleStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");

  const loadStatus = () => {
    setLoading(true);
    fetch("/api/google/status")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setStatus(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadStatus();
    // Surface the OAuth redirect result (?google=connected|error|unconfigured).
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search).get("google");
      if (p === "connected") setNotice("Google Calendar berhasil terhubung.");
      else if (p === "error") setNotice("Gagal menghubungkan Google. Coba lagi.");
      else if (p === "unconfigured")
        setNotice("Integrasi Google belum dikonfigurasi oleh admin.");
    }
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    setNotice("");
    try {
      const res = await fetch("/api/google/calendar/sync", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setNotice(`${data.synced ?? 0} tenggat disinkronkan ke Google Calendar.`);
      } else {
        setNotice(data.error || "Gagal sinkronisasi.");
      }
    } catch {
      setNotice("Terjadi kendala jaringan saat sinkronisasi.");
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setWorking(true);
    try {
      await fetch("/api/google/disconnect", { method: "POST" });
      setNotice("Akun Google diputuskan.");
      loadStatus();
    } catch {
      setNotice("Gagal memutuskan akun.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4"
    >
      <div className="flex items-start gap-3">
        <span className="grid place-items-center w-10 h-10 rounded-2xl bg-primary/10 text-primary shrink-0">
          <CalendarCheck size={20} />
        </span>
        <div className="min-w-0">
          <h2 className="font-bold text-foreground">Integrasi Google Calendar</h2>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            Hubungkan akun Google untuk menyinkronkan tenggat tugasmu ke Google
            Calendar secara otomatis.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="skeleton h-11 w-48 rounded-xl" />
      ) : !status?.configured ? (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl px-3 py-2.5">
          <Info size={14} className="text-amber-500 shrink-0 mt-0.5" />
          <span>
            Integrasi Google belum dikonfigurasi pada server (perlu{" "}
            <code className="font-mono">GOOGLE_CLIENT_ID</code> &amp;{" "}
            <code className="font-mono">GOOGLE_CLIENT_SECRET</code>).
          </span>
        </div>
      ) : status.connected ? (
        <div className="space-y-3">
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg">
            <CheckCircle2 size={14} />
            Terhubung{status.email ? ` (${status.email})` : ""}
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSync}
              disabled={syncing}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              {syncing ? (
                <RefreshCw size={15} className="animate-spin" />
              ) : (
                <CalendarCheck size={15} />
              )}
              Sinkronkan tenggat
            </button>
            <button
              onClick={handleDisconnect}
              disabled={working}
              className="inline-flex items-center gap-2 min-h-[44px] px-4 border border-border text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-semibold text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              <Unlink size={15} />
              Putuskan
            </button>
          </div>
        </div>
      ) : (
        <a
          href="/api/google/connect"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors w-fit"
        >
          <Link2 size={15} />
          Hubungkan Google Calendar
        </a>
      )}

      {notice && (
        <p className="text-xs font-medium text-muted-foreground bg-muted/40 border border-border rounded-xl px-3 py-2">
          {notice}
        </p>
      )}
    </motion.div>
  );
}
