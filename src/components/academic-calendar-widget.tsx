"use client";

import React, { useEffect, useState, useCallback } from "react";
import { CalendarCheck, Plus, RefreshCw, X } from "lucide-react";

interface Ev {
  jenis: string;
  judul: string;
  mulai: string;
  selesai: string;
}

const JENIS = ["UTS", "UAS", "KRS", "Libur", "Wisuda", "Pembayaran", "Lainnya"];

function fmt(d: string): string {
  const dt = new Date(d);
  if (isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

/** Surfaces the crowdsourced academic calendar for the user's campus on the dashboard. */
export function AcademicCalendarWidget() {
  const [universitas, setUniversitas] = useState("");
  const [events, setEvents] = useState<Ev[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ jenis: "UTS", judul: "", mulai: "", selesai: "" });

  const load = useCallback(async (uni: string) => {
    if (!uni) return;
    try {
      const res = await fetch(`/api/campus/calendar?universitas=${encodeURIComponent(uni)}`);
      if (!res.ok) return;
      const data = await res.json();
      const all: Ev[] = Array.isArray(data)
        ? data.flatMap((c: { events?: Ev[] }) => (Array.isArray(c.events) ? c.events : []))
        : [];
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const upcoming = all
        .filter((e) => {
          const end = new Date(e.selesai || e.mulai);
          return !isNaN(end.getTime()) && end.getTime() >= today.getTime();
        })
        .sort((a, b) => new Date(a.mulai).getTime() - new Date(b.mulai).getTime())
        .slice(0, 5);
      setEvents(upcoming);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    let active = true;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active) return;
        const uni = d?.user?.universitas || "";
        setUniversitas(uni);
        load(uni);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!universitas || !form.judul.trim() || !form.mulai) return;
    setSaving(true);
    try {
      await fetch("/api/campus/calendar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          universitas,
          events: [
            { jenis: form.jenis, judul: form.judul.trim(), mulai: form.mulai, selesai: form.selesai || form.mulai },
          ],
        }),
      });
      setForm({ jenis: "UTS", judul: "", mulai: "", selesai: "" });
      setOpen(false);
      load(universitas);
    } finally {
      setSaving(false);
    }
  };

  if (!universitas) return null;

  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 md:p-6 shadow-sm">
      <div className="absolute -right-8 -top-10 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />
      <div className="relative flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
            <CalendarCheck size={18} className="text-primary" /> Kalender Akademik
          </h2>
          <p className="text-[11px] text-muted-foreground mt-1">Agenda kampusmu, dari UTS sampai KRS.</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/10 px-2.5 py-1.5 rounded-lg transition-colors shrink-0"
        >
          {open ? <X size={14} /> : <Plus size={14} />}
          {open ? "Tutup" : "Tambah"}
        </button>
      </div>

      {open && (
        <form onSubmit={submit} className="relative space-y-2 mb-4 p-3 rounded-2xl bg-background/70 border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <select
              value={form.jenis}
              onChange={(e) => setForm({ ...form, jenis: e.target.value })}
              className="px-2 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
            >
              {JENIS.map((j) => (
                <option key={j} value={j}>{j}</option>
              ))}
            </select>
            <input
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              placeholder="Judul agenda"
              className="sm:col-span-2 px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <input type="date" value={form.mulai} onChange={(e) => setForm({ ...form, mulai: e.target.value })}
              className="px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
            <input type="date" value={form.selesai} onChange={(e) => setForm({ ...form, selesai: e.target.value })}
              className="px-3 py-2 rounded-lg bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary" />
          </div>
          <button type="submit" disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-lg transition-all disabled:opacity-60">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Plus size={13} />}
            Simpan agenda kampus
          </button>
          <p className="text-[10px] text-muted-foreground">Agenda dibagikan untuk semua mahasiswa {universitas}.</p>
        </form>
      )}

      {events.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-background/60 px-4 py-5 text-xs text-muted-foreground">Belum ada agenda akademik untuk kampusmu. Tambahkan UTS/UAS/KRS biar jadi rujukan bersama.</div>
      ) : (
        <div className="space-y-2">
          {events.map((e, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-2xl bg-background/70 border border-border hover:border-primary/20 transition-colors">
              <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 text-primary shrink-0">{e.jenis || "Agenda"}</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground truncate">{e.judul}</p>
                <p className="text-[11px] text-muted-foreground">{fmt(e.mulai)}{e.selesai && e.selesai !== e.mulai ? ` – ${fmt(e.selesai)}` : ""}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
