"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Plus, X, Trash2, CheckCircle2, Clock, UploadCloud, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";

interface Deadline {
  _id: string;
  courseName: string;
  title: string;
  dueDate: string;
  dueTime: string;
  weight: string;
  requirements: string;
  status: "pending" | "done" | "overdue";
  createdAt: string;
}

const DAYS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

function getDaysLeft(dueDate: string, dueTime: string) {
  const now = new Date();
  const due = new Date(`${dueDate}T${dueTime}`);
  const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  return diff;
}

export default function DeadlinesPage() {
  const { data: session } = useSession();
  const [deadlines, setDeadlines] = useState<Deadline[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const todayDate = today.getDate();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startOffset = firstDay === 0 ? 6 : firstDay - 1;

  const monthName = today.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  const [form, setForm] = useState({
    courseName: "",
    title: "",
    dueDate: "",
    dueTime: "23:59",
    weight: "",
    requirements: "",
  });

  const fetchDeadlines = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/deadlines");
      const data = await res.json();
      if (Array.isArray(data)) setDeadlines(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) fetchDeadlines();
  }, [session]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseName || !form.title || !form.dueDate) return;
    setSubmitting(true);

    const res = await fetch("/api/deadlines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      const newDeadline = await res.json();
      setDeadlines((prev) => [...prev, newDeadline].sort((a, b) =>
        new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
      ));
      setShowForm(false);
      setForm({ courseName: "", title: "", dueDate: "", dueTime: "23:59", weight: "", requirements: "" });
    }
    setSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/deadlines/${id}`, { method: "DELETE" });
    setDeadlines((prev) => prev.filter((d) => d._id !== id));
  };

  const handleMarkDone = async (id: string) => {
    await fetch(`/api/deadlines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "done" }),
    });
    setDeadlines((prev) => prev.map((d) => d._id === id ? { ...d, status: "done" } : d));
  };

  const getDeadlinesForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return deadlines.filter((d) => d.dueDate === dateStr && d.status === "pending");
  };

  const upcomingDeadlines = deadlines
    .filter((d) => d.status === "pending")
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 8);

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.07 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 12 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 28 } },
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
            <CalendarDays size={24} className="text-primary" />
            Tenggat Waktu
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Semua deadline kuliah kamu, terorganisir rapi — nggak ada yang kelewat.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl text-sm font-bold transition-all shadow-sm shrink-0"
        >
          <Plus size={16} />
          Tambah Tugas
        </button>
      </motion.div>

      {/* Add Deadline Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && setShowForm(false)}
          >
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.96, opacity: 0 }}
              className="bg-card border border-border rounded-3xl p-7 w-full max-w-md shadow-xl space-y-5"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground text-lg">Tugas baru</h2>
                <button onClick={() => setShowForm(false)} className="p-1.5 rounded-xl hover:bg-muted text-muted-foreground transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAdd} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Nama tugas</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: UTS Ekonomi Makro"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Mata kuliah</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: Ekonomi Makro Internasional"
                    value={form.courseName}
                    onChange={(e) => setForm({ ...form, courseName: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Tanggal batas</label>
                    <input
                      type="date"
                      required
                      value={form.dueDate}
                      onChange={(e) => setForm({ ...form, dueDate: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Jam</label>
                    <input
                      type="time"
                      value={form.dueTime}
                      onChange={(e) => setForm({ ...form, dueTime: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all cursor-pointer"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-muted-foreground">Bobot nilai</label>
                    <input
                      type="text"
                      placeholder="Misal: 15%"
                      value={form.weight}
                      onChange={(e) => setForm({ ...form, weight: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <div className="col-span-1" />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Catatan / ketentuan (opsional)</label>
                  <textarea
                    rows={2}
                    placeholder="Format PDF, font TNR, spasi 1.5..."
                    value={form.requirements}
                    onChange={(e) => setForm({ ...form, requirements: e.target.value })}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl text-sm transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {submitting ? <RefreshCw size={16} className="animate-spin" /> : "Simpan"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Calendar + Deadline List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Calendar */}
        <motion.div variants={itemVariants} className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-foreground capitalize">{monthName}</h2>
            <span className="text-xs text-primary font-semibold bg-primary/10 px-3 py-1 rounded-full">
              {upcomingDeadlines.length} tugas aktif
            </span>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            {DAYS.map((d) => <div key={d}>{d}</div>)}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: startOffset }).map((_, i) => (
              <div key={`empty-${i}`} />
            ))}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const day = idx + 1;
              const dayDeadlines = getDeadlinesForDay(day);
              const isToday = day === todayDate;
              const isSelected = selectedDay === day;

              return (
                <button
                  key={day}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[68px] p-1.5 rounded-2xl border flex flex-col transition-all text-left ${
                    isToday
                      ? "bg-primary/10 border-primary/30"
                      : isSelected
                      ? "bg-muted border-primary/40"
                      : "border-border hover:border-primary/30 hover:bg-muted/50"
                  }`}
                >
                  <span className={`text-[11px] font-bold ${isToday ? "text-primary" : "text-muted-foreground"}`}>
                    {day}
                  </span>
                  <div className="mt-auto space-y-0.5">
                    {dayDeadlines.slice(0, 2).map((dl, i) => {
                      const daysLeft = getDaysLeft(dl.dueDate, dl.dueTime);
                      return (
                        <div
                          key={i}
                          className={`text-[9px] px-1 py-0.5 rounded-md truncate font-semibold ${
                            daysLeft <= 1
                              ? "bg-destructive/10 text-destructive"
                              : daysLeft <= 3
                              ? "bg-warning/10 text-warning"
                              : "bg-primary/10 text-primary"
                          }`}
                        >
                          {dl.title}
                        </div>
                      );
                    })}
                    {dayDeadlines.length > 2 && (
                      <div className="text-[9px] text-muted-foreground px-1">
                        +{dayDeadlines.length - 2} lagi
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Deadline List */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h2 className="font-bold text-foreground text-sm">Yang harus diselesaikan</h2>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw size={18} className="animate-spin text-muted-foreground" />
              </div>
            ) : upcomingDeadlines.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 size={32} className="text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">Semua beres!</p>
                <p className="text-xs text-muted-foreground mt-1">Tambah tugas baru kalau ada yang masuk.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((dl) => {
                  const daysLeft = getDaysLeft(dl.dueDate, dl.dueTime);
                  const isUrgent = daysLeft <= 1;
                  const isWarning = daysLeft > 1 && daysLeft <= 3;

                  return (
                    <div
                      key={dl._id}
                      className={`p-4 rounded-2xl border transition-colors ${
                        isUrgent
                          ? "border-destructive/20 bg-destructive/5"
                          : isWarning
                          ? "border-warning/20 bg-warning/5"
                          : "border-border bg-muted/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 flex-1 min-w-0">
                          <span className="text-[10px] font-bold text-primary uppercase tracking-wide block truncate">
                            {dl.courseName}
                          </span>
                          <span className="text-sm font-semibold text-foreground block leading-tight">{dl.title}</span>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                            <Clock size={11} />
                            {new Date(dl.dueDate).toLocaleDateString("id-ID", { day: "numeric", month: "short" })} · {dl.dueTime}
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-extrabold px-2.5 py-1 rounded-lg shrink-0 ${
                            isUrgent
                              ? "bg-destructive/10 text-destructive border border-destructive/20"
                              : isWarning
                              ? "bg-warning/10 text-warning border border-warning/20"
                              : "bg-muted text-muted-foreground border border-border"
                          }`}
                        >
                          {daysLeft <= 0 ? "Hari ini!" : `H-${daysLeft}`}
                        </span>
                      </div>

                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleMarkDone(dl._id)}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold transition-colors border border-emerald-500/20"
                        >
                          <CheckCircle2 size={13} />
                          Selesai
                        </button>
                        <button
                          onClick={() => handleDelete(dl._id)}
                          className="p-1.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* AI Scan hint */}
          <div className="bg-card border border-border rounded-3xl p-5 space-y-3 shadow-sm">
            <div className="flex items-center gap-2">
              <UploadCloud size={18} className="text-primary" />
              <h3 className="font-bold text-sm text-foreground">Scan dari screenshot</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Punya foto papan tulis atau screenshot info tugas dari WA? Upload di Workspace — AI akan coba baca deadline-nya otomatis.
            </p>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
