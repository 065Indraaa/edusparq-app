"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, ChevronRight, GraduationCap, BookOpen, Loader2,
  Plus, Check, Sparkles, ArrowRight, X,
} from "lucide-react";
import Link from "next/link";

// ─── Types (mirror of API response) ───────────────────────────────────────────

interface Fakultas {
  id: string;
  name: string;
  icon: string;
  color: string;
}

interface PopularCourse {
  semester: number;
  namaMatkul: string;
  sks: number;
}

interface JurusanItem {
  id: string;
  name: string;
  fakultasId: string;
  fakultasName: string;
  keywords: string[];
  icon: string;
  color: string;
  description: string;
  popularCourses: PopularCourse[];
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function JurusanPage() {
  const [fakultas, setFakultas] = useState<Fakultas[]>([]);
  const [jurusanList, setJurusanList] = useState<JurusanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFakultas, setActiveFakultas] = useState<string | null>(null);
  const [selected, setSelected] = useState<JurusanItem | null>(null);
  const [addingCourse, setAddingCourse] = useState<string | null>(null);
  const [addedCourses, setAddedCourses] = useState<Set<string>>(new Set());

  // Fetch catalog
  useEffect(() => {
    fetch("/api/jurusan")
      .then((r) => r.json())
      .then((data) => {
        setFakultas(data.fakultas || []);
        setJurusanList(data.jurusan || []);
      })
      .finally(() => setLoading(false));
  }, []);

  // Filtered list
  const filtered = useMemo(() => {
    let list = jurusanList;
    if (activeFakultas) list = list.filter((j) => j.fakultasId === activeFakultas);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (j) =>
          j.name.toLowerCase().includes(q) ||
          j.keywords.some((kw) => kw.includes(q))
      );
    }
    return list;
  }, [jurusanList, activeFakultas, search]);

  // Group by fakultas for display
  const grouped = useMemo(() => {
    const map = new Map<string, JurusanItem[]>();
    filtered.forEach((j) => {
      if (!map.has(j.fakultasId)) map.set(j.fakultasId, []);
      map.get(j.fakultasId)!.push(j);
    });
    return map;
  }, [filtered]);

  // Add course to user's workspace
  const addCourse = async (namaMatkul: string, sks: number, semester: number) => {
    setAddingCourse(namaMatkul);
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: namaMatkul,
          credits: sks,
          semester: `Semester ${semester}`,
        }),
      });
      if (res.ok) {
        setAddedCourses((prev) => new Set(prev).add(namaMatkul));
      }
    } catch (err) {
      console.error("Add course failed", err);
    } finally {
      setAddingCourse(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <GraduationCap size={18} />
          </span>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
            Katalog Jurusan
          </h1>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Template mata kuliah populer untuk {jurusanList.length} jurusan di {fakultas.length} fakultas.
          AI otomatis menyesuaikan jawaban dengan jurusan Anda.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Cari jurusan (informatika, akuntansi, hukum...)"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-3 rounded-xl bg-card/80 border border-border/70 text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all"
        />
      </div>

      {/* Fakultas filter chips */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveFakultas(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all ${
            !activeFakultas
              ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary))]"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Semua Fakultas
        </button>
        {fakultas.map((f) => (
          <button
            key={f.id}
            onClick={() => setActiveFakultas(f.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all flex items-center gap-1.5 ${
              activeFakultas === f.id
                ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary))]"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <span>{f.icon}</span>
            {f.name}
          </button>
        ))}
      </div>

      {/* Jurusan grid grouped by fakultas */}
      <div className="space-y-6">
        {Array.from(grouped.entries()).map(([fakId, jurusans]) => {
          const fak = fakultas.find((f) => f.id === fakId);
          return (
            <div key={fakId} className="space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-lg">{fak?.icon}</span>
                <h2 className={`text-sm font-bold tracking-tight ${fak?.color || "text-foreground"}`}>
                  {fak?.name}
                </h2>
                <span className="h-px flex-1 bg-border/50" />
                <span className="text-[10px] font-bold text-muted-foreground">
                  {jurusans.length} jurusan
                </span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {jurusans.map((j, i) => (
                  <motion.button
                    key={j.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 40 }}
                    onClick={() => setSelected(j)}
                    className="text-left p-4 rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm hover:border-primary/30 hover:bg-primary/5 transition-all group"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl shrink-0">{j.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-bold tracking-tight text-foreground group-hover:text-primary transition-colors">
                          {j.name}
                        </h3>
                        <p className="text-[11px] font-medium text-muted-foreground mt-0.5 line-clamp-2">
                          {j.description}
                        </p>
                        {j.popularCourses.length > 0 && (
                          <div className="flex items-center gap-1 mt-2 text-[10px] font-bold text-primary">
                            <BookOpen size={11} />
                            {j.popularCourses.length} matkul template
                          </div>
                        )}
                      </div>
                      <ChevronRight size={14} className="text-muted-foreground group-hover:text-primary transition-colors shrink-0 mt-1" />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm font-medium text-muted-foreground">
              Tidak ada jurusan yang cocok dengan pencarian Anda.
            </p>
          </div>
        )}
      </div>

      {/* Detail modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-end md:items-center justify-center p-3 md:p-6"
            onClick={() => setSelected(null)}
            role="dialog"
            aria-modal="true"
          >
            <motion.div
              initial={{ y: "100%", scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="w-full max-w-lg bg-card/95 backdrop-blur-2xl border border-border rounded-3xl max-h-[85vh] overflow-y-auto no-scrollbar shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="sticky top-0 bg-card/95 backdrop-blur-2xl px-5 pt-5 pb-4 border-b border-border/50 z-10">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <span className="text-3xl">{selected.icon}</span>
                    <div>
                      <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                        {selected.name}
                      </h2>
                      <span className={`text-[10px] font-bold ${fakultas.find(f => f.id === selected.fakultasId)?.color}`}>
                        {selected.fakultasName}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelected(null)}
                    className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors shrink-0"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs font-medium text-muted-foreground mt-3 leading-relaxed">
                  {selected.description}
                </p>
                <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/10">
                  <Sparkles size={13} className="text-primary shrink-0" />
                  <p className="text-[11px] font-medium text-foreground/80">
                    AI otomatis menyesuaikan jawaban untuk jurusan ini saat Anda bertanya di Tutor/Chat.
                  </p>
                </div>
              </div>

              {/* Courses */}
              <div className="px-5 py-4">
                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground mb-3">
                  Template Mata Kuliah Populer
                </h3>
                {selected.popularCourses.length === 0 ? (
                  <p className="text-xs font-medium text-muted-foreground py-4 text-center">
                    Belum ada template matkul untuk jurusan ini.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selected.popularCourses
                      .sort((a, b) => a.semester - b.semester)
                      .map((c, i) => {
                        const added = addedCourses.has(c.namaMatkul);
                        const isLoading = addingCourse === c.namaMatkul;
                        return (
                          <div
                            key={i}
                            className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors"
                          >
                            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary text-[10px] font-black border border-primary/20 shrink-0">
                              {c.semester}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold tracking-tight text-foreground truncate">
                                {c.namaMatkul}
                              </p>
                              <span className="text-[10px] font-medium text-muted-foreground">
                                Semester {c.semester} • {c.sks} SKS
                              </span>
                            </div>
                            <button
                              onClick={() => addCourse(c.namaMatkul, c.sks, c.semester)}
                              disabled={added || isLoading}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold tracking-tight shrink-0 transition-all ${
                                added
                                  ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                                  : "bg-primary text-primary-foreground hover:shadow-[0_6px_16px_-10px_hsl(var(--primary))]"
                              }`}
                            >
                              {isLoading ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : added ? (
                                <Check size={12} />
                              ) : (
                                <Plus size={12} />
                              )}
                              {added ? "Ditambah" : "Tambah"}
                            </button>
                          </div>
                        );
                      })}
                  </div>
                )}

                {/* CTA to workspace */}
                <Link
                  href="/workspace"
                  className="mt-4 flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-muted/60 text-foreground text-sm font-bold tracking-tight hover:bg-muted transition-colors"
                >
                  Buka Workspace
                  <ArrowRight size={14} />
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
