"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FileText,
  ArrowLeft,
  Sparkles,
  Loader2,
  Copy,
  Check,
  AlertCircle,
  Download,
  User,
  Briefcase,
  Award,
} from "lucide-react";

export default function CvPage() {
  const [targetRole, setTargetRole] = useState("");
  const [extraSkills, setExtraSkills] = useState("");
  const [projects, setProjects] = useState("");
  const [organizations, setOrganizations] = useState("");
  const [experiences, setExperiences] = useState("");
  const [loading, setLoading] = useState(false);
  const [cv, setCv] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const generate = async () => {
    setLoading(true);
    setError("");
    setCv("");
    try {
      const res = await fetch("/api/career/cv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetRole,
          skills: extraSkills.split(",").map((s) => s.trim()).filter(Boolean),
          projects: projects.split("\n").map((s) => s.trim()).filter(Boolean),
          organizations: organizations.split("\n").map((s) => s.trim()).filter(Boolean),
          experiences: experiences.split("\n").map((s) => s.trim()).filter(Boolean),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Gagal membuat CV.");
      setCv(data.cv || "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal membuat CV.");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!cv) return;
    try {
      await navigator.clipboard.writeText(cv);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const downloadMarkdown = () => {
    if (!cv) return;
    const blob = new Blob([cv], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cv-edusparq.md";
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-amber-500/10 text-amber-500 uppercase tracking-[0.18em] mb-4">
          <FileText size={13} /> CV Builder AI
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground">
          Buat CV ATS-Friendly
        </h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          AI akan menyusun CV profesional berdasarkan profil akademikmu. Tambahkan skill, proyek, dan pengalaman untuk hasil lebih baik.
        </p>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6 space-y-4">
          <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
            <User size={16} /> Data Pendukung
          </h2>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Target Role</label>
            <input
              type="text"
              value={targetRole}
              onChange={(e) => setTargetRole(e.target.value)}
              placeholder="Contoh: Data Analyst"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Skill Tambahan (pisahkan koma)</label>
            <input
              type="text"
              value={extraSkills}
              onChange={(e) => setExtraSkills(e.target.value)}
              placeholder="SQL, Python, Tableau, Public Speaking"
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Proyek (satu per baris)</label>
            <textarea
              value={projects}
              onChange={(e) => setProjects(e.target.value)}
              placeholder="Analisis data penjualan menggunakan Python dan Pandas&#10;Website portofolio pribadi dengan Next.js"
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Organisasi / Kepanitiaan</label>
            <textarea
              value={organizations}
              onChange={(e) => setOrganizations(e.target.value)}
              placeholder="Ketua HMIF 2025&#10;Volunteer Tech Conference 2026"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-muted-foreground mb-1">Pengalaman Kerja / Magang</label>
            <textarea
              value={experiences}
              onChange={(e) => setExperiences(e.target.value)}
              placeholder="Intern Data Analyst di Startup X (Jan–Apr 2026)&#10;Freelance Digital Marketing"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>

          <button
            onClick={generate}
            disabled={loading}
            className="w-full h-11 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2 transition-colors"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            {loading ? "Membuat CV..." : "Generate CV dengan AI"}
          </button>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 p-3 rounded-lg">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </section>

        <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
              <Briefcase size={16} /> Preview CV
            </h2>
            {cv && (
              <div className="flex items-center gap-2">
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold hover:bg-muted transition-colors"
                >
                  {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
                <button
                  onClick={downloadMarkdown}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-background text-xs font-bold hover:bg-muted transition-colors"
                >
                  <Download size={14} /> .md
                </button>
              </div>
            )}
          </div>

          <div className="flex-1 min-h-[24rem] rounded-lg border border-border bg-background p-4 overflow-auto">
            {cv ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                {cv.split("\n").map((line, i) => {
                  if (line.startsWith("# ")) {
                    return <h1 key={i} className="text-xl font-black">{line.replace("# ", "")}</h1>;
                  }
                  if (line.startsWith("## ")) {
                    return <h2 key={i} className="text-base font-bold mt-4">{line.replace("## ", "")}</h2>;
                  }
                  if (line.startsWith("- ")) {
                    return <li key={i} className="ml-4">{line.replace("- ", "")}</li>;
                  }
                  if (line.startsWith("---")) {
                    return <hr key={i} className="my-4" />;
                  }
                  if (line.trim() === "") {
                    return <div key={i} className="h-2" />;
                  }
                  return <p key={i} className="text-sm">{line}</p>;
                })}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-muted-foreground">
                <Award size={40} className="mb-3 opacity-40" />
                <p className="text-sm font-medium">CV akan muncul di sini.</p>
                <p className="text-xs mt-1">Isi data pendukung lalu klik Generate.</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
