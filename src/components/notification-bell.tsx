"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";

interface NotifItem {
  id: string;
  title: string;
  courseName: string;
  dueDate: string;
  dueTime: string;
  daysLeft: number;
  severity: "overdue" | "today" | "soon";
}

function label(n: NotifItem): string {
  if (n.severity === "overdue") return `Terlambat ${Math.abs(n.daysLeft)} hari`;
  if (n.severity === "today") return "Hari ini";
  if (n.daysLeft === 1) return "Besok";
  return `H-${n.daysLeft}`;
}

function tone(s: NotifItem["severity"]): string {
  if (s === "overdue") return "text-destructive bg-destructive/10";
  if (s === "today") return "text-amber-600 dark:text-amber-400 bg-amber-500/10";
  return "text-primary bg-primary/10";
}

/** Bell with a live count of overdue/soon deadlines + a dropdown reminder list. */
export function NotificationBell() {
  const [items, setItems] = useState<NotifItem[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      fetch("/api/notifications")
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d && Array.isArray(d.items)) setItems(d.items);
        })
        .catch(() => {});
    load();
    const t = setInterval(load, 5 * 60 * 1000); // refresh every 5 min
    return () => {
      active = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const urgent = items.filter((i) => i.severity !== "soon").length;
  const badge = urgent > 0 ? urgent : items.length;

  return (
    <div ref={boxRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
        aria-label="Notifikasi tenggat"
      >
        <Bell size={18} />
        {badge > 0 && (
          <span className={`absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full text-[9px] font-bold flex items-center justify-center ring-2 ring-background ${urgent > 0 ? "bg-destructive text-white" : "bg-primary text-primary-foreground"}`}>
            {badge}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-w-[90vw] max-h-96 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl z-50 no-scrollbar">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <span className="text-sm font-bold text-foreground">Pengingat Tenggat</span>
            <Link href="/deadlines" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Tidak ada tenggat dalam waktu dekat. Santai dulu. 🎉
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href="/deadlines"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground truncate">{n.title}</span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md shrink-0 ${tone(n.severity)}`}>
                      {label(n)}
                    </span>
                  </div>
                  {n.courseName && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{n.courseName}</p>}
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
