"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { AcademicCalendarWidget } from "@/components/academic-calendar-widget";
import { RecommendationsWidget } from "@/components/recommendations-widget";
import {
  CalendarDays,
  BookOpen,
  ChevronRight,
  Info,
  Users,
  PenTool,
  Bot,
  GraduationCap,
  Clock,
  Sparkles
} from "lucide-react";

type ApiDeadline = {
  _id: string;
  courseName: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  status?: string;
};

type DeadlineView = {
  title: string;
  course: string;
  date: string;
  daysLeft: number;
};

type ApiCourse = {
  _id: string;
  name: string;
  instructor?: string;
  progress?: number;
  semester?: string;
  grade?: string;
  credits?: number;
};

type CourseProgress = {
  name: string;
  progress: number;
  instructor: string;
  deadline: string;
};

export default function DashboardPage() {
  const { data: session } = useSession();

  // Sample/fallback stats — used when not logged in or fetch fails/empty.
  const fallbackStats = [
    { label: "IPK Kumulatif", value: "-" },
    { label: "SKS Diambil", value: "0" },
    { label: "Mata Kuliah", value: "0" },
    { label: "Dokumen", value: "0" },
  ];

  // No fabricated deadlines. When logged in we only ever show the user's real
  // tenggat (or an empty state) — keep this empty so nothing mock leaks in.
  const fallbackDeadlines: DeadlineView[] = [];

  const [stats, setStats] = useState(fallbackStats);
  const [deadlines, setDeadlines] = useState<DeadlineView[]>(fallbackDeadlines);
  const [loading, setLoading] = useState(false);
  const [classProgress, setClassProgress] = useState<CourseProgress[]>([]);
  const [userSemester, setUserSemester] = useState<string>("");
  const [todayClasses, setTodayClasses] = useState<{ courseName: string; jamMulai: string; jamSelesai: string; ruang: string }[]>([]);

  // Adaptive greeting — computed after mount to avoid hydration mismatch.
  const [timeGreeting, setTimeGreeting] = useState("Halo");
  const firstName =
    session?.user?.name?.trim().split(/\s+/)[0] || "Mahasiswa";

  useEffect(() => {
    const h = new Date().getHours();
    if (h >= 5 && h < 11) setTimeGreeting("Selamat pagi");
    else if (h >= 11 && h < 15) setTimeGreeting("Selamat siang");
    else if (h >= 15 && h < 18) setTimeGreeting("Selamat sore");
    else setTimeGreeting("Selamat malam");
  }, []);

  // Fetch real profile + deadlines on mount when a session exists.
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;

    const formatDate = (iso: string, time?: string) => {
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      const months = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
        "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
      const base = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
      return time ? `${base}, ${time} WIB` : base;
    };

    const run = async () => {
      setLoading(true);
      try {
        const [profileRes, deadlinesRes, coursesRes] = await Promise.all([
          fetch("/api/user/profile").catch(() => null),
          fetch("/api/deadlines").catch(() => null),
          fetch("/api/courses").catch(() => null),
        ]);

        // --- Stats from profile ---
        if (profileRes?.ok) {
          const profile = await profileRes.json().catch(() => null);
          const s = profile?.stats;
          if (s) {
            if (!cancelled) {
              setStats([
                { label: "IPK Kumulatif", value: s.ipk !== null && s.ipk !== undefined ? Number(s.ipk).toFixed(2) : "-" },
                { label: "SKS Diambil", value: String(s.sks ?? 0) },
                { label: "Mata Kuliah", value: String(s.courseCount ?? 0) },
                { label: "Dokumen", value: String(s.documentCount ?? 0) },
              ]);
              if (profile?.user?.semester) setUserSemester(`Semester ${profile.user.semester}`);
            }
          }
        }

        // --- Deadlines panel ---
        if (deadlinesRes?.ok) {
          const raw = await deadlinesRes.json().catch(() => null);
          if (Array.isArray(raw) && raw.length > 0) {
            const now = new Date();
            const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
            const view: DeadlineView[] = (raw as ApiDeadline[])
              .filter((d) => d?.dueDate)
              .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
              .slice(0, 4)
              .map((d) => {
                const due = new Date(d.dueDate);
                const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
                const daysLeft = Math.ceil((dueDay - startOfToday) / 86400000);
                return {
                  title: d.title,
                  course: d.courseName,
                  date: formatDate(d.dueDate, d.dueTime),
                  daysLeft,
                };
              });
            if (!cancelled && view.length > 0) setDeadlines(view);
          }
        }

        // --- Course progress from real courses ---
        if (coursesRes?.ok) {
          const rawCourses = await coursesRes.json().catch(() => null);
          if (Array.isArray(rawCourses) && rawCourses.length > 0 && !cancelled) {
            const mapped: CourseProgress[] = (rawCourses as ApiCourse[]).slice(0, 4).map((c) => ({
              name: c.name,
              progress: typeof c.progress === "number" ? c.progress : 0,
              instructor: c.instructor || "Dosen",
              deadline: c.grade ? `Nilai: ${c.grade}` : "Lihat tenggat",
            }));
            setClassProgress(mapped);
          }
        }
      } catch {
        // Swallow — fallbacks already in place.
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // Today's class schedule for the "Kelas Hari Ini" widget.
  useEffect(() => {
    if (!session?.user) return;
    let cancelled = false;
    fetch("/api/schedule")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d || !Array.isArray(d.items)) return;
        const js = new Date().getDay();
        const today = js === 0 ? 7 : js;
        setTodayClasses(
          d.items
            .filter((i: { hari?: number }) => i.hari === today)
            .map((i: { courseName?: string; jamMulai?: string; jamSelesai?: string; ruang?: string }) => ({
              courseName: i.courseName || "",
              jamMulai: i.jamMulai || "",
              jamSelesai: i.jamSelesai || "",
              ruang: i.ruang || "",
            }))
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [session?.user]);

  // Render a "days left" badge label from daysLeft.
  const dueLabel = (daysLeft: number) =>
    daysLeft < 0 ? "Terlambat" : daysLeft === 0 ? "Hari ini" : `H-${daysLeft}`;


  const quickFeatures = [
    { name: "Tutor", desc: "Bahas konsep sulit berdasarkan mata kuliah yang sedang kamu ambil.", icon: Bot, href: "/tutor" },
    { name: "Menulis", desc: "Susun dokumen akademik, perbaiki paragraf, dan kelola sitasi.", icon: PenTool, href: "/writing" },
    { name: "Latihan Ujian", desc: "Buat soal latihan, jawab esai, lalu lihat penilaiannya.", icon: GraduationCap, href: "/exams" },
    { name: "Kelompok", desc: "Catat dokumen bersama, ulasan anggota, dan progres tugas kelompok.", icon: Users, href: "/collab" },
  ];

  // Framer motion variants
  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const item = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div 
      variants={container} 
      initial="hidden" 
      animate="show" 
      className="space-y-5 flex-1 flex flex-col justify-between w-full mx-auto max-w-full"
    >
      {/* Top Welcome Banner (Spans Full Width on Desktop) */}
      <motion.section variants={item} className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-sm flex flex-col md:flex-row items-center justify-between min-h-[180px]">
        {/* Background Accent */}
        <div className="absolute -right-10 -top-10 opacity-[0.03] pointer-events-none hidden md:block">
          <Sparkles size={300} className="text-foreground" />
        </div>
        
        <div className="p-6 md:p-7 z-10 flex-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground uppercase tracking-[0.18em] mb-4">
            <Clock size={13} /> Dashboard Akademik
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground leading-tight">
            {timeGreeting}, {firstName}.
          </h1>
          <p className="text-muted-foreground text-sm md:text-base mt-3 max-w-xl leading-relaxed">
            {userSemester ? userSemester + '. ' : ''}Hari ini adalah hari yang baik untuk merangkum catatan, memeriksa tenggat tugas, atau bertanya pada Tutor AI.
          </p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link href="/tutor" className="px-6 py-3 bg-foreground hover:bg-foreground/90 text-background font-semibold rounded-2xl text-sm transition-transform hover:scale-[1.02] inline-flex items-center gap-2 shadow-sm">
              <Bot size={18} /> Chat Tutor AI
            </Link>
            <Link href="/workspace" className="px-6 py-3 bg-card hover:bg-muted text-foreground font-semibold rounded-2xl text-sm transition-colors border border-border inline-flex items-center gap-2 shadow-sm">
              <BookOpen size={18} /> Buka Ruang Kerja
            </Link>
          </div>
        </div>

        {/* Small Daily Quote/Tip Card on the right of banner */}
        <div className="hidden lg:flex flex-col p-5 z-10 w-[300px] shrink-0 border-l border-border bg-muted/20 h-full justify-center">
          <GraduationCap size={24} className="text-muted-foreground mb-3 opacity-50" />
          <p className="text-sm font-medium text-foreground italic leading-relaxed">
            "Konsistensi mengalahkan intensitas. Satu halaman hari ini lebih baik dari sepuluh halaman esok hari."
          </p>
        </div>
      </motion.section>

      {/* Main Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
        
        {/* Statistics (4 mini blocks) */}
        <motion.div variants={item} className="col-span-1 md:col-span-3 lg:col-span-2 grid grid-cols-2 gap-4">
          {stats.map((stat, idx) => {
            const meta = [GraduationCap, BookOpen, CalendarDays, PenTool][idx] || BookOpen;
            const Icon = meta;
            return (
              <div key={idx} className="rounded-2xl border border-border bg-card p-6 shadow-sm flex flex-col justify-center items-center text-center hover:bg-muted/30 transition-colors">
                <div className="w-12 h-12 rounded-2xl bg-muted text-foreground flex items-center justify-center mb-4">
                  <Icon size={22} strokeWidth={2} />
                </div>
                <div>
                  {loading ? (
                    <span className="skeleton h-10 w-20 rounded-md block mb-1 mx-auto" />
                  ) : (
                    <span className="text-4xl font-black text-foreground block leading-none tracking-tight mb-2">{stat.value}</span>
                  )}
                  <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest block">{stat.label}</span>
                </div>
              </div>
            );
          })}
        </motion.div>

        {/* Upcoming Deadlines Bento */}
        <motion.div variants={item} className="col-span-1 md:col-span-3 lg:col-span-2 rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <CalendarDays size={20} /> Tenggat Terdekat
            </h2>
            <Link href="/deadlines" className="p-2 bg-muted rounded-xl text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight size={18} />
            </Link>
          </div>
          <div className="space-y-4 flex-1 overflow-y-auto pr-2 no-scrollbar">
            {loading ? [0, 1].map((i) => (
              <div key={i} className="p-5 rounded-2xl bg-muted/50 border border-transparent space-y-3">
                <span className="skeleton block h-3 w-32 rounded" />
                <span className="skeleton block h-5 w-48 rounded" />
              </div>
            )) : deadlines.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-2xl">
                <CalendarDays size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground font-medium">Hore! Tidak ada tenggat tugas terdekat.</p>
              </div>
            ) : deadlines.map((dl, idx) => (
              <div key={idx} className="p-4 rounded-2xl border border-border bg-background hover:bg-muted/30 transition-colors flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block truncate mb-1">{dl.course}</span>
                  <span className="font-bold text-sm text-foreground block leading-tight truncate">{dl.title}</span>
                </div>
                <span className={`text-[10px] font-extrabold px-3 py-1.5 rounded-xl uppercase shrink-0 ${
                  dl.daysLeft <= 1
                    ? "bg-foreground text-background"
                    : "bg-muted text-muted-foreground"
                }`}>
                  {dueLabel(dl.daysLeft)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Classes Today */}
        <motion.div variants={item} className="col-span-1 md:col-span-3 lg:col-span-2 rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock size={20} /> Kelas Hari Ini
            </h2>
            <Link href="/jadwal" className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center transition-colors">
              Lihat jadwal lengkap
            </Link>
          </div>
          {todayClasses.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {todayClasses.map((c, i) => (
                <div key={i} className="flex items-stretch gap-4 p-4 rounded-2xl bg-muted/40 border border-border">
                  <div className="flex flex-col items-center justify-center min-w-[4rem] text-center">
                    <span className="block text-lg font-black text-foreground leading-none">{c.jamMulai}</span>
                    <span className="block text-[10px] text-muted-foreground font-bold mt-1">{c.jamSelesai}</span>
                  </div>
                  <div className="w-[2px] bg-border rounded-full" />
                  <div className="flex flex-col justify-center min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">{c.courseName}</p>
                    {c.ruang && <p className="text-xs text-muted-foreground mt-1 font-medium flex items-center gap-1.5"><Info size={12}/> {c.ruang}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
             <div className="flex items-center p-6 bg-muted/30 rounded-2xl border border-border">
               <div className="w-12 h-12 rounded-xl bg-background flex items-center justify-center mr-4 shrink-0 shadow-sm">
                 <Bot size={24} className="text-muted-foreground" />
               </div>
               <div>
                 <h3 className="text-sm font-bold text-foreground">Jadwal Kosong</h3>
                 <p className="text-xs text-muted-foreground mt-1 max-w-sm leading-relaxed">Tidak ada jadwal hari ini. Mungkin saat yang tepat untuk mereview materi kuliah sebelumnya.</p>
               </div>
             </div>
          )}
        </motion.div>

        {/* Quick Access Menu / Widgets */}
        <motion.div variants={item} className="col-span-1 md:col-span-3 lg:col-span-2 grid grid-cols-2 gap-4">
           {quickFeatures.map((feat, idx) => {
             const Icon = feat.icon;
             return (
               <Link
                 key={idx}
                 href={feat.href}
                 className="group bg-card border border-border hover:bg-muted/20 rounded-2xl p-5 flex flex-col justify-center items-center text-center transition-all min-h-[140px] shadow-sm hover:-translate-y-1"
               >
                 <div className="bg-background shadow-sm border border-border text-foreground w-12 h-12 rounded-[1.25rem] flex items-center justify-center transition-transform group-hover:scale-110 mb-4">
                   <Icon size={24} strokeWidth={2} />
                 </div>
                 <h3 className="font-bold text-sm text-foreground">{feat.name}</h3>
                 <p className="text-[10px] text-muted-foreground mt-1">Akses cepat</p>
               </Link>
             );
           })}
        </motion.div>

      </div>
    </motion.div>
  );
}
