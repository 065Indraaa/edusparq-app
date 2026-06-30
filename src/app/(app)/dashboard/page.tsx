"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Bot,
  Upload,
  Calendar,
  BookOpen,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import WorkspaceChat from "@/components/workspace-chat";

interface ApiCourse {
  _id: string;
  name: string;
  instructor?: string;
  progress?: number;
  semester?: string;
  grade?: string;
  credits?: number;
}

interface CourseCard {
  _id: string;
  name: string;
  instructor: string;
  progress: number;
  credits: number;
}

interface ApiDeadline {
  _id: string;
  courseName: string;
  title: string;
  dueDate: string;
  dueTime?: string;
  priority?: string;
  status?: string;
}

interface DeadlineItem {
  _id: string;
  title: string;
  course: string;
  date: string;
  daysLeft: number;
  priority: "tinggi" | "sedang" | "rendah";
}

interface StudentContext {
  gpa?: number | null;
  totalCredits?: number;
  semester?: number;
}

interface ActivityItem {
  _id: string;
  type: string;
  description: string;
  timestamp: string;
}

interface ScheduleItem {
  _id: string;
  courseName: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  ruang?: string;
  dosen?: string;
}

export default function DashboardPage() {
  const { data: session } = useSession();
  const studentName =
    session?.user?.name?.trim().split(/\s+/)[0] || "Mahasiswa";

  const [courses, setCourses] = useState<CourseCard[]>([]);
  const [deadlines, setDeadlines] = useState<DeadlineItem[]>([]);
  const [studentContext, setStudentContext] = useState<StudentContext | null>(
    null,
  );
  const [recentActivity, setRecentActivity] = useState<ActivityItem[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [loading, setLoading] = useState(true);

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.08 } },
  };

  const item = {
    hidden: { opacity: 0, y: 16 },
    show: {
      opacity: 1,
      y: 0,
      transition: { type: "spring" as const, stiffness: 300, damping: 24 },
    },
  };

  const formatDate = (iso: string, time?: string) => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const months = [
      "Jan", "Feb", "Mar", "Apr", "Mei", "Jun",
      "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
    ];
    const base = `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    return time ? `${base}, ${time}` : base;
  };

  useEffect(() => {
    if (!session?.user) {
      setLoading(false);
      return;
    }
    let cancelled = false;

    const run = async () => {
      setLoading(true);
      try {
        const [coursesRes, deadlinesRes, ctxRes, scheduleRes] =
          await Promise.all([
            fetch("/api/courses").catch(() => null),
            fetch("/api/deadlines").catch(() => null),
            fetch("/api/student/context").catch(() => null),
            fetch("/api/schedule").catch(() => null),
          ]);

        if (coursesRes?.ok) {
          const raw = await coursesRes.json().catch(() => null);
          if (Array.isArray(raw) && !cancelled) {
            const mapped: CourseCard[] = (raw as ApiCourse[]).slice(0, 6).map(
              (c) => ({
                _id: c._id,
                name: c.name,
                instructor: c.instructor || "Dosen",
                progress:
                  typeof c.progress === "number" ? c.progress : 0,
                credits: c.credits ?? 0,
              }),
            );
            setCourses(mapped);
          }
        }

        if (deadlinesRes?.ok) {
          const raw = await deadlinesRes.json().catch(() => null);
          if (Array.isArray(raw) && !cancelled) {
            const now = new Date();
            const startOfToday = new Date(
              now.getFullYear(),
              now.getMonth(),
              now.getDate(),
            ).getTime();
            const mapped: DeadlineItem[] = (raw as ApiDeadline[])
              .filter((d) => d?.dueDate)
              .sort(
                (a, b) =>
                  new Date(a.dueDate).getTime() -
                  new Date(b.dueDate).getTime(),
              )
              .slice(0, 5)
              .map((d) => {
                const due = new Date(d.dueDate);
                const dueDay = new Date(
                  due.getFullYear(),
                  due.getMonth(),
                  due.getDate(),
                ).getTime();
                const daysLeft = Math.ceil(
                  (dueDay - startOfToday) / 86400000,
                );
                const p = (d.priority || "").toLowerCase();
                const priority: DeadlineItem["priority"] =
                  p === "tinggi" || p === "high"
                    ? "tinggi"
                    : p === "rendah" || p === "low"
                      ? "rendah"
                      : "sedang";
                return {
                  _id: d._id,
                  title: d.title,
                  course: d.courseName,
                  date: formatDate(d.dueDate, d.dueTime),
                  daysLeft,
                  priority,
                };
              });
            setDeadlines(mapped);
          }
        }

        if (ctxRes?.ok) {
          const ctx = await ctxRes.json().catch(() => null);
          if (ctx && !cancelled) {
            setStudentContext({
              gpa: ctx.gpa ?? ctx.stats?.ipk ?? null,
              totalCredits: ctx.totalCredits ?? ctx.stats?.sks ?? undefined,
              semester: ctx.semester ?? ctx.user?.semester ?? undefined,
            });
            const activity = Array.isArray(ctx.recentActivity)
              ? ctx.recentActivity
              : [];
            setRecentActivity(activity.slice(0, 5));
          }
        }

        if (scheduleRes?.ok) {
          const raw = await scheduleRes.json().catch(() => null);
          if (raw && !cancelled) {
            const jsDay = new Date().getDay();
            const today = jsDay === 0 ? 7 : jsDay;
            const items = Array.isArray(raw.items) ? raw.items : [];
            const todays: ScheduleItem[] = items
              .filter((s: ScheduleItem) => s.hari === today)
              .sort((a: ScheduleItem, b: ScheduleItem) =>
                a.jamMulai.localeCompare(b.jamMulai),
              );
            setSchedule(todays);
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

  const quickActions = [
    {
      title: "Tanya AI",
      desc: "Chat dengan Tutor AI untuk memahami materi.",
      icon: Bot,
      href: "/tutor",
      accent: "bg-primary/10 text-primary",
    },
    {
      title: "Upload Materi",
      desc: "Unggah catatan atau dokumen kuliah.",
      icon: Upload,
      href: "/workspace",
      accent: "bg-amber-500/10 text-amber-500",
    },
    {
      title: "Lihat Tugas",
      desc: "Pantau tenggat dan tugas mendatang.",
      icon: Calendar,
      href: "/deadlines",
      accent: "bg-blue-500/10 text-blue-500",
    },
  ];

  const priorityStyles: Record<
    DeadlineItem["priority"],
    { dot: string; badge: string }
  > = {
    tinggi: {
      dot: "bg-red-500",
      badge: "bg-red-500/10 text-red-500",
    },
    sedang: {
      dot: "bg-amber-500",
      badge: "bg-amber-500/10 text-amber-500",
    },
    rendah: {
      dot: "bg-emerald-500",
      badge: "bg-emerald-500/10 text-emerald-500",
    },
  };

  const dueLabel = (daysLeft: number) =>
    daysLeft < 0
      ? "Terlambat"
      : daysLeft === 0
        ? "Hari ini"
        : `H-${daysLeft}`;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6 w-full mx-auto max-w-6xl"
    >
      {/* Greeting Card */}
      <motion.section
        variants={item}
        className="relative overflow-hidden rounded-xl border border-border bg-card shadow-sm p-6 md:p-8"
      >
        <div className="absolute -right-8 -top-8 opacity-[0.04] pointer-events-none">
          <TrendingUp size={200} className="text-foreground" />
        </div>
        <div className="relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold bg-muted text-muted-foreground uppercase tracking-[0.18em] mb-4">
            <Clock size={13} /> Dashboard Akademik
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground leading-tight">
            Selamat datang, {studentName}.
          </h1>
          <p className="text-muted-foreground text-sm md:text-base mt-2 max-w-xl leading-relaxed">
            Mari lanjutkan belajar hari ini. Pilih salah satu aksi cepat di
            bawah untuk memulai.
          </p>
        </div>
      </motion.section>

      {/* Quick Action Cards */}
      <motion.section
        variants={item}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link
              key={action.title}
              href={action.href}
              className="group bg-card border border-border rounded-xl shadow-sm p-5 hover:-translate-y-1 hover:shadow-md transition-all flex items-start gap-4"
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${action.accent}`}
              >
                <Icon size={22} strokeWidth={2} />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-1">
                  {action.title}
                  <ArrowRight
                    size={14}
                    className="opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all"
                  />
                </h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  {action.desc}
                </p>
              </div>
            </Link>
          );
        })}
      </motion.section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Active Courses */}
        <motion.section
          variants={item}
          className="lg:col-span-2 bg-card border border-border rounded-xl shadow-sm p-5 md:p-6"
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
              <BookOpen size={20} /> Mata Kuliah Aktif
            </h2>
            <Link
              href="/courses"
              className="text-xs text-muted-foreground hover:text-foreground font-semibold inline-flex items-center gap-1 transition-colors"
            >
              Lihat semua <ArrowRight size={12} />
            </Link>
          </div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="skeleton h-24 rounded-xl bg-muted/50"
                />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center p-8 border-2 border-dashed border-border rounded-xl">
              <BookOpen
                size={32}
                className="text-muted-foreground/40 mb-3"
              />
              <p className="text-sm text-muted-foreground font-medium">
                Belum ada mata kuliah terdaftar.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {courses.map((course) => (
                <div
                  key={course._id}
                  className="p-4 rounded-xl border border-border bg-background hover:bg-muted/30 transition-colors"
                >
                  <h3 className="font-bold text-sm text-foreground truncate">
                    {course.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {course.instructor}
                  </p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${course.progress}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground tabular-nums">
                      {course.progress}%
                    </span>
                  </div>
                  {course.credits > 0 && (
                    <p className="text-[10px] text-muted-foreground mt-2">
                      {course.credits} SKS
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </motion.section>

        {/* Right Column: GPA + Deadlines */}
        <div className="space-y-4">
          {/* GPA Widget */}
          <motion.section
            variants={item}
            className="bg-card border border-border rounded-xl shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
                <TrendingUp size={18} /> IPK
              </h2>
            </div>
            <div className="flex items-end gap-2">
              {loading ? (
                <span className="skeleton h-10 w-24 rounded-md block" />
              ) : (
                <span className="text-4xl font-black text-foreground leading-none tabular-nums">
                  {studentContext?.gpa != null
                    ? Number(studentContext.gpa).toFixed(2)
                    : "-"}
                </span>
              )}
              <span className="text-xs text-muted-foreground mb-1">
                / 4.00
              </span>
            </div>
            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <BookOpen size={12} />
                {studentContext?.totalCredits ?? 0} SKS
              </span>
              {studentContext?.semester != null && (
                <span className="flex items-center gap-1">
                  <Calendar size={12} />
                  Semester {studentContext.semester}
                </span>
              )}
            </div>
          </motion.section>

          {/* Today's Schedule */}
          <motion.section
            variants={item}
            className="bg-card border border-border rounded-xl shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
                <Calendar size={18} /> Jadwal Hari Ini
              </h2>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="skeleton h-16 rounded-lg bg-muted/50"
                  />
                ))}
              </div>
            ) : schedule.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-border rounded-xl">
                <Calendar
                  size={28}
                  className="text-muted-foreground/40 mb-2"
                />
                <p className="text-xs text-muted-foreground font-medium">
                  Tidak ada kelas hari ini.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {schedule.map((s) => (
                  <div
                    key={s._id}
                    className="p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-semibold text-foreground truncate">
                      {s.courseName}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock size={11} />
                        {s.jamMulai} – {s.jamSelesai}
                      </span>
                      {s.ruang && (
                        <span className="truncate">{s.ruang}</span>
                      )}
                    </div>
                    {s.dosen && (
                      <p className="text-[10px] text-muted-foreground mt-1 truncate">
                        {s.dosen}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.section>

          {/* Upcoming Deadlines */}
          <motion.section
            variants={item}
            className="bg-card border border-border rounded-xl shadow-sm p-5"
          >
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-black tracking-tight text-foreground flex items-center gap-2">
                <Calendar size={18} /> Tenggat Terdekat
              </h2>
              <Link
                href="/deadlines"
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowRight size={14} />
              </Link>
            </div>
            {loading ? (
              <div className="space-y-3">
                {[0, 1].map((i) => (
                  <div
                    key={i}
                    className="skeleton h-16 rounded-lg bg-muted/50"
                  />
                ))}
              </div>
            ) : deadlines.length === 0 ? (
              <div className="flex flex-col items-center justify-center text-center p-4 border-2 border-dashed border-border rounded-xl">
                <Calendar
                  size={28}
                  className="text-muted-foreground/40 mb-2"
                />
                <p className="text-xs text-muted-foreground font-medium">
                  Tidak ada tenggat terdekat.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {deadlines.map((dl) => {
                  const styles = priorityStyles[dl.priority];
                  return (
                    <div
                      key={dl._id}
                      className="p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground uppercase tracking-wider truncate">
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${styles.dot}`}
                          />
                          <span className="truncate">{dl.course}</span>
                        </span>
                        <span
                          className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md uppercase shrink-0 ${styles.badge}`}
                        >
                          {dueLabel(dl.daysLeft)}
                        </span>
                      </div>
                      <p className="font-semibold text-sm text-foreground mt-1 truncate">
                        {dl.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Clock size={11} /> {dl.date}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </motion.section>
        </div>
      </div>

      {/* Recent Activity */}
      <motion.section
        variants={item}
        className="bg-card border border-border rounded-xl shadow-sm p-5 md:p-6 mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-black tracking-tight text-foreground flex items-center gap-2">
            <Clock size={20} /> Aktivitas Terbaru
          </h2>
        </div>
        {recentActivity.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center p-6 border-2 border-dashed border-border rounded-xl">
            <Clock size={28} className="text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground font-medium">
              Belum ada aktivitas terbaru.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Mulai chat, upload materi, atau kerjakan tugas untuk melihat
              riwayat di sini.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentActivity.map((act) => (
              <div
                key={act._id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border bg-background hover:bg-muted/30 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Clock size={14} className="text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">
                    {act.description}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {new Date(act.timestamp).toLocaleString("id-ID")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      <WorkspaceChat />
    </motion.div>
  );
}
