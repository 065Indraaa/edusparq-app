"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  CalendarRange,
  Plus,
  Trash2,
  MapPin,
  User as UserIcon,
  RefreshCw,
  X,
} from "lucide-react";
import { CourseSelect } from "@/components/course-select";

interface ClassItem {
  _id: string;
  courseName: string;
  hari: number;
  jamMulai: string;
  jamSelesai: string;
  ruang: string;
  dosen: string;
}

const HARI = ["", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu", "Minggu"];

function todayHari(): number {
  const js = new Date().getDay(); // 0=Minggu..6=Sabtu
  return js === 0 ? 7 : js; // 1=Senin..7=Minggu
}

export default function JadwalPage() {
  const { status: authStatus } = useSession();
  const [items, setItems] = useState<ClassItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    courseName: "",
    hari: String(todayHari()),
    jamMulai: "08:00",
    jamSelesai: "09:40",
    ruang: "",
    dosen: "",
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/schedule");
      if (res.ok) {
        const data = await res.json();
        setItems(Array.isArray(data?.items) ? data.items : []);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") refresh();
    else if (authStatus === "unauthenticated") setLoading(false);
  }, [authStatus, refresh]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.courseName.trim()) {
      setError("Pilih mata kuliah dulu.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, hari: Number(form.hari) }),
      });
      if (!res.ok) throw new Error("save-failed");
      setForm({ courseName: "", hari: String(todayHari()), jamMulai: "08:00", jamSelesai: "09:40", ruang: "", dosen: "" });
      setShowForm(false);
      refresh();
    } catch {
      setError("Gagal menyimpan jadwal.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setItems((prev) => prev.filter((i) => i._id !== id));
    try {
      await fetch(`/api/schedule?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  const today = todayHari();
  const byDay = (d: number) => items.filter((i) => i.hari === d);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
              <CalendarRange size={20} />
            </span>
            Jadwal Kuliah
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5">Atur jadwal mingguanmu — biar tahu kelas hari ini jam berapa dan di ruang mana.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((s) => !s)}
          className="inline-flex items-center gap-2 px-4 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shrink-0"
        >
          {showForm ? <X size={16} /> : <Plus size={16} />}
          {showForm ? "Tutup" : "Tambah"}
        </button>
      </div>

      {showForm && (
        <motion.form
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          onSubmit={submit}
          className="bg-card border border-border rounded-3xl p-5 space-y-3 shadow-sm overflow-hidden"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Mata kuliah</label>
            <CourseSelect value={form.courseName} onChange={(v) => setForm({ ...form, courseName: v })} />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Hari</label>
              <select
                value={form.hari}
                onChange={(e) => setForm({ ...form, hari: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
              >
                {HARI.slice(1).map((h, i) => (
                  <option key={h} value={String(i + 1)}>{h}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Mulai</label>
              <input type="time" value={form.jamMulai} onChange={(e) => setForm({ ...form, jamMulai: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Selesai</label>
              <input type="time" value={form.jamSelesai} onChange={(e) => setForm({ ...form, jamSelesai: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ruang</label>
              <input value={form.ruang} onChange={(e) => setForm({ ...form, ruang: e.target.value })} placeholder="mis. GKB 3.2"
                className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Dosen (opsional)</label>
            <input value={form.dosen} onChange={(e) => setForm({ ...form, dosen: e.target.value })} placeholder="Nama dosen pengampu"
              className="w-full px-4 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
          </div>
          {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
          <button type="submit" disabled={saving}
            className="inline-flex items-center gap-2 px-5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all disabled:opacity-60">
            {saving ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
            Simpan jadwal
          </button>
        </motion.form>
      )}

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="bg-card border border-border rounded-2xl p-4 skeleton h-20" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-12 text-sm text-muted-foreground">
          Belum ada jadwal. Klik <span className="font-bold text-foreground">Tambah</span> untuk memasukkan kelas pertamamu.
        </div>
      ) : (
        <div className="space-y-4">
          {HARI.slice(1).map((nama, idx) => {
            const d = idx + 1;
            const dayItems = byDay(d);
            if (dayItems.length === 0) return null;
            const isToday = d === today;
            return (
              <div key={nama} className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-extrabold ${isToday ? "text-primary" : "text-foreground"}`}>{nama}</span>
                  {isToday && (
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary">Hari ini</span>
                  )}
                </div>
                <div className="space-y-2">
                  {dayItems.map((it) => (
                    <div key={it._id} className={`flex items-center gap-3 p-4 rounded-2xl border shadow-sm ${isToday ? "border-primary/30 bg-primary/5" : "border-border bg-card"}`}>
                      <div className="text-center shrink-0 w-14">
                        <span className="block text-sm font-black text-foreground leading-tight">{it.jamMulai}</span>
                        <span className="block text-[10px] text-muted-foreground">{it.jamSelesai}</span>
                      </div>
                      <div className="w-px self-stretch bg-border" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground leading-snug truncate">{it.courseName}</p>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground mt-0.5">
                          {it.ruang && <span className="inline-flex items-center gap-1"><MapPin size={11} />{it.ruang}</span>}
                          {it.dosen && <span className="inline-flex items-center gap-1"><UserIcon size={11} />{it.dosen}</span>}
                        </div>
                      </div>
                      <button type="button" onClick={() => remove(it._id)} aria-label="Hapus jadwal"
                        className="text-muted-foreground hover:text-destructive p-2 rounded-lg hover:bg-destructive/10 transition-colors shrink-0">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}
