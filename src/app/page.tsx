"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sparkles,
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
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 120, damping: 14 } },
};

const scaleUp = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: { opacity: 1, scale: 1, y: 0, transition: { type: "spring" as const, stiffness: 100, damping: 15 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12 } },
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden selection:bg-foreground/10 selection:text-foreground font-sans">
      
      {/* ===== Floating Navbar ===== */}
      <div className="fixed top-0 left-0 right-0 z-50 px-4 py-4 md:py-6 flex justify-center pointer-events-none">
        <header className="pointer-events-auto w-full max-w-5xl bg-card/80 backdrop-blur-2xl border border-border shadow-sm rounded-full px-4 md:px-6 h-14 md:h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 md:gap-3 group">
            <div className="bg-foreground text-background p-2 rounded-full flex items-center justify-center transition-transform group-hover:rotate-12">
              <Sparkles size={16} />
            </div>
            <span className="font-display font-extrabold text-base md:text-lg tracking-tight">EduSparq</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-muted-foreground">
            <a href="#hero" className="hover:text-foreground transition-colors">Beranda</a>
            <a href="#fitur" className="hover:text-foreground transition-colors">Fitur</a>
          </nav>

          <div className="flex items-center gap-2 md:gap-3">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center justify-center h-10 px-4 rounded-full text-sm font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 h-10 px-5 rounded-full text-sm font-bold bg-foreground text-background hover:scale-105 transition-transform active:scale-95 shadow-sm"
            >
              Daftar <ArrowRight size={14} className="hidden sm:block" />
            </Link>
          </div>
        </header>
      </div>

      {/* ===== Hero Bento Section ===== */}
      <section id="hero" className="relative pt-28 pb-16 md:pt-32 md:pb-20 px-4 md:px-6 max-w-[1400px] mx-auto flex flex-col items-center">
        {/* Subtle Background Pattern */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(hsl(var(--foreground)/0.03)_1px,transparent_1px)] [background-size:24px_24px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />

        <motion.div variants={stagger} initial="hidden" animate="show" className="w-full grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-5">
          
          {/* Main Hero Text Card */}
          <motion.div variants={fadeUp} className="md:col-span-12 lg:col-span-7 bg-card border border-border rounded-[2rem] p-6 md:p-10 lg:p-14 flex flex-col justify-center shadow-sm relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-foreground/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3 group-hover:bg-foreground/10 transition-colors duration-700" />
            
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold bg-muted text-foreground border border-border w-fit mb-6">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-foreground opacity-20"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-foreground"></span>
              </span>
              Asisten AI Akademik
            </div>
            
            <h1 className="font-display text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter leading-[1.05] text-foreground mb-6">
              Satu <span className="text-muted-foreground/50">ruang</span><br/>untuk semua<br/>tugas kuliah.
            </h1>
            
            <p className="text-lg text-muted-foreground font-medium max-w-md leading-relaxed mb-8">
              Manajemen tenggat, tutor AI yang jujur, pembuat sitasi, dan perangkum materi, semuanya dalam satu antarmuka yang modern dan rapi.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 relative z-10">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 h-14 px-8 rounded-full bg-foreground text-background font-bold text-base hover:scale-[1.02] transition-transform shadow-lg active:scale-95"
              >
                Mulai Belajar Sekarang
              </Link>
            </div>
          </motion.div>

          {/* Right Image/3D Illustration Card */}
          <motion.div variants={scaleUp} className="md:col-span-12 lg:col-span-5 bg-card border border-border rounded-[2rem] p-4 shadow-sm flex items-center justify-center relative overflow-hidden group min-h-[300px] md:min-h-[400px]">
            {/* Soft backdrop glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-background/20" />
            
            <motion.div 
              animate={{ y: [0, -12, 0] }} 
              transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
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
      <section id="fitur" className="py-16 px-4 md:px-6 max-w-[1400px] mx-auto border-t border-border/40">
        <div className="mb-10 md:mb-12 flex flex-col md:flex-row md:items-end justify-between gap-5">
          <div className="max-w-2xl">
            <h2 className="font-display text-3xl md:text-5xl font-black tracking-tight mb-4">
              Berhenti berpindah tab.
            </h2>
            <p className="text-lg text-muted-foreground font-medium leading-relaxed">
              EduSparq menggabungkan semua alat bantu yang dibutuhkan mahasiswa dalam satu ruang terpadu. Lebih sedikit distraksi, lebih banyak aksi.
            </p>
          </div>
          <Link href="/login" className="inline-flex items-center gap-2 text-foreground font-bold hover:underline underline-offset-4">
            Eksplorasi Fitur <ArrowRight size={16} />
          </Link>
        </div>

        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true, margin: "-100px" }} className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5">
          
          <motion.div variants={fadeUp} className="md:col-span-2 bg-card border border-border rounded-[2rem] p-6 md:p-10 hover:shadow-md transition-shadow group flex flex-col md:flex-row items-center gap-8">
             <div className="flex-1">
               <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform duration-500 ease-out">
                 <CalendarDays size={28} className="text-foreground" />
               </div>
               <h3 className="font-display text-2xl font-black tracking-tight mb-3">Jadwal & Tenggat Cerdas</h3>
               <p className="text-muted-foreground font-medium leading-relaxed">
                 Pantau jadwal kelas dan tenggat waktu tugas Anda di satu tempat. Sistem memberikan prioritas otomatis berdasarkan waktu tersisa.
               </p>
             </div>
             <div className="flex-1 w-full bg-muted/30 rounded-2xl border border-border p-4 space-y-3">
               {[1,2,3].map((i) => (
                 <div key={i} className="bg-card border border-border p-3 rounded-xl flex items-center justify-between shadow-sm">
                   <div className="h-2.5 w-24 bg-muted rounded-full" />
                   <div className={`h-6 px-3 rounded-lg flex items-center justify-center text-[9px] font-bold uppercase tracking-wider ${i===1 ? 'bg-foreground text-background' : 'bg-muted text-muted-foreground'}`}>
                     {i===1 ? 'Hari Ini' : `H-${i*2}`}
                   </div>
                 </div>
               ))}
             </div>
          </motion.div>

          <motion.div variants={fadeUp} className="bg-card border border-border rounded-[2rem] p-6 md:p-10 hover:shadow-md transition-shadow group">
             <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform duration-500 ease-out">
               <Users size={28} className="text-foreground" />
             </div>
             <h3 className="font-display text-2xl font-black tracking-tight mb-3">Kolaborasi</h3>
             <p className="text-muted-foreground font-medium leading-relaxed">
               Kerjakan tugas kelompok bersama secara real-time. Berbagi file, membuat to-do list, dan berdiskusi.
             </p>
          </motion.div>

          <motion.div variants={fadeUp} className="bg-card border border-border rounded-[2rem] p-6 md:p-10 hover:shadow-md transition-shadow group">
             <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform duration-500 ease-out">
               <PenTool size={28} className="text-foreground" />
             </div>
             <h3 className="font-display text-2xl font-black tracking-tight mb-3">Asisten Menulis</h3>
             <p className="text-muted-foreground font-medium leading-relaxed">
               Hasilkan kerangka esai, parafrasa teks secara etis, dan susun daftar pustaka hanya dalam hitungan detik.
             </p>
          </motion.div>

          <motion.div variants={fadeUp} className="md:col-span-2 bg-foreground text-background rounded-[2rem] p-6 md:p-10 hover:shadow-xl transition-shadow group flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
             <div className="absolute right-0 top-0 w-1/2 h-full bg-background/5 blur-3xl rounded-full translate-x-1/3 -translate-y-1/4" />
             
             <div className="flex-1 relative z-10">
               <div className="w-14 h-14 rounded-2xl bg-background/10 backdrop-blur-md border border-background/20 flex items-center justify-center mb-6 group-hover:-translate-y-2 transition-transform duration-500 ease-out">
                 <Search size={28} className="text-background" />
               </div>
               <h3 className="font-display text-2xl font-black tracking-tight mb-3">Riset Terdalam</h3>
               <p className="text-background/70 font-medium leading-relaxed">
                 Tanyakan konsep sulit kepada AI Mode Riset. Kami akan mencari referensi jurnal relevan dan menyusun ringkasan komprehensif untuk tugas akhir Anda.
               </p>
             </div>
          </motion.div>

        </motion.div>
      </section>

      {/* ===== Big CTA Section ===== */}
      <section className="py-16 px-4 md:px-6">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ type: "spring", stiffness: 100 }} viewport={{ once: true }} className="max-w-[1000px] mx-auto bg-card border border-border rounded-[2.5rem] p-10 md:p-20 text-center shadow-sm relative overflow-hidden">
          <div className="absolute left-1/2 top-0 -translate-x-1/2 w-[600px] h-[300px] bg-foreground/5 rounded-[100%] blur-[80px] pointer-events-none" />
          
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 6, ease: "easeInOut" }} className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mx-auto mb-8 shadow-sm">
            <LayoutDashboard size={32} className="text-foreground" />
          </motion.div>
          
          <h2 className="font-display text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6">
            Meja kerja masa depan.
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground font-medium max-w-2xl mx-auto mb-10">
            Didesain khusus untuk meningkatkan produktivitas mahasiswa. Bergabunglah sekarang, gratis selamanya untuk fitur dasar.
          </p>
          
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 h-16 px-10 rounded-full bg-foreground text-background font-bold text-lg hover:scale-105 transition-transform shadow-lg active:scale-95"
          >
            Buat Ruang Kerja Gratis
          </Link>
        </motion.div>
      </section>

      {/* ===== Minimal Footer ===== */}
      <footer className="border-t border-border/50 py-12 px-4 md:px-6 mt-12">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="bg-foreground text-background p-1.5 rounded-full flex items-center justify-center">
              <Sparkles size={12} />
            </div>
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
