"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import {
  FileText, Plus, Trash2, Save, Check, RefreshCw, Sparkles, Download,
  Printer, Bold, Italic, Underline, List, ListOrdered, Heading1, Heading2,
  Wand2, Languages, Scissors, Expand, FileEdit,
} from "lucide-react";

interface DocMeta {
  _id: string;
  title: string;
  docType: string;
  courseName: string;
  citationStyle: string;
  wordCount: number;
  updatedAt: string;
}

const DOC_TYPES = [
  { id: "makalah", label: "Makalah" },
  { id: "esai", label: "Esai" },
  { id: "laporan", label: "Laporan" },
  { id: "proposal", label: "Proposal" },
  { id: "artikel", label: "Artikel" },
  { id: "umum", label: "Umum" },
];

const INLINE_ACTIONS = [
  { id: "improve", label: "Perbaiki", icon: Wand2 },
  { id: "paraphrase", label: "Parafrase", icon: FileEdit },
  { id: "expand", label: "Kembangkan", icon: Expand },
  { id: "shorten", label: "Ringkas", icon: Scissors },
  { id: "academic", label: "Akademik", icon: Sparkles },
  { id: "english", label: "Inggris", icon: Languages },
];

export default function DocumentStudio({
  universitas,
  prodi,
}: {
  universitas: string;
  prodi: string;
}) {
  const [docs, setDocs] = useState<DocMeta[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [docType, setDocType] = useState("makalah");
  const [citationStyle, setCitationStyle] = useState("APA");
  const [saving, setSaving] = useState(false);
  const [savedFlag, setSavedFlag] = useState(false);

  // AI draft panel
  const [topic, setTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [showDraftPanel, setShowDraftPanel] = useState(false);

  // Inline action state
  const [actionBusy, setActionBusy] = useState<string | null>(null);
  const [hasSelection, setHasSelection] = useState(false);
  const savedRange = useRef<Range | null>(null);

  const editorRef = useRef<HTMLDivElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openDoc = async (id: string) => {
    const r = await fetch(`/api/writing/documents/${id}`);
    if (!r.ok) return;
    const { document: doc } = await r.json();
    setActiveId(id);
    setTitle(doc.title || "");
    setDocType(doc.docType || "makalah");
    setCitationStyle(doc.citationStyle || "APA");
    setShowDraftPanel(false);
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
    setShowDraftPanel(true);
    if (editorRef.current) editorRef.current.innerHTML = "";
  };

  const deleteDoc = async (id: string) => {
    await fetch(`/api/writing/documents/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      if (editorRef.current) editorRef.current.innerHTML = "";
    }
    loadList();
  };

  const doSave = useCallback(async () => {
    if (!activeId || !editorRef.current) return;
    setSaving(true);
    try {
      await fetch(`/api/writing/documents/${activeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: editorRef.current.innerHTML,
          docType,
          citationStyle,
        }),
      });
      setSavedFlag(true);
      setTimeout(() => setSavedFlag(false), 1500);
    } finally {
      setSaving(false);
    }
  }, [activeId, title, docType, citationStyle]);

  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => doSave(), 1200);
  }, [doSave]);

  const exec = (cmd: string, value?: string) => {
    document.execCommand(cmd, false, value);
    editorRef.current?.focus();
    scheduleSave();
  };

  const trackSelection = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      savedRange.current = sel.getRangeAt(0).cloneRange();
      setHasSelection(sel.toString().trim().length > 0);
    } else {
      setHasSelection(false);
    }
  };

  const runInlineAction = async (action: string) => {
    const range = savedRange.current;
    const text = range?.toString().trim();
    if (!range || !text) return;
    setActionBusy(action);
    try {
      const r = await fetch("/api/writing/action", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      const d = await r.json();
      if (r.ok && d.result) {
        const sel = window.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("insertText", false, d.result);
        }
        scheduleSave();
      } else {
        alert(d.error || "Gagal memproses teks.");
      }
    } finally {
      setActionBusy(null);
      setHasSelection(false);
    }
  };

  const generateDraft = async () => {
    if (topic.trim().length < 3) return;
    setGenerating(true);
    try {
      const r = await fetch("/api/writing/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic, docType, citationStyle,
          university: universitas, major: prodi,
        }),
      });
      const d = await r.json();
      if (r.ok && d.html && editorRef.current) {
        editorRef.current.innerHTML = d.html;
        if (!title || title === "Dokumen Baru" || title === "Dokumen Tanpa Judul") {
          setTitle(topic.slice(0, 120));
        }
        setShowDraftPanel(false);
        scheduleSave();
      } else {
        alert(d.error || "Gagal membuat draft.");
      }
    } finally {
      setGenerating(false);
    }
  };

  const buildExportHtml = () => {
    const body = editorRef.current?.innerHTML || "";
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title}</title></head><body style="font-family:'Times New Roman',serif;font-size:12pt;line-height:1.6;">${body}</body></html>`;
  };

  const exportDoc = () => {
    const blob = new Blob(["\ufeff", buildExportHtml()], {
      type: "application/msword;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "dokumen").replace(/[^\w\-]+/g, "_")}.doc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const printPdf = () => {
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(
      `<html><head><title>${title}</title><style>body{font-family:'Times New Roman',serif;font-size:12pt;line-height:1.7;max-width:720px;margin:40px auto;padding:0 24px;color:#111}h1{font-size:20pt}h2{font-size:15pt}h3{font-size:13pt}blockquote{border-left:3px solid #ccc;padding-left:12px;color:#444}</style></head><body>${buildExportHtml()}</body></html>`
    );
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const TOOLS = [
    { cmd: "bold", icon: Bold, label: "Tebal" },
    { cmd: "italic", icon: Italic, label: "Miring" },
    { cmd: "underline", icon: Underline, label: "Garis bawah" },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      {/* Sidebar: document list */}
      <div className="lg:col-span-1 space-y-3">
        <button
          onClick={createDoc}
          className="w-full min-h-[44px] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all shadow-sm shadow-primary/20 flex items-center justify-center gap-2"
        >
          <Plus size={16} /> Dokumen Baru
        </button>

        <div className="bg-card border border-border rounded-2xl p-2 space-y-1 max-h-[60vh] overflow-y-auto">
          {loadingList ? (
            <div className="flex justify-center py-6">
              <RefreshCw size={16} className="animate-spin text-muted-foreground" />
            </div>
          ) : docs.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6 px-2">
              Belum ada dokumen. Buat dokumen pertamamu.
            </p>
          ) : (
            docs.map((d) => (
              <div
                key={d._id}
                className={`group flex items-center gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all ${
                  activeId === d._id ? "bg-primary/10 border border-primary/20" : "hover:bg-muted"
                }`}
                onClick={() => openDoc(d._id)}
              >
                <FileText size={15} className="text-primary shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{d.title}</p>
                  <p className="text-[10px] text-muted-foreground capitalize">
                    {d.docType} · {d.wordCount} kata
                  </p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); deleteDoc(d._id); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all shrink-0"
                  aria-label="Hapus"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Editor */}
      <div className="lg:col-span-3">
        {!activeId ? (
          <div className="bg-card border border-border rounded-3xl p-10 text-center space-y-3 shadow-sm">
            <FileText size={40} className="mx-auto text-primary/40" />
            <h3 className="font-bold text-foreground">Studio Dokumen</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Tulis makalah, esai, atau laporan dengan editor lengkap. Minta AI menyusun draft awal,
              perbaiki paragraf dengan menyorot teks, lalu ekspor ke Word atau PDF.
            </p>
            <button
              onClick={createDoc}
              className="inline-flex items-center gap-2 min-h-[44px] px-5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all"
            >
              <Plus size={16} /> Mulai Menulis
            </button>
          </div>
        ) : (
          <div className="bg-card border border-border rounded-3xl shadow-sm overflow-hidden">
            {/* Top bar */}
            <div className="p-4 border-b border-border space-y-3">
              <div className="flex items-center gap-2 flex-wrap">
                <input
                  value={title}
                  onChange={(e) => { setTitle(e.target.value); scheduleSave(); }}
                  placeholder="Judul dokumen"
                  className="flex-1 min-w-[180px] px-3 min-h-[42px] rounded-xl bg-muted border border-border text-sm font-bold text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
                <select
                  value={docType}
                  onChange={(e) => { setDocType(e.target.value); scheduleSave(); }}
                  className="px-3 min-h-[42px] rounded-xl bg-muted border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                >
                  {DOC_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                </select>
                <button
                  onClick={() => setShowDraftPanel((s) => !s)}
                  className="inline-flex items-center gap-1.5 min-h-[42px] px-3 rounded-xl bg-primary/10 text-primary text-xs font-bold hover:bg-primary/20 transition-all"
                >
                  <Sparkles size={14} /> Draft AI
                </button>
              </div>

              {/* AI draft panel */}
              {showDraftPanel && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="rounded-2xl bg-muted/50 border border-border p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Tulis topik/judul, AI akan menyusun draft lengkap yang bisa kamu edit.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                      placeholder="Contoh: Dampak literasi digital terhadap hasil belajar mahasiswa"
                      className="flex-1 min-w-[200px] px-3 min-h-[42px] rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      onClick={generateDraft}
                      disabled={generating || topic.trim().length < 3}
                      className="inline-flex items-center gap-2 min-h-[42px] px-4 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-all disabled:opacity-60"
                    >
                      {generating ? <RefreshCw size={15} className="animate-spin" /> : <><Sparkles size={14} /> Susun</>}
                    </button>
                  </div>
                  {universitas && (
                    <p className="text-[10px] text-muted-foreground">
                      Disesuaikan untuk: {universitas}{prodi ? ` · ${prodi}` : ""}
                    </p>
                  )}
                </motion.div>
              )}

              {/* Toolbar */}
              <div className="flex items-center gap-1 flex-wrap">
                {TOOLS.map(({ cmd, icon: Icon, label }) => (
                  <button key={cmd} onClick={() => exec(cmd)} title={label}
                    className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-all">
                    <Icon size={15} />
                  </button>
                ))}
                <span className="w-px h-5 bg-border mx-1" />
                <button onClick={() => exec("formatBlock", "<h1>")} title="Judul 1" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-all"><Heading1 size={16} /></button>
                <button onClick={() => exec("formatBlock", "<h2>")} title="Judul 2" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-all"><Heading2 size={16} /></button>
                <button onClick={() => exec("insertUnorderedList")} title="Daftar" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-all"><List size={15} /></button>
                <button onClick={() => exec("insertOrderedList")} title="Daftar bernomor" className="h-9 w-9 flex items-center justify-center rounded-lg hover:bg-muted text-foreground transition-all"><ListOrdered size={15} /></button>
                <span className="w-px h-5 bg-border mx-1" />
                <button onClick={doSave} title="Simpan" className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg hover:bg-muted text-foreground text-xs font-semibold transition-all">
                  {saving ? <RefreshCw size={14} className="animate-spin" /> : savedFlag ? <Check size={14} className="text-emerald-500" /> : <Save size={14} />}
                  {savedFlag ? "Tersimpan" : "Simpan"}
                </button>
                <div className="ml-auto flex items-center gap-1">
                  <button onClick={exportDoc} title="Unduh Word" className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg hover:bg-muted text-foreground text-xs font-semibold transition-all"><Download size={14} /> .doc</button>
                  <button onClick={printPdf} title="Cetak / PDF" className="h-9 px-2.5 flex items-center gap-1.5 rounded-lg hover:bg-muted text-foreground text-xs font-semibold transition-all"><Printer size={14} /> PDF</button>
                </div>
              </div>

              {/* Inline AI action bar (shows when text selected) */}
              {hasSelection && (
                <div className="flex items-center gap-1.5 flex-wrap rounded-xl bg-primary/5 border border-primary/20 p-2">
                  <span className="text-[11px] font-bold text-primary px-1">AI untuk teks terpilih:</span>
                  {INLINE_ACTIONS.map(({ id, label, icon: Icon }) => (
                    <button key={id} onClick={() => runInlineAction(id)} disabled={actionBusy !== null}
                      className="inline-flex items-center gap-1 px-2.5 h-8 rounded-lg bg-card border border-border text-xs font-semibold text-foreground hover:border-primary hover:text-primary transition-all disabled:opacity-50">
                      {actionBusy === id ? <RefreshCw size={12} className="animate-spin" /> : <Icon size={12} />}
                      {label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Editable surface */}
            <div
              ref={editorRef}
              contentEditable
              suppressContentEditableWarning
              onInput={scheduleSave}
              onMouseUp={trackSelection}
              onKeyUp={trackSelection}
              className="prose-editor min-h-[55vh] max-h-[70vh] overflow-y-auto p-6 sm:p-8 text-sm leading-relaxed text-foreground focus:outline-none"
              style={{ wordBreak: "break-word" }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
