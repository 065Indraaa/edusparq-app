"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Sparkles,
  RefreshCw,
  Download,
  Copy,
  Check,
  Trash2,
  FileText,
  Presentation,
  ListChecks,
  Wand2,
  Layers3,
} from "lucide-react";
import { CourseSelect } from "@/components/course-select";

interface Note {
  _id: string;
  courseName: string;
  judul: string;
  formatType: "dokumen" | "presentasi" | "poin";
  content: string;
  createdAt?: string;
}

const FORMATS: { value: Note["formatType"]; label: string; icon: typeof FileText; desc: string }[] = [
  { value: "dokumen", label: "Dokumen", icon: FileText, desc: "Catatan rapi & lengkap" },
  { value: "presentasi", label: "Presentasi", icon: Presentation, desc: "Kerangka slide" },
  { value: "poin", label: "Poin", icon: ListChecks, desc: "Ringkasan padat" },
];

export default function CatatanPage() {
  const { status: authStatus } = useSession();
  const [raw, setRaw] = useState("");
  const [courseName, setCourseName] = useState("");
  const [format, setFormat] = useState<Note["formatType"]>("dokumen");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Note | null>(null);
  const [history, setHistory] = useState<Note[]>([]);
  const [copied, setCopied] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/notes/refine");
      if (res.ok) {
        const d = await res.json();
        setHistory(Array.isArray(d?.items) ? d.items : []);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") refresh();
  }, [authStatus, refresh]);

  const generate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (raw.trim().length < 10) {
      setError("Tulis catatan kasarmu dulu ya.");
      return;
    }
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/notes/refine", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawInput: raw, courseName, format }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d?.error || "Gagal merapikan catatan.");
        return;
      }
      setResult(d.note);
      refresh();
    } catch {
      setError("Terjadi kendala koneksi.");
    } finally {
      setBusy(false);
    }
  };

  const download = (note: Note) => {
    const blob = new Blob([note.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(note.judul || "catatan").replace(/[^a-z0-9]+/gi, "_")}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  };

  const remove = async (id: string) => {
    setHistory((prev) => prev.filter((n) => n._id !== id));
    if (result?._id === id) setResult(null);
    try {
      await fetch(`/api/notes/refine?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-6xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute right-0 bottom-0 h-40 w-40 translate-x-12 translate-y-12 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.35fr_0.8fr] gap-6 items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
              <Wand2 size={14} /> AI Note Studio
            </div>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-foreground">Catatan Pintar</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
              Ubah coretan kuliah jadi dokumen rapi, outline slide, atau ringkasan poin yang siap dibaca ulang.
            </p>
          </div>
          <div className="rounded-2xl bg-background/70 border border-border p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-foreground mb-2">
              <Layers3 size={15} className="text-primary" /> 3 format output
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">Dokumen untuk belajar mendalam, presentasi untuk tugas kelompok, poin untuk review cepat.</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: input form */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={generate} className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {FORMATS.map((f) => {
            const Icon = f.icon;
            const active = format === f.value;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFormat(f.value)}
                className={`flex flex-row sm:flex-col items-center sm:justify-center gap-2 sm:gap-1.5 p-3 rounded-2xl border text-left sm:text-center transition-all min-h-[76px] ${
                  active ? "border-primary/40 bg-primary/10 text-primary" : "border-border bg-muted/30 text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={18} className={active ? "text-primary" : "text-muted-foreground"} />
                <span className="flex flex-col min-w-0">
                  <span className="text-xs font-bold">{f.label}</span>
                  <span className="text-[10px] text-muted-foreground leading-tight">{f.desc}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Mata kuliah (opsional)</label>
          <CourseSelect value={courseName} onChange={setCourseName} placeholder="Pilih mata kuliah" />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Catatan kasarmu</label>
          <textarea
            value={raw}
            onChange={(e) => setRaw(e.target.value)}
            rows={8}
            placeholder="Tempel coretan kuliah, poin-poin acak, atau hasil ketik cepat di kelas…"
            className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        {error && <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">{error}</p>}

        <button type="submit" disabled={busy}
          className="inline-flex items-center justify-center gap-2 px-6 min-h-[48px] w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 shadow-sm">
          {busy ? <RefreshCw size={16} className="animate-spin" /> : <Sparkles size={16} />}
          {busy ? "Merapikan…" : "Rapikan dengan AI"}
        </button>
          </form>
        </div>

        {/* Right column: output + history */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <div className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="text-base font-bold text-foreground truncate">{result.judul}</h2>
                <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 shrink-0">
                  <button onClick={() => copy(result.content)} className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                    {copied ? <Check size={14} /> : <Copy size={14} />} {copied ? "Tersalin" : "Salin"}
                  </button>
                  <button onClick={() => download(result)} className="inline-flex items-center justify-center gap-1.5 text-xs font-bold px-3 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                    <Download size={14} /> .md
                  </button>
                </div>
              </div>
              <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed bg-muted/30 border border-border rounded-2xl p-4 overflow-x-auto max-h-[60vh]">{result.content}</pre>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-[1.75rem] p-6 text-center space-y-3 shadow-sm">
              <NotebookPen size={40} className="mx-auto text-primary opacity-40 animate-pulse" />
              <h3 className="font-bold text-foreground text-sm">Hasil rapi muncul di sini</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Tulis coretanmu di kiri, pilih format, lalu klik &ldquo;Rapikan dengan AI&rdquo;. Catatan rapi siap unduh akan tampil di sini.
              </p>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-2 rounded-[1.75rem] border border-border bg-card p-4 sm:p-5 shadow-sm">
              <h2 className="text-sm font-bold text-foreground">Catatan tersimpan</h2>
              {history.map((n) => (
                <div key={n._id} className="rounded-2xl p-3 sm:p-4 flex items-center gap-3 bg-muted/30 border border-border/70 hover:bg-muted/50 transition-colors">
                  <FileText size={16} className="text-primary shrink-0" />
                  <button onClick={() => setResult(n)} className="min-w-0 flex-1 text-left">
                    <p className="text-sm font-semibold text-foreground truncate">{n.judul}</p>
                    <p className="text-[11px] text-muted-foreground">{[n.formatType, n.courseName].filter(Boolean).join(" · ")}</p>
                  </button>
                  <button onClick={() => download(n)} aria-label="Unduh" className="text-muted-foreground hover:text-primary p-2 rounded-lg hover:bg-primary/10 transition-colors shrink-0">
                    <Download size={15} />
                  </button>
                  <button onClick={() => remove(n._id)} aria-label="Hapus" className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
