"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, ChevronDown } from "lucide-react";

interface Suggestion {
  name: string;
  semester: string;
  sks: number | null;
  source: "mine" | "default";
}

/**
 * Reusable "pick a mata kuliah" combobox backed by /api/courses/suggestions
 * (the user's real courses + crowdsourced defaults for their prodi). The user
 * can pick from the list or type a new course name — free text is always saved,
 * so it works as a plain input even before any courses exist.
 *
 * `refreshKey` lets a parent force a re-fetch after it adds a new course.
 */
export function CourseSelect({
  value,
  onChange,
  disabled,
  placeholder,
  className,
  refreshKey,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  refreshKey?: number;
}) {
  const [query, setQuery] = useState(value);
  const [items, setItems] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    let active = true;
    fetch("/api/courses/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (active && d && Array.isArray(d.courses)) setItems(d.courses);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [refreshKey]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handle = (v: string) => {
    setQuery(v);
    onChange(v);
    setOpen(true);
  };

  const pick = (s: Suggestion) => {
    setQuery(s.name);
    onChange(s.name);
    setOpen(false);
  };

  const q = query.trim().toLowerCase();
  const filtered = q ? items.filter((i) => i.name.toLowerCase().includes(q)) : items;

  const inputClass =
    className ||
    "w-full pl-11 pr-10 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <BookOpen
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => handle(e.target.value)}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder={placeholder || "Pilih atau ketik mata kuliah"}
          autoComplete="off"
          className={inputClass}
        />
        <ChevronDown
          size={16}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
      </div>

      {open && filtered.length > 0 && (
        <div className="absolute z-30 mt-2 w-full max-h-64 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl no-scrollbar">
          {filtered.map((s, idx) => (
            <button
              key={`${s.name}-${idx}`}
              type="button"
              onClick={() => pick(s)}
              className="w-full text-left px-4 py-2.5 hover:bg-muted/60 transition-colors border-b border-border last:border-b-0 flex items-center gap-2.5"
            >
              <BookOpen size={14} className="text-primary shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground truncate">{s.name}</span>
                {(s.semester || s.sks != null) && (
                  <span className="block text-[11px] text-muted-foreground">
                    {[s.semester, s.sks != null ? `${s.sks} SKS` : ""].filter(Boolean).join(" · ")}
                  </span>
                )}
              </span>
              <span
                className={`text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded shrink-0 ${
                  s.source === "mine"
                    ? "bg-primary/10 text-primary"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {s.source === "mine" ? "Matkul saya" : "Saran"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
