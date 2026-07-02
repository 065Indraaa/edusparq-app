"use client";

import React, { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Target,
  ArrowLeft,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Calendar,
  ShieldAlert,
  Lightbulb,
} from "lucide-react";

interface SkillGapResult {
  summary: string;
  matchedSkills: string[];
  missingSkills: string[];
  suggestedCertifications: string[];
  learningPath: string[];
  timelineMonths: number;
  confidence: "high" | "medium" | "low";
}

const ROLES = [
  "Data Analyst",
  "Software Engineer / Full Stack Developer",
  "AI / Machine Learning Engineer",
  "Cybersecurity Specialist",
  "Cloud Engineer",
  "Digital Marketing Specialist",
  "UI/UX Designer",
  "Product Manager (Tech)",
  "Business Development / Sales Digital",
  "Green Energy Specialist",
  "Web3 / Crypto Compliance & Operations",
  "Blockchain / Smart Contract Developer",
];

export default function SkillGapPage() {
  const [targetRole, setTargetRole] = useState("");
  const [customRole, setCustomRole] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkillGapResult | null>(null);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState("");

  const selectedRole = targetRole === "custom" ? customRole.trim() : targetRole;

  const analyze = async () => {
    if (!selectedRole) return;
    setLoading(true);
    setError("");
    setResult(null);
    setRaw("");
    try {
      const res = await fetch("/api/career/skill-gap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetRole: selectedRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal menganalisis skill gap.");
      if (data.analysis?.parseError) {
        setRaw(data.analysis.raw || "");
      } else {
        setResult(data.analysis as SkillGapResult);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menganalisis skill gap.");
    } finally {
      setLoading(false);
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-500 uppercase tracking-[0.18em] mb-4">
          <Target size={13} /> Skill Gap Analysis
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
          Cek Kesiapan Skill-mu
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Pilih target karir, lalu AI akan membandingkan skill yang kamu miliki dengan yang dibutuhkan pasar kerja 2026.
        </p>
      </section>

      <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
        <label className="block text-sm font-bold text-foreground mb-2">Target Karir</label>
        <div className="flex flex-col sm:flex-row gap-3">
          <select
            value={targetRole}
            onChange={(e) => setTargetRole(e.target.value)}
            className="flex-1 h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">Pilih target karir...</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
            <option value="custom">Lainnya (tulis sendiri)</option>
          </select>
          {targetRole === "custom" && (
            <input
              type="text"
              value={customRole}
              onChange={(e) => setCustomRole(e.target.value)}
              placeholder="Contoh: Data Engineer, Growth Hacker"
              className="flex-1 h-11 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          )}
          <button
            onClick={analyze}
            disabled={!selectedRole || loading}
            className="h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Menganalisis..." : "Analisis dengan AI"}
          </button>
        </div>
        {error && (
          <div className="mt-4 flex items-center gap-2 text-sm text-destructive bg-destructive/5 p-3 rounded-lg">
            <AlertCircle size={16} /> {error}
          </div>
        )}
      </section>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2 mb-3">
              <Lightbulb size={20} /> Ringkasan
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
            <div className="mt-4 flex flex-wrap gap-3 text-xs">
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground">
                <Calendar size={13} /> Estimasi: {result.timelineMonths} bulan belajar
              </div>
              <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold ${
                result.confidence === "high"
                  ? "bg-emerald-500/10 text-emerald-500"
                  : result.confidence === "medium"
                  ? "bg-amber-500/10 text-amber-500"
                  : "bg-blue-500/10 text-blue-500"
              }`}>
                <ShieldAlert size={13} />
                Confidence: {result.confidence === "high" ? "Tinggi" : result.confidence === "medium" ? "Sedang" : "Rendah"}
              </div>
            </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <section className="rounded-xl border border-border bg-card shadow-sm p-5">
              <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2 mb-3">
                <CheckCircle2 size={16} className="text-emerald-500" /> Skill yang Cocok
              </h2>
              {result.matchedSkills.length > 0 ? (
                <ul className="space-y-2">
                  {result.matchedSkills.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Belum ada skill yang terdeteksi cocok.</p>
              )}
            </section>

            <section className="rounded-xl border border-border bg-card shadow-sm p-5">
              <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2 mb-3">
                <Target size={16} className="text-destructive" /> Skill yang Perlu Dipelajari
              </h2>
              {result.missingSkills.length > 0 ? (
                <ul className="space-y-2">
                  {result.missingSkills.map((s, i) => (
                    <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-destructive mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted-foreground">Kamu sudah memiliki skill utama untuk role ini.</p>
              )}
            </section>
          </div>

          <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2 mb-3">
              <BookOpen size={16} /> Rekomendasi Sertifikasi & Kursus
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {result.suggestedCertifications.map((c, i) => (
                <div key={i} className="p-3 rounded-lg border border-border bg-background text-sm text-foreground">
                  {c}
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
            <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2 mb-3">
              <Calendar size={16} /> Learning Path
            </h2>
            <ol className="space-y-3">
              {result.learningPath.map((step, i) => (
                <li key={i} className="flex items-start gap-3 text-sm text-muted-foreground">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          </section>
        </motion.div>
      )}

      {raw && (
        <section className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
          <h3 className="text-sm font-bold text-amber-600 mb-2">Respons AI (raw)</h3>
          <pre className="text-xs text-muted-foreground whitespace-pre-wrap">{raw}</pre>
        </section>
      )}
    </div>
  );
}
