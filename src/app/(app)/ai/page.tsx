"use client";

import React, { useState, useEffect, Suspense, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useRouter } from "next/navigation";
import {
  Bot,
  Cpu,
  GraduationCap,
  PenTool,
  Search,
  Scale,
  Sparkles,
  ChevronDown,
  Command,
} from "lucide-react";
import AiTutorMode from "../../../components/ai-modes/AiTutorMode";
import AiAgentMode from "../../../components/ai-modes/AiAgentMode";
import AiDosenMode from "../../../components/ai-modes/AiDosenMode";
import AiWritingMode from "../../../components/ai-modes/AiWritingMode";
import AiResearchMode from "../../../components/ai-modes/AiResearchMode";
import AiHukumMode from "../../../components/ai-modes/AiHukumMode";

const AI_MODES = [
  {
    id: "tutor",
    label: "Tutor AI",
    shortLabel: "Tutor",
    icon: Bot,
    desc: "Tanya jawab materi kuliah",
    color: "bg-primary/10 text-primary border-primary/20",
    activeColor: "bg-primary text-primary-foreground border-primary",
    ringColor: "ring-primary/20",
  },
  {
    id: "agent",
    label: "Agent AI",
    shortLabel: "Agent",
    icon: Cpu,
    desc: "Tugas kompleks multi-agen",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    activeColor: "bg-violet-600 text-white border-violet-600",
    ringColor: "ring-violet-500/20",
  },
  {
    id: "dosen",
    label: "Dosen Virtual",
    shortLabel: "Dosen",
    icon: GraduationCap,
    desc: "Nilai jawaban esai & rubrik",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    activeColor: "bg-emerald-600 text-white border-emerald-600",
    ringColor: "ring-emerald-500/20",
  },
  {
    id: "writing",
    label: "Asisten Menulis",
    shortLabel: "Menulis",
    icon: PenTool,
    desc: "Draft, sitasi & dokumen",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    activeColor: "bg-amber-600 text-white border-amber-600",
    ringColor: "ring-amber-500/20",
  },
  {
    id: "research",
    label: "Riset AI",
    shortLabel: "Riset",
    icon: Search,
    desc: "Kajian literatur & topik",
    color: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20",
    activeColor: "bg-sky-600 text-white border-sky-600",
    ringColor: "ring-sky-500/20",
  },
  {
    id: "hukum",
    label: "Kamus Hukum",
    shortLabel: "Hukum",
    icon: Scale,
    desc: "Cari pasal & peraturan",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    activeColor: "bg-rose-600 text-white border-rose-600",
    ringColor: "ring-rose-500/20",
  },
];

function AiHubInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const paramMode = searchParams.get("mode");
  const [mode, setMode] = useState("tutor");
  const [showDropdown, setShowDropdown] = useState(false);
  const [showHint, setShowHint] = useState(false);

  useEffect(() => {
    if (paramMode && AI_MODES.some((m) => m.id === paramMode)) {
      setMode(paramMode);
    }
  }, [paramMode]);

  // Keyboard shortcuts: 1-6 to switch modes
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= AI_MODES.length) {
        switchMode(AI_MODES[num - 1].id);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Show shortcut hint briefly on first load
  useEffect(() => {
    const t1 = setTimeout(() => setShowHint(true), 800);
    const t2 = setTimeout(() => setShowHint(false), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const currentMode = AI_MODES.find((m) => m.id === mode) || AI_MODES[0];

  const switchMode = useCallback((id: string) => {
    setMode(id);
    setShowDropdown(false);
    router.replace(`/ai?mode=${id}`, { scroll: false });
  }, [router]);

  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="shrink-0 mb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <h1 className="font-display tracking-tight text-xl sm:text-2xl font-extrabold text-foreground flex items-center gap-2.5">
              <span className="grid place-items-center w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/15 to-teal-500/15 text-primary">
                <Sparkles size={20} />
              </span>
              Asisten AI
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              Semua alat bantu akademik AI dalam satu tempat. Pilih mode yang sesuai kebutuhan Anda.
            </p>
          </div>

          {/* Dropdown (mobile compact) + shortcut hint */}
          <div className="flex items-center gap-3">
            <AnimatePresence>
              {showHint && (
                <motion.div
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="hidden sm:flex items-center gap-1.5 text-[10px] font-semibold text-muted-foreground bg-muted px-2.5 py-1 rounded-lg border border-border"
                >
                  <Command size={10} /> Tekan 1–6 untuk switch mode
                </motion.div>
              )}
            </AnimatePresence>
            <div className="relative">
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-card border border-border hover:border-primary/40 transition-all text-sm font-bold shadow-sm"
              >
                <span className={`grid place-items-center w-6 h-6 rounded-lg ${currentMode.color}`}>
                  <currentMode.icon size={14} />
                </span>
                <span className="text-foreground hidden sm:inline">{currentMode.label}</span>
                <span className="text-foreground sm:hidden">{currentMode.shortLabel}</span>
                <ChevronDown size={13} className={`text-muted-foreground transition-transform ${showDropdown ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {showDropdown && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -6, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-2 w-64 bg-card border border-border rounded-2xl shadow-2xl z-50 p-1.5 space-y-0.5"
                    >
                      {AI_MODES.map((m, i) => (
                        <button
                          key={m.id}
                          onClick={() => switchMode(m.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-sm font-semibold transition-all ${
                            mode === m.id ? m.activeColor : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-white/10 shrink-0">
                            <m.icon size={15} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="block truncate">{m.label}</span>
                              <span className="text-[10px] font-bold opacity-60 ml-2 shrink-0">{i + 1}</span>
                            </div>
                            <span className={`block text-[10px] font-medium truncate ${mode === m.id ? "text-white/70" : "text-muted-foreground"}`}>
                              {m.desc}
                            </span>
                          </div>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Scrollable horizontal tabs — all breakpoints */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
            {AI_MODES.map((m, i) => {
              const Icon = m.icon;
              const isActive = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => switchMode(m.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border whitespace-nowrap shrink-0 select-none ${
                    isActive ? m.activeColor : `${m.color} hover:opacity-80`
                  } ${isActive ? "shadow-sm" : ""}`}
                >
                  <Icon size={14} />
                  <span className="hidden sm:inline">{m.shortLabel}</span>
                  <span className="sm:hidden">{m.shortLabel.slice(0, 3)}</span>
                  {isActive && (
                    <motion.span
                      layoutId="ai-active-pill"
                      className={`absolute inset-0 rounded-xl ring-2 ${m.ringColor} pointer-events-none`}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                  <span className="hidden lg:inline-flex items-center justify-center w-4 h-4 rounded bg-black/10 text-[9px] font-black opacity-50">
                    {i + 1}
                  </span>
                </button>
              );
            })}
          </div>
          {/* Fade indicator for scroll */}
          <div className="absolute right-0 top-0 bottom-1 w-8 bg-gradient-to-l from-background to-transparent pointer-events-none sm:hidden" />
        </div>
      </div>

      {/* Mode Content */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            initial={{ opacity: 0, y: 10, filter: "blur(2px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -6, filter: "blur(2px)" }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="h-full"
          >
            {mode === "tutor" && <AiTutorMode />}
            {mode === "agent" && <AiAgentMode />}
            {mode === "dosen" && <AiDosenMode />}
            {mode === "writing" && <AiWritingMode />}
            {mode === "research" && <AiResearchMode />}
            {mode === "hukum" && <AiHukumMode />}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default function AiHubPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full">
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <span className="text-xs font-semibold text-muted-foreground animate-pulse">Memuat Asisten AI...</span>
          </div>
        </div>
      }
    >
      <AiHubInner />
    </Suspense>
  );
}
