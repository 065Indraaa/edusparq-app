"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import { UserCircle, Save, RefreshCw, GraduationCap, Building2, BookOpen, Hash, CheckCircle2 } from "lucide-react";

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
    { key: "universitas", label: "Universitas / Perguruan Tinggi", placeholder: "Contoh: Universitas Brawijaya", icon: Building2 },
    { key: "fakultas", label: "Fakultas", placeholder: "Contoh: Fakultas Ekonomi dan Bisnis", icon: GraduationCap },
    { key: "prodi", label: "Program Studi", placeholder: "Contoh: Akuntansi", icon: BookOpen },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-3xl">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
            <UserCircle size={20} />
          </span>
          Profil Akademik
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Lengkapi data akademik Anda. Informasi kampus dipakai untuk menyesuaikan kerangka penulisan,
          rekomendasi riset, dan konteks Tutor AI dengan perguruan tinggi Anda.
        </p>
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
      <motion.form variants={itemVariants} onSubmit={handleSave} className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
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
    </motion.div>
  );
}
