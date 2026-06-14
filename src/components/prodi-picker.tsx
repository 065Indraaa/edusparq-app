"use client";

import React, { useEffect, useRef, useState } from "react";
import { BookOpen, Loader2, GraduationCap } from "lucide-react";

interface ProdiResult {
  id: string;
  nama: string;
  jenjang: string;
  pt: string;
  ptSingkat: string;
}

/**
 * Autocomplete input for study programs (prodi), powered by keyless PDDIKTI
 * data. When `universitas` is provided, suggestions are narrowed to that campus
 * so the list stays relevant. Free typing is always saved (manual fallback), so
 * the form never breaks even if PDDIKTI is unreachable.
 */
export function ProdiPicker({
  value,
  onChange,
  universitas,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  universitas?: string;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<ProdiResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const handleChange = (v: string) => {
    setQuery(v);
    onChange(v);
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ kind: "prodi", q: v });
        if (universitas && universitas.trim()) params.set("pt", universitas.trim());
        const res = await fetch(`/api/campus/pddikti?${params.toString()}`);
        const data = await res.json();
        const list: ProdiResult[] = Array.isArray(data?.results) ? data.results : [];
        setResults(list);
        setOpen(list.length > 0);
      } catch {
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);
  };

  const pick = (p: ProdiResult) => {
    setQuery(p.nama);
    onChange(p.nama);
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <BookOpen
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled}
          placeholder="Ketik nama program studi, mis. Akuntansi"
          autoComplete="off"
          className="w-full pl-11 pr-10 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
        />
        {loading && (
          <Loader2
            size={16}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
          />
        )}
      </div>

      {open && results.length > 0 && (
        <div className="absolute z-30 mt-2 w-full max-h-72 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl no-scrollbar">
          {results.map((p, idx) => (
            <button
              key={`${p.id}-${idx}`}
              type="button"
              onClick={() => pick(p)}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border last:border-b-0 flex items-start gap-3"
            >
              <GraduationCap size={16} className="text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground leading-snug">
                  {p.nama}
                  {p.jenjang && (
                    <span className="ml-1.5 text-[11px] font-bold text-primary">{p.jenjang}</span>
                  )}
                </span>
                {p.pt && (
                  <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                    {p.pt}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
