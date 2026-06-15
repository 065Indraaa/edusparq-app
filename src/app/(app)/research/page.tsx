"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Search, Sparkles, Copy, Check, RefreshCw, Quote } from "lucide-react";
import { useSession } from "next-auth/react";

// Generic fallback topics, used only when the user has no courses/prodi yet.
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
  show: {
    opacity: 1,
    y: 0,
    transition: { type: "spring" as const, stiffness: 300, damping: 26 },
  },
};

export default function ResearchPage() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);
  const [topics, setTopics] = useState<string[]>(GENERIC_TOPICS);
  const [topicsFromCourses, setTopicsFromCourses] = useState(false);
  const [prodi, setProdi] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  // Build topic suggestions from the user's real courses (and prodi). This keeps
  // suggestions relevant to whatever the student is actually studying, on any campus.
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
        const derived = courseNames
          .slice(0, 8)
          .map((name) => `Isu terkini dalam ${name}`);
        setTopics(derived);
        setTopicsFromCourses(true);
      } else if (userProdi) {
        setTopics([
          `Tren penelitian terbaru di bidang ${userProdi}`,
          `Tantangan utama ${userProdi} di Indonesia`,
          `Penerapan teknologi pada ${userProdi}`,
          `Studi kasus ${userProdi} di Indonesia`,
        ]);
        setTopicsFromCourses(true);
      }
    });
    return () => {
      active = false;
    };
  }, [session]);

  const runSearch = async (q: string) => {
    if (!q.trim() || isLoading) return;
    setIsLoading(true);
    setResult("");
    setError(false);

    const prompt = `Kamu asisten riset akademik. ${
      prodi ? `Penanya adalah mahasiswa program studi ${prodi}. ` : ""
    }Untuk topik/pertanyaan riset berikut, berikan dalam Bahasa Indonesia:\n"${q}"\n\n1. 3-5 sudut pandang / angle penelitian yang relevan dan bisa diteliti.\n2. Daftar kata kunci & referensi kunci (nama penulis/teori/jurnal yang biasa dipakai di bidang ini).\n3. Ringkasan singkat tinjauan literatur (literature overview) 1-2 paragraf.\n\nBalas rapi dengan heading bernomor. Ingatkan bahwa referensi yang disebut perlu diverifikasi sendiri.`;

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
      className="space-y-6 max-w-4xl"
    >
      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-sm bg-grid">
        <div className="relative space-y-2">
          <h1 className="font-display tracking-tight text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
            <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
              <Search size={20} />
            </span>
            Penelitian
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Temukan sudut pandang riset, referensi kunci, dan gambaran literatur untuk topik yang Anda kaji.
          </p>

          {/* Search bar */}
          <motion.form variants={itemVariants} onSubmit={handleSubmit} className="pt-3">
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
                placeholder="Cari jurnal, artikel, atau topik penelitian..."
                className="w-full pl-12 pr-28 min-h-[56px] rounded-2xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-sm"
              />
              <button
                type="submit"
                disabled={isLoading || !query.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all shadow-sm shadow-primary/20 disabled:opacity-50 disabled:shadow-none flex items-center gap-1.5"
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
        </div>
      </motion.div>

      {/* Topic suggestions */}
      <motion.div variants={itemVariants} className="space-y-3">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {topicsFromCourses ? "Berdasarkan mata kuliah & prodi Anda" : "Topik untuk memulai"}
        </span>
        <div className="flex flex-wrap gap-2">
          {topics.map((topic) => (
            <button
              key={topic}
              onClick={() => handleTopic(topic)}
              disabled={isLoading}
              className="px-4 min-h-[44px] rounded-full bg-muted border border-border text-xs font-medium text-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-all disabled:opacity-60"
            >
              {topic}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Result / states */}
      <motion.div variants={itemVariants}>
        {error ? (
          <div className="bg-card border border-border rounded-3xl p-8 text-center space-y-3 shadow-sm">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-400/10 text-amber-500 flex items-center justify-center">
              <RefreshCw size={22} />
            </div>
            <p className="text-sm font-bold text-foreground">
              Asisten riset belum dapat dihubungi.
            </p>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              Silakan coba kembali beberapa saat lagi atau perbarui kata kunci Anda. Topik populer di atas tetap dapat dipilih.
            </p>
          </div>
        ) : result || isLoading ? (
          <div className="bg-card border border-border rounded-3xl p-6 sm:p-7 space-y-4 shadow-sm animate-fade-up">
            <div className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[11px] font-bold">
                <Sparkles size={12} /> AI · Mode Riset
              </span>
              {result && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs font-semibold text-primary hover:underline"
                >
                  {copied ? <Check size={13} /> : <Copy size={13} />}
                  {copied ? "Tersalin" : "Salin"}
                </button>
              )}
            </div>

            <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words">
              {result}
              {isLoading && (
                <span className="inline-flex gap-1 ml-1 align-middle">
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms] opacity-70" />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms] opacity-70" />
                  <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms] opacity-70" />
                </span>
              )}
            </div>

            {result && !isLoading && (
              <div className="flex items-start gap-2.5 pt-4 border-t border-border text-xs text-muted-foreground">
                <Quote size={15} className="shrink-0 mt-0.5 text-amber-400" />
                <p className="leading-relaxed">
                  Hasil ini disusun oleh AI. Seluruh referensi dan data yang disebutkan wajib Anda verifikasi secara mandiri sebelum digunakan dalam tugas atau publikasi.
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="bg-card border border-dashed border-border rounded-3xl p-10 text-center space-y-4 shadow-sm">
            <div className="w-16 h-16 mx-auto rounded-3xl bg-gradient-to-br from-primary/15 to-teal-500/15 text-primary flex items-center justify-center">
              <Search size={28} />
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-foreground">Mulai eksplorasi riset Anda</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
                Tuliskan topik pada kolom pencarian atau pilih salah satu topik populer di atas untuk memperoleh sudut pandang penelitian dan referensi awal.
              </p>
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
