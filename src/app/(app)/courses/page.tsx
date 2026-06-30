"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  GraduationCap,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  X,
  Award,
} from "lucide-react";
import { AddCourseForm } from "../../../components/add-course-form";
import { GRADE_VALUES } from "../../../lib/validations";

interface Course {
  _id: string;
  name: string;
  instructor?: string;
  semester?: string;
  credits?: number;
  progress?: number;
  grade?: string;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 28 },
  },
};

const gradeBadgeClass = (grade?: string) => {
  if (!grade) {
    return "bg-muted text-muted-foreground border-border";
  }
  switch (grade) {
    case "A":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "A-":
      return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20";
    case "B+":
    case "B":
    case "B-":
      return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    case "C+":
    case "C":
    case "C-":
      return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
    case "D":
    case "E":
      return "bg-destructive/10 text-destructive border-destructive/20";
    default:
      return "bg-muted text-muted-foreground border-border";
  }
};

function parseSemesterNumber(semester?: string): number {
  if (!semester) return 1;
  const match = semester.match(/\d+/);
  return match ? Number(match[0]) : 1;
}

function formatSemesterOption(n: number): string {
  return `Semester ${n}`;
}

export default function CoursesPage() {
  const { status: authStatus } = useSession();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);

  const [form, setForm] = useState({
    name: "",
    instructor: "",
    credits: "3",
    semester: "1",
    grade: "",
    progress: "0",
  });

  const fetchCourses = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/courses");
      if (res.ok) {
        const data = await res.json();
        setCourses(Array.isArray(data) ? data : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") fetchCourses();
    else if (authStatus === "unauthenticated") setLoading(false);
  }, [authStatus, fetchCourses]);

  const openEdit = (course: Course) => {
    setEditingCourse(course);
    setForm({
      name: course.name || "",
      instructor: course.instructor || "",
      credits: String(course.credits ?? 3),
      semester: String(parseSemesterNumber(course.semester)),
      grade: course.grade || "",
      progress: String(course.progress ?? 0),
    });
  };

  const closeEdit = () => {
    setEditingCourse(null);
    setForm({
      name: "",
      instructor: "",
      credits: "3",
      semester: "1",
      grade: "",
      progress: "0",
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourse) return;

    const payload = {
      name: form.name.trim(),
      instructor: form.instructor.trim(),
      credits: Number(form.credits) || 0,
      semester: formatSemesterOption(Number(form.semester) || 1),
      grade: form.grade || "",
      progress: Math.min(100, Math.max(0, Number(form.progress) || 0)),
    };

    try {
      const res = await fetch(`/api/courses/${editingCourse._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        const updated = await res.json();
        setCourses((prev) =>
          prev.map((c) => (c._id === updated._id ? updated : c))
        );
        closeEdit();
      }
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Hapus mata kuliah "${name}"?`)) return;

    try {
      const res = await fetch(`/api/courses/${id}`, { method: "DELETE" });
      if (res.ok) {
        setCourses((prev) => prev.filter((c) => c._id !== id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-7xl"
    >
      {/* Header */}
      <motion.section
        variants={itemVariants}
        className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm"
      >
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-5">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
              <BookOpen size={14} /> Akademik
            </div>
            <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-black text-gradient">
              Mata Kuliah
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed">
              Kelola seluruh mata kuliah, pantau progres, dan catat nilai akhir
              Anda di satu tempat.
            </p>
          </div>
          <button
            type="button"
            onClick={() => fetchCourses()}
            disabled={refreshing}
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[44px] w-full sm:w-auto bg-muted hover:bg-muted/80 text-foreground border border-border rounded-2xl text-sm font-bold transition-all shadow-sm disabled:opacity-60"
          >
            <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </motion.section>

      {/* Add course form */}
      <motion.div variants={itemVariants} className="max-w-xl">
        <AddCourseForm onAdded={fetchCourses} />
      </motion.div>

      {/* Courses grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4"
            >
              <div className="skeleton h-4 w-3/4 rounded" />
              <div className="skeleton h-3 w-1/2 rounded" />
              <div className="skeleton h-2 w-full rounded" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-12 rounded-lg" />
                <div className="skeleton h-6 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : courses.length === 0 ? (
        <motion.div
          variants={itemVariants}
          className="rounded-[1.5rem] border border-dashed border-border bg-muted/25 text-center py-10 px-4"
        >
          <GraduationCap size={32} className="mx-auto mb-3 text-primary" />
          <p className="text-sm font-semibold text-foreground">
            Belum ada mata kuliah.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Gunakan form Tambah Mata Kuliah di atas untuk mulai mencatat.
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {courses.map((course) => {
              const progress = Math.min(
                100,
                Math.max(0, course.progress ?? 0)
              );
              return (
                <motion.div
                  key={course._id}
                  layout
                  variants={itemVariants}
                  initial="hidden"
                  animate="show"
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="group bg-card border border-border rounded-3xl p-5 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-foreground leading-snug truncate">
                        {course.name}
                      </h3>
                      {course.instructor ? (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {course.instructor}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/60 mt-0.5">
                          Belum ada dosen
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEdit(course)}
                        aria-label="Ubah mata kuliah"
                        className="p-1.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(course._id, course.name)}
                        aria-label="Hapus mata kuliah"
                        className="p-1.5 rounded-xl border border-border hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 mt-4">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border">
                      <GraduationCap size={11} />
                      {course.semester || "Semester 1"}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-primary/10 text-primary border border-primary/20">
                      {course.credits ?? 0} SKS
                    </span>
                    {course.grade ? (
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] font-extrabold px-2.5 py-1 rounded-lg border ${gradeBadgeClass(
                          course.grade
                        )}`}
                      >
                        <Award size={11} />
                        Nilai {course.grade}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg bg-muted text-muted-foreground border border-border">
                        Belum dinilai
                      </span>
                    )}
                  </div>

                  <div className="mt-5 space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-bold text-muted-foreground">
                      <span>Progres</span>
                      <span className="tabular-nums">{progress}%</span>
                    </div>
                    <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden border border-border/50">
                      <div
                        className="h-full bg-primary rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Edit modal */}
      <AnimatePresence>
        {editingCourse && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget) closeEdit();
            }}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground text-lg">
                  Edit Mata Kuliah
                </h2>
                <button
                  type="button"
                  onClick={closeEdit}
                  aria-label="Tutup"
                  className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Nama mata kuliah
                  </label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">
                    Dosen pengampu
                  </label>
                  <input
                    type="text"
                    value={form.instructor}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        instructor: e.target.value,
                      }))
                    }
                    placeholder="Nama dosen"
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Semester
                    </label>
                    <select
                      value={form.semester}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          semester: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      {Array.from({ length: 14 }, (_, i) => i + 1).map(
                        (n) => (
                          <option key={n} value={String(n)}>
                            Semester {n}
                          </option>
                        )
                      )}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      SKS
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={12}
                      value={form.credits}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          credits: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Nilai
                    </label>
                    <select
                      value={form.grade}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          grade: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    >
                      {GRADE_VALUES.map((g) => (
                        <option key={g} value={g}>
                          {g || "Belum ada nilai"}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Progres (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.progress}
                      onChange={(e) =>
                        setForm((prev) => ({
                          ...prev,
                          progress: e.target.value,
                        }))
                      }
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl text-sm transition-all shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={16} />
                  Simpan perubahan
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
