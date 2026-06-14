"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Library,
  Search,
  BookMarked,
  Plus,
  Check,
  Trash2,
  ExternalLink,
  Copy,
  Loader2,
  FileText,
} from "lucide-react";

interface CatalogItem {
  id: string;
  title: string;
  authors: string[];
  year: string;
  type: string;
  typeLabel: string;
  journal: string;
  publisher: string;
  doi: string;
  url: string;
}

interface SavedItem extends CatalogItem {
  _id: string;
  refId: string;
}

const TYPES: { value: string; label: string }[] = [
  { value: "semua", label: "Semua" },
  { value: "jurnal", label: "Jurnal" },
  { value: "skripsi", label: "Skripsi" },
  { value: "tesis", label: "Tesis" },
  { value: "disertasi", label: "Disertasi" },
  { value: "buku", label: "Buku" },
];

function formatCitation(it: { authors: string[]; year: string; title: string; journal: string; publisher: string; doi: string; url: string }): string {
  const authors = it.authors.length ? it.authors.join(", ") : "Anonim";
  const year = it.year || "t.t.";
  const source = it.journal || it.publisher || "";
  const link = it.doi ? `https://doi.org/${it.doi}` : it.url || "";
  return `${authors} (${year}). ${it.title}.${source ? ` ${source}.` : ""}${link ? ` ${link}` : ""}`;
}

export default function KatalogPage() {
  const { status: authStatus } = useSession();
  const [tab, setTab] = useState<"cari" | "pustaka">("cari");

  const [q, setQ] = useState("");
  const [type, setType] = useState("semua");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [results, setResults] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const [library, setLibrary] = useState<SavedItem[]>([]);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const refreshLibrary = useCallback(async () => {
    try {
      const res = await fetch("/api/catalog/library");
      if (!res.ok) return;
      const data = await res.json();
      const items: SavedItem[] = Array.isArray(data?.items) ? data.items : [];
      setLibrary(items);
      setSavedIds(new Set(items.map((i) => i.refId)));
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (authStatus === "authenticated") refreshLibrary();
  }, [authStatus, refreshLibrary]);

  const runSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (q.trim().length < 2) {
      setNotice("Ketik minimal 2 karakter untuk mencari.");
      return;
    }
    setLoading(true);
    setSearched(true);
    setNotice("");
    try {
      const params = new URLSearchParams({ q: q.trim(), type });
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      const res = await fetch(`/api/catalog/search?${params.toString()}`);
      const data = await res.json();
      setResults(Array.isArray(data?.results) ? data.results : []);
    } catch {
      setResults([]);
      setNotice("Gagal mencari. Coba lagi sebentar.");
    } finally {
      setLoading(false);
    }
  };

  const save = async (it: CatalogItem) => {
    const refId = it.doi || it.id;
    setSavedIds((prev) => new Set(prev).add(refId));
    try {
      await fetch("/api/catalog/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...it, refId }),
      });
      refreshLibrary();
    } catch {
      setNotice("Gagal menyimpan ke pustaka.");
    }
  };

  const remove = async (refId: string) => {
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(refId);
      return next;
    });
    setLibrary((prev) => prev.filter((i) => i.refId !== refId));
    try {
      await fetch(`/api/catalog/library?refId=${encodeURIComponent(refId)}`, { method: "DELETE" });
    } catch {
      // ignore
    }
  };

  const copyCitation = async (it: { authors: string[]; year: string; title: string; journal: string; publisher: string; doi: string; url: string }, key: string) => {
    try {
      await navigator.clipboard.writeText(formatCitation(it));
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      setNotice("Tidak bisa menyalin. Salin manual dari detail.");
    }
  };

  const Card = ({ it, saved, onSave, onRemove, copyKey }: {
    it: CatalogItem;
    saved: boolean;
    onSave?: () => void;
    onRemove?: () => void;
    copyKey: string;
  }) => (
    <div className="bg-card border border-border rounded-2xl p-4 shadow-sm space-y-2.5">
      <div className="flex items-start gap-2">
        <FileText size={16} className="text-primary shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-bold text-foreground leading-snug">{it.title}</h3>
          {it.authors.length > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{it.authors.join(", ")}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-[11px]">
        {it.typeLabel && (
          <span className="font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">{it.typeLabel}</span>
        )}
        {it.year && <span className="text-muted-foreground">{it.year}</span>}
        {it.journal && <span className="text-muted-foreground truncate max-w-[55%]">· {it.journal}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        {onSave && (
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            className={`inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg transition-colors min-h-[36px] ${
              saved
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 cursor-default"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            {saved ? <Check size={14} /> : <Plus size={14} />}
            {saved ? "Tersimpan" : "Simpan"}
          </button>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors min-h-[36px]"
          >
            <Trash2 size={14} /> Hapus
          </button>
        )}
        <button
          type="button"
          onClick={() => copyCitation(it, copyKey)}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors min-h-[36px]"
        >
          {copiedId === copyKey ? <Check size={14} /> : <Copy size={14} />}
          {copiedId === copyKey ? "Tersalin" : "Salin sitasi"}
        </button>
        {it.url && (
          <a
            href={it.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:bg-primary/5 transition-colors min-h-[36px]"
          >
            <ExternalLink size={14} /> Buka
          </a>
        )}
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
          <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
            <Library size={20} />
          </span>
          Katalog Riset
        </h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Cari jurnal, skripsi, tesis & disertasi dari katalog akademik (Crossref), simpan ke pustakamu, lalu salin sitasinya.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setTab("cari")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === "cari" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <Search size={15} /> Cari
        </button>
        <button
          type="button"
          onClick={() => setTab("pustaka")}
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-colors ${
            tab === "pustaka" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
          }`}
        >
          <BookMarked size={15} /> Pustaka Saya ({library.length})
        </button>
      </div>

      {notice && (
        <p className="text-xs font-semibold text-muted-foreground bg-muted/50 border border-border rounded-xl px-3 py-2">
          {notice}
        </p>
      )}

      {tab === "cari" ? (
        <div className="space-y-5">
          <form onSubmit={runSearch} className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari judul, topik, atau kata kunci…"
                className="w-full pl-11 pr-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TYPES.map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => setType(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                    type === t.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Dari thn"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-24 px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                />
                <span className="text-muted-foreground text-xs">—</span>
                <input
                  type="number"
                  placeholder="Sampai"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-24 px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all disabled:opacity-60"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
                Cari
              </button>
            </div>
          </form>

          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2].map((i) => (
                <div key={i} className="bg-card border border-border rounded-2xl p-4 space-y-2">
                  <div className="skeleton h-4 w-3/4 rounded" />
                  <div className="skeleton h-3 w-1/2 rounded" />
                </div>
              ))}
            </div>
          ) : results.length > 0 ? (
            <div className="space-y-3">
              {results.map((it) => {
                const refId = it.doi || it.id;
                return (
                  <Card
                    key={refId}
                    it={it}
                    saved={savedIds.has(refId)}
                    onSave={() => save(it)}
                    copyKey={`s-${refId}`}
                  />
                );
              })}
            </div>
          ) : searched ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Tidak ada hasil. Coba kata kunci lain atau ubah filter tipe/tahun.
            </div>
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Mulai cari literatur untuk tugas, makalah, atau skripsimu.
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {library.length > 0 ? (
            library.map((it) => (
              <Card key={it.refId} it={it} saved onRemove={() => remove(it.refId)} copyKey={`l-${it.refId}`} />
            ))
          ) : (
            <div className="text-center py-12 text-sm text-muted-foreground">
              Pustaka masih kosong. Simpan referensi dari tab Cari untuk mengumpulkannya di sini.
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}
