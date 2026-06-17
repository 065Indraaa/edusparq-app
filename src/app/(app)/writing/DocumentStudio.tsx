"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText, Plus, Trash2, Save, Check, RefreshCw, Sparkles, Download,
  Printer, Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  Wand2, Languages, Scissors, Expand, FileEdit, BookOpen, Quote, ChevronDown, Copy, PenTool, ImageIcon, FileWarning, Bookmark, ShieldCheck, Search
} from "lucide-react";
import { formatCitation as formatCitationLib, CITATION_STYLES, type CitationStyle } from "@/lib/citation-format";

interface Citation {
  _id: string; type: string; author: string; title: string; year: string; doi?: string;
  journal: string; volume: string; issue: string; pages: string; publisher: string; url: string;
}

const GENERIC_STRUCTURE = [
  "Halaman Judul & Pernyataan Orisinalitas",
  "Abstrak (Bahasa Indonesia & Inggris)",
  "Bab 1: Pendahuluan",
  "Bab 2: Tinjauan Pustaka",
  "Bab 3: Metode Penelitian",
  "Bab 4: Hasil & Pembahasan",
  "Bab 5: Penutup",
  "Daftar Pustaka",
];

interface DocMeta {
  _id: string; title: string; docType: string; courseName: string;
  citationStyle: string; wordCount: number; updatedAt: string;
}

const DOC_TYPES = [
  { id: "makalah", label: "Makalah" },
  { id: "esai", label: "Esai" },
  { id: "laporan", label: "Laporan" },
  { id: "proposal", label: "Proposal" },
  { id: "artikel", label: "Artikel" },
];

const parseMarkdown = (text: string) => {
  let html = text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/^\> (.*$)/gim, '<blockquote>$1</blockquote>')
    .replace(/\n\n/g, '<br><br>')
    .replace(/\n/g, '<br>');
  
  html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
  html = html.replace(/<\/ul><br><ul>/g, ''); 
  return html;
};

export default function DocumentStudio({
  universitas,
  prodi,
}: {
  universitas: string;
  prodi: string;
}) {
  // Document State
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("makalah");
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);
  const [showDocMenu, setShowDocMenu] = useState(false);

  // Left Sidebar State
  const [activeTool, setActiveTool] = useState<"outline" | "paraphrase" | "citation" | "library">("outline");

  // Outline Tool
  const [paperTopic, setPaperTopic] = useState("");
  const [citationGuide, setCitationGuide] = useState("APA");
  const [generatedOutline, setGeneratedOutline] = useState<string | null>(null);
  const [isGeneratingOutline, setIsGeneratingOutline] = useState(false);

  // Paraphrase Tool
  const [paraMode, setParaMode] = useState<"indonesian" | "english">("indonesian");
  const [inputText, setInputText] = useState("");
  const [outputText, setOutputText] = useState("");
  const [isParaphrasing, setIsParaphrasing] = useState(false);

  // Citation Tool
  const [citations, setCitations] = useState<Citation[]>([]);
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("APA");
  const [loadingCitations, setLoadingCitations] = useState(false);
  const [verifyStatus, setVerifyStatus] = useState<Record<string, { state: "idle" | "loading" | "verified" | "unverified" | "error"; info?: string }>>({});
  const handleVerifyCitation = async (c: Citation, e: React.MouseEvent) => {
    e.stopPropagation();
    setVerifyStatus((s) => ({ ...s, [c._id]: { state: "loading" } }));
    try {
      const params = new URLSearchParams();
      if (c.doi) params.set("doi", c.doi);
      if (c.title) params.set("title", c.title);
      if (c.author) params.set("author", c.author);
      const r = await fetch(`/api/citations/verify?${params.toString()}`);
      const data = await r.json();
      if (data.verified) setVerifyStatus((s) => ({ ...s, [c._id]: { state: "verified", info: data.work?.doi ? `DOI: ${data.work.doi}` : "Cocok dengan Crossref" } }));
      else if (data.source === "none") setVerifyStatus((s) => ({ ...s, [c._id]: { state: "unverified", info: "Tidak ditemukan di Crossref" } }));
      else setVerifyStatus((s) => ({ ...s, [c._id]: { state: "unverified", info: "Mirip tapi belum cocok persis" } }));
    } catch {
      setVerifyStatus((s) => ({ ...s, [c._id]: { state: "error" } }));
    }
  };
  const [newCit, setNewCit] = useState({ author: "", title: "", year: "", journal: "", publisher: "" });

  // Library Tool
  const [libraryItems, setLibraryItems] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedRange, setSavedRange] = useState<Range | null>(null);

  const handleSelection = () => {
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editorRef.current?.contains(selection.anchorNode)) {
      setSavedRange(selection.getRangeAt(0).cloneRange());
      const text = selection.toString().trim();
      if (text && text.length > 10) {
        setInputText(text);
        setActiveTool("paraphrase");
      }
    }
  };

  const loadList = useCallback(async () => {
    setLoadingList(true);
    try {
      const r = await fetch("/api/writing/documents");
      const d = await r.json();
      if (Array.isArray(d.documents)) setDocs(d.documents);
    } finally {
      setLoadingList(false);
    }
  }, []);

  const loadCitations = useCallback(async () => {
    setLoadingCitations(true);
    fetch("/api/citations")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setCitations(data))
      .finally(() => setLoadingCitations(false));
  }, []);

  const loadLibraryItems = useCallback(async () => {
    setLoadingLibrary(true);
    fetch("/api/library")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setLibraryItems(data))
      .finally(() => setLoadingLibrary(false));
  }, []);

  useEffect(() => { loadList(); loadCitations(); loadLibraryItems(); }, [loadList, loadCitations, loadLibraryItems]);

  const openDoc = async (id: string) => {
    const r = await fetch(`/api/writing/documents/${id}`);
    if (!r.ok) return;
    const { document: doc } = await r.json();
    setActiveId(id);
    setTitle(doc.title || "");
    setDocType(doc.docType || "makalah");
    setCitationStyle((doc.citationStyle as CitationStyle) || "APA");
    setShowDocMenu(false);
    if (editorRef.current) editorRef.current.innerHTML = doc.content || "";
  };

  const createDoc = async () => {
    const r = await fetch("/api/writing/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Dokumen Baru", content: "", docType, citationStyle }),
    });
    if (!r.ok) return;
    const { document: doc } = await r.json();
    await loadList();
    setActiveId(doc._id);
    setTitle(doc.title);
    setDocType(doc.docType);
    setShowDocMenu(false);
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const doSave = useCallback(async () => {
    if (!activeId || !editorRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/writing/documents/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, content: editorRef.current.innerHTML, docType, citationStyle,
        }),
      });
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1500);
      loadList(); // Silent background update for wordcount
    } finally {
      setSaving(false);
    }
  }, [activeId, title, docType, citationStyle, loadList]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1500);
  }, [doSave]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    scheduleSave();
  };

  // Phase 6 Advanced Features
  const [refiningTitle, setRefiningTitle] = useState(false);
  const handleRefineTitle = async () => {
    if (!title) return;
    setRefiningTitle(true);
    try {
      const res = await fetch("/api/writing/refine-title", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      const data = await res.json();
      if (data.title) {
        setTitle(data.title);
        scheduleSave();
      }
    } finally { setRefiningTitle(false); }
  };

  const [isAutoGenerating, setIsAutoGenerating] = useState(false);
  const [useWebGrounding, setUseWebGrounding] = useState(true);

  const handleAutoGenerateDraft = async () => {
    if (!activeId || !title) return alert("Pilih dokumen dan pastikan ada judul/topik dulu!");
    setIsAutoGenerating(true);
    if (editorRef.current) editorRef.current.innerHTML = `<p style="color: gray;">Sedang menyusun ${docType} lengkap oleh AI, mohon tunggu...</p>`;
    try {
      const res = await fetch("/api/writing/draft", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: title, docType, citationStyle, useWeb: useWebGrounding, university: universitas, major: prodi })
      });
      const data = await res.json();
      if (data.html && editorRef.current) {
        editorRef.current.innerHTML = data.html;
        scheduleSave();
      } else if (data.error) {
        alert(data.error);
        if (editorRef.current) editorRef.current.innerHTML = "";
      }
    } catch {
      alert("Gagal menghubungi AI. Coba lagi sebentar.");
      if (editorRef.current) editorRef.current.innerHTML = "";
    } finally { setIsAutoGenerating(false); }
  };
  const deleteDoc = async () => {
    if (!activeId || !confirm("Yakin ingin menghapus dokumen ini secara permanen?")) return;
    await fetch(`/api/writing/documents/${activeId}`, { method: "DELETE" });
    setActiveId(null);
    setTitle("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    loadList();
  };

  const exportToWord = () => {
    if (!editorRef.current) return;
    const header = "<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><title>Export</title></head><body>";
    const footer = "</body></html>";
    const sourceHTML = header + editorRef.current.innerHTML + footer;
    const source = 'data:application/vnd.ms-word;charset=utf-8,' + encodeURIComponent(sourceHTML);
    const fileDownload = document.createElement("a");
    document.body.appendChild(fileDownload);
    fileDownload.href = source;
    fileDownload.download = `${title || 'dokumen'}.doc`;
    fileDownload.click();
    document.body.removeChild(fileDownload);
  };

  const handleInsertImage = () => {
    const url = prompt("Masukkan URL gambar yang ingin disisipkan:");
    if (url) exec("insertImage", url);
  };

  // Outline Function — grounded via /api/writing/outline (no client-side prompt DIY).
  const handleGenerateOutline = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return alert("Buat atau pilih dokumen dari panel atas terlebih dahulu!");
    if (!paperTopic.trim()) return;
    setIsGeneratingOutline(true);
    setGeneratedOutline(null);

    try {
      const res = await fetch("/api/writing/outline", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: paperTopic, citationGuide, university: universitas }),
      });
      if (!res.body) throw new Error();
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            result += JSON.parse(data).text;
            setGeneratedOutline(result);
          } catch {}
        }
      }

      if (result && editorRef.current) {
        const html = parseMarkdown(result);
        editorRef.current.focus();
        if (savedRange) {
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(savedRange);
          document.execCommand("insertHTML", false, `<br><h2>Kerangka Pemikiran</h2>${html}<br>`);
        } else {
          editorRef.current.innerHTML += `<br><h2>Kerangka Pemikiran</h2>${html}<br>`;
          const newRange = document.createRange();
          newRange.selectNodeContents(editorRef.current);
          newRange.collapse(false);
          const sel = window.getSelection();
          sel?.removeAllRanges();
          sel?.addRange(newRange);
        }
        scheduleSave();
      }
    } catch {
      setGeneratedOutline("Gagal menyusun kerangka.");
    } finally {
      setIsGeneratingOutline(false);
    }
  };

  // Paraphrase Function — grounded via /api/writing/paraphrase.
  const handleParaphrase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeId) return alert("Buat atau pilih dokumen terlebih dahulu!");
    if (!inputText.trim()) return alert("Pilih (blok) teks di editor yang ingin diparafrasa terlebih dahulu!");
    setIsParaphrasing(true);
    setOutputText("");

    try {
      const res = await fetch("/api/writing/paraphrase", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: inputText, lang: paraMode }),
      });
      if (!res.body) { setIsParaphrasing(false); return; }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let result = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const data = trimmed.slice(5).trim();
          if (data === "[DONE]") { done = true; break; }
          try {
            result += JSON.parse(data).text;
            setOutputText(result);
          } catch {}
        }
      }

      // Auto-replace the selected text with the paraphrased result.
      if (result && editorRef.current && savedRange) {
        editorRef.current.focus();
        const sel = window.getSelection();
        sel?.removeAllRanges();
        sel?.addRange(savedRange);
        const html = parseMarkdown(result);
        document.execCommand("insertHTML", false, html);
        scheduleSave();
      }
    } catch {
      setOutputText("Gagal memparafrase.");
    } finally {
      setIsParaphrasing(false);
    }
  };

  // Add Citation
  const handleAddCitation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCit.author || !newCit.title || !newCit.year) return;
    const res = await fetch("/api/citations", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCit, type: newCit.journal ? "Jurnal" : "Buku", volume: "1", issue: "1", pages: "1" }),
    });
    if (res.ok) {
      const cit = await res.json();
      setCitations([cit, ...citations]);
      setNewCit({ author: "", title: "", year: "", journal: "", publisher: "" });
    }
  };

  const copyToEditor = (text: string) => {
    if (!activeId || !editorRef.current) return alert("Buat atau pilih dokumen terlebih dahulu!");
    editorRef.current.focus();
    
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      document.execCommand("insertText", false, text);
    } else {
      // Append if no valid selection
      editorRef.current.innerHTML += text + "<br>";
      const newRange = document.createRange();
      newRange.selectNodeContents(editorRef.current);
      newRange.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
    }
    scheduleSave();
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[75vh] min-h-[650px] max-h-[850px]">
      
      {/* LEFT PANEL: Smart Tools (30% width on desktop) */}
      <motion.div 
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300"
      >
        <div className="flex p-2 bg-muted/40 border-b border-border/50 backdrop-blur-md z-10">
          {[
            { id: "outline", icon: BookOpen, label: "Kerangka" },
            { id: "paraphrase", icon: Sparkles, label: "Parafrasa" },
            { id: "citation", icon: Quote, label: "Sitasi" },
            { id: "library", icon: Bookmark, label: "Pustaka" },
          ].map(({ id, icon: Icon, label }) => (
            <button key={id} onClick={() => setActiveTool(id as any)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                activeTool === id ? "bg-card text-foreground shadow-sm border border-border" : "text-muted-foreground hover:text-foreground"
              }`}>
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar relative">
          <AnimatePresence mode="wait">
            {/* Outline Tool */}
            {activeTool === "outline" && (
              <motion.div 
                key="outline"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
                <div className="space-y-1.5">
                  <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><BookOpen size={16} className="text-primary" /> Sistem Kerangka</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">Otomatisasi pembuatan draf awal berstandar kampus Anda.</p>
                </div>
                <form onSubmit={handleGenerateOutline} className="space-y-3">
                  <input required placeholder="Topik penelitian..." value={paperTopic} onChange={(e) => setPaperTopic(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all" />
                  <button type="submit" disabled={isGeneratingOutline}
                    className="w-full py-3 bg-foreground hover:bg-foreground/90 text-background font-bold text-xs rounded-2xl transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50">
                    {isGeneratingOutline ? <RefreshCw size={14} className="animate-spin" /> : "Susun Kerangka Pintar"}
                  </button>
                </form>
                {generatedOutline && (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 mt-5 rounded-2xl bg-primary/5 border border-primary/10 text-xs text-foreground whitespace-pre-wrap font-mono relative group shadow-inner">
                    {generatedOutline}
                    <button onClick={() => copyToEditor(generatedOutline)} className="absolute -top-3 -right-3 p-2 bg-primary text-primary-foreground rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110" title="Pindahkan ke Editor"><Plus size={16} /></button>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* Paraphrase Tool */}
            {activeTool === "paraphrase" && (
              <motion.div 
                key="paraphrase"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-5"
              >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2"><Sparkles size={16} className="text-primary" /> Parafrasa AI</h3>
                <button onClick={() => setParaMode(paraMode === "indonesian" ? "english" : "indonesian")} className="text-[10px] font-bold px-2.5 py-1.5 bg-card border border-border rounded-lg text-foreground uppercase tracking-widest hover:bg-muted shadow-sm transition-all">{paraMode === "indonesian" ? "ID" : "EN"}</button>
              </div>
              <form onSubmit={handleParaphrase} className="space-y-3">
                <textarea required rows={5} placeholder="Tempelkan kalimat yang ingin dirapikan ke bahasa akademik..." value={inputText} onChange={(e) => setInputText(e.target.value)}
                  className="w-full px-4 py-3 rounded-2xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 resize-none transition-all" />
                <button type="submit" disabled={isParaphrasing || !inputText.trim()}
                  className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-2xl transition-all shadow-sm flex justify-center items-center gap-2 disabled:opacity-50 shadow-primary/20">
                  {isParaphrasing ? <RefreshCw size={14} className="animate-spin" /> : "Mulai Parafrasa"}
                </button>
              </form>
              {outputText && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 mt-5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground relative group shadow-inner">
                  {outputText}
                  <button onClick={() => copyToEditor(outputText)} className="absolute -top-3 -right-3 p-2 bg-emerald-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110" title="Pindahkan ke Editor"><Plus size={16} /></button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* Citation Tool */}
          {activeTool === "citation" && (
            <motion.div 
              key="citation"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-foreground flex justify-between items-center">
                  <span className="flex items-center gap-2"><Quote size={16} className="text-primary" /> Daftar Pustaka</span>
                  <select value={citationStyle} onChange={(e) => setCitationStyle(e.target.value as CitationStyle)} className="text-xs bg-card border border-border rounded-lg px-2 py-1 outline-none font-bold text-primary shadow-sm">
                    {CITATION_STYLES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </h3>
              </div>
              
              <form onSubmit={handleAddCitation} className="p-4 rounded-2xl bg-muted/40 border border-dashed border-border/60 space-y-3">
                <input required placeholder="Penulis (Cth: Sugiyono)" value={newCit.author} onChange={(e) => setNewCit({...newCit, author: e.target.value})} className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                <input required placeholder="Judul Dokumen" value={newCit.title} onChange={(e) => setNewCit({...newCit, title: e.target.value})} className="w-full px-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                <div className="flex gap-2">
                  <input required placeholder="Tahun" type="number" value={newCit.year} onChange={(e) => setNewCit({...newCit, year: e.target.value})} className="w-1/3 px-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                  <input placeholder="Jurnal/Penerbit" value={newCit.journal} onChange={(e) => setNewCit({...newCit, journal: e.target.value})} className="w-2/3 px-3 py-2 text-xs rounded-xl bg-card border border-border focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all" />
                </div>
                <button type="submit" className="w-full py-2 bg-foreground text-background text-xs font-bold rounded-xl hover:bg-foreground/90 mt-2 shadow-sm transition-all">Tambahkan Pustaka</button>
              </form>

              <div className="space-y-3">
                {loadingCitations ? <div className="flex justify-center py-6"><RefreshCw size={16} className="animate-spin text-muted-foreground" /></div> : citations.length === 0 ? <p className="text-xs text-center text-muted-foreground py-6">Belum ada pustaka tersimpan.</p> : citations.map(c => (
                  <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} key={c._id} className="p-3.5 rounded-2xl border border-border/60 bg-card text-xs relative group hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer" onClick={() => copyToEditor(formatCitationLib(c, citationStyle as CitationStyle))}>
                    <p className="font-serif leading-relaxed line-clamp-3 text-muted-foreground group-hover:text-foreground transition-colors">{formatCitationLib(c, citationStyle as CitationStyle)}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={(e) => handleVerifyCitation(c, e)} disabled={verifyStatus[c._id]?.state === "loading"} className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted hover:bg-muted/70 text-[10px] font-bold text-muted-foreground disabled:opacity-50 transition-colors" title="Verifikasi via Crossref">
                        {verifyStatus[c._id]?.state === "loading" ? <RefreshCw size={11} className="animate-spin" /> : <ShieldCheck size={11} />}
                        Verifikasi
                      </button>
                      {verifyStatus[c._id]?.state === "verified" && <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 dark:text-emerald-400"><ShieldCheck size={11} /> Terverifikasi{verifyStatus[c._id]?.info ? `: ${verifyStatus[c._id].info}` : ""}</span>}
                      {verifyStatus[c._id]?.state === "unverified" && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400"><FileWarning size={11} /> {verifyStatus[c._id]?.info || "Belum terverifikasi"}</span>}
                      {verifyStatus[c._id]?.state === "error" && <span className="text-[10px] font-bold text-destructive">Gagal cek</span>}
                    </div>
                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-primary shadow-lg p-1.5 rounded-lg text-primary-foreground transform scale-90 group-hover:scale-100 transition-all">
                      <Plus size={14} />
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Library Tool */}
          {activeTool === "library" && (
            <motion.div 
              key="library"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-5"
            >
              <div className="space-y-1.5">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Bookmark size={16} className="text-primary" /> Pustaka Riset
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">Tarik hasil kajian dari menu Katalog Riset langsung ke editor Anda.</p>
              </div>
              
              <div className="space-y-3">
                {loadingLibrary ? (
                  <div className="flex justify-center py-6"><RefreshCw size={16} className="animate-spin text-muted-foreground" /></div>
                ) : libraryItems.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground py-6">Pustaka masih kosong. Kunjungi menu Research untuk menyimpan literatur.</p>
                ) : (
                  libraryItems.map(item => (
                    <motion.div 
                      initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} 
                      key={item._id} 
                      className="p-3.5 rounded-2xl border border-border/60 bg-card text-xs relative group hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer"
                      onClick={() => copyToEditor(item.content)}
                    >
                      <h4 className="font-bold text-foreground mb-1 line-clamp-1">{item.title}</h4>
                      <p className="font-serif leading-relaxed line-clamp-3 text-muted-foreground group-hover:text-foreground transition-colors">{item.content}</p>
                      <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 bg-primary shadow-lg p-1.5 rounded-lg text-primary-foreground transform scale-90 group-hover:scale-100 transition-all">
                        <Plus size={14} />
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* RIGHT PANEL: Editor Canvas (70% width on desktop) */}
      <motion.div 
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="flex-1 flex flex-col bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-300 relative"
      >
        
        {/* Editor Toolbar & Document Manager */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 border-b border-border/50 bg-muted/20 backdrop-blur-md gap-4 z-20 relative">
          
          {/* Document Selector Dropdown */}
          <div className="relative">
            <button onClick={() => setShowDocMenu(!showDocMenu)} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted border border-border hover:bg-muted/80 transition-colors">
              <FileText size={16} className="text-primary" />
              <div className="text-left flex flex-col">
                <span className="text-xs font-bold text-foreground leading-none max-w-[150px] truncate">{title || "Pilih Dokumen"}</span>
              </div>
              <ChevronDown size={14} className="text-muted-foreground ml-1" />
            </button>

            <AnimatePresence>
              {showDocMenu && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10 }} className="absolute top-full mt-2 left-0 w-[280px] bg-card border border-border shadow-xl rounded-2xl p-2 z-50 max-h-[300px] overflow-y-auto">
                  <button onClick={createDoc} className="w-full flex items-center justify-center gap-2 py-2 mb-2 bg-primary/10 text-primary hover:bg-primary/20 font-bold text-xs rounded-xl transition-colors">
                    <Plus size={14} /> Buat Dokumen Baru
                  </button>
                  {docs.map(d => (
                    <button key={d._id} onClick={() => openDoc(d._id)} className="w-full flex flex-col items-start px-3 py-2 hover:bg-muted rounded-xl transition-colors text-left group">
                      <span className="text-sm font-semibold text-foreground truncate w-full group-hover:text-primary">{d.title}</span>
                      <span className="text-[10px] text-muted-foreground">{new Date(d.updatedAt).toLocaleDateString("id-ID")} · {d.wordCount} kata</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Title Editor & Generation */}
          {activeId && (
            <div className="flex-1 flex flex-col sm:flex-row items-center gap-2 w-full">
              <input value={title} onChange={(e) => { setTitle(e.target.value); scheduleSave(); }} placeholder="Ketik judul/topik di sini..."
                className="flex-1 bg-transparent border-none text-sm font-bold sm:text-center text-left text-foreground focus:outline-none focus:ring-0 placeholder:text-muted-foreground/50 min-w-0 w-full" />
              
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={handleRefineTitle} disabled={refiningTitle} title="Sempurnakan Judul ala Akademik" className="px-2 py-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-colors flex items-center gap-1">
                  {refiningTitle ? <RefreshCw size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Refine Judul
                </button>
                <select value={docType} onChange={e => { setDocType(e.target.value); scheduleSave(); }} className="px-2 py-1.5 bg-card border border-border text-xs font-bold rounded-lg focus:outline-none shadow-sm">
                  {DOC_TYPES.map(dt => <option key={dt.id} value={dt.id}>{dt.label}</option>)}
                </select>
                <button onClick={handleAutoGenerateDraft} disabled={isAutoGenerating} className="px-3 py-1.5 bg-primary text-primary-foreground font-bold text-xs rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1 shadow-sm">
                  {isAutoGenerating ? <RefreshCw size={12} className="animate-spin" /> : <Wand2 size={12} />}
                  Generate Isi
                </button>
                <label title="Gunakan referensi web saat membuat draft (anti-halusinasi)" className="flex items-center gap-1 cursor-pointer select-none shrink-0 px-2 py-1.5 rounded-lg bg-muted/40 hover:bg-muted transition-colors">
                  <input type="checkbox" checked={useWebGrounding} onChange={(e) => setUseWebGrounding(e.target.checked)} className="w-3 h-3 accent-primary" />
                  <span className="text-[10px] font-bold text-muted-foreground">Web</span>
                </label>
              </div>
            </div>
          )}

          {/* Text Formatting & Actions Tools */}
          {activeId && (
            <div className="flex items-center gap-1.5 bg-background border border-border/60 rounded-xl p-1.5 shadow-sm overflow-x-auto">
              <button onClick={() => exec("bold")} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><Bold size={14} /></button>
              <button onClick={() => exec("italic")} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><Italic size={14} /></button>
              <button onClick={() => exec("underline")} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><Underline size={14} /></button>
              <span className="w-px h-4 bg-border/80 mx-0.5" />
              <button onClick={() => exec("insertUnorderedList")} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><List size={14} /></button>
              <button onClick={() => exec("insertOrderedList")} className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><ListOrdered size={14} /></button>
              <button onClick={handleInsertImage} title="Sisipkan Gambar (URL)" className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><ImageIcon size={14} /></button>
              <span className="w-px h-4 bg-border/80 mx-0.5" />
              <button onClick={() => window.print()} title="Cetak / Save as PDF" className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><Printer size={14} /></button>
              <button onClick={exportToWord} title="Download DOCX (Word)" className="p-1.5 sm:p-2 rounded-lg hover:bg-muted text-foreground transition-colors"><Download size={14} /></button>
              <button onClick={deleteDoc} title="Hapus Dokumen" className="p-1.5 sm:p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors"><Trash2 size={14} /></button>
              <span className="w-px h-4 bg-border/80 mx-0.5" />
              <button onClick={doSave} className="px-2 py-1 sm:px-3 sm:py-1.5 flex items-center gap-1.5 rounded-lg hover:bg-muted text-foreground text-xs font-bold transition-colors">
                {saving ? <RefreshCw size={14} className="animate-spin text-primary" /> : savedFlag ? <Check size={14} className="text-emerald-500" /> : <Save size={14} className="text-primary/70" />}
              </button>
            </div>
          )}
        </div>

        {/* Editor Canvas */}
        {!activeId ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-primary/10 rounded-3xl rotate-3 flex items-center justify-center mb-6 text-primary shadow-inner"><PenTool size={32} /></div>
            <h3 className="font-display text-2xl font-bold text-foreground mb-3">Kanvas Menulis Pintar</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-8 leading-relaxed">Pilih dokumen dari menu dropdown di atas atau buat yang baru untuk mulai menulis bersama asisten AI yang dirancang khusus untuk mahasiswa.</p>
            <button onClick={createDoc} className="px-8 py-3.5 bg-primary text-primary-foreground font-bold text-sm rounded-2xl hover:bg-primary/90 transition-all shadow-md shadow-primary/20 hover:shadow-lg flex items-center gap-2">
              <Plus size={18} /> Buat Dokumen Baru
            </button>
          </motion.div>
        ) : (
          <div className="flex-1 relative overflow-y-auto custom-scrollbar bg-background/30">
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={scheduleSave}
              onMouseUp={handleSelection}
              onKeyUp={handleSelection}
              className="prose-editor min-h-full p-10 md:p-16 text-[15px] leading-[2] text-foreground focus:outline-none max-w-4xl mx-auto font-serif focus:ring-0 selection:bg-primary/20"
              style={{ wordBreak: "break-word" }}
            />
          </div>
        )}
      </motion.div>

    </div>
  );
}
