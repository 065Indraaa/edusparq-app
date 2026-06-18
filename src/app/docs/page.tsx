"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  BookOpen, Bot, Cpu, PenTool, Search, Send, Wallet, KeyRound,
  Zap, CalendarDays, Users, FolderOpen, ArrowRight,
  GraduationCap, Building2, NotebookPen,
} from "lucide-react";

const features = [
  { icon: Bot, title: "Tutor AI", desc: "Tanya jawab per mata kuliah dengan konteks personal." },
  { icon: PenTool, title: "Menulis Akademik", desc: "Draft, parafrase, dan sitasi otomatis." },
  { icon: Search, title: "Riset", desc: "Cari sudut pandang & referensi penelitian." },
  { icon: Cpu, title: "Agent AI", desc: "Multi-agen untuk tugas kompleks." },
  { icon: GraduationCap, title: "Latihan Ujian", desc: "Soal latihan + evaluasi jawaban." },
  { icon: FolderOpen, title: "Materi & Analitik", desc: "Upload PDF/DOCX, ringkas, flashcard, kuis." },
  { icon: CalendarDays, title: "Jadwal & Tenggat", desc: "Pantau kuliah dan deadline." },
  { icon: Users, title: "Kelompok", desc: "Kerja kelompok real-time." },
  { icon: Building2, title: "Organisasi", desc: "Kelola HIMA/BEM/divisi/program kerja." },
  { icon: Send, title: "Telegram Bot", desc: "Akses fitur dari chat Telegram." },
  { icon: Wallet, title: "Sistem Credit", desc: "Bayar sesuai pemakaian token AI." },
  { icon: KeyRound, title: "BYOK", desc: "Bawa API key sendiri, gratis platform." },
];

export default function PublicDocsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="fixed top-0 left-0 right-0 z-50 px-4 py-4 flex justify-center">
        <div className="w-full max-w-5xl bg-card/70 backdrop-blur-3xl border border-border/50 rounded-full px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 font-extrabold tracking-tight">
            <img src="/logo.png" alt="EduSparq" className="h-8 w-8 rounded-full" />
            EduSparq
          </Link>
          <Link href="/login" className="inline-flex items-center gap-1.5 text-sm font-bold hover:text-primary transition-colors">
            Masuk <ArrowRight size={14} />
          </Link>
        </div>
      </header>

      <main className="pt-28 pb-16 px-4 max-w-4xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-bold mb-4">
            <BookOpen size={14} /> Dokumentasi
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4">
            Satu platform untuk seluruh perjalanan akademikmu.
          </h1>
          <p className="text-muted-foreground font-medium max-w-2xl mx-auto">
            EduSparq menggabungkan AI, manajemen tugas, kolaborasi, dan organisasi kemahasiswaan dalam satu ruang kerja terpadu.
          </p>
        </motion.div>

        <section className="mb-16">
          <h2 className="text-xl font-black tracking-tight mb-6">Fitur Utama</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="p-4 rounded-2xl border border-border/60 bg-card/50 hover:border-border transition-colors"
              >
                <f.icon size={22} className="text-primary mb-3" />
                <h3 className="font-bold text-sm mb-1">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="mb-16">
          <h2 className="text-xl font-black tracking-tight mb-6">Cara Kerja</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { step: "1", title: "Buat Akun", desc: "Daftar gratis, dapatkan credit awal." },
              { step: "2", title: "Atur Profil", desc: "Isi kampus, prodi, semester, dan mata kuliah." },
              { step: "3", title: "Pakai AI", desc: "Tanya tutor, buat tugas, atau kelola organisasi." },
            ].map((s) => (
              <div key={s.step} className="p-5 rounded-2xl bg-muted/30 border border-border text-center">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-black mb-3">
                  {s.step}
                </span>
                <h3 className="font-bold mb-1">{s.title}</h3>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl bg-foreground text-background p-8 md:p-12 text-center">
          <Zap size={32} className="mx-auto mb-4" />
          <h2 className="text-2xl md:text-3xl font-black tracking-tight mb-3">Siap mulai?</h2>
          <p className="text-background/80 font-medium mb-6 max-w-lg mx-auto">
            Gabung gratis. Tidak perlu kartu kredit untuk fitur dasar.
          </p>
          <Link href="/login" className="inline-flex items-center gap-2 h-12 px-6 rounded-full bg-background text-foreground font-bold hover:bg-background/90 transition-colors">
            Buat Akun Gratis <ArrowRight size={16} />
          </Link>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 px-4">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted-foreground">
          <p>© 2026 EduSparq. Created by <span className="text-foreground font-bold">@chaoho554</span>.</p>
          <div className="flex items-center gap-4">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/pricing" className="hover:text-foreground">Harga</Link>
            <Link href="/login" className="hover:text-foreground">Masuk</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
