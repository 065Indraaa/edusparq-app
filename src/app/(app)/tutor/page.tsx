"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Sparkles, Search, BookOpen, GraduationCap, Send, Trash2, RefreshCw } from "lucide-react";
import { useSession } from "next-auth/react";
import { ConfidenceBadge, ConfidenceLevel, SourceAttribution } from "@/components/ui/ConfidenceBadge";

interface ChatMeta {
  sources: { title: string; exactQuote: string; documentId: string }[];
  confidence: ConfidenceLevel;
}

interface ChatMessage {
  _id?: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  createdAt?: string;
  isStreaming?: boolean;
  meta?: ChatMeta;
}

const MODES = [
  {
    id: "socratic",
    label: "Socratic",
    icon: GraduationCap,
    desc: "Bantu kamu mikir sendiri — bukan langsung kasih jawaban",
    placeholder: "Tanya soal konsep yang bikin bingung...",
  },
  {
    id: "helper",
    label: "Penjelasan",
    icon: BookOpen,
    desc: "Jawaban langsung, jelas, pakai contoh nyata",
    placeholder: "Tanya apa aja soal kuliah kamu...",
  },
  {
    id: "research",
    label: "Riset",
    icon: Search,
    desc: "Cari sudut pandang penelitian dan referensi yang relevan",
    placeholder: "Topik atau pertanyaan riset kamu...",
  },
];

export default function TutorPage() {
  const { data: session } = useSession();
  const [mode, setMode] = useState("helper");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingHistory, setIsFetchingHistory] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const currentMode = MODES.find((m) => m.id === mode) || MODES[1];

  // Load chat history from DB
  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/chat")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setMessages(data);
      })
      .finally(() => setIsFetchingHistory(false));
  }, [session]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: input, mode };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    // Placeholder streaming message
    const streamingMsg: ChatMessage = {
      role: "assistant",
      content: "",
      mode,
      isStreaming: true,
    };
    setMessages((prev) => [...prev, streamingMsg]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: userMsg.content, mode }),
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
                  // Attach meta (sources + confidence) when it arrives.
                  ...(parsed.meta ? { meta: parsed.meta as ChatMeta } : {}),
                };
                return updated;
              });
            } catch {}
          }
        }
      }

      // Mark as done streaming
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
          content: "Koneksi terputus. Coba kirim lagi.",
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
    if (!confirm("Hapus semua riwayat obrolan?")) return;
    await fetch("/api/chat", { method: "DELETE" });
    setMessages([]);
  };

  const userName = session?.user?.name?.split(" ")[0] || "kamu";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-h-[860px]">
      
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Bot size={24} className="text-primary" />
              Tutor AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tanya apa aja soal materi kuliah — dijawab sesuai cara kamu belajar.
            </p>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
            >
              <Trash2 size={14} />
              Hapus riwayat
            </button>
          )}
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mt-4 flex-wrap">
          {MODES.map((m) => {
            const Icon = m.icon;
            const isActive = mode === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-2xl text-sm font-semibold transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                <Icon size={15} />
                {m.label}
              </button>
            );
          })}
        </div>
        
        {/* Mode description */}
        <p className="text-xs text-muted-foreground mt-2 ml-1">{currentMode.desc}</p>

        {/* Socratic mode persistent indicator */}
        <AnimatePresence>
          {mode === "socratic" && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-3"
            >
              <div className="inline-flex items-start gap-2.5 px-3.5 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <Sparkles size={16} className="shrink-0 mt-0.5 text-emerald-500" />
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Mode Sokratik aktif</span>
                  <span className="block text-emerald-700/80 dark:text-emerald-300/80">
                    Tutor nggak kasih jawaban langsung — dia bakal nuntun kamu lewat pertanyaan supaya nemu jawabannya sendiri.
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Chat Area */}
      <div className="flex-1 bg-card border border-border rounded-3xl flex flex-col overflow-hidden shadow-sm">
        
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 no-scrollbar">
          
          {isFetchingHistory ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={20} className="text-muted-foreground animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-4 pb-8"
            >
              <div className="w-16 h-16 rounded-3xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-foreground">Halo, {userName}! 👋</h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  {currentMode.desc}. Tulis pertanyaanmu di bawah — nggak perlu formal, pakai bahasa sehari-hari juga oke.
                </p>
              </div>
            </motion.div>
          ) : (
            <AnimatePresence initial={false}>
              {messages.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-3xl px-5 py-3.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-lg"
                        : "bg-muted text-foreground rounded-tl-lg border border-border"
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.isStreaming && (
                      <span className="inline-flex gap-0.5 ml-1">
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:0ms]" />
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:150ms]" />
                        <span className="w-1 h-1 bg-current rounded-full animate-bounce [animation-delay:300ms]" />
                      </span>
                    )}
                  </div>
                  {msg.role === "assistant" && !msg.isStreaming && msg.meta && (
                    <div className="max-w-[85%] w-full mt-1">
                      <ConfidenceBadge
                        level={msg.meta.confidence}
                        sources={msg.meta.sources.map(
                          (s): SourceAttribution => ({
                            title: s.title,
                            author: "",
                            year: "",
                            exactQuote: s.exactQuote,
                          })
                        )}
                      />
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border p-4">
          <form onSubmit={handleSend} className="flex gap-3 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentMode.placeholder}
              disabled={isLoading}
              className="flex-1 px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="p-3 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Send size={18} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
