"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText, Plus, Trash2, RefreshCw, Sparkles, CheckCircle2, XCircle,
  ClipboardList, Clock, Award, ChevronRight,
} from "lucide-react";

interface PQuestion {
  type: "mc" | "essay";
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  points: number;
  idealAnswer: string;
}
interface Paper {
  _id: string;
  title: string;
  courseName: string;
  topic: string;
  questions: PQuestion[];
  attempts: number;
  lastScore: number;
  nextReviewAt: string | null;
  updatedAt: string;
}
interface DocOpt { _id: string; originalName: string; }

interface EssayResult { score: number; feedback: string; strengths: string[]; missing: string[]; }

export default function ExamPractice({
  courses,
  documents,
}: {
  courses: string[];
  documents: DocOpt[];
}) {
  const [papers, setPapers] = useState<Paper[]>([]);
  const [loading, setLoading] = useState(true);
  const [active, setActive] = useState<Paper | null>(null);

  // generator
  const [course, setCourse] = useState("");
  const [topic, setTopic] = useState("");
  const [docId, setDocId] = useState("");
  const [mcCount, setMcCount] = useState(5);
  const [essayCount, setEssayCount] = useState(2);
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState("");

  // attempt
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [essays, setEssays] = useState<Record<number, string>>({});
  const [grading, setGrading] = useState(false);
  const [result, setResult] = useState<{
    overall: number;
    perEssay: Record<number, EssayResult>;
  } | null>(null);

  const loadPapers = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/exams/practice");
      const d = await r.json();
      if (Array.isArray(d.papers)) setPapers(d.papers);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadPapers(); }, [loadPapers]);

  const openPaper = (p: Paper) => {
    setActive(p);
    setAnswers({});
    setEssays({});
    setResult(null);
  };

  const handleRancang = async () => {
    if (genBusy) return;
    if (!course.trim() && !topic.trim() && !docId) {
      setGenError("Isi mata kuliah/topik atau pilih materi dulu.");
      return;
    }
    setGenBusy(true);
    setGenError("");
    try {
      const r = await fetch("/api/exams/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: course, topic, documentId: docId || undefined,
          mcCount, essayCount,
        }),
      });
      const d = await r.json();
      if (r.ok && d.paper) {
        await loadPapers();
        openPaper(d.paper);
      } else {
        setGenError(d.error || "Gagal membuat latihan.");
      }
    } finally {
      setGenBusy(false);
    }
  };

  const removePaper = async (id: string) => {
    await fetch(`/api/exams/practice/${id}`, { method: "DELETE" });
    if (active?._id === id) setActive(null);
    loadPapers();
  };

  const submit = async () => {
    if (!active || grading) return;
    setGrading(true);
    try {
      let earned = 0;
      let total = 0;
      const perEssay: Record<number, EssayResult> = {};

      for (let i = 0; i < active.questions.length; i++) {
        const q = active.questions[i];
        total += q.points;
        if (q.type === "mc") {
          if (answers[i] === q.correctIndex) earned += q.points;
        } else {
          const ans = (essays[i] || "").trim();
          if (!ans) { perEssay[i] = { score: 0, feedback: "Belum dijawab.", strengths: [], missing: [] }; continue; }
          const r = await fetch("/api/tutor/grade", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question: q.question, answer: ans, courseName: active.courseName }),
          });
          const d = await r.json();
          const ev = d?.evaluation;
          const s = typeof ev?.score === "number" ? ev.score : 0;
          perEssay[i] = {
            score: s,
            feedback: ev?.feedback || "",
            strengths: Array.isArray(ev?.strengths) ? ev.strengths : [],
            missing: Array.isArray(ev?.missing) ? ev.missing : [],
          };
          earned += (q.points * s) / 100;
        }
      }

      const overall = total > 0 ? Math.round((earned / total) * 100) : 0;
      setResult({ overall, perEssay });

      // Record attempt for spaced repetition.
      await fetch(`/api/exams/practice/${active._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ score: overall }),
      });
      loadPapers();
    } finally {
      setGrading(false);
    }
  };

  const fmtDate = (s: string | null) => {
    if (!s) return null;
    const d = new Date(s);
    return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
  };

  // ---- Attempt view ----
  if (active) {
    return (
      <div className="space-y-5">
        <button onClick={() => setActive(null)} className="text-sm text-primary font-semibold hover:underline">
          ← Kembali ke daftar latihan
        </button>

        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-2">
          <h2 className="font-black text-lg text-foreground">{active.title}</h2>
          <p className="text-xs text-muted-foreground">
            {active.questions.length} soal · {active.questions.filter((q) => q.type === "mc").length} pilgan, {active.questions.filter((q) => q.type === "essay").length} esai
          </p>
        </div>

        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="bg-gradient-to-br from-primary/10 via-card to-card border border-primary/20 rounded-3xl p-6 text-center shadow-sm">
            <Award size={32} className="mx-auto text-primary mb-2" />
            <p className="font-display tracking-tight text-4xl font-black text-gradient">{result.overall}</p>
            <p className="text-sm text-muted-foreground mt-1">Skor keseluruhan</p>
          </motion.div>
        )}

        <div className="space-y-4">
          {active.questions.map((q, i) => (
            <div key={i} className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3">
              <div className="flex items-start gap-2">
                <span className="text-[10px] font-bold uppercase tracking-wide text-primary bg-primary/10 px-2 py-0.5 rounded-full shrink-0 mt-0.5">
                  {q.type === "mc" ? "Pilgan" : "Esai"} · {q.points} poin
                </span>
                <p className="text-sm font-semibold text-foreground">{i + 1}. {q.question}</p>
              </div>

              {q.type === "mc" ? (
                <div className="space-y-2">
                  {q.options.map((opt, oi) => {
                    const picked = answers[i] === oi;
                    const isCorrect = result && oi === q.correctIndex;
                    const isWrongPick = result && picked && oi !== q.correctIndex;
                    return (
                      <button key={oi} disabled={!!result}
                        onClick={() => setAnswers((a) => ({ ...a, [i]: oi }))}
                        className={`w-full text-left px-4 py-2.5 rounded-xl border text-sm transition-all flex items-center gap-2 ${
                          isCorrect ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 text-foreground"
                          : isWrongPick ? "border-destructive/40 bg-destructive/10 text-foreground"
                          : picked ? "border-primary bg-primary/10 text-foreground"
                          : "border-border bg-muted/40 text-foreground hover:border-primary/40"
                        }`}>
                        {result && isCorrect && <CheckCircle2 size={15} className="text-emerald-500 shrink-0" />}
                        {result && isWrongPick && <XCircle size={15} className="text-destructive shrink-0" />}
                        {opt}
                      </button>
                    );
                  })}
                  {result && q.explanation && (
                    <p className="text-xs text-muted-foreground bg-muted/50 rounded-xl p-3 leading-relaxed">
                      <strong>Penjelasan:</strong> {q.explanation}
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <textarea rows={4} disabled={!!result}
                    value={essays[i] || ""}
                    onChange={(e) => setEssays((s) => ({ ...s, [i]: e.target.value }))}
                    placeholder="Tulis jawaban esaimu di sini..."
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none disabled:opacity-70" />
                  {(() => {
                    const er = result?.perEssay[i];
                    if (!er) return null;
                    return (
                      <div className="rounded-2xl bg-muted/50 border border-border p-3 space-y-2 text-xs">
                        <p className="font-bold text-primary">Nilai esai: {er.score}/100</p>
                        {er.feedback && <p className="text-muted-foreground leading-relaxed">{er.feedback}</p>}
                        {er.missing.length > 0 && (
                          <p className="text-muted-foreground"><strong>Perlu ditambah:</strong> {er.missing.join("; ")}</p>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>

        {!result && (
          <button onClick={submit} disabled={grading}
            className="w-full min-h-[48px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
            {grading ? <><RefreshCw size={16} className="animate-spin" /> Menilai jawaban...</> : <><CheckCircle2 size={16} /> Kumpulkan & Nilai</>}
          </button>
        )}
      </div>
    );
  }

  // ---- List + generator view ----
  return (
    <div className="space-y-5">
      <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <ClipboardList size={16} className="text-primary" />
          <h2 className="font-bold text-foreground">Buat Latihan Soal</h2>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI menyusun paper latihan (pilihan ganda + esai) dari mata kuliah, topik, atau materimu. Esai dinilai otomatis dengan rubrik.
        </p>
        <div className="grid sm:grid-cols-2 gap-3">
          <input value={course} onChange={(e) => setCourse(e.target.value)} list="exam-course-list"
            placeholder="Mata kuliah (mis: Basis Data)"
            className="px-4 min-h-[46px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
          <datalist id="exam-course-list">{courses.map((c) => <option key={c} value={c} />)}</datalist>
          <input value={topic} onChange={(e) => setTopic(e.target.value)}
            placeholder="Fokus topik (opsional)"
            className="px-4 min-h-[46px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary" />
        </div>
        <select value={docId} onChange={(e) => setDocId(e.target.value)}
          className="w-full px-4 min-h-[46px] rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary">
          <option value="">Tanpa materi (pakai topik di atas)</option>
          {documents.map((d) => <option key={d._id} value={d._id}>Dari materi: {d.originalName}</option>)}
        </select>
        <div className="flex gap-3 flex-wrap">
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Pilgan
            <input type="number" min={0} max={12} value={mcCount} onChange={(e) => setMcCount(Number(e.target.value))}
              className="w-16 px-2 min-h-[40px] rounded-xl bg-muted border border-border text-sm text-foreground text-center focus:outline-none focus:border-primary" />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
            Esai
            <input type="number" min={0} max={6} value={essayCount} onChange={(e) => setEssayCount(Number(e.target.value))}
              className="w-16 px-2 min-h-[40px] rounded-xl bg-muted border border-border text-sm text-foreground text-center focus:outline-none focus:border-primary" />
          </label>
          <button onClick={handleRancang} disabled={genBusy}
            className="flex-1 min-w-[140px] min-h-[46px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2">
            {genBusy ? <><RefreshCw size={16} className="animate-spin" /> Menyusun...</> : <><Sparkles size={15} /> Buat Latihan</>}
          </button>
        </div>
        {genError && (
          <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">{genError}</p>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-bold text-sm text-foreground px-1">Latihan tersimpan</h3>
        {loading ? (
          <div className="flex justify-center py-8"><RefreshCw size={18} className="animate-spin text-muted-foreground" /></div>
        ) : papers.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">Belum ada latihan. Buat yang pertama di atas.</p>
        ) : (
          papers.map((p) => {
            const due = p.nextReviewAt && new Date(p.nextReviewAt) <= new Date();
            return (
              <div key={p._id} onClick={() => openPaper(p)}
                className="group flex items-center gap-3 bg-card border border-border rounded-2xl p-4 cursor-pointer hover:border-primary/40 transition-all">
                <FileText size={18} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{p.title}</p>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground flex-wrap">
                    <span>{p.questions.length} soal</span>
                    {p.attempts > 0 && <span>· Skor terakhir {p.lastScore}</span>}
                    {p.nextReviewAt && (
                      <span className={`inline-flex items-center gap-1 ${due ? "text-primary font-bold" : ""}`}>
                        · <Clock size={10} /> {due ? "Waktunya review!" : `Review ${fmtDate(p.nextReviewAt)}`}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); removePaper(p._id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0">
                  <Trash2 size={15} />
                </button>
                <ChevronRight size={16} className="text-muted-foreground shrink-0" />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
