"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Copy, Check, Paperclip, X, Sparkles, Loader2, ChevronDown } from "lucide-react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ type: string; title: string }>;
  streaming?: boolean;
  createdAt?: string;
}

interface ChatInterfaceProps {
  messages: Message[];
  onSend: (text: string, mode: string) => void;
  loading?: boolean;
  attachedFile?: { name: string; id: string } | null;
  onRemoveAttachment?: () => void;
  mode?: string;
  onModeChange?: (mode: string) => void;
}

const MODES = [
  { id: "helper", label: "Helper", desc: "Jawaban langsung & jelas" },
  { id: "socratic", label: "Socratic", desc: "Bimbingan lewat pertanyaan" },
  { id: "research", label: "Riset", desc: "Analisis mendalam dengan sumber" },
];

export function ChatInterface({ messages, onSend, loading, attachedFile, onRemoveAttachment, mode = "helper", onModeChange }: ChatInterfaceProps) {
  const [input, setInput] = useState("");
  const [showModeMenu, setShowModeMenu] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => { scrollToBottom(); }, [messages, scrollToBottom]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 160) + "px";
    }
  }, [input]);

  const handleSend = () => {
    if (!input.trim() || loading) return;
    onSend(input.trim(), mode);
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCopy = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const currentMode = MODES.find(m => m.id === mode) || MODES[0];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 space-y-6">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground mb-1">Tanya apa saja</h3>
              <p className="text-sm text-muted-foreground max-w-sm">
                Saya bisa bantu menjawab pertanyaan, membuat rangkuman, mencari referensi, dan mengerjakan tugas Anda.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-md">
              {["Jelaskan konsep Machine Learning", "Buat rangkuman materi", "Cari jurnal tentang ekonomi digital", "Bantu kerjakan tugas"].map((s) => (
                <button key={s} onClick={() => setInput(s)} className="px-3 py-1.5 text-xs font-medium bg-card border border-border rounded-full hover:bg-muted transition-colors text-muted-foreground">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <AnimatePresence initial={false}>
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div className={`max-w-[85%] md:max-w-[75%] ${msg.role === "user" ? "order-2" : ""}`}>
                <div
                  className={`rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? "bg-primary text-background rounded-br-md"
                      : "bg-card border border-border text-foreground rounded-bl-md"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div className="prose prose-sm dark:prose-invert max-w-none break-words [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_pre]:bg-muted [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto [&_code]:text-sm [&_a]:text-primary">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {msg.content || ""}
                      </ReactMarkdown>
                    </div>
                  ) : (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{msg.content}</p>
                  )}
                  {msg.streaming && (
                    <div className="flex gap-1 mt-2">
                      {[0, 1, 2].map((i) => (
                        <span key={i} className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                      ))}
                    </div>
                  )}
                </div>
                {msg.role === "assistant" && !msg.streaming && msg.content && (
                  <div className="flex items-center gap-2 mt-1.5 ml-1">
                    <button
                      onClick={() => handleCopy(msg.content, msg.id)}
                      className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                    >
                      {copiedId === msg.id ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      {copiedId === msg.id ? "Tersalin" : "Salin"}
                    </button>
                    {msg.sources && msg.sources.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        {msg.sources.length} sumber
                      </span>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {loading && messages[messages.length - 1]?.role === "user" && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-background p-3 md:p-4">
        <div className="max-w-4xl mx-auto">
          {attachedFile && (
            <div className="mb-2 inline-flex items-center gap-2 px-3 py-1.5 bg-muted rounded-lg text-xs">
              <Paperclip className="w-3 h-3" />
              <span className="font-medium">{attachedFile.name}</span>
              <button onClick={onRemoveAttachment} className="hover:text-foreground">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}
          <div className="relative flex items-end gap-2">
            <div className="relative">
              <button
                onClick={() => setShowModeMenu(!showModeMenu)}
                className="flex items-center gap-1 px-3 py-2.5 rounded-xl bg-card border border-border text-xs font-medium hover:bg-muted transition-colors h-full"
              >
                {currentMode.label}
                <ChevronDown className="w-3 h-3" />
              </button>
              {showModeMenu && (
                <div className="absolute bottom-full mb-1 left-0 w-48 bg-card border border-border rounded-xl shadow-lg overflow-hidden z-50">
                  {MODES.map((m) => (
                    <button
                      key={m.id}
                      onClick={() => { onModeChange?.(m.id); setShowModeMenu(false); }}
                      className={`w-full text-left px-3 py-2 hover:bg-muted transition-colors ${mode === m.id ? "bg-muted" : ""}`}
                    >
                      <div className="text-xs font-semibold">{m.label}</div>
                      <div className="text-[10px] text-muted-foreground">{m.desc}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex-1 flex items-end gap-2 bg-card border border-border rounded-xl focus-within:ring-2 focus-within:ring-primary/20 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tulis pesan..."
                rows={1}
                className="flex-1 bg-transparent resize-none px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none max-h-40"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || loading}
                className="m-1 p-2 rounded-lg bg-primary text-background disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
