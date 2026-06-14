"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock } from "lucide-react";

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
        className="relative rounded-2xl border border-transparent hover:border-border hover:bg-muted/70 text-muted-foreground hover:text-foreground transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
        <div className="absolute right-0 mt-2 w-80 max-w-[calc(100vw-1.5rem)] max-h-[28rem] overflow-y-auto rounded-[1.5rem] border border-border bg-card shadow-2xl z-50 no-scrollbar">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3 bg-muted/25">
            <span className="text-sm font-bold text-foreground inline-flex items-center gap-2"><CalendarClock size={15} className="text-primary" /> Pengingat Tenggat</span>
            <Link href="/deadlines" onClick={() => setOpen(false)} className="text-[11px] font-semibold text-primary hover:underline">
              Lihat semua
            </Link>
          </div>
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
              Tidak ada tenggat dalam waktu dekat. Santai dulu. 🎉
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {items.map((n) => (
                <Link
                  key={n.id}
                  href="/deadlines"
                  onClick={() => setOpen(false)}
                  className="block px-3 py-3 rounded-2xl hover:bg-muted/60 transition-colors border border-transparent hover:border-border"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground min-w-0 line-clamp-2">{n.title}</span>
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
