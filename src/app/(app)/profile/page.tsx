"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { UserCircle, Save, RefreshCw, GraduationCap, Building2, BookOpen, Hash, CheckCircle2 } from "lucide-react";
import { UniversityPicker } from "@/components/university-picker";
import { GoogleConnectCard } from "@/components/google-connect-card";
import { ProdiPicker } from "@/components/prodi-picker";
import { PddiktiAutofill, PddiktiFill } from "@/components/pddikti-autofill";

interface ProfileForm {
  name: string;
  universitas: string;
  fakultas: string;
  prodi: string;
  semester: string;
}

interface ProfileStats {
  deadlineCount: number;
  courseCount: number;
  documentCount: number;
  ipk: number | null;
  sks: number;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function ProfilePage() {
  const { data: session } = useSession();

  const [form, setForm] = useState<ProfileForm>({
    name: "",
    universitas: "",
    fakultas: "",
    prodi: "",
    semester: "1",
  });
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    setLoading(true);
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (!active) return;
        const u = data?.user || {};
        setForm({
          name: u.name || session.user?.name || "",
          universitas: u.universitas || "",
          fakultas: u.fakultas || "",
          prodi: u.prodi || "",
          semester: String(u.semester ?? "1"),
        });
        if (data?.stats) setStats(data.stats);
      })
      .catch(() => active && setError("Gagal memuat profil. Coba muat ulang halaman."))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [session]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      setError("Nama tidak boleh kosong.");
      return;
    }
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name.trim(),
          universitas: form.universitas.trim(),
          fakultas: form.fakultas.trim(),
          prodi: form.prodi.trim(),
          semester: Number(form.semester) || 1,
        }),
      });
      if (!res.ok) throw new Error("save-failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Gagal menyimpan. Pastikan Anda sudah masuk dan coba lagi.");
    } finally {
      setSaving(false);
    }
  };

  const set = (k: keyof ProfileForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const fields: { key: keyof ProfileForm; label: string; placeholder: string; icon: React.ElementType }[] = [
    { key: "fakultas", label: "Fakultas", placeholder: "Contoh: Fakultas Ekonomi dan Bisnis", icon: GraduationCap },
  ];

  const applyPddikti = (data: PddiktiFill) =>
    setForm((f) => ({
      ...f,
      name: data.nama || f.name,
      universitas: data.universitas || f.universitas,
      fakultas: data.fakultas || f.fakultas,
      prodi: data.prodi || f.prodi,
      semester: String(data.semester || Number(f.semester) || 1),
    }));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
            <UserCircle size={14} /> Profil Mahasiswa
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient">Profil Akademik</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Lengkapi data akademik Anda. Informasi kampus dipakai untuk menyesuaikan kerangka penulisan, rekomendasi riset, dan konteks Tutor AI dengan perguruan tinggi Anda.
          </p>
        </div>
      </motion.div>

      {/* Derived academic stats (real data) */}
      <motion.div variants={itemVariants} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "IPK", value: loading ? null : stats?.ipk != null ? stats.ipk.toFixed(2) : "—", hint: "dari mata kuliah bernilai" },
          { label: "Total SKS", value: loading ? null : String(stats?.sks ?? 0), hint: "seluruh mata kuliah" },
          { label: "Mata Kuliah", value: loading ? null : String(stats?.courseCount ?? 0), hint: "terdaftar" },
          { label: "Dokumen", value: loading ? null : String(stats?.documentCount ?? 0), hint: "terindeks" },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 shadow-sm">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{s.label}</span>
            {s.value === null ? (
              <span className="skeleton h-7 w-12 rounded-md mt-1 block" />
            ) : (
              <span className="text-2xl font-black text-foreground block leading-tight mt-0.5">{s.value}</span>
            )}
            <span className="text-[10px] text-muted-foreground">{s.hint}</span>
          </div>
        ))}
      </motion.div>

      {stats && stats.ipk === null && !loading && (
        <motion.p variants={itemVariants} className="text-xs text-muted-foreground bg-muted/40 border border-border rounded-xl px-3 py-2">
          IPK akan otomatis terhitung setelah Anda menambahkan mata kuliah beserta nilainya (SKS &amp; huruf mutu) di halaman Ruang Kerja.
        </motion.p>
      )}

      {/* Form */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
      <motion.form variants={itemVariants} onSubmit={handleSave} className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
        <PddiktiAutofill onFill={applyPddikti} />

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">Nama lengkap</label>
          <input
            value={form.name}
            onChange={set("name")}
            disabled={loading}
            placeholder="Nama lengkap Anda"
            className="w-full px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Building2 size={13} className="text-primary" /> Universitas / Perguruan Tinggi
          </label>
          <UniversityPicker
            value={form.universitas}
            onChange={(v) => setForm((f) => ({ ...f, universitas: v }))}
            disabled={loading}
          />
        </div>

        {fields.map(({ key, label, placeholder, icon: Icon }) => (
          <div key={key} className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
              <Icon size={13} className="text-primary" /> {label}
            </label>
            <input
              value={form[key]}
              onChange={set(key)}
              disabled={loading}
              placeholder={placeholder}
              className="w-full px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        ))}

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <BookOpen size={13} className="text-primary" /> Program Studi
          </label>
          <ProdiPicker
            value={form.prodi}
            onChange={(v) => setForm((f) => ({ ...f, prodi: v }))}
            universitas={form.universitas}
            disabled={loading}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Hash size={13} className="text-primary" /> Semester saat ini
          </label>
          <input
            type="number"
            min={1}
            max={14}
            value={form.semester}
            onChange={set("semester")}
            disabled={loading}
            className="w-full px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>

        {error && (
          <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={saving || loading}
            className="min-h-[48px] px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
            {saving ? "Menyimpan..." : "Simpan profil"}
          </button>
          {saved && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 size={15} /> Tersimpan
            </span>
          )}
        </div>
      </motion.form>

        <div className="space-y-6">
          <GoogleConnectCard />
        </div>
      </div>
    </motion.div>
  );
}
