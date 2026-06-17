"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, FileText, Globe, Loader2, Send } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface DocOpt { _id: string; originalName: string; }

export default function AssignmentSolver({ documents }: { documents: DocOpt[] }) {
  const [question, setQuestion] = useState("");
  const [docId, setDocId] = useState("");
  const [useWebSearch, setUseWebSearch] = useState(true);
  
  const [solving, setSolving] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  const handleSolve = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim() || solving) return;

    setSolving(true);
    setResult("");
    setError("");

    try {
      const res = await fetch("/api/exams/solve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question,
          documentId: docId || undefined,
          useWebSearch,
        }),
      });

      if (!res.ok || !res.body) {
        setError("Gagal memproses tugas. Silakan coba lagi.");
        setSolving(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
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
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            setResult((prev) => prev + (parsed.text || ""));
          } catch {
            // Abaikan error parse
          }
        }
      }
    } catch {
      setError("Terjadi kendala koneksi.");
    } finally {
      setSolving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/5 blur-3xl" />
        
        <div className="flex items-center gap-2 relative z-10">
          <Sparkles size={18} className="text-primary" />
          <h2 className="font-bold text-foreground text-lg">Mengerjakan Tugas & Esai</h2>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed relative z-10 max-w-3xl">
          Sistem AI akan menyusun jawaban lengkap, memecahkan masalah matematika/logika, atau melakukan analisis berdasarkan dokumen materi kuliah Anda dan hasil riset web secara instan.
        </p>

        <form onSubmit={handleSolve} className="space-y-4 relative z-10">
          <textarea
            required
            rows={5}
            placeholder="Ketik instruksi tugas atau tempelkan pertanyaan di sini..."
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full px-4 py-3 rounded-2xl bg-muted/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all resize-none"
          />

          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <FileText size={14} /> Referensi Materi (Opsional)
              </label>
              <select
                value={docId}
                onChange={(e) => setDocId(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
              >
                <option value="">Gunakan pengetahuan dasar AI</option>
                {documents.map((d) => (
                  <option key={d._id} value={d._id}>{d.originalName}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 space-y-2">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Globe size={14} /> Fitur Pintar
              </label>
              <label className="flex items-center gap-3 p-2.5 rounded-xl border border-border bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="relative flex items-center">
                  <input 
                    type="checkbox" 
                    checked={useWebSearch}
                    onChange={(e) => setUseWebSearch(e.target.checked)}
                    className="sr-only peer" 
                  />
                  <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                </div>
                <span className="text-sm font-medium text-foreground">Gunakan Pencarian Web Publik</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            disabled={solving || !question.trim()}
            className="w-full py-3.5 bg-foreground hover:bg-foreground/90 text-background font-bold text-sm rounded-2xl transition-all shadow-sm disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {solving ? (
              <><Loader2 size={16} className="animate-spin" /> Memproses Solusi Tugas...</>
            ) : (
              <><Send size={16} /> Hasilkan Jawaban</>
            )}
          </button>
        </form>
      </div>

      <AnimatePresence>
        {(result || solving) && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-card border-l-4 border-l-primary border-t border-r border-b border-border rounded-2xl p-6 md:p-8 shadow-sm relative"
          >
            <div className="flex items-center gap-2 mb-4">
              <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded">
                Asisten Akademik
              </span>
              {useWebSearch && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Globe size={12} /> Diperkuat Pencarian Web
                </span>
              )}
            </div>
            
            <div className="prose prose-sm dark:prose-invert max-w-none text-foreground leading-relaxed">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{result}</ReactMarkdown>
              {solving && (
                <span className="inline-block w-1.5 h-4 align-middle bg-primary/60 animate-pulse ml-1" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
