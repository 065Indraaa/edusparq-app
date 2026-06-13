"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Copy, Check, RefreshCw, Quote } from "lucide-react";

const POPULAR_TOPICS = [
  "Dampak AI terhadap pendidikan tinggi",
  "Inklusi keuangan petani Indonesia",
  "Kesehatan mental mahasiswa",
  "Energi terbarukan & transisi hijau",
  "Ekonomi digital UMKM",
  "Perubahan iklim & ketahanan pangan",
  "Literasi digital generasi Z",
  "Smart city di Indonesia",
];

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 26 },
  },
};

export default function ResearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const runSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setIsLoading(true);
    setResult("");
    setError(false);

    const prompt = `Kamu asisten riset akademik. Untuk topik/pertanyaan riset berikut, berikan dalam Bahasa Indonesia:\n"${q}"\n\n1. 3-5 sudut pandang / angle penelitian yang relevan dan bisa diteliti.\n2. Daftar kata kunci & referensi kunci (nama penulis/teori/jurnal yang biasa dipakai di bidang ini).\n3. Ringkasan singkat tinjauan literatur (literature overview) 1-2 paragraf.\n\nBalas rapi dengan heading bernomor. Ingatkan bahwa referensi yang disebut perlu diverifikasi sendiri.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, mode: "research" }),
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

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="space-y-6 max-w-3xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Search size={24} className="text-primary" />
          Penelitian
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Temukan sudut pandang riset, referensi kunci, dan gambaran literatur untuk topikmu.
        </p>
      </motion.div>

      {/* Search bar */}
      <motion.form variants={itemVariants} onSubmit={handleSubmit}>
        <div className="relative">
          <Search
            size={20}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari jurnal, paper, atau topik penelitian..."
            className="w-full pl-12 pr-28 py-4 rounded-2xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
          />
          <button
            type="submit"
            disabled={isLoading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all disabled:opacity-50 flex items-center gap-1.5"
          >
            {isLoading ? (
              <RefreshCw size={15} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={14} /> Cari
              </>
            )}
          </button>
        </div>
      </motion.form>

      {/* Popular topics */}
      <motion.div variants={itemVariants} className="space-y-2.5">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Topik Populer
        </span>
        <div className="flex flex-wrap gap-2">
          {POPULAR_TOPICS.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopic(topic)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-full bg-muted border border-border text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary transition-all disabled:opacity-60"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Result / states */}
      <motion.div variants={itemVariants}>
        {error ? (
          <div className="bg-card border border-border rounded-3xl p-6 text-center space-y-2 shadow-sm">
            <p className="text-sm font-bold text-foreground">
              Yah, asisten riset lagi nggak bisa dihubungi.
            </p>
            <p className="text-xs text-muted-foreground">
              Coba ulangi beberapa saat lagi, atau ubah kata kuncinya. Topik populer di atas tetap bisa dipilih.
            </p>
          </div>
        ) : result || isLoading ? (
          <div className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                <Sparkles size={12} /> AI • mode Riset
              </span>
              {result && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "Tersalin!" : "Salin"}
                </button>
              )}
            </div>

            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {result}
              {isLoading && (
                <span className="inline-flex gap-0.5 ml-1 align-middle">
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                  <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
                </span>
              )}
            </div>

            {result && !isLoading && (
              <div className="flex items-start gap-2 pt-3 border-t border-border text-xs text-muted-foreground">
                <Quote size={14} className="shrink-0 mt-0.5 text-amber-400" />
                <p className="leading-relaxed">
                  Ini hasil AI. Referensi & data yang disebutkan wajib kamu verifikasi mandiri
                  sebelum dipakai di tugas atau publikasi.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-3xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-14 h-14 mx-auto rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
              <Search size={26} />
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-foreground text-sm">Mulai eksplorasi risetmu</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Ketik topik di kolom pencarian atau pilih salah satu topik populer di atas untuk
                dapat sudut pandang penelitian dan referensi awal.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
