"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Briefcase,
  TrendingUp,
  Target,
  FileText,
  MessageSquareText,
  ArrowRight,
  Search,
  Wallet,
  Award,
  Lightbulb,
  AlertCircle,
} from "lucide-react";

interface TrendingRole {
  id: string;
  title: string;
  category: string;
  entrySalary: string;
  demand: "high" | "very-high" | "stable";
  skills: string[];
  description: string;
}

interface CareerTrend {
  year: number;
  topSectors: string[];
  keySkills: string[];
  salaryNote: string;
  sourceNote: string;
}

const FEATURES = [
  {
    title: "Lowongan & Magang",
    desc: "Cari lowongan entry-level, magang, part-time, dan remote.",
    icon: Briefcase,
    href: "/karir/lowongan",
    color: "bg-blue-500/10 text-blue-500",
  },
  {
    title: "Skill Gap Analysis",
    desc: "AI bantu analisis kekurangan skill vs target karir.",
    icon: Target,
    href: "/karir/skill-gap",
    color: "bg-emerald-500/10 text-emerald-500",
  },
  {
    title: "CV Builder AI",
    desc: "Generate CV ATS-friendly dari profil akademikmu.",
    icon: FileText,
    href: "/karir/cv",
    color: "bg-amber-500/10 text-amber-500",
  },
  {
    title: "Persiapan Wawancara",
    desc: "Latihan pertanyaan behavioral, technical, & case study.",
    icon: MessageSquareText,
    href: "/karir/wawancara",
    color: "bg-purple-500/10 text-purple-500",
  },
];

const DEMAND_LABEL: Record<TrendingRole["demand"], { text: string; className: string }> = {
  "very-high": { text: "Sangat Tinggi", className: "bg-red-500/10 text-red-500" },
  high: { text: "Tinggi", className: "bg-orange-500/10 text-orange-500" },
  stable: { text: "Stabil", className: "bg-blue-500/10 text-blue-500" },
};

export default function KarirPage() {
  const { data: session } = useSession();
  const studentName = session?.user?.name?.trim().split(/\s+/)[0] || "Mahasiswa";

  const [trend, setTrend] = useState<CareerTrend | null>(null);
  const [roles, setRoles] = useState<TrendingRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch("/api/career/trends")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setTrend(d.trend ?? null);
        setRoles(Array.isArray(d.roles) ? d.roles : []);
      })
      .catch(() => setError("Gagal memuat data tren karir."))
      .finally(() => setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 w-full mx-auto max-w-6xl pb-8">
      {/* Header */}
      <section className="rounded-xl border border-border bg-card shadow-sm p-6 md:p-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground uppercase tracking-[0.18em] mb-4">
          <TrendingUp size={13} /> Career Center
        </div>
        <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
          Persiapkan karirmu, {studentName}.
        </h1>
        <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-2xl leading-relaxed">
          Eksplorasi profesi paling dicari 2026 — dari Data Analyst, AI Engineer,
          Cybersecurity, hingga Web3/Blockchain — langsung dalam satu ruang EduSparq.
        </p>
      </section>

      {/* Quick Actions */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {FEATURES.map((f) => {
          const Icon = f.icon;
          return (
            <Link
              key={f.href}
              href={f.href}
              className="group bg-card border border-border rounded-xl shadow-sm p-5 hover:-translate-y-1 hover:shadow-md transition-all flex items-start gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${f.color}`}>
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1">
                  {f.title}
                  <ArrowRight size={14} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {f.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </section>

      {/* Market Trend Card */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2 mb-4">
            <Lightbulb size={20} /> Tren Karir 2026
          </h2>
          {loading ? (
            <div className="space-y-3">
              <div className="skeleton h-4 w-3/4 bg-muted/50 rounded" />
              <div className="skeleton h-4 w-1/2 bg-muted/50 rounded" />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle size={16} /> {error}
            </div>
          ) : trend ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground leading-relaxed">
                {trend.salaryNote}
              </p>
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                  Sektor Paling Banyak Merekrut
                </h3>
                <div className="flex flex-wrap gap-2">
                  {trend.topSectors.map((s) => (
                    <span
                      key={s}
                      className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-muted text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                Sumber: {trend.sourceNote}
              </p>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2 mb-4">
            <Wallet size={20} /> Gaji Entry-Level
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed mb-4">
            Kisaran gaji populer untuk fresh graduate:
          </p>
          <div className="space-y-3">
            {[
              { role: "AI / ML Engineer", range: "Rp 15–30 jt" },
              { role: "Cybersecurity", range: "Rp 12–20 jt" },
              { role: "Cloud Engineer", range: "Rp 10–22 jt" },
              { role: "Data Analyst", range: "Rp 8–12 jt" },
              { role: "Software Engineer", range: "Rp 7–12 jt" },
              { role: "Digital Marketing", range: "Rp 6–15 jt" },
            ].map((r) => (
              <div key={r.role} className="flex items-center justify-between text-sm">
                <span className="text-foreground font-medium">{r.role}</span>
                <span className="font-bold text-primary tabular-nums">{r.range}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/70 mt-4">
            Estimasi pasar; bervariasi per kota & perusahaan.
          </p>
        </div>
      </section>

      {/* Trending Roles */}
      <section className="rounded-xl border border-border bg-card shadow-sm p-5 md:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Search size={20} /> Profesi Paling Dicari
          </h2>
          <Link
            href="/karir/lowongan"
            className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1 transition-colors"
          >
            Lihat lowongan <ArrowRight size={12} />
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="skeleton h-32 rounded-xl bg-muted/50" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roles.slice(0, 6).map((role) => (
              <div
                key={role.id}
                className="p-4 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-sm text-foreground">{role.title}</h3>
                    <p className="text-xs text-muted-foreground mt-0.5">{role.category}</p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      DEMAND_LABEL[role.demand].className
                    }`}
                  >
                    {DEMAND_LABEL[role.demand].text}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-2">
                  {role.description}
                </p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {role.skills.slice(0, 4).map((s) => (
                    <span
                      key={s}
                      className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
                <div className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary">
                  <Award size={13} />
                  {role.entrySalary}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* CTA */}
      <section className="rounded-xl border border-primary/20 bg-primary/5 p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-black text-foreground text-base">Belum yakin mau ke arah mana?</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Coba Skill Gap Analysis untuk tahu jurusan & skillmu cocok di karir apa.
          </p>
        </div>
        <Link
          href="/karir/skill-gap"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors shrink-0"
        >
          <Target size={16} /> Analisis Sekarang
        </Link>
      </section>
    </div>
  );
}
