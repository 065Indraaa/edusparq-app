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
    <div className="flex flex-col h-[calc(100vh-8rem)] md:h-[calc(100vh-4rem)] max-h-[860px]">

      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-2xl bg-primary/10 text-primary">
                <Bot size={20} />
              </span>
              Tutor AI
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              Ajukan pertanyaan seputar materi kuliah, dijawab sesuai gaya belajar Anda.
            </p>
          </div>

          {messages.length > 0 && (
            <button
              onClick={handleClearHistory}
              className="flex items-center gap-1.5 px-3 min-h-[44px] rounded-2xl text-xs font-semibold text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors border border-transparent hover:border-destructive/20"
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">Hapus riwayat</span>
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
                aria-pressed={isActive}
                className={`flex items-center gap-2 px-4 min-h-[44px] rounded-2xl text-sm font-semibold transition-all border ${
                  isActive
                    ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20"
                    : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"
                }`}
              >
                <Icon size={16} />
                {m.label}
              </button>
            );
          })}
        </div>

        {/* Mode description */}
        <p className="text-xs text-muted-foreground mt-2.5 ml-1">{currentMode.desc}</p>

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
              <div className="flex items-start gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                <span className="grid place-items-center w-7 h-7 shrink-0 rounded-xl bg-emerald-500/15 text-emerald-500">
                  <Sparkles size={15} />
                </span>
                <div className="text-xs leading-relaxed">
                  <span className="font-bold">Mode Sokratik aktif</span>
                  <span className="block text-emerald-700/80 dark:text-emerald-300/80 mt-0.5">
                    Tutor tidak memberikan jawaban secara langsung, melainkan menuntun Anda melalui serangkaian pertanyaan agar dapat menemukan jawabannya sendiri.
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 no-scrollbar">

          {isFetchingHistory ? (
            <div className="flex items-center justify-center h-full">
              <RefreshCw size={20} className="text-muted-foreground animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center h-full text-center space-y-5 pb-8"
            >
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-primary/15 to-teal-500/15 text-primary flex items-center justify-center">
                <Sparkles size={28} />
              </div>
              <div className="space-y-2">
                <h3 className="font-bold text-lg text-foreground">Selamat datang, {userName}.</h3>
                <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                  {currentMode.desc} Tuliskan pertanyaan Anda pada kolom di bawah; gunakan bahasa yang paling nyaman bagi Anda.
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
                  className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                >
                  {/* Avatar */}
                  {msg.role === "assistant" && (
                    <div className="shrink-0 w-9 h-9 rounded-2xl bg-primary/10 text-primary grid place-items-center mt-0.5">
                      <Bot size={18} />
                    </div>
                  )}

                  <div className={`flex flex-col min-w-0 ${msg.role === "user" ? "items-end" : "items-start"} max-w-[85%]`}>
                    <div
                      className={`rounded-3xl px-4 py-3 sm:px-5 sm:py-3.5 text-sm leading-relaxed shadow-sm ${
                        msg.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-md"
                          : "bg-muted text-foreground rounded-tl-md border border-border"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{msg.content}</p>
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
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="shrink-0 border-t border-border p-3 sm:p-4 bg-card">
          <form onSubmit={handleSend} className="flex gap-2.5 items-center">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={currentMode.placeholder}
              disabled={isLoading}
              className="flex-1 px-4 min-h-[48px] rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              aria-label="Kirim pesan"
              className="grid place-items-center w-12 h-12 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground rounded-2xl transition-all shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {isLoading ? <RefreshCw size={18} className="animate-spin" /> : <Send size={18} />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
