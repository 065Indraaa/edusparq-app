"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Cpu, Sparkles, CheckCircle2, XCircle, AlertCircle, Clock,
  ChevronRight, Send, RefreshCw, Zap, Brain, Target, ListChecks,
  Wrench, Star, ArrowRight, HelpCircle, Play, RotateCcw,
  MessageSquare, Loader2, BookOpen, Shield,
} from "lucide-react";
import { useSession } from "next-auth/react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface TraceStep {
  agent: string;
  startedAt: string;
  finishedAt?: string;
  status: "pending" | "running" | "done" | "skipped" | "error";
  summary?: string;
  creditCost?: number;
  tokensOut?: number;
  error?: string;
}

interface AgentSession {
  _id: string;
  request: string;
  courseName: string;
  tutorMode: string;
  tier: string;
  status: string;
  totalCreditCost: number;
  trace: TraceStep[];
  pendingClarification?: string[];
  createdAt: string;
}

const AGENT_PIPELINE = [
  { id: "classifier", label: "Pengarah", icon: Brain, color: "from-violet-500 to-purple-600", bgLight: "bg-violet-500/10", textColor: "text-violet-600 dark:text-violet-400", borderColor: "border-violet-500/30", tier: "complex", desc: "Menganalisis kompleksitas permintaan dan memilih jalur eksekusi paling hemat (simple/medium/complex).", detail: "Pakai heuristic rule-based gratis terlebih dahulu. Hanya bila ambigu, AI classifier dipanggil dengan model lite untuk hemat token.", tokens: "~150" },
  { id: "clarifier", label: "Klarifikasi", icon: HelpCircle, color: "from-amber-500 to-orange-500", bgLight: "bg-amber-500/10", textColor: "text-amber-600 dark:text-amber-400", borderColor: "border-amber-500/30", tier: "medium+", desc: "Mendeteksi ambiguitas & mengajukan pertanyaan esensial, atau menyimpulkan asumsi bila permintaan sudah cukup jelas.", detail: "Maksimal 3 pertanyaan tajam. Bila permintaan sudah jelas, langsung tulis asumsi tanpa bertanya.", tokens: "~600" },
  { id: "specifier", label: "Spesifikasi", icon: Target, color: "from-blue-500 to-cyan-500", bgLight: "bg-blue-500/10", textColor: "text-blue-600 dark:text-blue-400", borderColor: "border-blue-500/30", tier: "complex", desc: "Mengubah permintaan menjadi spesifikasi teknis: tujuan, scope, batasan, kriteria sukses.", detail: "Kontrak kerja untuk semua agen selanjutnya. Output terstruktur dalam 4 heading: Tujuan, Scope, Batasan, Kriteria Sukses.", tokens: "~900" },
  { id: "planner", label: "Perencanaan", icon: ListChecks, color: "from-emerald-500 to-green-500", bgLight: "bg-emerald-500/10", textColor: "text-emerald-600 dark:text-emerald-400", borderColor: "border-emerald-500/30", tier: "complex", desc: "Memecah spesifikasi menjadi urutan langkah logis yang terstruktur (3–8 langkah).", detail: "Setiap langkah punya judul singkat + detail. Diurutkan berdasarkan dependensi: dasar dulu, detail kemudian, penutup terakhir.", tokens: "~900" },
  { id: "tasker", label: "Penugasasan", icon: ListChecks, color: "from-teal-500 to-cyan-600", bgLight: "bg-teal-500/10", textColor: "text-teal-600 dark:text-teal-400", borderColor: "border-teal-500/30", tier: "complex", desc: "Mengubah rencana menjadi task atomic siap-eksekusi (maks 6 task).", detail: "Tiap task = satu unit kerja. Langkah kecil digabung, langkah besar dipecah. Implementer bisa langsung kerjakan tanpa bertanya.", tokens: "~700" },
  { id: "implementer", label: "Implementasi", icon: Wrench, color: "from-orange-500 to-red-500", bgLight: "bg-orange-500/10", textColor: "text-orange-600 dark:text-orange-400", borderColor: "border-orange-500/30", tier: "all", desc: "Eksekutor utama — menjalankan semua task & menghasilkan output final berkualitas universitas.", detail: "Prioritaskan referensi sebagai fondasi. Kutip eksplisit. Bahasa formal metodis. Rumus sebagai teks tebal. Jangan mengarang data.", tokens: "~3000" },
  { id: "reviewer", label: "Kualitas", icon: Star, color: "from-rose-500 to-pink-500", bgLight: "bg-rose-500/10", textColor: "text-rose-600 dark:text-rose-400", borderColor: "border-rose-500/30", tier: "complex", desc: "Audit output terhadap spesifikasi, beri skor kualitas 0–100, revisi bila kurang dari 75.", detail: "Cek kelengkapan, akurasi, struktur & bahasa. Bila ada masalah kritis → revisi output. Bila reviewer gagal → output implementer tetap diberikan (graceful).", tokens: "~1500" },
];

const TIER_EXPLANATIONS = [
  { tier: "simple", label: "Simple", icon: Zap, color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30", desc: "1 panggilan AI", flow: "Helper → Output", examples: ["Apa itu inflasi?", "Jelaskan fungsi UI pada React"], detail: "Pertanyaan definisi/fakta langsung dijawab oleh persona tutor. Tidak ada sub-agen." },
  { tier: "medium", label: "Medium", icon: MessageSquare, color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30", desc: "2 panggilan AI", flow: "Klarifikasi → Implementasi", examples: ["Bandingkan regresi linear vs logistik", "Jelaskan teori motivasi Herzberg"], detail: "Klarifier cek ambiguitas, lalu Implementer kerjakan. Reviewer tidak dipanggil." },
  { tier: "complex", label: "Complex", icon: Cpu, color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30", desc: "6–7 panggilan AI", flow: "Klarifikasi → Spesifikasi → Perencanaan → Penugasasan → Implementasi → Kualitas", examples: ["Buatkan saya bab 3 skripsi", "Selesaikan soal studi kasus ini lengkap", "Buat ERD untuk sistem perpustakaan"], detail: "Pipeline penuh. Setiap tahap menghasilkan output yang jadi input tahap berikutnya — hemat token karena tidak mengulang dari nol." },
];

function StatusIcon({ status }: { status: TraceStep["status"] }) {
  switch (status) {
    case "done": return <CheckCircle2 size={16} className="text-emerald-500" />;
    case "running": return <Loader2 size={16} className="text-primary animate-spin" />;
    case "error": return <XCircle size={16} className="text-red-500" />;
    case "skipped": return <AlertCircle size={16} className="text-muted-foreground" />;
    default: return <Clock size={16} className="text-muted-foreground" />;
  }
}

function TraceStepper({ trace }: { trace: TraceStep[] }) {
  if (trace.length === 0) return null;
  return (
    <div className="space-y-3 mt-4">
      <h4 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Jejak Eksekusi</h4>
      <div className="space-y-2">
        {trace.map((step, i) => {
          const agentDef = AGENT_PIPELINE.find((a) => a.id === step.agent);
          return (
            <div key={i} className={`flex items-start gap-3 px-3 py-2.5 rounded-2xl border transition-all ${step.status === "running" ? "bg-primary/5 border-primary/30" : step.status === "done" ? "bg-emerald-500/5 border-emerald-500/20" : step.status === "error" ? "bg-red-500/5 border-red-500/20" : "bg-muted/30 border-border/50"}`}>
              <div className="mt-0.5 shrink-0"><StatusIcon status={step.status} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-bold text-foreground truncate">{agentDef?.label || step.agent}</span>
                  {step.creditCost !== undefined && step.creditCost > 0 && <span className="text-[10px] font-semibold text-muted-foreground shrink-0">{step.creditCost.toFixed(1)} cr</span>}
                </div>
                {step.summary && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">{step.summary}</p>}
                {step.error && <p className="text-xs text-red-500 mt-0.5 line-clamp-2">{step.error}</p>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TierBadge({ tier }: { tier: string }) {
  const t = TIER_EXPLANATIONS.find((e) => e.tier === tier);
  if (!t) return null;
  const Icon = t.icon;
  return <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border ${t.color}`}><Icon size={12} />{t.label}</span>;
}

export default function AiAgentMode() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"docs" | "run" | "history">("docs");
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [runResult, setRunResult] = useState<{ output: string; tier: string; trace: TraceStep[]; totalCreditCost: number; pendingClarification?: string[]; sessionId: string } | null>(null);
  const [runError, setRunError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AgentSession | null>(null);

  const loadSessions = useCallback(async () => {
    if (!session?.user) return;
    setIsLoadingSessions(true);
    try {
      const res = await fetch("/api/agent/sessions?limit=20");
      if (res.ok) {
        const data = await res.json();
        setSessions(Array.isArray(data) ? data : []);
      }
    } catch { /* non-fatal */ }
    setIsLoadingSessions(false);
  }, [session]);

  useEffect(() => {
    if (activeTab === "history") loadSessions();
  }, [activeTab, loadSessions]);

  const handleRun = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isRunning) return;
    setIsRunning(true);
    setRunResult(null);
    setRunError("");
    try {
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: input.trim(), tutorMode: "helper" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setRunError(data.error || "Gagal menjalankan agent pipeline.");
      } else {
        setRunResult(data);
        setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
      }
    } catch {
      setRunError("Koneksi gagal. Coba lagi.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display tracking-tight text-xl font-extrabold flex items-center gap-2.5">
            <span className="grid place-items-center w-8 h-8 rounded-2xl bg-gradient-to-br from-violet-500/15 to-pink-500/15 text-violet-600 dark:text-violet-400"><Cpu size={18} /></span>
            Agent AI
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Sistem multi-agen untuk tugas akademik kompleks — hemat token, hasil terstruktur.</p>
        </div>
      </div>

      <div className="flex gap-2">
        {([
          { id: "docs", label: "Cara Kerja", icon: BookOpen },
          { id: "run", label: "Jalankan Agent", icon: Play },
          { id: "history", label: "Riwayat", icon: Clock },
        ] as const).map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} aria-pressed={isActive}
              className={`flex items-center gap-2 px-4 min-h-[44px] rounded-2xl text-sm font-semibold transition-all border ${isActive ? "bg-primary text-primary-foreground border-primary shadow-sm shadow-primary/20" : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40"}`}>
              <Icon size={15} />{tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === "docs" && (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-primary/15 to-teal-500/15 text-primary flex items-center justify-center"><Zap size={20} /></div>
              <div>
                <h3 className="font-bold text-lg text-foreground">Bagaimana Agent Bekerja?</h3>
                <p className="text-xs text-muted-foreground">Orchestrator on-demand — hanya jalankan yang dibutuhkan</p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground leading-relaxed space-y-3">
              <p>Orchestrator menganalisis kompleksitas permintaan dan memilih jalur eksekusi paling efisien. Setiap agen membaca hasil agen sebelumnya dan menulis outputnya kembali ke konteks bersama.</p>
              <div className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-xs font-semibold"><Shield size={14} className="shrink-0" />Klasifikasi pertama menggunakan heuristic rule-based (GRATIS). AI classifier hanya dipanggil bila ambigu.</div>
            </div>
          </div>
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm">
            <h3 className="font-bold text-lg text-foreground mb-4">3 Jalur Eksekusi</h3>
            <div className="grid gap-4 sm:grid-cols-3">
              {TIER_EXPLANATIONS.map((tier) => {
                const Icon = tier.icon;
                return (
                  <div key={tier.tier} className={`p-4 rounded-2xl border ${tier.color} space-y-3`}>
                    <div className="flex items-center gap-2"><Icon size={20} /><h4 className="font-bold text-sm">{tier.label}</h4></div>
                    <p className="text-xs font-semibold opacity-80">{tier.desc}</p>
                    <p className="text-xs opacity-70">{tier.flow}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "run" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
            <form onSubmit={handleRun} className="space-y-3">
              <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Contoh: Buatkan saya kerangka Bab 3 Metodologi Penelitian..." disabled={isRunning} rows={4}
                className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all disabled:opacity-60 resize-none" />
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs text-muted-foreground">Kredit Anda akan dipotong sesuai jumlah agen yang dijalankan.</p>
                <button type="submit" disabled={isRunning || !input.trim()}
                  className="flex items-center gap-2 px-5 min-h-[44px] rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-bold transition-all shadow-sm shadow-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none">
                  {isRunning ? <><Loader2 size={16} className="animate-spin" />Memproses...</> : <><Send size={16} />Jalankan</>}
                </button>
              </div>
            </form>
          </div>
          {runError && <div className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 text-sm text-red-600 dark:text-red-400">{runError}</div>}
          {runResult && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3"><TierBadge tier={runResult.tier} /><span className="text-xs text-muted-foreground">{runResult.totalCreditCost.toFixed(1)} credit terpakai</span></div>
                <button onClick={() => { setRunResult(null); setInput(""); }} className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"><RotateCcw size={13} />Mulai baru</button>
              </div>
              {runResult.pendingClarification && runResult.pendingClarification.length > 0 && (
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 space-y-2">
                  <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400"><HelpCircle size={16} /><span className="text-sm font-bold">Pertanyaan Klarifikasi</span></div>
                  <ul className="space-y-1.5">
                    {runResult.pendingClarification.map((q, i) => (
                      <li key={i} className="text-sm text-muted-foreground flex items-start gap-2"><span className="font-bold text-amber-500 shrink-0">{i + 1}.</span>{q}</li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="prose prose-sm max-w-none text-foreground dark:prose-invert border-t border-border pt-4">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{runResult.output}</ReactMarkdown>
              </div>
              <TraceStepper trace={runResult.trace} />
              <div ref={bottomRef} />
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Riwayat sesi agent terbaru</p>
            <button onClick={loadSessions} disabled={isLoadingSessions} className="flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"><RefreshCw size={13} className={isLoadingSessions ? "animate-spin" : ""} />Muat ulang</button>
          </div>
          {isLoadingSessions ? (
            <div className="flex items-center justify-center py-20"><Loader2 size={24} className="text-muted-foreground animate-spin" /></div>
          ) : sessions.length === 0 ? (
            <div className="bg-card border border-border rounded-3xl p-12 text-center shadow-sm">
              <div className="w-14 h-14 rounded-3xl bg-muted flex items-center justify-center mx-auto mb-4"><Clock size={24} className="text-muted-foreground" /></div>
              <h3 className="font-bold text-foreground mb-1">Belum ada sesi agent</h3>
              <p className="text-sm text-muted-foreground">Jalankan agent pertama Anda di tab "Jalankan Agent".</p>
            </div>
          ) : (
            <div className="space-y-3">
              {sessions.map((s) => (
                <div key={s._id} onClick={() => setSelectedSession(selectedSession?._id === s._id ? null : s)}
                  className={`bg-card border rounded-2xl p-4 shadow-sm cursor-pointer transition-all ${selectedSession?._id === s._id ? "border-primary/40 bg-primary/5" : "border-border hover:border-primary/20"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground line-clamp-2 leading-relaxed">{s.request}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <TierBadge tier={s.tier} />
                        {s.courseName && <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-md">{s.courseName}</span>}
                        <span className="text-[10px] text-muted-foreground">{s.totalCreditCost.toFixed(1)} cr</span>
                        <span className={`text-[10px] font-bold ${s.status === "completed" ? "text-emerald-500" : s.status === "error" ? "text-red-500" : s.status === "clarification" ? "text-amber-500" : "text-muted-foreground"}`}>
                          {s.status === "completed" ? "Selesai" : s.status === "clarification" ? "Menunggu jawaban" : s.status === "error" ? "Gagal" : s.status}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0">{new Date(s.createdAt).toLocaleDateString("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                  <AnimatePresence>
                    {selectedSession?._id === s._id && s.trace?.length > 0 && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <TraceStepper trace={s.trace} />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
