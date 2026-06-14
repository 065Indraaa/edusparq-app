"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  Sparkles,
  GraduationCap,
  BookOpen,
  UploadCloud,
  CheckCircle2,
  Circle,
  ArrowRight,
  X,
} from "lucide-react";

const SEEN_KEY = "edusparq_onboarding_seen";

type Steps = { profilDone: boolean; adaMatkul: boolean; adaMateri: boolean };

interface StepDef {
  key: keyof Steps;
  title: string;
  desc: string;
  href: string;
  cta: string;
  icon: typeof GraduationCap;
}

const STEPS: StepDef[] = [
  {
    key: "profilDone",
    title: "Lengkapi profil kampus",
    desc: "Universitas, fakultas, program studi, dan semester.",
    href: "/profile",
    cta: "Isi profil",
    icon: GraduationCap,
  },
  {
    key: "adaMatkul",
    title: "Tambah mata kuliah",
    desc: "Biar IPK, SKS, dan rekomendasi belajar relevan denganmu.",
    href: "/workspace",
    cta: "Tambah matkul",
    icon: BookOpen,
  },
  {
    key: "adaMateri",
    title: "Upload materi pertama",
    desc: "PDF atau slide kuliah — AI akan langsung membacanya.",
    href: "/workspace",
    cta: "Upload materi",
    icon: UploadCloud,
  },
];

/**
 * Welcome / onboarding modal. Mounted in the app layout so it can appear on the
 * first authenticated page load. Visibility is derived from REAL data via
 * /api/user/onboarding (no stale flags), and suppressed for the session once the
 * user has seen it (localStorage) or dismissed it (server).
 */
export function OnboardingGate() {
  const { status } = useSession();
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<Steps | null>(null);

  useEffect(() => {
    if (status !== "authenticated") return;
    if (typeof window !== "undefined" && window.localStorage.getItem(SEEN_KEY)) {
      return;
    }
    let active = true;
    fetch("/api/user/onboarding")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!active || !data) return;
        if (!data.selesai && !data.dismissed) {
          setSteps(data.steps);
          setOpen(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [status]);

  const markSeen = () => {
    if (typeof window !== "undefined") window.localStorage.setItem(SEEN_KEY, "1");
  };

  const handleSkip = () => {
    markSeen();
    setOpen(false);
    fetch("/api/user/onboarding", { method: "PATCH" }).catch(() => {});
  };

  const handleNavigate = () => {
    markSeen();
    setOpen(false);
  };

  if (!steps) return null;

  const doneCount = Object.values(steps).filter(Boolean).length;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan memulai EduSparq"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 12 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-lg overflow-hidden"
          >
            {/* Header */}
            <div className="relative px-6 pt-6 pb-5 border-b border-border">
              <button
                onClick={handleSkip}
                aria-label="Tutup"
                className="absolute right-4 top-4 w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20 mb-3">
                <Sparkles size={14} />
                <span>Selamat datang</span>
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">
                Yuk siapkan EduSparq-mu
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Tiga langkah singkat ini bikin semua fitur (Tutor AI, ringkasan,
                flashcard) jadi relevan dengan kuliahmu.
              </p>
              <div className="mt-4 flex items-center gap-3">
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all duration-500"
                    style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-bold text-muted-foreground shrink-0">
                  {doneCount}/{STEPS.length}
                </span>
              </div>
            </div>

            {/* Steps */}
            <div className="p-4 space-y-2">
              {STEPS.map((step) => {
                const done = steps[step.key];
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className={`flex items-center gap-3 p-3 rounded-2xl border transition-colors ${
                      done
                        ? "border-emerald-500/20 bg-emerald-500/5"
                        : "border-border bg-muted/30"
                    }`}
                  >
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        done ? "bg-emerald-500/10 text-emerald-500" : "bg-primary/10 text-primary"
                      }`}
                    >
                      {done ? <CheckCircle2 size={20} /> : <Icon size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm font-bold leading-snug ${
                          done ? "text-muted-foreground line-through" : "text-foreground"
                        }`}
                      >
                        {step.title}
                      </p>
                      <p className="text-xs text-muted-foreground leading-snug mt-0.5">
                        {step.desc}
                      </p>
                    </div>
                    {done ? (
                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-wider shrink-0">
                        Selesai
                      </span>
                    ) : (
                      <Link
                        href={step.href}
                        onClick={handleNavigate}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 px-3 py-2 rounded-xl transition-colors shrink-0 min-h-[40px]"
                      >
                        {step.cta}
                        <ArrowRight size={14} />
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Footer */}
            <div className="px-4 pb-5 pt-1 flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Circle size={8} className="fill-current opacity-40" />
                Bisa dilanjut kapan saja
              </span>
              <button
                onClick={handleSkip}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground px-4 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
              >
                Lewati dulu
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
