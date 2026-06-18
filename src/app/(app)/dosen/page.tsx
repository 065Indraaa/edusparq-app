"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  GraduationCap,
  Send,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Lightbulb,
  History,
  ShieldCheck,
  Target,
} from "lucide-react";
import { CourseSelect } from "../../../components/course-select-dropdown";

interface Evaluation {
  _id?: string;
  courseName?: string;
  question: string;
  userAnswer: string;
  score: number;
  verdict: string;
  feedback: string;
  strengths: string[];
  missing: string[];
  saran: string;
  idealAnswer: string;
  createdAt?: string;
}

function scoreTone(score: number): { ring: string; text: string; bg: string } {
  if (score >= 80) return { ring: "border-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10" };
  if (score >= 60) return { ring: "border-amber-500", text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10" };
  return { ring: "border-destructive", text: "text-destructive", bg: "bg-destructive/10" };
}

export default function DosenVirtualPage() {
  const { status: authStatus } = useSession();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [courseName, setCourseName] = useState("");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Evaluation | null>(null);
  const [history, setHistory] = useState<Evaluation[]>([]);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/tutor/grade");
      if (!res.ok) return;
      const data = await res.json();
      setHistory(Array.isArray(data?.items) ? data.items : []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") refreshHistory();
  }, [authStatus, refreshHistory]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (question.trim().length < 5 || answer.trim().length < 1) {
      setError("Tulis soal dan jawabanmu dulu ya.");
      return;
    }
    setGrading(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/tutor/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, answer, courseName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || "Gagal menilai jawaban.");
        return;
      }
      setResult(data.evaluation);
      refreshHistory();
    } catch {
      setError("Terjadi kendala koneksi. Coba lagi.");
    } finally {
      setGrading(false);
    }
  };

  const ResultCard = ({ ev }: { ev: Evaluation }) => {
    const tone = scoreTone(ev.score);
    return (
      <div className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-5 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className={`grid place-items-center w-20 h-20 rounded-full border-4 ${tone.ring} ${tone.bg} shrink-0`}>
            <span className={`text-2xl font-black ${tone.text}`}>{ev.score}</span>
          </div>
          <div className="min-w-0">
            <span className={`text-xs font-bold uppercase tracking-wider ${tone.text}`}>{ev.verdict || "Hasil"}</span>
            <p className="text-sm text-foreground leading-snug mt-1">{ev.feedback}</p>
          </div>
        </div>

        {ev.strengths.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
              <CheckCircle2 size={14} /> Sudah tepat
            </span>
            <ul className="space-y-1">
              {ev.strengths.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-emerald-500">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {ev.missing.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
              <AlertCircle size={14} /> Perlu diperbaiki
            </span>
            <ul className="space-y-1">
              {ev.missing.map((s, i) => (
                <li key={i} className="text-xs text-muted-foreground pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-amber-500">{s}</li>
              ))}
            </ul>
          </div>
        )}

        {ev.saran && (
          <div className="rounded-2xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-2.5">
            <Lightbulb size={16} className="text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-foreground leading-relaxed"><span className="font-bold">Saran: </span>{ev.saran}</p>
          </div>
        )}

        {ev.idealAnswer && (
          <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-1">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Kunci / Jawaban Ideal</span>
            <p className="text-xs text-foreground leading-relaxed">{ev.idealAnswer}</p>
          </div>
        )}
      </div>
    );
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-7xl">
      <section className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute right-0 top-0 h-40 w-40 translate-x-12 -translate-y-16 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative grid lg:grid-cols-[1.4fr_0.8fr] gap-6 items-end">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
              <GraduationCap size={14} /> Evaluasi Jawaban
            </div>
            <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-black tracking-tight text-gradient">Dosen Virtual</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
              Uji jawabanmu dengan skor 0–100, daftar kekuatan, bagian yang bolong, dan contoh jawaban ideal.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-2xl bg-background/70 border border-border p-3">
              <ShieldCheck size={16} className="text-primary mb-2" />
              <p className="text-xs font-bold text-foreground">Rubrik jelas</p>
              <p className="text-[11px] text-muted-foreground">Bukan cuma nilai.</p>
            </div>
            <div className="rounded-2xl bg-background/70 border border-border p-3">
              <Target size={16} className="text-primary mb-2" />
              <p className="text-xs font-bold text-foreground">Langsung revisi</p>
              <p className="text-[11px] text-muted-foreground">Tahu mana yang kurang.</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left column: Input Form */}
        <div className="lg:col-span-6 space-y-6">
          <form onSubmit={submit} className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Mata kuliah (opsional)</label>
          <CourseSelect value={courseName} onChange={setCourseName} placeholder="Pilih mata kuliah" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Soal / pertanyaan</label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            rows={3}
            placeholder="Tempel soal tugas atau pertanyaan di sini…"
            className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Jawabanmu</label>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={6}
            placeholder="Tulis jawabanmu di sini untuk dinilai…"
            className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">{error}</p>
        )}

        <button
          type="submit"
          disabled={grading}
          className="inline-flex items-center justify-center gap-2 px-6 min-h-[48px] w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 shadow-sm"
        >
          {grading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          {grading ? "Menilai…" : "Nilai jawaban"}
        </button>
          </form>
        </div>

        {/* Right column: Results & History */}
        <div className="lg:col-span-6 space-y-6">
          {result ? (
            <ResultCard ev={result} />
          ) : (
            <div className="bg-card border border-border rounded-[1.75rem] p-6 text-center space-y-3 shadow-sm">
              <GraduationCap size={40} className="mx-auto text-primary opacity-40 animate-pulse" />
              <h3 className="font-bold text-foreground text-sm">Siap Menilai Jawabanmu</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Tulis soal tugas dan jawabanmu di sebelah kiri, lalu klik &ldquo;Nilai jawaban&rdquo;. Dosen Virtual akan mengevaluasi akurasinya secara mendalam di sini.
              </p>
            </div>
          )}

          {history.length > 0 && (
            <div className="space-y-3 rounded-[1.75rem] border border-border bg-card p-4 sm:p-5 shadow-sm">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <History size={16} className="text-primary" /> Riwayat penilaian
              </h2>
              {history.map((h) => {
                const tone = scoreTone(h.score);
                return (
                  <div key={h._id} className="rounded-2xl p-3 sm:p-4 flex items-start gap-3 bg-muted/30 border border-border/70 hover:bg-muted/50 transition-colors">
                    <div className={`grid place-items-center w-12 h-12 rounded-xl border-2 ${tone.ring} ${tone.bg} shrink-0`}>
                      <span className={`text-sm font-black ${tone.text}`}>{h.score}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{h.question}</p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {[h.courseName, h.verdict].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
