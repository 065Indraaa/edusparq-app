"use client";

import React, { useState } from "react";
import { Plus, RefreshCw, X } from "lucide-react";
import { CourseSelect } from "@/components/course-select";

/**
 * Compact "Tambah Mata Kuliah" form. Posts a real Course to /api/courses so the
 * user's matkul list (used by every CourseSelect and the onboarding checklist)
 * gets populated. The name field reuses CourseSelect so a student can pick a
 * standard course for their prodi/semester instead of typing it out.
 */
export function AddCourseForm({
  onAdded,
  defaultSemester,
}: {
  onAdded?: () => void;
  defaultSemester?: number;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [semester, setSemester] = useState(String(defaultSemester || 1));
  const [credits, setCredits] = useState("3");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const reset = () => {
    setName("");
    setCredits("3");
    setError("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Nama mata kuliah wajib diisi.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/courses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          semester: `Semester ${Number(semester) || 1}`,
          credits: Number(credits) || 3,
        }),
      });
      if (!res.ok) throw new Error("save-failed");
      reset();
      setOpen(false);
      onAdded?.();
    } catch {
      setError("Gagal menyimpan mata kuliah. Pastikan sudah masuk.");
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-dashed border-border text-xs font-bold text-muted-foreground hover:text-primary hover:border-primary/50 hover:bg-primary/5 transition-colors min-h-[42px]"
      >
        <Plus size={15} /> Tambah Mata Kuliah
      </button>
    );
  }

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-border bg-muted/30 p-3 space-y-2.5"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-foreground">Tambah Mata Kuliah</span>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            reset();
          }}
          aria-label="Tutup"
          className="text-muted-foreground hover:text-foreground"
        >
          <X size={15} />
        </button>
      </div>

      <CourseSelect value={name} onChange={setName} disabled={saving} placeholder="Nama mata kuliah" />

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Semester</label>
          <select
            value={semester}
            onChange={(e) => setSemester(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
          >
            {Array.from({ length: 14 }, (_, i) => i + 1).map((n) => (
              <option key={n} value={String(n)}>
                Semester {n}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">SKS</label>
          <input
            type="number"
            min={1}
            max={12}
            value={credits}
            onChange={(e) => setCredits(e.target.value)}
            disabled={saving}
            className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
          />
        </div>
      </div>

      {error && <p className="text-[11px] font-semibold text-destructive">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl transition-all disabled:opacity-60 min-h-[42px]"
      >
        {saving ? <RefreshCw size={14} className="animate-spin" /> : <Plus size={14} />}
        {saving ? "Menyimpan..." : "Simpan"}
      </button>
    </form>
  );
}
