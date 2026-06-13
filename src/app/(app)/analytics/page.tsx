"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, Search, Info, CheckCircle2, ChevronRight } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function AnalyticsPage() {
  const metrics = [
    { label: "IPK Rata-rata Pengguna", value: "3.64", change: "+0.12 dari semester lalu", positive: true },
    { label: "Tugas Selesai Tepat Waktu", value: "92%", change: "+4.5% dari bln lalu", positive: true },
    { label: "Waktu Belajar Aktif", value: "14 Jam", change: "-2 Jam minggu ini", positive: false },
    { label: "Topik Tersulit", value: "Statistika", change: "Berdasarkan salah kuis", positive: false },
  ];

  const searchLogs = [
    { query: "Perbedaan jurnal Sinta 1 dan Sinta 2", count: "1,240 mahasiswa", status: "Tren Naik" },
    { query: "Cara buat daftar pustaka otomatis dari PDF", count: "890 mahasiswa", status: "Stabil" },
    { query: "Contoh rumusan masalah kualitatif", count: "750 mahasiswa", status: "Tren Naik" },
    { query: "Batas wajar similarity Turnitin", count: "620 mahasiswa", status: "Stabil" },
  ];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <BarChart3 size={24} className="text-primary" />
          Analitik Akademik
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pantau tren belajar, topik pencarian mahasiswa lain, dan evaluasi performa akademik kamu secara real-time.
        </p>
      </motion.div>

      {/* Metrics Row */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, idx) => (
          <div key={idx} className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-1.5 hover:border-primary/20 transition-all">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">{m.label}</span>
            <span className="text-xl font-black text-foreground block">{m.value}</span>
            <span className={`text-[10px] font-semibold flex items-center gap-1 ${m.positive ? "text-emerald-500" : "text-amber-500"}`}>
              {m.positive ? <TrendingUp size={12} /> : <TrendingUp size={12} className="rotate-180" />}
              {m.change}
            </span>
          </div>
        ))}
      </motion.div>

      {/* Charts section */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Weekly Study Hours Line Chart (SVG) */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-foreground">Waktu Belajar Mingguan</h2>
            <span className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-1 rounded-md">Jam/Minggu</span>
          </div>

          {/* SVG Line Chart */}
          <div className="relative h-48 w-full">
            <svg className="w-full h-full" viewBox="0 0 500 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Grid Lines */}
              {[20, 70, 120, 170].map((y, i) => (
                <line key={i} x1="40" y1={y} x2="480" y2={y} stroke="currentColor" className="text-border" strokeWidth="1" />
              ))}

              {/* Chart Line Gradient */}
              <defs>
                <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--primary)" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="var(--primary)" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* Line Area & Path */}
              <path d="M 40 170 Q 110 130 180 145 T 320 60 T 480 40 L 480 170 Z" fill="url(#chartGradient)" />
              <path d="M 40 170 Q 110 130 180 145 T 320 60 T 480 40" stroke="hsl(var(--primary))" strokeWidth="3" strokeLinecap="round" />

              {/* Data Dots */}
              {[
                { cx: 110, cy: 130 },
                { cx: 180, cy: 145 },
                { cx: 320, cy: 60 },
                { cx: 480, cy: 40 },
              ].map((dot, i) => (
                <circle key={i} cx={dot.cx} cy={dot.cy} r="4" fill="hsl(var(--primary))" stroke="hsl(var(--card))" strokeWidth="2" />
              ))}

              {/* Axis Labels */}
              {[
                { x: 40, label: "Mgg 1", align: "middle" },
                { x: 110, label: "Mgg 3", align: "middle" },
                { x: 180, label: "Mgg 5", align: "middle" },
                { x: 320, label: "Mgg 7 (UTS)", align: "middle" },
                { x: 480, label: "Mgg 8", align: "end" },
              ].map((lbl, i) => (
                <text key={i} x={lbl.x} y="190" fill="currentColor" className="text-muted-foreground text-[10px]" textAnchor={lbl.align as any}>{lbl.label}</text>
              ))}
            </svg>
          </div>
        </div>

        {/* Feature Usage Share Donut Chart (SVG) */}
        <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-foreground">Distribusi Fitur yang Dipakai</h2>
            <span className="text-[10px] text-muted-foreground font-bold bg-muted px-2 py-1 rounded-md">Berdasarkan Aktivitas</span>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-around gap-6 h-48">
            {/* SVG Donut Chart */}
            <div className="relative w-36 h-36 shrink-0">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="currentColor" className="text-muted" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeDasharray="35 65" strokeDashoffset="0" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#8b5cf6" strokeWidth="3.5" strokeDasharray="25 75" strokeDashoffset="-35" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#ec4899" strokeWidth="3.5" strokeDasharray="20 80" strokeDashoffset="-60" />
                <circle cx="18" cy="18" r="15.915" fill="none" stroke="#06b6d4" strokeWidth="3.5" strokeDasharray="20 80" strokeDashoffset="-80" />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-lg font-black text-foreground">100%</span>
                <span className="text-[9px] text-muted-foreground font-bold uppercase tracking-wider">Total</span>
              </div>
            </div>

            {/* Labels Legend */}
            <div className="grid gap-3 text-xs w-full">
              {[
                { color: "bg-primary", label: "Tutor AI (35%)" },
                { color: "bg-violet-500", label: "Asisten Nulis (25%)" },
                { color: "bg-pink-500", label: "Grup Kelompok (20%)" },
                { color: "bg-cyan-500", label: "Latihan Ujian (20%)" },
              ].map((item, i) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-xl hover:bg-muted transition-colors">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${item.color}`} />
                    <span className="text-muted-foreground font-medium">{item.label}</span>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground/50" />
                </div>
              ))}
            </div>
          </div>
        </div>

      </motion.div>

      {/* Grid: Search Logs & Common Pain Points */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Search Logs */}
        <div className="lg:col-span-2 bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
          <div className="flex items-center gap-2">
            <Search size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-foreground">Trending di EduSparq Minggu Ini</h2>
          </div>

          <div className="space-y-3">
            {searchLogs.map((log, idx) => (
              <div key={idx} className="p-4 bg-muted/40 border border-border rounded-2xl flex items-center justify-between gap-3 hover:border-primary/30 transition-colors">
                <div className="space-y-1 min-w-0">
                  <span className="font-semibold text-sm text-foreground block truncate">{log.query}</span>
                  <span className="text-xs text-muted-foreground block">Dicari {log.count}</span>
                </div>
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full shrink-0 ${
                  log.status === "Tren Naik" 
                    ? "text-emerald-600 bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400" 
                    : "text-amber-600 bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400"
                }`}>
                  {log.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Info */}
        <div className="lg:col-span-1 bg-gradient-to-br from-primary to-violet-600 rounded-3xl p-6 text-white shadow-sm space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-white/10 rounded-full blur-2xl" />
          
          <h2 className="text-sm font-bold flex items-center gap-2">
            <Info size={16} />
            Wawasan AI
          </h2>

          <div className="space-y-4 text-sm leading-relaxed">
            <p className="text-white/90">
              Berdasarkan analisis aktivitas belajar kamu, kamu memiliki kelemahan di topik <strong>Statistika Inferensial</strong>.
            </p>
            <p className="text-white/90">
              Kami merekomendasikan untuk menambah 2 jam belajar minggu ini menggunakan fitur <strong>Latihan Ujian (Flashcards)</strong> untuk memperbaiki pemahaman konsep.
            </p>
          </div>

          <button className="w-full mt-4 py-2.5 bg-white text-primary hover:bg-white/90 font-bold text-sm rounded-xl transition-all flex items-center justify-center gap-2">
            Mulai Latihan Sekarang <ChevronRight size={16} />
          </button>
        </div>

      </motion.div>

    </motion.div>
  );
}
