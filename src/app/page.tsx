"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import {
  Sparkles,
  Bot,
  CalendarDays,
  PenTool,
  GraduationCap,
  Search,
  Users,
  ShieldCheck,
  ArrowRight,
  Check,
  Quote,
  Smartphone,
  Zap,
  Globe,
} from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 26 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const features = [
  {
    icon: Bot,
    title: "Tutor AI dengan rujukan",
    desc: "Tutor yang menuntun Anda berpikir melalui pertanyaan terarah, lengkap dengan tingkat keyakinan dan rujukan sumber pada setiap jawaban.",
    tint: "text-primary bg-primary/10",
  },
  {
    icon: CalendarDays,
    title: "Pengelolaan tenggat",
    desc: "Ekstraksi tenggat otomatis dari silabus dan dokumen tugas, disertai pengingat kontekstual agar tidak ada kewajiban yang terlewat.",
    tint: "text-amber-600 dark:text-amber-400 bg-amber-400/15",
  },
  {
    icon: PenTool,
    title: "Asisten penulisan & sitasi",
    desc: "Penyusunan kerangka, parafrasa yang etis, serta pengelolaan sitasi dalam format APA, MLA, IEEE, dan Harvard.",
    tint: "text-teal-600 dark:text-teal-400 bg-teal-400/15",
  },
  {
    icon: GraduationCap,
    title: "Persiapan ujian",
    desc: "Prediksi butir soal UTS dan UAS dari materi Anda sendiri, dilengkapi kartu belajar untuk pengulangan aktif.",
    tint: "text-primary bg-primary/10",
  },
  {
    icon: Search,
    title: "Riset literatur",
    desc: "Penelusuran jurnal dan makalah relevan, ringkasan abstrak, serta penemuan versi akses terbuka yang sah.",
    tint: "text-teal-600 dark:text-teal-400 bg-teal-400/15",
  },
  {
    icon: Users,
    title: "Kolaborasi kelompok",
    desc: "Ruang kerja bersama untuk tugas kelompok: pembagian peran, berbagi materi, dan pemantauan kemajuan secara terpadu.",
    tint: "text-amber-600 dark:text-amber-400 bg-amber-400/15",
  },
];

const steps = [
  {
    n: "01",
    title: "Unggah materi Anda",
    desc: "Masukkan slide, silabus, berkas PDF, atau catatan kuliah. EduSparq segera membaca dan memahaminya.",
  },
  {
    n: "02",
    title: "Ajukan & kerjakan",
    desc: "Bertanya kepada tutor AI, mengekstrak tenggat, menyusun tulisan, atau menyiapkan ujian dari satu tempat.",
  },
  {
    n: "03",
    title: "Telusuri sumbernya",
    desc: "Setiap jawaban menampilkan tingkat keyakinan dan rujukan, sehingga Anda mengetahui sejauh mana ia dapat dipercaya.",
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-batik-grid text-foreground overflow-x-hidden">
      {/* ===== Navbar ===== */}
      <header className="sticky top-0 z-50 w-full border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="max-w-6xl mx-auto px-4 md:px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="bg-primary text-primary-foreground p-2 rounded-xl flex items-center justify-center shadow-sm">
              <Sparkles size={18} />
            </div>
            <span className="font-extrabold text-lg tracking-tight">EduSparq</span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#fitur" className="hover:text-foreground transition-colors">Fitur</a>
            <a href="#transparansi" className="hover:text-foreground transition-colors">Transparansi</a>
            <a href="#cara-kerja" className="hover:text-foreground transition-colors">Cara Kerja</a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link
              href="/login"
              className="hidden sm:inline-flex items-center px-4 h-11 rounded-xl text-sm font-semibold text-foreground hover:bg-muted transition-colors"
            >
              Masuk
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 px-4 h-11 rounded-xl text-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-sm active:scale-[0.98]"
            >
              Daftar gratis
              <ArrowRight size={15} />
            </Link>
          </div>
        </div>
      </header>

      {/* ===== Hero ===== */}
      <section className="relative">
        {/* background accents */}
        <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div className="absolute -top-20 -left-24 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float-slow" />
          <div className="absolute top-40 -right-20 w-80 h-80 bg-teal-400/15 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: "1.5s" }} />
          <div className="absolute bottom-0 left-1/3 w-72 h-72 bg-amber-400/10 rounded-full blur-3xl animate-float-slow" style={{ animationDelay: "3s" }} />
        </div>

        <div className="max-w-6xl mx-auto px-4 md:px-6 pt-16 pb-20 md:pt-28 md:pb-28 grid lg:grid-cols-2 gap-12 lg:gap-10 items-center">
          {/* Left copy */}
          <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-7 text-center lg:text-left">
            <motion.div variants={fadeUp} className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
              <Sparkles size={14} />
              Asisten akademik berbasis AI untuk mahasiswa Indonesia
            </motion.div>

            <motion.h1 variants={fadeUp} className="text-4xl md:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.05]">
              Belajar lebih cerdas,{" "}
              <span className="text-gradient">terarah, dan jujur.</span>
            </motion.h1>

            <motion.p variants={fadeUp} className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl mx-auto lg:mx-0">
              Pengelolaan tenggat, tutor AI dengan rujukan dan tingkat keyakinan, asisten
              penulisan serta sitasi, persiapan ujian, dan riset literatur dalam satu ruang
              kerja yang dirancang khusus untuk mahasiswa Indonesia.
            </motion.p>

            <motion.div variants={fadeUp} className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start pt-1">
              <Link
                href="/login"
                className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Mulai gratis sekarang
                <ArrowRight size={17} />
              </Link>
              <a
                href="#fitur"
                className="inline-flex items-center justify-center gap-2 px-6 h-12 rounded-xl border border-border bg-card font-semibold hover:bg-muted transition-colors"
              >
                Lihat fitur lengkap
              </a>
            </motion.div>

            <motion.div variants={fadeUp} className="flex flex-wrap items-center gap-x-5 gap-y-2 justify-center lg:justify-start text-xs text-muted-foreground pt-1">
              {["Tanpa kartu kredit", "Bahasa Indonesia yang natural", "Hemat kuota data"].map((t) => (
                <span key={t} className="inline-flex items-center gap-1.5">
                  <Check size={14} className="text-teal-500" />
                  {t}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* Right visual — mock AI answer with confidence meter */}
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 26, delay: 0.15 }}
            className="relative mx-auto w-full max-w-md"
          >
            <div className="rounded-3xl border border-border bg-card shadow-xl p-5 space-y-4">
              {/* user bubble */}
              <div className="flex justify-end">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm max-w-[80%]">
                  Tolong jelaskan inflasi menggunakan contoh harga kopi.
                </div>
              </div>

              {/* AI bubble */}
              <div className="flex gap-2.5">
                <div className="w-8 h-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-teal-400 flex items-center justify-center text-white">
                  <Bot size={16} />
                </div>
                <div className="space-y-3 flex-1">
                  <div className="bg-muted rounded-2xl rounded-tl-md px-4 py-3 text-sm leading-relaxed text-foreground border border-border">
                    Tahun lalu segelas kopi seharga Rp18.000, kini Rp20.000.
                    Kenaikan harga barang dan jasa secara umum dari waktu ke waktu itulah{" "}
                    <strong>inflasi</strong>. Daya beli uang Anda menurun secara bertahap.
                  </div>

                  {/* Confidence meter */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Tingkat keyakinan</span>
                      <span className="text-[10px] font-bold text-teal-600 dark:text-teal-400">Tinggi</span>
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      <div className="h-1.5 rounded-full bg-teal-500" />
                      <div className="h-1.5 rounded-full bg-teal-500" />
                      <div className="h-1.5 rounded-full bg-teal-500" />
                      <div className="h-1.5 rounded-full bg-muted-foreground/20" />
                    </div>
                  </div>

                  {/* source chip */}
                  <div className="flex items-start gap-2 p-2.5 rounded-xl bg-primary/5 border-l-[3px] border-primary text-xs">
                    <Quote size={13} className="text-primary shrink-0 mt-0.5" />
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">Pengantar Ekonomi Makro</span>, hlm. 42 · materi Anda
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* floating badge */}
            <div className="absolute -bottom-4 -left-4 hidden sm:flex items-center gap-2 px-3 py-2 rounded-2xl bg-card border border-border shadow-lg animate-float-slow">
              <ShieldCheck size={16} className="text-teal-500" />
              <span className="text-xs font-semibold">Selalu mencantumkan sumber</span>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ===== Stats strip ===== */}
      <section className="border-y border-border bg-muted/40">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-9 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { v: "6-in-1", l: "Perangkat akademik" },
            { v: "24/7", l: "Tutor AI siaga" },
            { v: "4", l: "Format sitasi" },
            { v: "100%", l: "Bahasa Indonesia" },
          ].map((s) => (
            <div key={s.l}>
              <div className="text-2xl md:text-3xl font-black text-primary">{s.v}</div>
              <div className="text-xs md:text-sm text-muted-foreground font-medium mt-1">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== Features ===== */}
      <section id="fitur" className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center max-w-2xl mx-auto space-y-4 mb-14"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <Zap size={14} /> Satu aplikasi untuk seluruh kebutuhan kuliah
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">
            Semua kebutuhan akademik dalam satu alur kerja
          </h2>
          <p className="text-muted-foreground leading-relaxed">
            Tidak perlu lagi berpindah antaraplikasi. EduSparq menyatukan tugas, materi, riset,
            dan AI dalam satu tempat yang konsisten.
          </p>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5"
        >
          {features.map((f) => {
            const Icon = f.icon;
            return (
              <motion.div
                key={f.title}
                variants={fadeUp}
                className="group rounded-3xl border border-border bg-card p-6 hover-lift hover:border-primary/40 hover:shadow-md transition-all"
              >
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 transition-transform group-hover:scale-110 ${f.tint}`}>
                  <Icon size={24} strokeWidth={2.4} />
                </div>
                <h3 className="font-bold text-lg mb-1.5">{f.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
              </motion.div>
            );
          })}
        </motion.div>
      </section>

      {/* ===== Transparency highlight ===== */}
      <section id="transparansi" className="bg-primary text-primary-foreground">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28 grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            variants={stagger}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="space-y-5"
          >
            <motion.span variants={fadeUp} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white/10 border border-white/20">
              <ShieldCheck size={14} /> Pembeda utama kami
            </motion.span>
            <motion.h2 variants={fadeUp} className="text-3xl md:text-4xl font-extrabold tracking-tight">
              AI yang jujur tentang tingkat keyakinannya
            </motion.h2>
            <motion.p variants={fadeUp} className="text-primary-foreground/80 leading-relaxed">
              Setiap jawaban faktual dilengkapi <strong>Pengukur Keyakinan</strong> dan rujukan
              sumber, baik dari dokumen Anda sendiri, jurnal eksternal, maupun inferensi AI.
              Anda tidak perlu menebak mana informasi yang dapat dipercaya.
            </motion.p>
            <motion.ul variants={fadeUp} className="space-y-2.5 pt-2">
              {[
                "Tingkat keyakinan: Tinggi, Sedang, Rendah, atau Tidak Diketahui",
                "Kutipan persis dari halaman sumber asli",
                "Peringatan yang jelas ketika jawaban hanya berupa inferensi",
              ].map((t) => (
                <li key={t} className="flex items-start gap-2.5 text-sm text-primary-foreground/90">
                  <Check size={18} className="text-teal-300 shrink-0 mt-0.5" />
                  {t}
                </li>
              ))}
            </motion.ul>
          </motion.div>

          {/* meter card */}
          <motion.div
            variants={fadeUp}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: "-60px" }}
            className="rounded-3xl bg-white/5 border border-white/15 backdrop-blur-sm p-6 space-y-5"
          >
            {[
              { label: "Tinggi", filled: 4, color: "bg-teal-400", note: "Terverifikasi dari sumber yang kuat" },
              { label: "Sedang", filled: 3, color: "bg-amber-400", note: "Referensi konsisten, cakupan terbatas" },
              { label: "Rendah", filled: 2, color: "bg-orange-400", note: "Inferensi AI, perlu diverifikasi" },
            ].map((row) => (
              <div key={row.label} className="space-y-1.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-bold">{row.label}</span>
                  <span className="text-primary-foreground/60 text-xs">{row.note}</span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div
                      key={i}
                      className={`h-2 rounded-full ${i < row.filled ? row.color : "bg-white/15"}`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ===== How it works ===== */}
      <section id="cara-kerja" className="max-w-6xl mx-auto px-4 md:px-6 py-20 md:py-28">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="text-center max-w-2xl mx-auto space-y-4 mb-14"
        >
          <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-teal-600 dark:text-teal-400">
            <Smartphone size={14} /> Siap digunakan dalam hitungan menit
          </span>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Cara kerjanya</h2>
        </motion.div>

        <motion.div
          variants={stagger}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="grid md:grid-cols-3 gap-6"
        >
          {steps.map((s) => (
            <motion.div
              key={s.n}
              variants={fadeUp}
              className="group relative rounded-3xl border border-border bg-card p-6 hover-lift hover:border-primary/40 transition-all"
            >
              <span className="text-5xl font-black text-primary/10 absolute top-4 right-5 select-none">{s.n}</span>
              <div className="text-sm font-black text-primary mb-3">{s.n}</div>
              <h3 className="font-bold text-lg mb-1.5">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== Final CTA ===== */}
      <section className="max-w-6xl mx-auto px-4 md:px-6 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative overflow-hidden rounded-[2rem] border border-border bg-card p-8 md:p-16 text-center"
        >
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-[28rem] h-72 bg-primary/10 rounded-full blur-3xl" />
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight max-w-2xl mx-auto">
            Siap menjalani semester ini dengan lebih efisien?
          </h2>
          <p className="text-muted-foreground mt-4 max-w-lg mx-auto leading-relaxed">
            Bergabunglah secara gratis dan rasakan manfaat memiliki asisten akademik yang memahami
            kebutuhan mahasiswa Indonesia.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 px-7 h-12 mt-8 rounded-xl bg-primary text-primary-foreground font-bold hover:bg-primary/90 transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Daftar gratis sekarang
            <ArrowRight size={17} />
          </Link>
        </motion.div>
      </section>

      {/* ===== Footer ===== */}
      <footer className="border-t border-border bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
              <Sparkles size={15} />
            </div>
            <span className="font-extrabold tracking-tight">EduSparq</span>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            © 2026 EduSparq · Dibuat untuk mahasiswa Indonesia
          </p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/login" className="hover:text-foreground transition-colors">Masuk</Link>
            <a href="#fitur" className="hover:text-foreground transition-colors">Fitur</a>
            <a href="#" className="hover:text-foreground transition-colors inline-flex items-center gap-1.5" aria-label="Situs">
              <Globe size={16} />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
