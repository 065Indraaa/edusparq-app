"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Search, BookOpen, GraduationCap, Send, Trash2, RefreshCw, Paperclip, X, FileText, FileUp, LayoutTemplate, CalendarClock } from "lucide-react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ConfidenceBadge, ConfidenceLevel, SourceAttribution } from "../ui/ConfidenceBadge";

interface ChatMeta {
  sources: { title: string; exactQuote: string; documentId: string }[];
  confidence: ConfidenceLevel;
}

interface ChatMessage {
  _id?: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  courseName?: string;
  createdAt?: string;
  isStreaming?: boolean;
  meta?: ChatMeta;
}

const MODES = [
  {
    id: "socratic",
    label: "Sokratik",
    icon: GraduationCap,
    desc: "Menuntun Anda menemukan jawaban sendiri melalui pertanyaan terarah.",
    placeholder: "Sampaikan konsep yang ingin Anda pahami lebih dalam...",
  },
  {
    id: "helper",
    label: "Penjelasan",
    icon: BookOpen,
    desc: "Memberikan penjelasan langsung, ringkas, dan disertai contoh nyata.",
    placeholder: "Ajukan pertanyaan apa pun seputar materi kuliah Anda...",
  },
  {
    id: "research",
    label: "Riset",
    icon: Search,
    desc: "Menelusuri sudut pandang penelitian serta referensi yang relevan.",
    placeholder: "Tuliskan topik atau pertanyaan riset Anda...",
  },
];

const ACTION_CHIPS = [
  { label: "Jelaskan konsep", prompt: "Jelaskan konsep berikut dengan bahasa sederhana dan contoh nyata: " },
  { label: "Beri contoh soal", prompt: "Buatkan satu contoh soal beserta pembahasan langkah demi langkah tentang: " },
  { label: "Beri analogi", prompt: "Berikan analogi sehari-hari yang mudah dipahami untuk konsep: " },
  { label: "Ringkas materi", prompt: "Ringkas poin-poin terpenting dari materi: " },
];

export default function AiTutorMode() {
  const { data: session } = useSession();
  const [mode, setMode] = useState("helper");
  const [courses, setCourses] = useState<string[]>([]);
  const [course, setCourse] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [nearestDeadline, setNearestDeadline] = useState<{title: string, date: string, course: string} | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentMode = MODES.find((m) => m.id === mode) || MODES[1];
  const visibleMessages = course
    ? messages.filter((m) => (m.courseName || "") === course)
    : messages;

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .finally(() => setIsFetchingHistory(false));
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/deadlines")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          const sorted = data.filter(d => d.dueDate && new Date(d.dueDate).getTime() >= Date.now()).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
          if (sorted.length > 0) {
            setNearestDeadline({ title: sorted[0].title, date: sorted[0].dueDate, course: sorted[0].courseName });
          }
        }
      })
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/courses")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) =>
        setCourses(
          (Array.isArray(data) ? data : [])
            .map((c: { name?: string }) => c?.name || "")
            .filter(Boolean)
        )
      )
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !attachment) || isLoading || isUploading) return;

    let attachmentUrl = "";
    let attachmentType = "";
    let attachmentName = "";

    if (attachment) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", attachment);
        const uploadRes = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        if (!uploadRes.ok) throw new Error("Gagal mengunggah lampiran");
        const uploadData = await uploadRes.json();
        attachmentUrl = uploadData.secure_url;
        attachmentType = attachment.name.endsWith(".pdf") ? "pdf" : attachment.name.endsWith(".docx") ? "docx" : "raw";
        attachmentName = attachment.name;
      } catch (err) {
        alert("Gagal mengunggah file lampiran. Silakan coba lagi.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const userMsg: ChatMessage = { 
      role: "user", 
      content: attachment ? `[Melampirkan file: ${attachmentName}]\n${input}` : input, 
      mode, 
      courseName: course 
    };
    
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setAttachment(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setIsLoading(true);

    const streamingMsg: ChatMessage = {
      role: "assistant",
      content: "",
      mode,
      courseName: course,
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message: userMsg.content, 
          mode, 
          courseName: course,
          attachmentUrl,
          attachmentType
        }),
      });

      if (!res.body) throw new Error("No response body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") break;
            try {
              const parsed = JSON.parse(data);
              accumulated += parsed.text || "";
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                updated[updated.length - 1] = {
                  ...last,
                  content: accumulated,
                  ...(parsed.meta ? { meta: parsed.meta as ChatMeta } : {}),
                };
                return updated;
              });
            } catch {}
          }
        }
      }

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          ...updated[updated.length - 1],
          isStreaming: false,
        };
        return updated;
      });
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Koneksi terputus. Silakan kirim ulang pesan Anda.",
          mode,
          isStreaming: false,
        };
        return updated;
      });
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleClearHistory = async () => {
    if (!confirm("Hapus seluruh riwayat percakapan?")) return;
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
  };

  const userName = session?.user?.name?.split(" ")[0] || "Anda";

  return (
    <div className="flex flex-col h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)]">
      {/* Sub-header inside mode */}
      <div className="shrink-0 mb-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {MODES.map((m) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  aria-pressed={isActive}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all border ${
                    isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                  }`}
                >
                  <Icon size={14} />
                  {m.label}
                </button>
              );
            })}
          </div>
          {visibleMessages.length > 0 && (
            <button onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 min-h-[36px] rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20">
              <Trash2 size={14} /><span className="hidden sm:inline">Hapus riwayat</span>
            </button>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-2 ml-1">{currentMode.desc}</p>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="text-xs font-semibold text-muted-foreground">Fokus matkul:</span>
          <select value={course} onChange={(e) => setCourse(e.target.value)}
            className="px-3 min-h-[32px] rounded-lg bg-card border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary">
            <option value="">Semua</option>
            {courses.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
        </div>
        <div className="flex items-center gap-1.5 mt-2 flex-wrap">
          {ACTION_CHIPS.map((c) => (
            <button key={c.label} type="button" onClick={() => { setInput(c.prompt); inputRef.current?.focus(); }}
              className="px-2.5 min-h-[28px] rounded-lg bg-muted border border-border text-[11px] font-semibold text-muted-foreground hover:text-primary hover:border-primary/40 transition-all">
              {c.label}
            </button>
          ))}
        </div>
        <AnimatePresence>
          {mode === "socratic" && (
            <motion.div initial={{ opacity: 0, y: -6, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, y: -6, height: 0 }} transition={{ duration: 0.2 }} className="mt-2">
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <span className="grid place-items-center w-7 h-7 shrink-0 rounded-xl bg-emerald-500/15 text-emerald-500"><Sparkles size={15} /></span>
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Mode Sokratik aktif</span>
                  <span className="block text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">Tutor tidak memberikan jawaban secara langsung, melainkan menuntun Anda melalui serangkaian pertanyaan agar dapat menemukan jawabannya sendiri.</span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-card border border-border rounded-3xl flex flex-col overflow-hidden shadow-sm">
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">
          {isFetchingHistory ? (
            <div className="flex items-center justify-center h-full"><RefreshCw size={20} className="text-muted-foreground animate-spin" /></div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto space-y-6 pb-8 pt-4 w-full">
              {nearestDeadline && (
                <div className="w-full flex items-center justify-center">
                  <div className="bg-primary/10 border border-primary/20 text-primary px-4 py-2 rounded-2xl flex items-center gap-2 text-xs font-semibold shadow-sm">
                    <CalendarClock size={16} />
                    Peringatan: Tenggat tugas "{nearestDeadline.title}" ({nearestDeadline.course}) segera tiba. Mari kita selesaikan!
                  </div>
                </div>
              )}
              <div className="text-center space-y-2 mb-2">
                <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/15 to-teal-500/15 text-primary flex items-center justify-center mx-auto mb-4"><Sparkles size={28} /></div>
                <h3 className="font-display font-black text-2xl text-foreground">Halo, {userName}.</h3>
                <p className="text-sm text-muted-foreground max-w-md mx-auto leading-relaxed">Pusat kendali akademik Anda. Unggah dokumen untuk dianalisis, atau gunakan pustaka template di bawah.</p>
              </div>
              <button onClick={() => fileInputRef.current?.click()}
                className="w-full relative overflow-hidden group bg-card border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/50 rounded-3xl p-8 flex flex-col items-center justify-center gap-4 transition-all">
                <div className="w-14 h-14 bg-background rounded-2xl flex items-center justify-center text-muted-foreground group-hover:text-primary group-hover:scale-110 transition-all shadow-sm"><FileUp size={28} /></div>
                <div className="text-center">
                  <span className="font-bold text-foreground block mb-1 group-hover:text-primary transition-colors">Unggah Materi / Referensi (PDF, Word)</span>
                  <span className="text-xs text-muted-foreground">Tutor AI akan membaca dokumen ini dan menjawab berdasarkan konteksnya.</span>
                </div>
              </button>
              <div className="w-full pt-4">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <LayoutTemplate size={16} className="text-muted-foreground" />
                  <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Pustaka Template</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {[
                    { label: "Laporan Praktikum", prompt: "Tolong buatkan format dan kerangka penulisan untuk Laporan Praktikum berdasarkan panduan standar, dan analisis data yang akan saya unggah." },
                    { label: "Bab 1 Pendahuluan", prompt: "Bantu saya menyusun Bab 1: Pendahuluan (Latar Belakang, Rumusan Masalah, Tujuan) untuk skripsi/makalah saya. Saya akan memberikan topik detailnya." },
                    { label: "Analisis Jurnal", prompt: "Saya akan mengunggah sebuah jurnal PDF. Tolong buatkan analisis kritis yang mencakup temuan utama, metodologi, dan kelemahan penelitian tersebut." },
                    { label: "Esai Opini", prompt: "Bantu saya membuat kerangka esai opini akademis sepanjang 1000 kata dengan argumen pro dan kontra terkait topik yang akan saya sebutkan." }
                  ].map((tpl, i) => (
                    <button key={i} onClick={() => { setInput(tpl.prompt); inputRef.current?.focus(); }}
                      className="text-left bg-card hover:bg-muted border border-border p-4 rounded-2xl transition-colors shadow-sm flex flex-col gap-2">
                      <span className="font-bold text-sm text-foreground">{tpl.label}</span>
                      <span className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{tpl.prompt}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {visibleMessages.map((msg, idx) => (
                <motion.div key={idx} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}>
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-9 h-9 rounded-2xl bg-primary/10 text-primary grid place-items-center mt-0.5"><Bot size={18} /></div>
                  )}
                  <div className={`flex flex-col min-w-0 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                    <div className={`rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm leading-relaxed shadow-sm ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-tr-md" : "bg-muted text-foreground rounded-tl-md border border-border"}`}>
                      <div className={`prose prose-sm max-w-none break-words ${msg.role === "user" ? "text-primary-foreground prose-invert" : "text-foreground dark:prose-invert"}`}>
                        {msg.role === "assistant" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                        ) : (
                          <p className="whitespace-pre-wrap m-0">{msg.content}</p>
                        )}
                      </div>
                      {msg.isStreaming && (
                        <span className="inline-flex gap-1 items-center ml-1 align-middle">
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:0ms] opacity-70" />
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:150ms] opacity-70" />
                          <span className="w-1.5 h-1.5 bg-current rounded-full animate-bounce [animation-delay:300ms] opacity-70" />
                        </span>
                      )}
                    </div>
                    {msg.role === "assistant" && !msg.isStreaming && msg.meta && (
                      <div className="w-full mt-1.5">
                        <ConfidenceBadge level={msg.meta.confidence} sources={msg.meta.sources.map((s): SourceAttribution => ({ title: s.title, author: "", year: "", exactQuote: s.exactQuote }))} />
                      </div>
                    )}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        <div className="shrink-0 border-t border-border p-3 sm:p-4 bg-card flex flex-col gap-2">
          {attachment && (
            <div className="flex items-center justify-between bg-muted rounded-xl px-3 py-2 border border-border/50 max-w-sm">
              <div className="flex items-center gap-2 overflow-hidden">
                <FileText size={16} className="text-primary shrink-0" />
                <span className="text-xs font-semibold text-foreground truncate">{attachment.name}</span>
              </div>
              <button type="button" onClick={() => setAttachment(null)} className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors"><X size={14} /></button>
            </div>
          )}
          <form onSubmit={handleSend} className="flex gap-2.5 items-center">
            <input type="file" ref={fileInputRef} className="hidden" accept=".pdf,.docx,.txt"
              onChange={(e) => { if (e.target.files?.[0]) setAttachment(e.target.files[0]); }} />
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading || isUploading} aria-label="Lampirkan file"
              className="grid place-items-center w-12 h-12 shrink-0 bg-muted hover:bg-muted/80 text-muted-foreground hover:text-foreground rounded-2xl transition-all border border-border disabled:opacity-50">
              <Paperclip size={20} />
            </button>
            <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)}
              placeholder={attachment ? "Tambahkan pesan untuk lampiran ini..." : currentMode.placeholder}
              disabled={isLoading || isUploading}
              className="flex-1 px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60" />
            <button type="submit" disabled={isLoading || isUploading || (!input.trim() && !attachment)} aria-label="Kirim pesan"
              className="grid place-items-center w-12 h-12 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
              {isLoading || isUploading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
