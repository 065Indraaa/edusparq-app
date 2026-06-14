"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { AcademicCalendarWidget } from "@/components/academic-calendar-widget";
import { RecommendationsWidget } from "@/components/recommendations-widget";
import {
  Sparkles,
  CalendarDays,
  BookOpen,
  ChevronRight,
  Info,
  Users,
  PenTool,
  Bot,
  GraduationCap,
  Clock
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
    { name: "Tutor Socratic", desc: "Pahami konsep yang rumit melalui bimbingan kritis.", icon: Bot, href: "/tutor" },
    { name: "Asisten Menulis", desc: "Susun kerangka, parafrasekan, dan kelola sitasi akademik.", icon: PenTool, href: "/writing" },
    { name: "Persiapan Ujian", desc: "Prediksi soal UTS/UAS serta latihan kartu ingatan.", icon: GraduationCap, href: "/exams" },
    { name: "Kolaborasi", desc: "Ruang kerja kelompok dan penugasan secara visual.", icon: Users, href: "/collab" },
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
      className="space-y-8 flex-1 flex flex-col justify-between"
    >
      
      {/* Welcome Banner */}
      <motion.section variants={item} className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 md:p-10 shadow-sm">
        <div className="absolute top-0 right-0 w-80 h-80 bg-primary/5 rounded-full blur-3xl -z-10" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
          <div className="space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={14} />
              <span>Mode Semester Aktif</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight text-foreground">
              {timeGreeting}, {firstName}.
            </h1>
            <p className="text-muted-foreground text-sm md:text-base leading-relaxed">
              Selamat datang kembali di ruang kerja akademik Anda.{userSemester ? ` Saat ini Anda berada pada semester aktif.` : " Mari selesaikan tenggat minggu ini secara efisien."}
            </p>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-4 p-5 rounded-2xl bg-muted/50 border border-border backdrop-blur-sm shrink-0 min-w-[280px]">
            {stats.map((stat, idx) => (
              <div key={idx} className="flex flex-col">
                <span className="text-muted-foreground text-[11px] uppercase font-bold tracking-wider mb-1">{stat.label}</span>
                {loading ? (
                  <span className="skeleton h-7 w-14 rounded-md" />
                ) : (
                  <span className="text-2xl font-black text-foreground">{stat.value}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </motion.section>

      <AcademicCalendarWidget />

      <RecommendationsWidget />

      {todayClasses.length > 0 && (
        <motion.section variants={item} className="rounded-3xl border border-primary/20 bg-primary/5 p-5 md:p-6 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <Clock size={18} className="text-primary" /> Kelas Hari Ini
            </h2>
            <Link href="/jadwal" className="text-xs font-semibold text-primary hover:underline">Lihat jadwal</Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {todayClasses.map((c, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-card border border-border">
                <div className="text-center shrink-0 w-14">
                  <span className="block text-sm font-black text-foreground leading-tight">{c.jamMulai}</span>
                  <span className="block text-[10px] text-muted-foreground">{c.jamSelesai}</span>
                </div>
                <div className="w-px self-stretch bg-border" />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{c.courseName}</p>
                  {c.ruang && <p className="text-[11px] text-muted-foreground">{c.ruang}</p>}
                </div>
              </div>
            ))}
          </div>
        </motion.section>
      )}

      {/* Main Grid: Left Timeline/Progress & Right Side panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left column (Timeline & Subject Progress) */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Semester Progress Timeline */}
          <motion.div variants={item} className="bg-card rounded-3xl border border-border p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center">
                <CalendarDays size={18} className="mr-2 text-primary" />
                {userSemester ? `Lini Masa ${userSemester}` : "Lini Masa Semester Ini"}
              </h2>
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">Ganjil 2026/2027</span>
            </div>
            
            {/* Visual Timeline Bar */}
            <div className="space-y-3">
              <div className="flex justify-between text-xs text-muted-foreground font-medium">
                <span>Minggu 1</span>
                <span className="text-primary font-bold">Minggu 8 (UTS)</span>
                <span>Minggu 16</span>
              </div>
              <div className="h-3 w-full bg-muted rounded-full overflow-hidden relative">
                <div className="absolute top-0 left-0 h-full w-1/2 bg-primary rounded-full" />
                <div className="absolute left-1/2 top-1/2 -translate-y-1/2 w-4 h-4 bg-background rounded-full border-[3px] border-primary shadow-sm transform -translate-x-1/2" />
              </div>
              <div className="text-xs text-muted-foreground leading-relaxed pt-2 flex items-start bg-muted/30 p-3 rounded-xl">
                <Info size={16} className="mr-2 mt-0.5 text-primary shrink-0" />
                 <span>{`Anda memiliki ${stats[2]?.value || 0} mata kuliah aktif dan ${stats[3]?.value || 0} dokumen tersimpan. Gunakan Tutor AI untuk memaksimalkan persiapan ujian.`}</span>
              </div>
            </div>
          </motion.div>

          {/* Active Course Progress */}
          <motion.div variants={item} className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-base font-bold tracking-tight text-foreground flex items-center">
                <BookOpen size={18} className="mr-2 text-primary" />
                Mata Kuliah Aktif
              </h2>
              <Link href="/workspace" className="text-xs text-primary hover:text-primary/80 font-semibold inline-flex items-center transition-colors">
                Lihat semua ruang kerja
                <ChevronRight size={14} className="ml-0.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {classProgress.length === 0 ? (
                <div className="col-span-2 p-10 text-center text-muted-foreground text-sm bg-muted/30 rounded-2xl border border-dashed border-border">
                  <BookOpen size={24} className="mx-auto mb-3 opacity-40" />
                  <p className="font-semibold">Belum ada mata kuliah.</p>
                  <p className="text-xs mt-1">Tambahkan mata kuliah melalui halaman Profil untuk memulai.</p>
                </div>
              ) : classProgress.map((item, idx) => (
                <div key={idx} className="bg-card border border-border hover:border-primary/30 rounded-2xl p-5 flex flex-col justify-between space-y-5 shadow-sm group hover-lift">
                  <div>
                    <div className="flex justify-between items-start gap-3">
                      <h3 className="font-semibold text-sm text-foreground leading-snug line-clamp-2">{item.name}</h3>
                      <span className="text-xs text-primary font-bold shrink-0 bg-primary/10 px-2 py-0.5 rounded-md">{item.progress}%</span>
                    </div>
                    <span className="text-xs text-muted-foreground block mt-1.5 font-medium">{item.instructor}</span>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all duration-500 ease-out" style={{ width: `${item.progress}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="inline-flex items-center font-medium text-muted-foreground">
                        <CalendarDays size={12} className="mr-1.5 opacity-70" />
                        {item.deadline}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Right column (Deadlines & Intelligent Notification Feed) */}
        <div className="space-y-8">
          
          {/* Upcoming Deadlines */}
          <motion.div variants={item} className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold tracking-tight text-foreground">Tenggat Terdekat</h2>
              <Link href="/deadlines" className="p-1.5 bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-colors">
                <ChevronRight size={16} />
              </Link>
            </div>

            <div className="space-y-3">
              {loading
                ? [0, 1, 2].map((i) => (
                    <div key={i} className="p-4 rounded-2xl bg-muted/30 border border-transparent space-y-2">
                      <span className="skeleton block h-2.5 w-24 rounded" />
                      <span className="skeleton block h-4 w-40 rounded" />
                      <span className="skeleton block h-3 w-32 rounded" />
                    </div>
                  ))
                : deadlines.length === 0 ? (
                  <div className="p-4 rounded-2xl bg-muted/30 border border-dashed border-border text-center">
                    <p className="text-xs text-muted-foreground">Belum ada tenggat. Tambahkan di halaman Tugas &amp; Tenggat.</p>
                  </div>
                ) : (
                  deadlines.map((dl, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-muted/30 border border-transparent hover:border-border transition-all flex items-start justify-between gap-3 group">
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider block">{dl.course}</span>
                    <span className="font-semibold text-sm text-foreground block leading-tight">{dl.title}</span>
                    <span className="text-xs text-muted-foreground font-medium block flex items-center">
                       {dl.date}
                    </span>
                  </div>
                  <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-md uppercase shrink-0 ${
                    dl.daysLeft <= 1
                      ? "bg-destructive/10 text-destructive border border-destructive/20"
                      : "bg-warning/10 text-warning border border-warning/20"
                  }`}>
                    {dueLabel(dl.daysLeft)}
                  </span>
                </div>
              )))}
            </div>
          </motion.div>

          {/* Contextual Smart Alert System */}
          <motion.div variants={item} className="rounded-3xl border border-primary/20 bg-primary/5 p-6 space-y-4 relative overflow-hidden shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wide text-primary flex items-center">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse mr-2" />
                Smart Assist
              </span>
            </div>
            
            <div className="space-y-3">
              <p className="text-sm text-foreground leading-relaxed font-medium">
                {deadlines.length > 0
                  ? `Tenggat "${deadlines[0].title}" dari ${deadlines[0].course} pada ${deadlines[0].date}. Perlu bantuan untuk mempersiapkan materi?`
                  : "Tambahkan tenggat tugas dan unggah materi kuliah untuk mendapatkan rekomendasi belajar yang personal."}
              </p>
              <div className="flex flex-wrap gap-2 pt-2">
                <Link href="/writing" className="px-3.5 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold rounded-xl text-xs transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm min-h-[44px]">
                  <PenTool size={14} />
                  Bantu menulis
                </Link>
                <Link href="/tutor" className="px-3.5 py-2 bg-background hover:bg-muted text-foreground font-semibold rounded-xl text-xs border border-border transition-colors cursor-pointer inline-flex items-center gap-1.5 shadow-sm min-h-[44px]">
                  <Bot size={14} />
                  Tutor Socratic
                </Link>
              </div>
            </div>
          </motion.div>
        </div>

      </div>

      {/* Quick Action Navigation Grid */}
      <motion.section variants={item} className="space-y-4 pt-4">
        <h2 className="text-base font-bold tracking-tight text-foreground px-1">Akses Cepat</h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {quickFeatures.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <Link
                key={idx}
                href={feat.href}
                className="group bg-card border border-border hover:border-primary/40 rounded-3xl p-6 flex flex-col justify-between h-40 hover:shadow-md hover-lift"
              >
                <div className="bg-primary/10 text-primary w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-110">
                  <Icon size={24} strokeWidth={2.5} />
                </div>
                <div className="space-y-1.5 mt-4">
                  <h3 className="font-bold text-sm text-foreground flex items-center justify-between">
                    {feat.name}
                    <ChevronRight size={16} className="text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{feat.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </motion.section>

    </motion.div>
  );
}
