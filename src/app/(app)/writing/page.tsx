"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PenTool, Sparkles, BookOpen, Quote, Plus, Copy, Trash2, RefreshCw, Check, Download, FileText } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatCitation as formatCitationLib, CITATION_STYLES, type CitationStyle } from "@/lib/citation-format";
import DocumentStudio from "./DocumentStudio";

interface Citation {
  _id: string;
  type: string;
  author: string;
  title: string;
  year: string;
  journal: string;
  volume: string;
  issue: string;
  pages: string;
  publisher: string;
  url: string;
}

// A single, generic Indonesian academic paper structure that applies across
// universities. The user's real campus (from their profile) is injected into the
// AI prompt so the outline follows their institution's conventions instead of a
// hardcoded list of four campuses.
const GENERIC_STRUCTURE = [
  "Halaman Judul & Pernyataan Orisinalitas",
  "Abstrak (Bahasa Indonesia & Inggris)",
  "Bab 1: Pendahuluan (Latar Belakang, Rumusan Masalah, Tujuan & Manfaat)",
  "Bab 2: Tinjauan Pustaka (Landasan Teori, Kajian Empiris, Kerangka Pemikiran, Hipotesis)",
  "Bab 3: Metode Penelitian (Desain, Variabel, Populasi & Sampel, Teknik Analisis)",
  "Bab 4: Hasil & Pembahasan (Deskripsi Data, Hasil Pengujian, Interpretasi)",
  "Bab 5: Penutup (Kesimpulan & Saran)",
  "Daftar Pustaka",
];

function formatCitation(cit: Citation, style: CitationStyle) {
  return formatCitationLib(
    {
      author: cit.author,
      title: cit.title,
      year: cit.year,
      journal: cit.journal,
      volume: cit.volume,
      issue: cit.issue,
      page: cit.pages,
      publisher: cit.publisher,
      url: cit.url,
    },
    style
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function WritingPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"dokumen" | "outline" | "paraphrase" | "citation">("dokumen");

  // Real campus context from the user's profile — drives outline conventions.
  const [universitas, setUniversitas] = useState("");
  const [prodi, setProdi] = useState("");

  // Outline
  const [paperTopic, setPaperTopic] = useState("");
  const [citationGuide, setCitationGuide] = useState("APA");
  const [generatedOutline, setGeneratedOutline] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [outlineCopied, setOutlineCopied] = useState(false);

  // Paraphrase
  const [paraMode, setParaMode] = useState<"indonesian" | "english">("indonesian");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isParaphrasing, setIsParaphrasing] = useState(false);

  // Citations
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [loadingCitations, setLoadingCitations] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [newCit, setNewCit] = useState({ author: "", title: "", year: "", journal: "", publisher: "" });

  // Fetch citations from DB
  useEffect(() => {
    if (!session?.user) return;
    setLoadingCitations(true);
    fetch("/api/citations")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCitations(data))
      .finally(() => setLoadingCitations(false));
  }, [session]);

  // Load the user's real campus context so the outline follows their institution.
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/user/profile")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.user) {
          setUniversitas(data.user.universitas || "");
          setProdi(data.user.prodi || "");
        }
      })
      .catch(() => {});
  }, [session]);

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperTopic.trim()) return;
    setIsGenerating(true);
    setGeneratedOutline(null);
    setOutlineCopied(false);

    const campusLabel = universitas.trim() || "perguruan tinggi di Indonesia";
    const fallback = `# Outline: ${paperTopic}\n\nAcuan struktur: ${campusLabel}${
      prodi ? ` (${prodi})` : ""
    }\n\n${GENERIC_STRUCTURE.map((s, i) => `${i + 1}. ${s}`).join("\n")}`;

    const prompt = `Buatkan OUTLINE (kerangka) makalah akademik yang terstruktur dalam Bahasa Indonesia untuk topik berikut:\n"${paperTopic}"\n\nKonteks penulis:\n- Perguruan tinggi: ${campusLabel}\n${
      prodi ? `- Program studi: ${prodi}\n` : ""
    }- Gaya sitasi: ${citationGuide}\n\nGunakan struktur baku karya ilmiah Indonesia berikut sebagai acuan bab/bagian, dan sesuaikan istilah dengan konvensi yang umum dipakai di ${campusLabel}:\n${GENERIC_STRUCTURE.map(
      (s, i) => `${i + 1}. ${s}`
    ).join(
      "\n"
    )}\n\nUntuk tiap bab/bagian, sesuaikan dengan topik di atas dan beri 2-4 sub-poin singkat sebagai isi. Balas dalam format Markdown dengan penomoran yang rapi. Jangan menulis paragraf panjang, cukup kerangka poin.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: prompt, mode: "helper" }),
      });
      if (!res.body) throw new Error("no-body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let result = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              result += JSON.parse(data).text;
              setGeneratedOutline(result);
            } catch {}
          }
        }
      }
      // If the stream produced nothing usable, fall back to the static template.
      if (!result.trim()) setGeneratedOutline(fallback);
    } catch {
      // Graceful degradation — show the static template so nothing breaks.
      setGeneratedOutline(fallback);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadOutline = () => {
    if (!generatedOutline) return;
    const blob = new Blob([generatedOutline], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "outline-edusparq.md";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopyOutline = () => {
    if (!generatedOutline) return;
    navigator.clipboard.writeText(generatedOutline);
    setOutlineCopied(true);
    setTimeout(() => setOutlineCopied(false), 2000);
  };

  const handleParaphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setIsParaphrasing(true);
    setOutputText("");

    // Stream from Groq via chat API with a system prompt for paraphrasing
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: `Parafrase kalimat berikut menjadi bahasa ${paraMode === "indonesian" ? "Indonesia" : "Inggris"} yang akademik dan formal. Hanya balas dengan hasil parafrasenya saja, tanpa penjelasan tambahan:\n\n"${inputText}"`,
        mode: "helper",
      }),
    });

    if (!res.body) { setIsParaphrasing(false); return; }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let result = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const lines = decoder.decode(value).split("\n");
      for (const line of lines) {
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") break;
          try { result += JSON.parse(data).text; setOutputText(result); } catch {}
        }
      }
    }
    setIsParaphrasing(false);
  };

  const handleAddCitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCit.author || !newCit.title || !newCit.year) return;

    const res = await fetch("/api/citations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newCit,
        type: newCit.journal ? "Jurnal" : "Buku",
        volume: "1", issue: "1", pages: "10-25",
      }),
    });
    if (res.ok) {
      const cit = await res.json();
      setCitations((prev) => [cit, ...prev]);
      setNewCit({ author: "", title: "", year: "", journal: "", publisher: "" });
    }
  };

  const handleDeleteCitation = async (id: string) => {
    await fetch(`/api/citations/${id}`, { method: "DELETE" });
    setCitations((prev) => prev.filter((c) => c._id !== id));
  };

  const handleCopy = (cit: Citation) => {
    navigator.clipboard.writeText(formatCitation(cit, citationStyle));
    setCopiedId(cit._id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleCopyAllCitations = () => {
    if (citations.length === 0) return;
    const all = citations.map((c) => formatCitation(c, citationStyle)).join("\n");
    navigator.clipboard.writeText(all);
    setCopiedId("__all__");
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
            <PenTool size={14} /> Menulis Akademik
          </div>
          <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-black tracking-tight text-gradient">Asisten Menulis</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Susun kerangka makalah, parafrasekan teks, dan kelola daftar pustaka dalam satu tempat.
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="flex bg-muted p-1 rounded-2xl gap-1 max-w-md">
        {[
          { id: "dokumen", label: "Dokumen", icon: FileText },
          { id: "outline", label: "Kerangka", icon: BookOpen },
          { id: "paraphrase", label: "Parafrase", icon: Sparkles },
          { id: "citation", label: "Pustaka", icon: Quote },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            aria-pressed={activeTab === id}
            className={`flex-1 flex items-center justify-center gap-2 min-h-[44px] px-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </motion.div>

      {activeTab === "dokumen" ? (
        <DocumentStudio universitas={universitas} prodi={prodi} />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">

          {/* Outline Generator */}
          {activeTab === "outline" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="space-y-1">
                <h2 className="font-bold text-foreground">Susun Kerangka Makalah</h2>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Kerangka disusun mengikuti struktur karya ilmiah Indonesia dan disesuaikan dengan
                  perguruan tinggi Anda.
                </p>
              </div>

              {/* Real campus context from profile */}
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                {universitas ? (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary font-semibold">
                    <BookOpen size={12} /> {universitas}{prodi ? ` · ${prodi}` : ""}
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-muted text-muted-foreground font-medium">
                    Lengkapi universitas di halaman Profil agar kerangka lebih relevan.
                  </span>
                )}
              </div>

              <form onSubmit={handleGenerateOutline} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Gaya sitasi</label>
                  <select
                    value={citationGuide}
                    onChange={(e) => setCitationGuide(e.target.value)}
                    className="w-full px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  >
                    {CITATION_STYLES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Topik atau judul sementara</label>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Pengaruh inklusi keuangan terhadap kesejahteraan petani..."
                    value={paperTopic}
                    onChange={(e) => setPaperTopic(e.target.value)}
                    className="w-full px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full min-h-[48px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <><Sparkles size={15} /> Susun Kerangka</>}
                </button>
              </form>

              {generatedOutline && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-t border-border pt-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm text-foreground">Kerangka {universitas.trim() || "Karya Ilmiah"}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={handleCopyOutline}
                        className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs text-primary font-semibold hover:underline"
                      >
                        {outlineCopied ? <Check size={13} /> : <Copy size={13} />}
                        {outlineCopied ? "Tersalin" : "Salin"}
                      </button>
                      <button
                        onClick={handleDownloadOutline}
                        className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs text-primary font-semibold hover:underline"
                      >
                        <Download size={13} /> Unduh .md
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {generatedOutline}
                    {isGenerating && (
                      <span className="inline-flex gap-1 ml-1 align-middle">
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms] opacity-70" />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms] opacity-70" />
                        <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms] opacity-70" />
                      </span>
                    )}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Paraphrase */}
          {activeTab === "paraphrase" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <h2 className="font-bold text-foreground">Parafrase Teks</h2>
                <div className="flex bg-muted p-1 rounded-xl gap-1">
                  {["indonesian", "english"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setParaMode(m as typeof paraMode)}
                      aria-pressed={paraMode === m}
                      className={`px-3 min-h-[36px] rounded-lg text-xs font-bold transition-all ${
                        paraMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {m === "indonesian" ? "Indonesia" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleParaphrase} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Teks yang akan diparafrasekan</label>
                  <textarea
                    required
                    rows={5}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={paraMode === "indonesian"
                      ? "Ketik atau tempelkan teks Anda di sini. Bahasa nonformal akan disusun ulang menjadi bahasa akademik..."
                      : "Type or paste your text here. Casual language will be rewritten into an academic style..."}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isParaphrasing || !inputText.trim()}
                  className="w-full min-h-[48px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-60 disabled:shadow-none flex items-center justify-center gap-2"
                >
                  {isParaphrasing ? <RefreshCw size={16} className="animate-spin" /> : <><Sparkles size={15} /> Parafrasekan</>}
                </button>
              </form>

              {outputText && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Hasil parafrase</label>
                    <button
                      onClick={() => navigator.clipboard.writeText(outputText)}
                      className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs text-primary font-semibold hover:underline"
                    >
                      <Copy size={13} /> Salin
                    </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 text-sm text-foreground leading-relaxed">
                    {outputText}
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* Citations */}
          {activeTab === "citation" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-bold text-foreground">Daftar Pustaka</h2>
                <div className="flex bg-muted p-1 rounded-xl gap-1">
                  {CITATION_STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setCitationStyle(s)}
                      aria-pressed={citationStyle === s}
                      className={`px-3 min-h-[36px] rounded-lg text-xs font-bold transition-all ${
                        citationStyle === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {citations.length > 0 && (
                <button
                  onClick={handleCopyAllCitations}
                  className="flex items-center gap-1.5 min-h-[36px] text-xs font-semibold text-primary hover:underline"
                >
                  {copiedId === "__all__" ? <Check size={13} /> : <Copy size={13} />}
                  {copiedId === "__all__" ? "Seluruhnya tersalin" : `Salin seluruhnya (${citations.length})`}
                </button>
              )}

              {loadingCitations ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : citations.length === 0 ? (
                <div className="py-10 text-center space-y-1.5">
                  <p className="text-sm font-semibold text-foreground">Belum ada referensi tersimpan</p>
                  <p className="text-xs text-muted-foreground">Tambahkan referensi pertama Anda melalui formulir di bawah.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {citations.map((cit) => (
                    <div key={cit._id} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2.5 hover-lift transition-all">
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wide text-primary">{cit.type}</span>
                      <p className="text-sm text-foreground leading-relaxed select-text font-serif">
                        {formatCitation(cit, citationStyle)}
                      </p>
                      <div className="flex gap-1 pt-2 border-t border-border">
                        <button
                          onClick={() => handleCopy(cit)}
                          className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs font-semibold text-primary hover:underline"
                        >
                          {copiedId === cit._id ? <Check size={13} /> : <Copy size={13} />}
                          {copiedId === cit._id ? "Tersalin" : "Salin"}
                        </button>
                        <button
                          onClick={() => handleDeleteCitation(cit._id)}
                          className="flex items-center gap-1.5 min-h-[36px] px-2 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={13} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add citation form */}
              <form onSubmit={handleAddCitation} className="p-4 rounded-2xl bg-muted/40 border border-dashed border-border space-y-3">
                <span className="text-sm font-bold text-foreground flex items-center gap-1.5"><Plus size={15} className="text-primary" /> Tambah referensi</span>
                <div className="grid grid-cols-2 gap-3">
                  <input required placeholder="Penulis (contoh: Sugiyono, B.)" value={newCit.author}
                    onChange={(e) => setNewCit({ ...newCit, author: e.target.value })}
                    className="col-span-2 px-3 min-h-[44px] rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  <input required placeholder="Judul" value={newCit.title}
                    onChange={(e) => setNewCit({ ...newCit, title: e.target.value })}
                    className="col-span-2 px-3 min-h-[44px] rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  <input required placeholder="Tahun" value={newCit.year} type="number"
                    onChange={(e) => setNewCit({ ...newCit, year: e.target.value })}
                    className="px-3 min-h-[44px] rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                  <input placeholder="Nama jurnal (opsional)" value={newCit.journal}
                    onChange={(e) => setNewCit({ ...newCit, journal: e.target.value })}
                    className="px-3 min-h-[44px] rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" />
                </div>
                <button type="submit"
                  className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2">
                  <Plus size={15} /> Simpan
                </button>
              </form>
            </div>
          )}
        </motion.div>

        {/* Right panel */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <BookOpen size={16} className="text-primary" />
              Panduan Sitasi
            </h3>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="p-3.5 rounded-xl bg-muted/50 space-y-1">
                <span className="font-bold text-foreground block">Format APA Edisi 7</span>
                <p className="leading-relaxed">Format yang paling umum digunakan di Indonesia. Nama Belakang, Inisial. (Tahun). Judul. Nama Jurnal, Vol(No), Halaman.</p>
              </div>
              <div className="p-3.5 rounded-xl bg-muted/50 space-y-1">
                <span className="font-bold text-foreground block">Penggunaan parafrase</span>
                <p className="leading-relaxed">Hasil parafrase AI berfungsi sebagai panduan awal. Periksa kembali konteks dan maknanya sebelum Anda kirimkan.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
      )}
    </motion.div>
  );
}
