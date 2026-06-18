"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Crown, Rocket, Check, X, ChevronDown, ArrowRight,
  Wallet, KeyRound, HelpCircle, Shield, Sparkles, CreditCard,
  Gift, Info,
} from "lucide-react";
import Link from "next/link";

// ─── Pricing Data ──────────────────────────────────────────────────────────────

interface CreditPackage {
  id: string;
  name: string;
  credits: number;
  price: number;
  unitPrice: number;
  bonus?: string;
  popular?: boolean;
  icon: React.ElementType;
  features: string[];
}

const PACKAGES: CreditPackage[] = [
  {
    id: "starter",
    name: "Starter",
    credits: 5_000,
    price: 10_000,
    unitPrice: 2,
    icon: Zap,
    features: [
      "5.000 credit",
      "Semua fitur AI",
      "Tutor per mata kuliah",
      "Riwayat percakapan",
      "Telegram bot",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    credits: 30_000,
    price: 50_000,
    unitPrice: 1.67,
    bonus: "Bonus 5.000",
    popular: true,
    icon: Crown,
    features: [
      "30.000 credit (+ 5.000 bonus)",
      "Semua fitur AI",
      "Agent AI complex tier",
      "Prioritas queue",
      "Export dokumen",
      "Telegram bot + notifikasi",
    ],
  },
  {
    id: "unlimited",
    name: "Unlimited",
    credits: 100_000,
    price: 120_000,
    unitPrice: 1.2,
    bonus: "Bonus 20.000",
    icon: Rocket,
    features: [
      "100.000 credit (+ 20.000 bonus)",
      "Semua fitur AI",
      "Agent AI unlimited",
      "Prioritas tertinggi",
      "Export + branding",
      "BYOK gratis",
      "Telegram bot + notifikasi",
      "Support prioritas",
    ],
  },
];

interface FAQ {
  question: string;
  answer: string;
}

const FAQS: FAQ[] = [
  {
    question: "Apa itu credit dan bagaimana perhitungannya?",
    answer:
      "Credit adalah unit pemakaian AI. Setiap request ke AI mengonsumsi credit berdasarkan jumlah token (kata) yang diproses. 1 credit ≈ 1 token keluar. Contoh: chat biasa 200-800 credit, draft makalah 2.000-5.000 credit, agent kompleks 5.000-15.000 credit.",
  },
  {
    question: "Apakah credit bisa hangus?",
    answer:
      "Tidak. Credit Anda tidak pernah kadaluarsa. Silakan top up sesuai kebutuhan — credit akan tetap ada di akun Anda sampai digunakan.",
  },
  {
    question: "Bagaimana cara top up?",
    answer:
      "Buka halaman Billing di dashboard, pilih paket atau masukkan nominal, lalu bayar via invoice manual. Setelah pembayaran dikonfirmasi, credit langsung masuk ke akun Anda.",
  },
  {
    question: "Apa itu BYOK dan kenapa harus pakai?",
    answer:
      "BYOK (Bring Your Own Key) memungkinkan Anda menggunakan API key AI milik sendiri (OpenAI/Google). Dengan BYOK, Anda tidak mengonsumsi credit platform — biaya langsung ke provider Anda. Cocok untuk penggunaan intensif.",
  },
  {
    question: "Berapa biaya kalau pakai BYOK sendiri?",
    answer:
      "Dengan BYOK, Anda hanya membayar langsung ke provider AI (OpenAI/Google) sesuai usage Anda. EduSparq tidak menambah biaya platform. Anda bisa cek harga resmi di website masing-masing provider.",
  },
  {
    question: "Apakah ada uji coba gratis?",
    answer:
      "Ya! Setiap akun baru mendapat 1.000 credit gratis untuk mencoba fitur-fitur EduSparq. Setelah habis, Anda bisa top up atau aktifkan BYOK.",
  },
  {
    question: "Apa bedanya Agent Simple, Medium, dan Complex?",
    answer:
      "Simple (1 AI call): ringkasan, definisi, pertanyaan cepat. Medium (2 calls): draft paragraf, analisis sederhana. Complex (6-7 calls): makalah lengkap, studi kasus, multi-step problem solving. Semakin kompleks, semakin banyak credit yang dipakai.",
  },
  {
    question: "Bisa refund credit?",
    answer:
      "Credit yang sudah dibeli tidak bisa di-refund. Namun credit tidak kadaluarsa, jadi Anda bisa menggunakannya kapan saja. Pastikan top up sesuai kebutuhan.",
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function PricingPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-bold text-primary">
          <Sparkles size={14} />
          Harga Transparan
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Pilih Paket Credit
        </h1>
        <p className="text-sm font-medium text-muted-foreground max-w-lg mx-auto">
          Credit tanpa kadaluarsa. Top up sesuai kebutuhan, atau pakai API key
          sendiri gratis.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-3 gap-5">
        {PACKAGES.map((pkg, i) => {
          const Icon = pkg.icon;
          return (
            <motion.div
              key={pkg.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 80, duration: 0.35 }}
              className={`relative rounded-2xl border bg-card/80 backdrop-blur-sm p-6 flex flex-col ${
                pkg.popular
                  ? "border-primary/40 shadow-[0_12px_32px_-16px_hsl(var(--primary))]"
                  : "border-border/70"
              }`}
            >
              {pkg.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-[10px] font-black tracking-wider uppercase">
                  Populer
                </span>
              )}

              <div className="space-y-4 flex-1">
                {/* Icon + Name */}
                <div className="flex items-center gap-3">
                  <span
                    className={`flex items-center justify-center w-10 h-10 rounded-xl border shrink-0 ${
                      pkg.popular
                        ? "bg-primary text-primary-foreground border-primary/30"
                        : "bg-muted text-muted-foreground border-border/70"
                    }`}
                  >
                    <Icon size={18} />
                  </span>
                  <div>
                    <h3 className="text-base font-bold tracking-tight text-foreground">
                      {pkg.name}
                    </h3>
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {pkg.credits.toLocaleString("id-ID")} credit
                    </span>
                  </div>
                </div>

                {/* Price */}
                <div className="space-y-1">
                  <div className="flex items-baseline gap-1">
                    <span className="text-[10px] font-bold text-muted-foreground">
                      Rp
                    </span>
                    <span className="text-3xl font-extrabold tracking-tight text-foreground">
                      {pkg.price.toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p className="text-[10px] font-medium text-muted-foreground">
                    ≈ Rp {pkg.unitPrice}/credit{" "}
                    {pkg.bonus && (
                      <span className="text-primary font-bold">(+ {pkg.bonus})</span>
                    )}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 pt-2">
                  {pkg.features.map((feat) => (
                    <li key={feat} className="flex items-start gap-2.5 text-sm font-medium text-foreground/85">
                      <Check size={14} className="text-primary mt-0.5 shrink-0" strokeWidth={2.5} />
                      {feat}
                    </li>
                  ))}
                </ul>
              </div>

              {/* CTA */}
              <Link
                href="/billing"
                className={`mt-6 flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold tracking-tight transition-all ${
                  pkg.popular
                    ? "bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_hsl(var(--primary))] hover:shadow-[0_14px_28px_-12px_hsl(var(--primary))]"
                    : "bg-muted/80 text-foreground hover:bg-muted"
                }`}
              >
                Top Up
                <ArrowRight size={15} />
              </Link>
            </motion.div>
          );
        })}
      </div>

      {/* BYOK Banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl border border-dashed border-primary/30 bg-gradient-to-r from-primary/5 to-primary/[0.02] p-6 md:p-8"
      >
        <div className="flex flex-col md:flex-row items-start md:items-center gap-5">
          <span className="flex items-center justify-center w-12 h-12 rounded-2xl bg-primary/10 text-primary border border-primary/20 shrink-0">
            <KeyRound size={22} />
          </span>
          <div className="flex-1 space-y-1.5">
            <h3 className="text-base font-bold tracking-tight text-foreground">
              Atau Pakai API Key Sendiri — Gratis
            </h3>
            <p className="text-sm font-medium text-muted-foreground max-w-lg">
              Aktifkan BYOK (Bring Your Own Key) di Settings → Kunci AI. Gunakan
              API key OpenAI atau Google milik Anda sendiri. Tanpa biaya platform,
              credit tidak berkurang.
            </p>
          </div>
          <Link
            href="/settings/ai"
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold tracking-tight shrink-0 shadow-[0_8px_20px_-12px_hsl(var(--primary))] hover:shadow-[0_12px_24px_-10px_hsl(var(--primary))] transition-shadow"
          >
            <KeyRound size={15} />
            Setup BYOK
          </Link>
        </div>
      </motion.div>

      {/* Credit Calculator */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm p-6"
      >
        <h3 className="text-base font-bold tracking-tight text-foreground mb-4">
          Estimasi Pemakaian
        </h3>
        <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Chat Sederhana", cost: "200–800", icon: "💬" },
            { label: "Tutor AI (sesi)", cost: "500–1.500", icon: "🎓" },
            { label: "Draft 1 Bab", cost: "2.000–5.000", icon: "📝" },
            { label: "Agent Complex", cost: "5.000–15.000", icon: "🤖" },
          ].map((item) => (
            <div
              key={item.label}
              className="flex items-center gap-3 p-3 rounded-xl bg-muted/40 border border-border/50"
            >
              <span className="text-xl">{item.icon}</span>
              <div>
                <span className="block text-xs font-bold text-foreground">
                  {item.label}
                </span>
                <span className="block text-[10px] font-medium text-muted-foreground">
                  ~{item.cost} credit
                </span>
              </div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* FAQ */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <HelpCircle size={18} className="text-primary" />
          <h2 className="text-lg font-bold tracking-tight text-foreground">
            Pertanyaan Umum
          </h2>
        </div>
        <div className="space-y-2">
          {FAQS.map((faq, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 40, duration: 0.25 }}
              className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="flex-1 text-sm font-bold tracking-tight text-foreground">
                  {faq.question}
                </span>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground shrink-0 transition-transform duration-200 ${
                    openFaq === i ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {openFaq === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-4 border-t border-border/50 pt-3">
                      <p className="text-sm font-medium text-muted-foreground leading-relaxed">
                        {faq.answer}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
