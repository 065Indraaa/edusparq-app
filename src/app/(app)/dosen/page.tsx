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
} from "lucide-react";
import { CourseSelect } from "@/components/course-select";

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
      <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
        <div className="flex items-center gap-4">
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
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
            <GraduationCap size={20} />
          </span>
          Dosen Virtual
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Tempel soal tugas dan jawabanmu — AI menilai akurasinya seperti dosen penguji: skor 0–100, poin yang tepat, yang kurang, plus kunci jawaban.
        </p>
      </div>

      <form onSubmit={submit} className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
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
          className="inline-flex items-center gap-2 px-6 min-h-[48px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60"
        >
          {grading ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
          {grading ? "Menilai…" : "Nilai jawaban"}
        </button>
      </form>

      {result && <ResultCard ev={result} />}

      {history.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
            <History size={16} className="text-primary" /> Riwayat penilaian
          </h2>
          {history.map((h) => {
            const tone = scoreTone(h.score);
            return (
              <div key={h._id} className="bg-card border border-border rounded-2xl p-4 flex items-start gap-3 shadow-sm">
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
    </motion.div>
  );
}
