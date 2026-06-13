"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { PenTool, Sparkles, BookOpen, Quote, Plus, Copy, Trash2, RefreshCw, Check, Download } from "lucide-react";
import { useSession } from "next-auth/react";
import { formatCitation as formatCitationLib, CITATION_STYLES, type CitationStyle } from "@/lib/citation-format";

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

const uniTemplates = {
  UI: {
    name: "Universitas Indonesia (UI 2026)",
    structure: [
      "Halaman Judul & Pernyataan Orisinalitas",
      "Abstrak (Bahasa Indonesia & Inggris, max 250 kata)",
      "Bab 1: Pendahuluan (Latar Belakang, Perumusan Masalah, Tujuan & Manfaat)",
      "Bab 2: Tinjauan Pustaka (Teori Utama, Kajian Empiris, Kerangka Pemikiran, Hipotesis)",
      "Bab 3: Metode Penelitian (Desain, Variabel, Populasi & Sampel, Metode Analisis)",
      "Bab 4: Hasil & Pembahasan (Deskripsi Data, Hasil Pengujian, Interpretasi)",
      "Bab 5: Penutup (Kesimpulan & Saran)",
      "Daftar Pustaka (Format APA Edisi 7)",
    ],
  },
  UGM: {
    name: "Universitas Gadjah Mada (UGM)",
    structure: [
      "Halaman Judul, Lembar Pengesahan, Kata Pengantar",
      "Intisari (Abstrak Indonesia & Abstract Inggris)",
      "Bab I: Pendahuluan (Latar Belakang, Rumusan Masalah, Keaslian Penelitian)",
      "Bab II: Landasan Teori & Tinjauan Pustaka",
      "Bab III: Metode Penelitian",
      "Bab IV: Hasil Penelitian & Pembahasan",
      "Bab V: Kesimpulan, Keterbatasan & Saran",
      "Daftar Pustaka (Gaya Harvard UGM)",
    ],
  },
  ITB: {
    name: "Institut Teknologi Bandung (ITB)",
    structure: [
      "Sampul Depan & Halaman Pengesahan",
      "Abstrak (Satu Paragraf, max 200 kata, Kata Kunci)",
      "Bab 1: Pendahuluan (Latar Belakang, Ruang Lingkup, Tujuan)",
      "Bab 2: Tinjauan Pustaka (Kerangka Teoretis, State of the Art)",
      "Bab 3: Metodologi / Perancangan Sistem",
      "Bab 4: Pengujian & Analisis Hasil",
      "Bab 5: Simpulan & Saran",
      "Daftar Pustaka (Format IEEE / Harvard)",
    ],
  },
  UNPAD: {
    name: "Universitas Padjadjaran (Unpad)",
    structure: [
      "Bagian Awal (Judul, Abstrak, Abstract)",
      "Bab I: Pendahuluan (Latar Belakang, Identifikasi Masalah)",
      "Bab II: Kajian Pustaka & Kerangka Pemikiran",
      "Bab III: Objek & Metode Penelitian",
      "Bab IV: Hasil Penelitian & Pembahasan",
      "Bab V: Simpulan & Saran",
      "Daftar Pustaka (Format Turabian / APA)",
    ],
  },
};

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
  const [activeTab, setActiveTab] = useState<"outline" | "paraphrase" | "citation">("outline");

  // Outline
  const [selectedUni, setSelectedUni] = useState<keyof typeof uniTemplates>("UI");
  const [paperTopic, setPaperTopic] = useState("");
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

  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paperTopic.trim()) return;
    setIsGenerating(true);
    setGeneratedOutline(null);
    setOutlineCopied(false);

    const tpl = uniTemplates[selectedUni];
    const fallback = `# Outline: ${paperTopic}\n\nFormat: ${tpl.name}\n\n${tpl.structure
      .map((s, i) => `${i + 1}. ${s}`)
      .join("\n")}`;

    const prompt = `Buatkan OUTLINE (kerangka) makalah akademik yang terstruktur dalam Bahasa Indonesia untuk topik berikut:\n"${paperTopic}"\n\nGunakan struktur panduan kampus ${tpl.name} sebagai acuan bab/bagian:\n${tpl.structure
      .map((s, i) => `${i + 1}. ${s}`)
      .join(
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
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <PenTool size={24} className="text-primary" />
          Asisten Nulis
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Outline makalah, parafrasa teks, kelola daftar pustaka — semua di satu tempat.
        </p>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="flex bg-muted p-1 rounded-2xl gap-1 max-w-md">
        {[
          { id: "outline", label: "Outline", icon: BookOpen },
          { id: "paraphrase", label: "Parafrase", icon: Sparkles },
          { id: "citation", label: "Pustaka", icon: Quote },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">

          {/* Outline Generator */}
          {activeTab === "outline" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <h2 className="font-bold text-foreground">Buat Struktur Makalah</h2>
              <form onSubmit={handleGenerateOutline} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Format panduan kampus</label>
                  <select
                    value={selectedUni}
                    onChange={(e) => setSelectedUni(e.target.value as keyof typeof uniTemplates)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                  >
                    {Object.entries(uniTemplates).map(([key, val]) => (
                      <option key={key} value={key}>{val.name}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Topik atau judul sementara kamu</label>
                  <input
                    type="text"
                    required
                    placeholder="Misal: Pengaruh inklusi keuangan terhadap kesejahteraan petani..."
                    value={paperTopic}
                    onChange={(e) => setPaperTopic(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isGenerating}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <><Sparkles size={15} /> Buat Outline</>}
                </button>
              </form>

              {generatedOutline && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="border-t border-border pt-5 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="font-bold text-sm text-foreground">Struktur {uniTemplates[selectedUni].name}</span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={handleCopyOutline}
                        className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                      >
                        {outlineCopied ? <Check size={12} /> : <Copy size={12} />}
                        {outlineCopied ? "Tersalin!" : "Salin"}
                      </button>
                      <button
                        onClick={handleDownloadOutline}
                        className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                      >
                        <Download size={12} /> Unduh .md
                      </button>
                    </div>
                  </div>
                  <div className="p-4 rounded-2xl bg-muted/40 border border-border text-sm text-foreground leading-relaxed whitespace-pre-wrap break-words font-mono">
                    {generatedOutline}
                    {isGenerating && (
                      <span className="inline-flex gap-0.5 ml-1 align-middle">
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
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
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground">Parafrase & Perbaikan Teks</h2>
                <div className="flex bg-muted p-0.5 rounded-xl gap-0.5">
                  {["indonesian", "english"].map((m) => (
                    <button
                      key={m}
                      onClick={() => setParaMode(m as typeof paraMode)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        paraMode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {m === "indonesian" ? "Indonesia" : "English"}
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleParaphrase} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Teks yang mau diparafrase</label>
                  <textarea
                    required
                    rows={4}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={paraMode === "indonesian"
                      ? "Ketik atau paste teks kamu di sini — boleh bahasa kasual, nanti dijadiin akademik..."
                      : "Type or paste your text here — casual language is fine, it'll be made academic..."}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-none"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isParaphrasing || !inputText.trim()}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {isParaphrasing ? <RefreshCw size={16} className="animate-spin" /> : <><Sparkles size={15} /> Parafrase Sekarang</>}
                </button>
              </form>

              {outputText && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide">Hasil parafrase</label>
                    <button
                      onClick={() => navigator.clipboard.writeText(outputText)}
                      className="flex items-center gap-1.5 text-xs text-primary font-semibold hover:underline"
                    >
                      <Copy size={12} /> Salin
                    </button>
                  </div>
                  <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-500/5 border border-emerald-200 dark:border-emerald-500/20 text-sm text-foreground leading-relaxed italic">
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
                <div className="flex bg-muted p-0.5 rounded-xl gap-0.5">
                  {CITATION_STYLES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setCitationStyle(s)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                        citationStyle === s ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
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
                  className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                >
                  {copiedId === "__all__" ? <Check size={12} /> : <Copy size={12} />}
                  {copiedId === "__all__" ? "Semua tersalin!" : `Salin semua (${citations.length})`}
                </button>
              )}

              {loadingCitations ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : citations.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  Belum ada referensi tersimpan. Tambah yang pertama di bawah.
                </div>
              ) : (
                <div className="space-y-3">
                  {citations.map((cit) => (
                    <div key={cit._id} className="p-4 rounded-2xl bg-muted/30 border border-border space-y-2">
                      <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide">
                        <span className="text-primary">{cit.type}</span>
                      </div>
                      <p className="text-sm text-foreground leading-relaxed italic select-text font-serif">
                        {formatCitation(cit, citationStyle)}
                      </p>
                      <div className="flex gap-3 pt-1 border-t border-border">
                        <button
                          onClick={() => handleCopy(cit)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                        >
                          {copiedId === cit._id ? <Check size={12} /> : <Copy size={12} />}
                          {copiedId === cit._id ? "Tersalin!" : "Salin"}
                        </button>
                        <button
                          onClick={() => handleDeleteCitation(cit._id)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add citation form */}
              <form onSubmit={handleAddCitation} className="p-4 rounded-2xl bg-muted/40 border border-dashed border-border space-y-3">
                <span className="text-sm font-bold text-foreground block">+ Tambah referensi</span>
                <div className="grid grid-cols-2 gap-3">
                  <input required placeholder="Penulis (Misal: Sugiyono, B.)" value={newCit.author}
                    onChange={(e) => setNewCit({ ...newCit, author: e.target.value })}
                    className="col-span-2 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
                  <input required placeholder="Judul" value={newCit.title}
                    onChange={(e) => setNewCit({ ...newCit, title: e.target.value })}
                    className="col-span-2 px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
                  <input required placeholder="Tahun" value={newCit.year} type="number"
                    onChange={(e) => setNewCit({ ...newCit, year: e.target.value })}
                    className="px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
                  <input placeholder="Nama jurnal (opsional)" value={newCit.journal}
                    onChange={(e) => setNewCit({ ...newCit, journal: e.target.value })}
                    className="px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
                </div>
                <button type="submit"
                  className="w-full py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2">
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
              <div className="p-3 rounded-xl bg-muted/50 space-y-1">
                <span className="font-bold text-foreground block">Format APA 7</span>
                <p className="leading-relaxed">Paling umum dipakai di Indonesia. Nama Belakang, Inisial. (Tahun). Judul. Nama Jurnal, Vol(No), Halaman.</p>
              </div>
              <div className="p-3 rounded-xl bg-muted/50 space-y-1">
                <span className="font-bold text-foreground block">Cara pakai parafrase</span>
                <p className="leading-relaxed">Hasil parafrase AI hanya sebagai panduan awal. Selalu periksa ulang konteks dan makna sebelum disubmit.</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
