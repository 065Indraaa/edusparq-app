"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Scale,
  Loader2,
  BookOpen,
  X,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
  ShieldCheck,
  Building,
} from "lucide-react";

interface SearchResult {
  id: number;
  snippet: string;
  metadata: {
    type: string;
    node_type: string;
    node_number: string;
  };
  score: number;
  work: {
    frbr_uri: string;
    title: string;
    number: string;
    year: number;
    status: string;
    type: string;
  };
}

interface LawDetail {
  work: any;
  articles: Array<{
    id: number;
    type: string;
    number: string;
    heading: string | null;
    content: string | null;
    parent_id: number | null;
    sort_order: number;
  }>;
}

const TYPES = [
  { value: "", label: "Semua Peraturan" },
  { value: "UUD", label: "UUD 1945" },
  { value: "UU", label: "Undang-Undang (UU)" },
  { value: "PERPPU", label: "Perppu" },
  { value: "PP", label: "Peraturan Pemerintah" },
  { value: "PERPRES", label: "Perpres" },
  { value: "PERMEN", label: "Permen" },
  { value: "PUTUSAN_MK", label: "Putusan MK" },
];

export default function AiHukumMode() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [selectedUri, setSelectedUri] = useState<string | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailData, setDetailData] = useState<LawDetail | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);

    try {
      let url = `/api/hukum/search?q=${encodeURIComponent(query)}&limit=20`;
      if (type) url += `&type=${type}`;

      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal melakukan pencarian");
      }

      setResults(data.results || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (uri: string) => {
    setSelectedUri(uri);
    setDetailLoading(true);
    setDetailData(null);
    setError(null);

    try {
      const res = await fetch(`/api/hukum/detail?uri=${encodeURIComponent(uri)}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Gagal mengambil detail pasal");
      }

      setDetailData(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setDetailLoading(false);
    }
  };

  // Keyboard shortcut to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && selectedUri) {
        setSelectedUri(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedUri]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Scale size={18} />
          </span>
          <h2 className="text-xl md:text-2xl font-extrabold tracking-tight text-foreground">
            Kamus Hukum Indonesia
          </h2>
        </div>
        <p className="text-sm font-medium text-muted-foreground">
          Cari lebih dari 100.000 undang-undang, pasal, dan putusan pengadilan di Indonesia. 
          Didukung oleh API Pasal.id.
        </p>
      </div>

      {/* Search Form */}
      <form onSubmit={handleSearch} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Cari kata kunci (cth: 'pencemaran nama baik', 'ITE', 'UU Cipta Kerja')"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 rounded-xl bg-card/80 border border-border/70 text-sm font-medium placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all shadow-sm"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="px-4 py-3.5 rounded-xl bg-card/80 border border-border/70 text-sm font-bold text-foreground focus:outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition-all cursor-pointer shadow-sm min-w-[180px]"
          >
            {TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="px-6 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold tracking-wide hover:shadow-[0_8px_24px_-12px_hsl(var(--primary))] transition-all disabled:opacity-50 disabled:pointer-events-none flex items-center justify-center min-w-[120px]"
          >
            {loading ? <Loader2 size={18} className="animate-spin" /> : "Cari Pasal"}
          </button>
        </div>
      </form>

      {/* Error Message */}
      {error && (
        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-bold flex items-center gap-2">
          <AlertCircle size={16} />
          {error}
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-bold tracking-tight text-muted-foreground">
            Menampilkan {results.length} hasil pencarian
          </h3>
          <div className="grid gap-4">
            {results.map((r) => {
              const isBerlaku = r.work.status.toLowerCase() === "berlaku";
              return (
                <motion.div
                  key={r.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => loadDetail(r.work.frbr_uri)}
                  className="group relative flex flex-col p-5 rounded-2xl border border-border/70 bg-card/80 hover:border-primary/30 hover:bg-primary/5 hover:shadow-lg transition-all cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-muted text-muted-foreground border border-border">
                          {r.work.type} {r.work.number} / {r.work.year}
                        </span>
                        {isBerlaku ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center gap-1">
                            <ShieldCheck size={10} /> Berlaku
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-destructive/10 text-destructive border border-destructive/20 flex items-center gap-1">
                            <ShieldAlert size={10} /> {r.work.status}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-extrabold tracking-tight text-foreground group-hover:text-primary transition-colors line-clamp-2">
                        {r.work.title}
                      </h3>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-background border flex items-center justify-center shrink-0 group-hover:bg-primary group-hover:text-primary-foreground group-hover:border-primary transition-colors shadow-sm">
                      <ChevronRight size={18} />
                    </div>
                  </div>

                  <div className="relative pl-4 border-l-2 border-primary/30 py-1">
                    <span className="absolute -left-2 top-0 bg-background text-primary text-[10px] px-1 font-bold">
                      {r.metadata.node_type === "pasal" ? `Pasal ${r.metadata.node_number}` : r.metadata.node_type}
                    </span>
                    <p 
                      className="text-sm font-medium text-muted-foreground italic line-clamp-3 mt-1 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: r.snippet.replace(/<mark>/g, '<mark className="bg-primary/20 text-foreground px-1 rounded font-bold">') }} 
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && !error && query && results.length === 0 && (
        <div className="text-center py-16">
          <BookOpen size={48} className="mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-bold text-foreground">Tidak ditemukan</h3>
          <p className="text-sm font-medium text-muted-foreground mt-1">
            Coba gunakan kata kunci lain atau periksa ejaan Anda.
          </p>
        </div>
      )}

      {/* Detail Modal */}
      <AnimatePresence>
        {selectedUri && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex justify-end"
            onClick={() => setSelectedUri(null)}
          >
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 28, stiffness: 300 }}
              className="w-full max-w-2xl bg-card border-l border-border h-full flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-border/50 bg-background/50 backdrop-blur shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                    <Building size={16} />
                  </div>
                  <h2 className="text-sm font-bold tracking-tight">Dokumen Hukum</h2>
                </div>
                <button
                  onClick={() => setSelectedUri(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 no-scrollbar relative">
                {detailLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <Loader2 size={32} className="animate-spin text-primary mb-4" />
                    <p className="text-sm font-medium text-muted-foreground animate-pulse">Mengambil dokumen resmi...</p>
                  </div>
                ) : detailData ? (
                  <div className="space-y-8 max-w-none">
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                          {detailData.work.type_name || detailData.work.type}
                        </span>
                        <span className="px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider bg-muted text-muted-foreground border">
                          Nomor {detailData.work.number} Tahun {detailData.work.year}
                        </span>
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-black uppercase tracking-wider border ${
                          detailData.work.status.toLowerCase() === 'berlaku' 
                            ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' 
                            : 'bg-destructive/10 text-destructive border-destructive/20'
                        }`}>
                          {detailData.work.status}
                        </span>
                      </div>
                      <h1 className="text-2xl font-black tracking-tight leading-snug">
                        {detailData.work.title}
                      </h1>
                    </div>

                    <hr className="border-border/50" />

                    <div className="space-y-6">
                      {detailData.articles && detailData.articles.length > 0 ? (
                        detailData.articles.map((article) => (
                          <div key={article.id} className="scroll-mt-6">
                            {article.type === 'bab' || article.type === 'bagian' ? (
                              <h3 className="text-lg font-bold text-foreground mt-8 mb-4 tracking-tight border-b pb-2">
                                {article.type.toUpperCase()} {article.number}
                                {article.heading && ` - ${article.heading}`}
                              </h3>
                            ) : article.type === 'pasal' ? (
                              <div className="flex gap-4 p-4 rounded-xl hover:bg-muted/30 transition-colors group">
                                <div className="text-sm font-black text-primary shrink-0 w-16 pt-0.5">
                                  Pasal {article.number}
                                </div>
                                <div className="flex-1 text-sm text-foreground/90 leading-relaxed space-y-3 font-serif">
                                  {article.content ? (
                                    <div dangerouslySetInnerHTML={{ __html: article.content.replace(/\n/g, '<br/>') }} />
                                  ) : (
                                    <span className="text-muted-foreground italic">Konten tidak tersedia</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="pl-20 text-sm text-foreground/80 leading-relaxed font-serif">
                                <span className="font-bold mr-2">{article.number}.</span>
                                {article.content}
                              </div>
                            )}
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-10 bg-muted/30 rounded-2xl border border-dashed">
                          <p className="text-sm font-medium text-muted-foreground">Tidak ada detail teks pasal yang tersedia untuk dokumen ini.</p>
                        </div>
                      )}
                    </div>
                  </div>
                ) : error ? (
                  <div className="text-center py-12 text-destructive">
                    <AlertCircle size={32} className="mx-auto mb-3 opacity-50" />
                    <p className="font-bold">{error}</p>
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
