"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ArrowUpRight, Lightbulb, RefreshCw, Sparkles } from "lucide-react";

interface Rec {
  topik: string;
  alasan: string;
  prioritas: "tinggi" | "sedang" | "rendah";
}

const PRIORITY_STYLE: Record<string, string> = {
  tinggi: "bg-red-500/10 text-red-600 dark:text-red-400",
  sedang: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  rendah: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
};

/** Surfaces AI-generated study recommendations grounded in the user's courses + analysed materials. */
export function RecommendationsWidget() {
  const [recs, setRecs] = useState<Rec[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/recommendations");
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      const list: Rec[] = Array.isArray(data?.recommendations) ? data.recommendations : [];
      setRecs(list);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    setError("");
    try {
      const res = await fetch("/api/recommendations", { method: "POST" });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(data?.error || "Gagal membuat rekomendasi. Coba lagi nanti.");
        return;
      }
      if (Array.isArray(data?.created) && data.created.length > 0) {
        setRecs(data.created);
      } else {
        setError(data?.message || "AI belum bisa membuat rekomendasi saat ini.");
        await load();
      }
    } catch {
      setError("Gagal membuat rekomendasi. Coba lagi nanti.");
    } finally {
      setGenerating(false);
    }
  };

  if (loading) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <Lightbulb size={18} className="text-primary" /> Rekomendasi Belajar AI
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">Dibuat dari mata kuliah dan materi yang sudah dianalisis.</p>
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60 shrink-0"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {recs.length > 0 ? "Perbarui" : "Buat"}
        </button>
      </div>

      {error && <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">{error}</p>}

      {recs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-5 text-xs text-muted-foreground">
          Belum ada rekomendasi. Tekan &ldquo;Buat&rdquo; untuk menghasilkan topik belajar dari mata kuliah dan materimu.
        </div>
      ) : (
        <div className="space-y-2">
          {recs.map((r, i) => (
            <div key={i} className="group flex items-start gap-3 p-3 rounded-2xl bg-background/70 border border-border hover:border-primary/20 hover:bg-background transition-all">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${
                  PRIORITY_STYLE[r.prioritas] || PRIORITY_STYLE.sedang
                }`}
              >
                {r.prioritas || "sedang"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">{r.topik}<ArrowUpRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity text-primary" /></p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">{r.alasan}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
