"use client";

import React, { useRef, useState } from "react";
import { Sparkles, Search, Loader2, UserCheck, ChevronDown } from "lucide-react";

interface MhsResult {
  id: string;
  nama: string;
  nim: string;
  namaPt: string;
  singkatanPt: string;
  namaProdi: string;
}

export interface PddiktiFill {
  universitas: string;
  prodi: string;
  semester: number;
}

/**
 * "Auto-fill from PDDIKTI" card. The student types their name, picks their own
 * record from the public PDDIKTI list (matched by NIM / campus), and we fill the
 * profile with REAL data: university, study program, and an estimated semester
 * (from the official entry date). Everything stays editable afterwards.
 */
export function PddiktiAutofill({ onFill }: { onFill: (data: PddiktiFill) => void }) {
  const [openPanel, setOpenPanel] = useState(false);
  const [name, setName] = useState("");
  const [results, setResults] = useState<MhsResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [filling, setFilling] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSearch = (v: string) => {
    setName(v);
    setNote("");
    if (debRef.current) clearTimeout(debRef.current);
    if (v.trim().length < 3) {
      setResults([]);
      return;
    }
    debRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/campus/pddikti?kind=mhs&q=${encodeURIComponent(v)}`);
        const data = await res.json();
        const list: MhsResult[] = Array.isArray(data?.results) ? data.results : [];
        setResults(list);
        if (list.length === 0) setNote("Tidak ada data cocok. Coba nama lengkap atau isi manual di bawah.");
      } catch {
        setResults([]);
        setNote("Gagal menghubungi PDDIKTI. Isi manual saja di bawah ya.");
      } finally {
        setSearching(false);
      }
    }, 350);
  };

  const choose = async (m: MhsResult) => {
    setFilling(m.id);
    setNote("");
    try {
      const res = await fetch(`/api/campus/pddikti?kind=detail&id=${encodeURIComponent(m.id)}`);
      const data = await res.json();
      const detail = data?.detail;
      if (!detail) {
        setNote("Detail tidak tersedia. Coba pilih entri lain atau isi manual.");
        return;
      }
      onFill({
        universitas: detail.namaPt || m.namaPt || "",
        prodi: detail.prodi || m.namaProdi || "",
        semester: Number(data?.semesterEstimate) || 1,
      });
      setNote(`Terisi dari data: ${m.nama}${m.nim ? ` (${m.nim})` : ""}. Semester perkiraan — silakan koreksi bila perlu.`);
      setResults([]);
      setName("");
      setOpenPanel(false);
    } catch {
      setNote("Gagal mengambil detail. Isi manual saja di bawah.");
    } finally {
      setFilling(null);
    }
  };

  return (
    <div className="rounded-2xl border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpenPanel((o) => !o)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left"
      >
        <span className="grid place-items-center w-9 h-9 rounded-xl bg-primary/15 text-primary shrink-0">
          <Sparkles size={18} />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-bold text-foreground">Isi otomatis dari PDDIKTI</span>
          <span className="block text-xs text-muted-foreground">
            Cari namamu, langsung terisi universitas, prodi & estimasi semester.
          </span>
        </span>
        <ChevronDown
          size={18}
          className={`text-muted-foreground transition-transform ${openPanel ? "rotate-180" : ""}`}
        />
      </button>

      {openPanel && (
        <div className="px-4 pb-4 space-y-3">
          <div className="relative">
            <Search
              size={16}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <input
              value={name}
              onChange={(e) => runSearch(e.target.value)}
              placeholder="Ketik nama lengkapmu di PDDIKTI"
              autoComplete="off"
              className="w-full pl-11 pr-10 min-h-[46px] rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            {searching && (
              <Loader2
                size={16}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin"
              />
            )}
          </div>

          {results.length > 0 && (
            <div className="max-h-64 overflow-y-auto rounded-xl border border-border bg-card divide-y divide-border no-scrollbar">
              {results.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => choose(m)}
                  disabled={filling !== null}
                  className="w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors flex items-start gap-3 disabled:opacity-60"
                >
                  <span className="grid place-items-center w-8 h-8 rounded-lg bg-primary/10 text-primary shrink-0 mt-0.5">
                    {filling === m.id ? (
                      <Loader2 size={15} className="animate-spin" />
                    ) : (
                      <UserCheck size={15} />
                    )}
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-foreground leading-snug">
                      {m.nama} {m.nim && <span className="text-[11px] text-muted-foreground">· {m.nim}</span>}
                    </span>
                    <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                      {[m.namaProdi, m.namaPt].filter(Boolean).join(" — ")}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
        </div>
      )}
    </div>
  );
}
