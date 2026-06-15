"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3,
  TrendingUp,
  MessageSquare,
  FileText,
  CalendarCheck,
  Layers,
  BookMarked,
  GraduationCap,
} from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

interface Analytics {
  totals: {
    chats: number;
    documents: number;
    deadlines: number;
    flashcards: number;
    citations: number;
    courses: number;
  };
  deadlinesByStatus: { pending: number; done: number; overdue: number };
  chatsByMode: { socratic: number; helper: number; research: number };
  recentActivityDays: { date: string; count: number }[];
}

// Empty analytics shape — shown as honest zeros for brand-new accounts or when
// the user is not signed in. No fabricated sample numbers.
const EMPTY: Analytics = {
  totals: { chats: 0, documents: 0, deadlines: 0, flashcards: 0, citations: 0, courses: 0 },
  deadlinesByStatus: { pending: 0, done: 0, overdue: 0 },
  chatsByMode: { socratic: 0, helper: 0, research: 0 },
  recentActivityDays: [],
};

const DONUT_COLORS = ["hsl(var(--primary))", "#8b5cf6", "#06b6d4"];

function buildLinePath(points: { x: number; y: number }[]) {
  if (points.length === 0) return "";
  return points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
}

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEmpty, setIsEmpty] = useState(false);

  useEffect(() => {
    let active = true;
    fetch("/api/analytics")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: Analytics) => {
        if (!active) return;
        const total = Object.values(d.totals || {}).reduce((a, b) => a + b, 0);
        setData(d);
        setIsEmpty(!d.totals || total === 0);
      })
      .catch(() => {
        if (!active) return;
        setData(EMPTY);
        setIsEmpty(true);
      })
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const d = data ?? EMPTY;

  const metrics = [
    { label: "Sesi Tutor AI", value: d.totals.chats, icon: MessageSquare, accent: "text-primary" },
    { label: "Dokumen Tersimpan", value: d.totals.documents, icon: FileText, accent: "text-teal-500" },
    { label: "Tenggat Terlacak", value: d.totals.deadlines, icon: CalendarCheck, accent: "text-amber-500" },
    { label: "Flashcard Dibuat", value: d.totals.flashcards, icon: Layers, accent: "text-emerald-500" },
    { label: "Sitasi Tersusun", value: d.totals.citations, icon: BookMarked, accent: "text-violet-500" },
    { label: "Mata Kuliah Aktif", value: d.totals.courses, icon: GraduationCap, accent: "text-pink-500" },
  ];

  // Weekly activity chart geometry.
  const activity = d.recentActivityDays;
  const maxCount = Math.max(1, ...activity.map((a) => a.count));
  const W = 500;
  const H = 200;
  const padX = 40;
  const padTop = 20;
  const padBottom = 30;
  const innerW = W - padX - 20;
  const innerH = H - padTop - padBottom;
  const points = activity.map((a, i) => ({
    x: padX + (activity.length === 1 ? innerW / 2 : (i / (activity.length - 1)) * innerW),
    y: padTop + innerH - (a.count / maxCount) * innerH,
    count: a.count,
    label: a.date
      ? new Date(a.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short" })
      : ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"][i] || "",
  }));
  const linePath = buildLinePath(points);
  const areaPath = points.length
    ? `${linePath} L ${points[points.length - 1].x} ${padTop + innerH} L ${points[0].x} ${padTop + innerH} Z`
    : "";

  // Feature-usage donut from chat modes.
  const modeData = [
    { label: "Tutor Socratic", value: d.chatsByMode.socratic },
    { label: "Asisten Belajar", value: d.chatsByMode.helper },
    { label: "Riset Akademik", value: d.chatsByMode.research },
  ];
  const modeTotal = modeData.reduce((a, b) => a + b.value, 0);
  let cumulative = 0;
  const donutSegments = modeData.map((m, i) => {
    const pct = modeTotal > 0 ? (m.value / modeTotal) * 100 : 0;
    const seg = {
      ...m,
      pct,
      color: DONUT_COLORS[i],
      dash: `${pct} ${100 - pct}`,
      offset: -cumulative,
    };
    cumulative += pct;
    return seg;
  });

  const deadlineStats = [
    { label: "Berlangsung", value: d.deadlinesByStatus.pending, color: "bg-primary" },
    { label: "Selesai", value: d.deadlinesByStatus.done, color: "bg-emerald-500" },
    { label: "Terlewat", value: d.deadlinesByStatus.overdue, color: "bg-destructive" },
  ];
  const deadlineTotal = deadlineStats.reduce((a, b) => a + b.value, 0);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
            <BarChart3 size={14} /> Statistik Belajar
          </div>
          <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-black tracking-tight text-gradient">Analitik Akademik</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Ringkasan aktivitas belajar Anda di EduSparq, dihimpun dari data Anda sendiri.
          </p>
          {isEmpty && !loading && (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground bg-background/70 border border-border px-2.5 py-1 rounded-full">
              Belum ada aktivitas. Mulai gunakan Tutor AI, unggah dokumen, atau buat flashcard untuk melihat statistik nyata Anda di sini.
            </p>
          )}
        </div>
      </motion.div>

      {/* Metrics Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-3xl p-5 space-y-3">
                <div className="skeleton h-5 w-5 rounded-lg" />
                <div className="skeleton h-7 w-12 rounded-lg" />
                <div className="skeleton h-3 w-20 rounded" />
              </div>
            ))
          : metrics.map((m, idx) => (
              <div
                key={idx}
                className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-2 hover-lift hover:border-primary/20 transition-all"
              >
                <m.icon size={18} className={m.accent} />
                <span className="font-display tracking-tight text-2xl font-black text-foreground block leading-none">{m.value}</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">
                  {m.label}
                </span>
              </div>
            ))}
      </motion.div>

      {/* Charts section */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Weekly Activity Line Chart */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-foreground">Aktivitas Tujuh Hari Terakhir</h2>
            <span className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-1 rounded-md">
              Interaksi/Hari
            </span>
          </div>

          {loading ? (
            <div className="skeleton h-48 w-full rounded-2xl" />
          ) : (
            <div className="relative h-48 w-full">
              <svg className="w-full h-full" viewBox="0 0 500 200" fill="none" xmlns="http://www.w3.org/2000/svg">
                {[padTop, padTop + innerH / 3, padTop + (innerH * 2) / 3, padTop + innerH].map((y, i) => (
                  <line key={i} x1={padX} y1={y} x2={W - 20} y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
                ))}

                <defs>
                  <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.35" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>

                {areaPath && <path d={areaPath} fill="url(#chartGradient)" />}
                {linePath && (
                  <path d={linePath} stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                )}

                {points.map((p, i) => (
                  <g key={i}>
                    <circle cx={p.x} cy={p.y} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" />
                    <text x={p.x} y={H - 8} fill="currentColor" className="text-muted-foreground text-[10px]" textAnchor="middle">
                      {p.label}
                    </text>
                  </g>
                ))}
              </svg>
            </div>
          )}
        </div>

        {/* Feature Usage Donut Chart */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-foreground">Distribusi Mode Tutor AI</h2>
            <span className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-1 rounded-md">
              Per Sesi
            </span>
          </div>

          {loading ? (
            <div className="skeleton h-48 w-full rounded-2xl" />
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-48">
              <div className="relative w-36 h-36 shrink-0">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3.5" />
                  {modeTotal > 0 &&
                    donutSegments.map((s, i) => (
                      <circle
                        key={i}
                        cx="18"
                        cy="18"
                        r="15.915"
                        fill="none"
                        stroke={s.color}
                        strokeWidth="3.5"
                        strokeDasharray={s.dash}
                        strokeDashoffset={s.offset}
                      />
                    ))}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-lg font-black text-foreground">{modeTotal}</span>
                  <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Sesi</span>
                </div>
              </div>

              <div className="grid gap-2 text-xs w-full">
                {donutSegments.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                      <span className="text-muted-foreground font-medium truncate">{item.label}</span>
                    </div>
                    <span className="font-bold text-foreground shrink-0">{Math.round(item.pct)}%</span>
                  </div>
                ))}
                {modeTotal === 0 && (
                  <p className="text-muted-foreground text-center py-4">Belum ada sesi tutor.</p>
                )}
              </div>
            </div>
          )}
        </div>

      </motion.div>

      {/* Deadline status breakdown */}
      <motion.div variants={itemVariants} className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-2">
          <CalendarCheck size={16} className="text-primary" />
          <h2 className="text-sm font-bold text-foreground">Status Tenggat Waktu</h2>
        </div>

        {loading ? (
          <div className="skeleton h-3 w-full rounded-full" />
        ) : (
          <>
            <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
              {deadlineTotal > 0 &&
                deadlineStats.map((s, i) => (
                  <div
                    key={i}
                    className={`${s.color} h-full transition-all`}
                    style={{ width: `${(s.value / deadlineTotal) * 100}%` }}
                  />
                ))}
            </div>
            <div className="grid grid-cols-3 gap-3">
              {deadlineStats.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${s.color}`} />
                  <div className="min-w-0">
                    <span className="text-sm font-black text-foreground block leading-none">{s.value}</span>
                    <span className="text-[10px] text-muted-foreground font-semibold">{s.label}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </motion.div>

      {/* Insight */}
      <motion.div variants={itemVariants} className="bg-gradient-to-br from-primary to-violet-600 rounded-3xl p-6 text-white shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
        <h2 className="text-sm font-bold flex items-center gap-2">
          <TrendingUp size={16} />
          Wawasan Singkat
        </h2>
        <p className="text-sm leading-relaxed text-white/90 mt-3 max-w-2xl">
          {d.totals.chats > 0
            ? `Anda telah melakukan ${d.totals.chats} sesi belajar bersama Tutor AI dan menyusun ${d.totals.flashcards} flashcard. Pertahankan ritme ini menjelang ujian.`
            : "Mulailah dengan bertanya kepada Tutor AI atau menyusun flashcard pertama Anda untuk membangun rekam jejak belajar."}
        </p>
      </motion.div>

    </motion.div>
  );
}
