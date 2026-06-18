"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, useScroll, useTransform } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Bot,
  CalendarDays,
  PenTool,
  Search,
  Users,
  ArrowRight,
  Globe,
  LayoutDashboard
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 40 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.9, y: 30 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 90, damping: 15 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.15 } },
};

export default function LandingPage() {
  const { scrollYProgress } = useScroll();
  const yParallax = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-foreground/10 selection:text-foreground font-sans relative">

      {/* Animated Background Orbs */}
      {mounted && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <motion.div
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -50, 100, 0],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute -top-[20%] -left-[10%] w-[500px] h-[500px] rounded-full bg-primary/5 blur-[120px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 50, 0],
              y: [0, 100, -50, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute top-[40%] -right-[10%] w-[600px] h-[600px] rounded-full bg-secondary/5 blur-[150px]"
          />
        </div>
      )}

      {/* ===== Floating Navbar ===== */}
      <motion.div
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 100, damping: 20, delay: 0.1 }}
        className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:py-6 flex justify-center pointer-events-none"
      >
        <header className="pointer-events-auto w-full max-w-5xl bg-card/70 backdrop-blur-3xl border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.04)] rounded-full px-4 md:px-6 h-14 md:h-16 flex items-center justify-between transition-all hover:bg-card/90">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="EduSparq" className="h-9 w-9 md:h-10 md:w-10 rounded-full shadow-sm group-hover:scale-105 transition-transform" />
            <span className="font-display font-extrabold text-base md:text-lg tracking-tight">EduSparq</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <a href="#hero" className="hover:text-foreground transition-colors relative group">
              Beranda
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-foreground transition-all group-hover:w-full"></span>
            </a>
            <a href="#fitur" className="hover:text-foreground transition-colors relative group">
              Fitur
              <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-foreground transition-all group-hover:w-full"></span>
            </a>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Masuk
            </Link>
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-bold bg-foreground text-background shadow-sm hover:shadow-md transition-shadow"
              >
                Daftar <ArrowRight size={14} className="hidden sm:block" />
              </Link>
            </motion.div>
          </div>
        </header>
      </motion.div>

      {/* ===== Hero Bento Section ===== */}
      <section id="hero" className="relative pt-28 pb-16 md:pt-32 md:pb-20 px-4 md:px-6 max-w-[1400px] mx-auto flex flex-col items-center z-10">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <motion.div variants={stagger} initial="hidden" animate="show" style={{ y: yParallax }} className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">

          {/* Main Hero Text Card */}
          <motion.div variants={fadeUp} className="md:col-span-12 lg:col-span-7 bg-card border border-border/60 rounded-[2rem] p-6 md:p-10 lg:p-14 flex flex-col justify-center shadow-sm relative overflow-hidden group hover:border-border transition-colors">
            <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-foreground/10 transition-all duration-1000 ease-out" />

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5, type: "spring" }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-muted/80 backdrop-blur-sm text-foreground border border-border/50 w-fit mb-6"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-30"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
              </span>
              Asisten AI Akademik
            </motion.div>

            <h1 className="font-display text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.05] text-foreground mb-6">
              Satu <span className="text-muted-foreground/50">ruang</span><br />untuk semua<br />tugas kuliah.
            </h1>

            <p className="text-lg text-muted-foreground font-medium max-w-md leading-relaxed mb-8">
              Manajemen tenggat, tutor AI yang jujur, pembuat sitasi, dan perangkum materi, semuanya dalam satu antarmuka yang dinamis.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
                <Link
                  href="/login"
                  className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-foreground text-background font-bold text-base shadow-lg hover:shadow-xl transition-shadow"
                >
                  Mulai Belajar Sekarang
                </Link>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Image/3D Illustration Card */}
          <motion.div
            variants={scaleUp}
            whileHover={{ y: -5 }}
            className="md:col-span-12 lg:col-span-5 bg-card/50 backdrop-blur-sm border border-border/60 rounded-[2rem] p-4 shadow-sm flex items-center justify-center relative overflow-hidden group min-h-[300px] md:min-h-[400px] transition-all"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/30 to-background/10 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />

            <motion.div
              animate={{ y: [0, -15, 0], rotate: [0, 1, -1, 0] }}
              transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }}
              className="relative w-full h-full min-h-[300px] flex items-center justify-center z-10 p-4"
            >
              <Image
                src="/images/hero_3d.png"
                alt="EduSparq 3D Dashboard Setup"
                fill
                className="object-contain drop-shadow-2xl"
                priority
              />
            </motion.div>
          </motion.div>

        </motion.div>
      </section>

      {/* ===== Bento Features Grid ===== */}
      <section id="fitur" className="py-16 px-4 md:px-6 max-w-[1400px] mx-auto relative z-10">
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-5 border-t border-border/40 pt-16">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            className="max-w-2xl"
          >
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight mb-4">
              Berhenti berpindah tab.
            </h2>
            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
              EduSparq menggabungkan semua alat bantu yang dibutuhkan mahasiswa dalam satu ruang terpadu. Lebih sedikit distraksi, lebih banyak aksi.
            </p>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
          >
            <Link href="/login" className="inline-flex items-center gap-2 text-foreground font-bold hover:underline underline-offset-4 group">
              Eksplorasi Fitur <motion.span group-hover={{ x: 5 }}><ArrowRight size={16} /></motion.span>
            </Link>
          </motion.div>
        </div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">

          <motion.div variants={fadeUp} whileHover={{ y: -8, scale: 1.01 }} className="md:col-span-2 bg-card border border-border/60 rounded-[2rem] p-6 md:p-10 hover:shadow-xl hover:border-border transition-all duration-300 group flex flex-col md:flex-row items-center gap-8 cursor-default">
            <div className="flex-1">
              <motion.div
                whileHover={{ rotate: 10, scale: 1.1 }}
                className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 text-foreground"
              >
                <CalendarDays size={28} />
              </motion.div>
              <h3 className="font-display text-2xl font-black tracking-tight mb-3">Jadwal & Tenggat Cerdas</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">
                Pantau jadwal kelas dan tenggat waktu tugas Anda di satu tempat. Sistem memberikan prioritas otomatis berdasarkan waktu tersisa.
              </p>
            </div>
            <div className="flex-1 w-full bg-muted/30 rounded-2xl border border-border p-4 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-foreground/5 blur-2xl rounded-full" />
              {[1, 2, 3].map((i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  viewport={{ once: true }}
                  className="bg-card border border-border p-3 rounded-xl flex items-center justify-between shadow-sm relative z-10"
                >
                  <div className="h-2.5 w-24 bg-muted rounded-full" />
                  <div className={`h-6 px-3 rounded-lg flex items-center justify-center text-[9px] font-bold uppercase tracking-wider ${i === 1 ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                    {i === 1 ? 'Hari Ini' : `H-${i * 2}`}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.div variants={fadeUp} whileHover={{ y: -8, scale: 1.01 }} className="bg-card border border-border/60 rounded-[2rem] p-6 md:p-10 hover:shadow-xl hover:border-border transition-all duration-300 group cursor-default">
            <motion.div
              whileHover={{ rotate: -10, scale: 1.1 }}
              className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 text-foreground"
            >
              <Users size={28} />
            </motion.div>
            <h3 className="font-display text-2xl font-black tracking-tight mb-3">Kolaborasi</h3>
            <p className="text-muted-foreground font-medium leading-relaxed">
              Kerjakan tugas kelompok bersama secara real-time. Berbagi file, membuat to-do list, dan berdiskusi dengan mudah.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} whileHover={{ y: -8, scale: 1.01 }} className="bg-card border border-border/60 rounded-[2rem] p-6 md:p-10 hover:shadow-xl hover:border-border transition-all duration-300 group cursor-default">
            <motion.div
              whileHover={{ rotate: 15, scale: 1.1 }}
              className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 text-foreground"
            >
              <PenTool size={28} />
            </motion.div>
            <h3 className="font-display text-2xl font-black tracking-tight mb-3">Asisten Menulis</h3>
            <p className="text-muted-foreground font-medium leading-relaxed">
              Hasilkan kerangka esai, parafrasa teks secara etis, dan susun daftar pustaka hanya dalam hitungan detik.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} whileHover={{ y: -8, scale: 1.01 }} className="md:col-span-2 bg-foreground text-background rounded-[2rem] p-6 md:p-10 hover:shadow-2xl hover:shadow-foreground/20 transition-all duration-300 group flex flex-col md:flex-row items-center gap-8 relative overflow-hidden cursor-default">
            <motion.div
              animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 8, repeat: Infinity }}
              className="absolute right-0 top-0 w-2/3 h-full bg-background/10 blur-3xl rounded-full translate-x-1/3 -translate-y-1/4"
            />

            <div className="flex-1 relative z-10">
              <motion.div
                whileHover={{ rotate: 90, scale: 1.1 }}
                transition={{ type: "spring" }}
                className="w-14 h-14 rounded-2xl bg-background/10 backdrop-blur-md border border-background/20 flex items-center justify-center mb-6 text-background"
              >
                <Search size={28} />
              </motion.div>
              <h3 className="font-display text-2xl font-black tracking-tight mb-3">Riset Terdalam</h3>
              <p className="text-background/80 font-medium leading-relaxed max-w-lg">
                Tanyakan konsep sulit kepada AI Mode Riset. Kami akan mencari referensi jurnal relevan dan menyusun ringkasan komprehensif untuk tugas akhir Anda.
              </p>
            </div>
          </motion.div>

        </motion.div>
      </section>

      {/* ===== Big CTA Section ===== */}
      <section className="py-24 px-4 md:px-6 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 80, damping: 20 }}
          viewport={{ once: true, margin: "-100px" }}
          className="max-w-[1000px] mx-auto bg-card border border-border/80 rounded-[3rem] p-10 md:p-20 text-center shadow-2xl relative overflow-hidden group"
        >
          {/* Animated Glow behind CTA */}
          <motion.div
            animate={{ scale: [1, 1.1, 1], opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 5, repeat: Infinity }}
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] bg-foreground/5 rounded-full blur-[100px] pointer-events-none"
          />

          <motion.div
            whileHover={{ scale: 1.2, rotate: 10 }}
            className="relative w-20 h-20 bg-foreground text-background rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl"
          >
            <LayoutDashboard size={32} />
          </motion.div>

          <h2 className="relative font-display text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6">
            Meja kerja masa depan.
          </h2>
          <p className="relative text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto mb-10">
            Didesain khusus untuk meningkatkan produktivitas mahasiswa. Bergabunglah sekarang, gratis selamanya untuk fitur dasar.
          </p>

          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative inline-block">
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 h-16 px-10 rounded-full bg-foreground text-background font-extrabold text-lg shadow-xl"
            >
              Buat Ruang Kerja Gratis <ArrowRight size={20} />
            </Link>
          </motion.div>
        </motion.div>
      </section>

      {/* ===== Minimal Footer ===== */}
      <footer className="border-t border-border/50 py-12 px-4 md:px-6 mt-12 relative z-10 bg-background/50 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 md:gap-3">
            <img src="/logo.png" alt="EduSparq" className="w-7 h-7 rounded-full" />
            <span className="font-display font-extrabold text-sm tracking-tight">EduSparq</span>
          </div>
          <p className="text-xs font-bold text-muted-foreground tracking-wider uppercase">
            © 2026 EduSparq Studio. Hak Cipta Dilindungi.
          </p>
          <div className="flex items-center gap-6 text-sm font-semibold text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Privasi</a>
            <a href="#" className="hover:text-foreground transition-colors">Ketentuan</a>
            <a href="https://github.com/edusparq" className="hover:text-foreground transition-colors" aria-label="GitHub">
              <Globe size={18} />
            </a>
          </div>
        </div>
      </footer>

    </div>
  );
}
