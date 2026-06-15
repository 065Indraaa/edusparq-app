"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Copy, Check, RefreshCw, Quote, Bookmark, SlidersHorizontal, CalendarDays, BookmarkPlus } from "lucide-react";
import { useSession } from "next-auth/react";

// Generic fallback topics
const GENERIC_TOPICS = [
  "Dampak AI terhadap pendidikan tinggi",
  "Kesehatan mental mahasiswa",
  "Literasi digital generasi Z",
  "Energi terbarukan & transisi hijau",
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function ResearchPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [topics, setTopics] = useState<string[]>(GENERIC_TOPICS);
  const [prodi, setProdi] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    Promise.all([
      fetch("/api/courses").then((r) => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/user/profile").then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([courses, profile]) => {
      if (!active) return;
      const userProdi = profile?.user?.prodi || "";
      setProdi(userProdi);
      const courseNames: string[] = Array.isArray(courses)
        ? courses.map((c: { name?: string }) => c?.name).filter((n): n is string => Boolean(n))
        : [];
      if (courseNames.length > 0) {
        setTopics(courseNames.slice(0, 8).map((name) => `Isu terkini dalam ${name}`));
      } else if (userProdi) {
        setTopics([
          `Tren penelitian terbaru di bidang ${userProdi}`,
          `Tantangan utama ${userProdi} di Indonesia`,
          `Penerapan teknologi pada ${userProdi}`,
          `Studi kasus ${userProdi} di Indonesia`,
        ]);
      }
    });
    return () => { active = false; };
  }, [session]);

  const runSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setIsLoading(true);
    setResult("");
    setError(false);

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: q, prodi }),
      });
      if (!res.body) throw new Error("no-body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              accumulated += JSON.parse(data).text;
              setResult(accumulated);
            } catch {}
          }
        }
      }
      if (!accumulated.trim()) setError(true);
    } catch {
      setError(true);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runSearch(query);
  };

  const handleTopic = (topic: string) => {
    setQuery(topic);
    inputRef.current?.focus();
    runSearch(topic);
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!result || isSaving) return;
    setIsSaving(true);
    try {
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: `Hasil Kajian: ${query}`,
          content: result,
          query: query,
        }),
      });
      if (!res.ok) throw new Error("Gagal menyimpan");
      alert("Berhasil disimpan ke Pustaka Saya!");
    } catch (err) {
      alert("Gagal menyimpan atau dokumen sudah ada di Pustaka.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full pb-24">
      {/* Page Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-2">Katalog Riset</h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Jelajahi ribuan literatur akademik, jurnal, dan publikasi penelitian terkini untuk mendukung studi Anda. Diperkuat oleh Crossref & AI.
          </p>
        </div>
        <div className="flex gap-4">
          <a href="/library" className="bg-card/80 backdrop-blur-md border border-border px-5 py-2.5 rounded-xl flex items-center gap-2 text-foreground font-semibold hover:bg-muted transition-all shadow-sm">
            <Bookmark size={18} className="text-primary fill-primary/20" />
            Pustaka Saya
          </a>
        </div>
      </motion.div>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Left Sidebar Filter (Visual Mockup adapted from Stitch HTML) */}
        <motion.aside variants={itemVariants} className="w-full lg:w-64 flex-shrink-0 space-y-8">
          <div className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-6 shadow-sm">
            <h3 className="font-semibold text-foreground mb-4 flex items-center gap-2">
              <SlidersHorizontal size={18} /> Filter Lanjutan
            </h3>
            <div className="space-y-6">
              {/* Tipe Dokumen */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block font-semibold">Tipe Dokumen</label>
                <div className="space-y-3">
                  {["Jurnal (Peer-Reviewed)", "Skripsi / Tugas Akhir", "Tesis & Disertasi", "Prosiding Konferensi"].map((type, idx) => (
                    <label key={type} className="flex items-center gap-3 cursor-pointer group">
                      <div className="relative flex items-center justify-center w-4 h-4">
                        <input type="checkbox" defaultChecked={idx === 0} className="peer appearance-none w-4 h-4 border border-input rounded bg-background checked:bg-primary checked:border-primary transition-all" />
                        <Check size={12} strokeWidth={4} className="absolute text-primary-foreground opacity-0 peer-checked:opacity-100 pointer-events-none" />
                      </div>
                      <span className={`text-sm transition-colors ${idx === 0 ? "text-foreground font-medium" : "text-muted-foreground group-hover:text-foreground"}`}>
                        {type}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <hr className="border-border/50" />
              {/* Rentang Tahun */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block font-semibold">Tahun Publikasi</label>
                <div className="flex items-center gap-2">
                  <input type="text" placeholder="Dari" className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary text-sm outline-none transition-all" />
                  <span className="text-muted-foreground">-</span>
                  <input type="text" placeholder="Sampai" className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary text-sm outline-none transition-all" />
                </div>
                <div className="flex flex-wrap gap-2 mt-3">
                  <button className="px-2 py-1 bg-muted border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">Tahun ini</button>
                  <button className="px-2 py-1 bg-muted border border-border rounded text-xs text-muted-foreground hover:text-foreground hover:border-foreground transition-colors">5 Tahun Terakhir</button>
                </div>
              </div>
              <hr className="border-border/50" />
              {/* Bidang Ilmu */}
              <div>
                <label className="text-xs text-muted-foreground uppercase tracking-wider mb-3 block font-semibold">Bidang Ilmu</label>
                <select className="w-full px-3 py-2 border border-input rounded-lg bg-background focus:border-primary focus:ring-1 focus:ring-primary text-sm outline-none transition-all text-foreground cursor-pointer">
                  <option>Semua Bidang</option>
                  <option>Ilmu Komputer</option>
                  <option>Psikologi</option>
                  <option>Ekonomi</option>
                  <option>Sastra</option>
                </select>
              </div>
            </div>
          </div>
        </motion.aside>

        {/* Right Content Area */}
        <motion.div variants={itemVariants} className="flex-1 space-y-6">
          {/* Real Search Bar mapped into the Stitch style control bar */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border border-border rounded-2xl p-2 shadow-sm">
            <form onSubmit={handleSubmit} className="relative w-full flex-1">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Masukkan kata kunci penelitian (contoh: dampak AI pada UI/UX)..."
                className="w-full pl-10 pr-28 py-3 rounded-xl bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-1 top-1/2 -translate-y-1/2 px-4 py-2 bg-foreground text-background font-semibold text-sm rounded-lg hover:bg-foreground/90 transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <><RefreshCw size={14} className="animate-spin" /> Mencari</> : "Pencarian AI"}
              </button>
            </form>
            <div className="flex items-center gap-2 w-full sm:w-auto px-4 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0">
              <span className="text-sm text-muted-foreground whitespace-nowrap">Urutkan:</span>
              <select className="bg-transparent text-sm font-semibold text-foreground outline-none cursor-pointer">
                <option>Relevansi AI</option>
                <option>Sitasi Terbanyak</option>
                <option>Terbaru</option>
              </select>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            {isLoading ? "Mengumpulkan referensi dari Crossref..." : result ? "Menampilkan hasil riset terpadu." : "Silakan masukkan kata kunci atau pilih topik rekomendasi di bawah."}
          </p>

          {/* Quick Topics */}
          {!result && !isLoading && (
            <div className="flex flex-wrap gap-2 pt-2">
              {topics.map((topic) => (
                <button
                  key={topic}
                  onClick={() => handleTopic(topic)}
                  className="px-4 py-2 rounded-lg bg-muted border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors"
                >
                  {topic}
                </button>
              ))}
            </div>
          )}

          {/* AI Result Card (Modeled after Stitch's "Paper Card") */}
          {(result || isLoading || error) && (
            <div className="space-y-4">
              {error ? (
                <article className="bg-card/80 backdrop-blur-md border border-border rounded-2xl p-8 text-center shadow-sm">
                  <div className="w-12 h-12 mx-auto rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mb-4">
                    <RefreshCw size={24} />
                  </div>
                  <h3 className="text-lg font-bold text-foreground mb-2">Gagal Menarik Data</h3>
                  <p className="text-sm text-muted-foreground">Server jurnal sedang sibuk. Silakan coba lagi.</p>
                </article>
              ) : (
                <article className="bg-card/80 backdrop-blur-md rounded-2xl p-6 md:p-8 hover:shadow-lg transition-shadow duration-300 relative group border-l-4 border-l-primary border-t border-r border-b border-border shadow-sm flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded">Sintesis Literatur AI</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><CalendarDays size={14} /> Live Crossref Data</span>
                      <span className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles size={14} /> Di-generate Otomatis</span>
                    </div>
                    
                    <h3 className="font-display text-2xl md:text-3xl font-bold text-foreground mb-4 leading-tight">
                      Hasil Kajian: {query}
                    </h3>
                    
                    <div className="prose prose-sm dark:prose-invert max-w-none text-muted-foreground leading-relaxed whitespace-pre-wrap">
                      {result}
                      {isLoading && (
                        <span className="inline-flex gap-1 ml-2 align-middle">
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms] opacity-70" />
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms] opacity-70" />
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms] opacity-70" />
                        </span>
                      )}
                    </div>

                    {!isLoading && result && (
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-8 pt-4 border-t border-border">
                        <Quote size={16} className="text-primary/50" /> Data disintesis dari 5 jurnal teratas untuk menghindari halusinasi teks.
                      </div>
                    )}
                  </div>

                  {/* Right Actions Bar (from Stitch layout) */}
                  <div className="flex md:flex-col gap-3 justify-end items-end md:w-40 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6 mt-4 md:mt-0">
                    <button onClick={handleCopy} disabled={isLoading} className="w-full py-2.5 bg-foreground text-background rounded-xl font-semibold text-xs hover:bg-foreground/90 transition-colors flex justify-center items-center gap-2">
                      {copied ? <Check size={16} /> : <Copy size={16} />}
                      {copied ? "Tersalin" : "Salin Teks"}
                    </button>
                    <button onClick={handleSave} disabled={isLoading || isSaving} className="w-full py-2.5 bg-transparent border border-border text-foreground rounded-xl font-semibold text-xs hover:bg-muted transition-colors flex justify-center items-center gap-2">
                      <BookmarkPlus size={16} /> {isSaving ? "Menyimpan..." : "Simpan Draft"}
                    </button>
                  </div>
                </article>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </motion.div>
  );
}
