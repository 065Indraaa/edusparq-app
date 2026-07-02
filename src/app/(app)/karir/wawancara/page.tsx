"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  MessageSquareText,
  ArrowLeft,
  Sparkles,
  Loader2,
  AlertCircle,
  Send,
  ThumbsUp,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface InterviewQuestion {
  id: number;
  question: string;
  type: "behavioral" | "technical" | "case-study";
  intent: string;
  tips: string;
}

interface InterviewFeedback {
  score: number;
  strengths: string[];
  improvements: string[];
  modelAnswer: string;
  encouragement: string;
}

const TYPES = [
  { value: "behavioral", label: "Behavioral" },
  { value: "technical", label: "Technical" },
  { value: "case-study", label: "Case Study" },
];

export default function WawancaraPage() {
  const [targetRole, setTargetRole] = useState("");
  const [type, setType] = useState<"behavioral" | "technical" | "case-study">("behavioral");
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<InterviewQuestion[]>([]);
  const [error, setError] = useState("");

  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<number, InterviewFeedback>>({});
  const [feedbackLoading, setFeedbackLoading] = useState<Record<number, boolean>>({});
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const generate = async () => {
    if (!targetRole.trim()) return;
    setLoading(true);
    setError("");
    setQuestions([]);
    setAnswers({});
    setFeedbacks({});
    try {
      const res = await fetch("/api/career/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole, type }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membuat pertanyaan.");
      const qs = Array.isArray(data.questions?.questions)
        ? data.questions.questions
        : Array.isArray(data.questions)
        ? data.questions
        : [];
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat pertanyaan.");
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (q: InterviewQuestion) => {
    const answer = answers[q.id]?.trim();
    if (!answer) return;
    setFeedbackLoading((prev) => ({ ...prev, [q.id]: true }));
    try {
      const res = await fetch("/api/career/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          type,
          question: q.question,
          answer,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal mendapatkan feedback.");
      setFeedbacks((prev) => ({ ...prev, [q.id]: data.feedback as InterviewFeedback }));
      setExpanded((prev) => ({ ...prev, [q.id]: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal mendapatkan feedback.");
    } finally {
      setFeedbackLoading((prev) => ({ ...prev, [q.id]: false }));
    }
  };

  return (
    <div className="space-y-5 w-full mx-auto max-w-4xl pb-8">
      <Link
        href="/karir"
        className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft size={14} /> Kembali ke Career Center
      </Link>

      <section className="rounded-xl border border-border bg-card shadow-sm p-6 md:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-purple-500/10 text-purple-500 uppercase tracking-[0.18em] mb-4">
          <MessageSquareText size={13} /> Interview Prep AI
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
          Latihan Wawancara dengan AI
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Pilih tipe wawancara dan target role, lalu latih jawabanmu. AI akan memberi pertanyaan realistis dan feedback konstruktif.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            placeholder="Target role, contoh: Data Analyst"
            className="flex-1 h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as InterviewQuestion["type"])}
            className="h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          <button
            onClick={generate}
            disabled={!targetRole.trim() || loading}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Membuat..." : "Generate Pertanyaan"}
          </button>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/5 p-3 rounded-lg">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </section>

      {questions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {questions.map((q) => {
            const feedback = feedbacks[q.id];
            const isExpanded = expanded[q.id];
            return (
              <section
                key={q.id}
                className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6"
              >
                <div className="flex items-start gap-3">
                  <span className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {q.id}
                  </span>
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-foreground">{q.question}</h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      <span className="font-semibold">Tipe:</span> {q.type} • <span className="font-semibold">Tujuan:</span> {q.intent}
                    </p>
                    <div className="mt-3 flex items-start gap-1.5 text-xs text-amber-600 bg-amber-500/5 p-2.5 rounded-lg">
                      <Lightbulb size={13} className="shrink-0 mt-0.5" />
                      <span>{q.tips}</span>
                    </div>

                    <div className="mt-4">
                      <textarea
                        value={answers[q.id] || ""}
                        onChange={(e) =>
                          setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                        }
                        placeholder="Tulis jawabanmu di sini..."
                        rows={4}
                        className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                      />
                      <button
                        onClick={() => submitAnswer(q)}
                        disabled={!answers[q.id]?.trim() || feedbackLoading[q.id]}
                        className="mt-2 h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1.5 transition-colors"
                      >
                        {feedbackLoading[q.id] ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Send size={13} />
                        )}
                        {feedbackLoading[q.id] ? "Mengevaluasi..." : "Dapatkan Feedback"}
                      </button>
                    </div>

                    {feedback && (
                      <div className="mt-4 rounded-lg border border-border bg-background overflow-hidden">
                        <button
                          onClick={() => setExpanded((prev) => ({ ...prev, [q.id]: !prev[q.id] }))}
                          className="w-full flex items-center justify-between p-3 text-left hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-foreground">
                              Feedback AI
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              feedback.score >= 7
                                ? "bg-emerald-500/10 text-emerald-500"
                                : feedback.score >= 5
                                ? "bg-amber-500/10 text-amber-500"
                                : "bg-red-500/10 text-red-500"
                            }`}>
                              Skor {feedback.score}/10
                            </span>
                          </div>
                          {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                        </button>
                        {isExpanded && (
                          <div className="p-4 space-y-3 text-sm">
                            <div>
                              <p className="font-bold text-emerald-600 flex items-center gap-1.5 mb-1">
                                <ThumbsUp size={13} /> Kelebihan
                              </p>
                              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                {feedback.strengths.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-bold text-destructive mb-1">Saran Perbaikan</p>
                              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                                {feedback.improvements.map((s, i) => (
                                  <li key={i}>{s}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <p className="font-bold text-foreground mb-1">Contoh Jawaban Lebih Baik</p>
                              <p className="text-muted-foreground leading-relaxed">{feedback.modelAnswer}</p>
                            </div>
                            <div className="text-xs text-muted-foreground italic bg-muted p-2.5 rounded-lg">
                              {feedback.encouragement}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </motion.div>
      )}
    </div>
  );
}
