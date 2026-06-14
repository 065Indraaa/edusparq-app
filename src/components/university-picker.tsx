"use client";

import React, { useEffect, useRef, useState } from "react";
import { Building2, Loader2, MapPin } from "lucide-react";

interface UniversityResult {
  name: string;
  shortName: string;
  province: string;
  regency: string;
  type: string;
}

/**
 * Autocomplete input for picking an Indonesian university via the campus API.
 *
 * Graceful degradation: if the API key is not configured server-side, this still
 * works as a plain text input (free typing is always saved via `onChange`), so
 * the profile form never breaks.
 */
export function UniversityPicker({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<UniversityResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement | null>(null);

  // Sync when the parent value arrives (e.g. after the profile loads).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  // Close the dropdown on outside click.
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
    onChange(v); // free text is always saved (manual fallback)
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    debRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/campus/universities?q=${encodeURIComponent(v)}`
        );
        const data = await res.json();
        const list: UniversityResult[] = Array.isArray(data?.results)
          ? data.results
          : [];
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

  const pick = (u: UniversityResult) => {
    setQuery(u.name);
    onChange(u.name);
    setResults([]);
    setOpen(false);
  };

  return (
    <div ref={boxRef} className="relative">
      <div className="relative">
        <Building2
          size={16}
          className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <input
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onFocus={() => results.length > 0 && setOpen(true)}
          disabled={disabled}
          placeholder="Ketik nama universitas, mis. Universitas Brawijaya"
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
          {results.map((u, idx) => (
            <button
              key={`${u.name}-${idx}`}
              type="button"
              onClick={() => pick(u)}
              className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors border-b border-border last:border-b-0 flex items-start gap-3"
            >
              <Building2 size={16} className="text-primary shrink-0 mt-0.5" />
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground leading-snug">
                  {u.name}
                </span>
                {(u.regency || u.province || u.shortName) && (
                  <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground mt-0.5">
                    {u.shortName && (
                      <span className="font-bold text-primary">{u.shortName}</span>
                    )}
                    {(u.regency || u.province) && (
                      <span className="inline-flex items-center gap-0.5">
                        <MapPin size={10} />
                        {[u.regency, u.province].filter(Boolean).join(", ")}
                      </span>
                    )}
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
