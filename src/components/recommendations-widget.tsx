"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Lightbulb, RefreshCw, Sparkles } from "lucide-react";

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
    <section className="rounded-3xl border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
          <Lightbulb size={18} className="text-primary" /> Rekomendasi Belajar AI
        </h2>
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-60"
        >
          {generating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
          {recs.length > 0 ? "Perbarui" : "Buat"}
        </button>
      </div>

      {error && <p className="text-xs text-amber-600 dark:text-amber-400 mb-3">{error}</p>}

      {recs.length === 0 ? (
        <p className="text-xs text-muted-foreground py-2">
          Belum ada rekomendasi. Tekan &ldquo;Buat&rdquo; untuk menghasilkan topik belajar dari mata kuliah dan materimu.
        </p>
      ) : (
        <div className="space-y-2">
          {recs.map((r, i) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-2xl bg-muted/30 border border-border">
              <span
                className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shrink-0 ${
                  PRIORITY_STYLE[r.prioritas] || PRIORITY_STYLE.sedang
                }`}
              >
                {r.prioritas || "sedang"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground">{r.topik}</p>
                <p className="text-[11px] text-muted-foreground">{r.alasan}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
