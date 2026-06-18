"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Bot, Cpu, ChevronDown, ArrowRight, Brain,
  PenTool, Search, GraduationCap, Library, ClipboardCheck,
  Send, Wallet, KeyRound, Shield, Zap, MessageSquare,
  Lightbulb, Target, ListChecks, Wrench, Star, Globe,
  CalendarDays, Users, FolderOpen, BarChart3, Building2,
  NotebookPen, CalendarRange,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ─── Data ──────────────────────────────────────────────────────────────────────

interface DocSection {
  id: string;
  title: string;
  icon: React.ElementType;
  category: string;
  content: string;
}

const SECTIONS: DocSection[] = [
  {
    id: "overview",
    title: "Apa itu EduSparq?",
    icon: BookOpen,
    category: "Umum",
    content: `## Platform Asisten Akademik AI

**EduSparq** adalah platform asisten akademik berbasis AI yang dirancang khusus untuk mahasiswa Indonesia. Kami membantu dari mulai memahami materi kuliah, mengerjakan tugas, hingga menyelesaikan masalah akademik kompleks menggunakan **sistem multi-agen**.

### Fitur Utama

| Fitur | Deskripsi |
|-------|-----------|
| **Tutor AI** | Tanya jawab per mata kuliah dengan konteks personal |
| **Menulis** | Draft dokumen akademik dengan sitasi otomatis |
| **Riset** | Cari sudut pandang & referensi penelitian |
| **Agent AI** | Multi-agen untuk tugas kompleks (makalah, analisis, dll) |
| **Katalog** | Temukan referensi terbuka & jurnal ilmiah |
| **Latihan Ujian** | Soal latihan + evaluasi jawaban |
| **Dosen Virtual** | Penilaian esai berbasis rubrik akademik |
| **Telegram Bot** | Kelola semua fitur langsung dari Telegram |
`,
  },
  {
    id: "agents",
    title: "Sistem Multi-Agen",
    icon: Cpu,
    category: "Agent",
    content: `## Cara Kerja Agent AI

EduSparq menggunakan **arsitektur orchestrator + sub-agen** yang menjalankan pipeline bertahap untuk menyelesaikan tugas kompleks.

### Pipeline 7 Agen

1. **Pengarah (Classifier)** — Mengklasifikasi kompleksitas permintaan ke 3 tier
2. **Klarifikasi** — Menanya detail jika permintaan kurang jelas
3. **Spesifikasi** — Menyusun spesifikasi teknis tugas
4. **Perencana** — Merancang langkah-langkah eksekusi
5. **Pelaksana** — Mengeksekusi rencana dengan AI
6. **Implementasi** — Menghasilkan output final (dokumen, kode, analisis)
7. **Kualitas** — Review hasil & scoring kualitas

### 3 Tier Eksekusi

| Tier | Jumlah Call AI | Contoh |
|------|---------------|--------|
| **Simple** | 1 call | Ringkasan materi, definisi istilah |
| **Medium** | 2 calls | Draft paragraf, analisis sederhana |
| **Complex** | 6-7 calls | Makalah lengkap, studi kasus, coding |

### Menggunakan Agent

\`\`\`
1. Buka menu Agent AI di sidebar
2. Ketik permintaan (misal: "Buat makalah tentang Blockchain")
3. Tambahkan nama mata kuliah untuk konteks
4. Klik Jalankan
5. Lihat trace setiap langkah agen
6. Berikan klarifikasi jika diminta
\`\`\`

> **Tip**: Semakin spesifik permintaan, semakin akurat hasilnya. Sertakan detail seperti format, panjang, dan referensi yang diinginkan.
`,
  },
  {
    id: "tutor",
    title: "Tutor AI",
    icon: Bot,
    category: "Belajar",
    content: `## Menggunakan Tutor AI

Tutor AI adalah asisten percakapan yang memahami konteks mata kuliah Anda. Setiap sesi di-bind ke satu mata kuliah agar jawaban tetap relevan.

### Cara Pakai

1. **Pilih mata kuliah** — Pilih dari daftar mata kuliah yang sudah Anda tambahkan
2. **Ketik pertanyaan** — Tanyakan konsep, rumus, atau minta penjelasan
3. **Mode Tutor** — Aktifkan untuk respons pendidikan (step-by-step, bukan langsung jawaban)
4. **Riwayat** — Semua percakapan tersimpan per mata kuliah

### Tips Efektif

- Minta **contoh konkret** untuk setiap konsep abstrak
- Gunakan **"jelaskan seperti saya 5 tahun"** untuk analogi sederhana
- Minta **soal latihan** untuk menguji pemahaman
- Referensi **slide kuliah** yang sudah Anda upload di Materi
`,
  },
  {
    id: "writing",
    title: "Menulis Akademik",
    icon: PenTool,
    category: "Belajar",
    content: `## Fitur Menulis

Bantu draft, edit, dan format dokumen akademik dengan bantuan AI.

### Mode yang Tersedia

- **Draft** — Buat draft baru dari topik/prompt
- **Edit** — Perbaiki draft yang sudah ada
- **Sitasi** — Generate dan format sitasi (APA, IEEE, dll)
- **Paraphrase** — Parafrase teks dengan menjaga makna

### Workflow Rekomendasi

1. Tentukan struktur outline terlebih dahulu
2. Draft per bagian (BAB I, II, III, dll)
3. Review dan edit per paragraf
4. Tambahkan sitasi di akhir
5. Gunakan **Agent AI** untuk penyelesaian kompleks
`,
  },
  {
    id: "telegram",
    title: "Telegram Bot",
    icon: Send,
    category: "Integrasi",
    content: `## EduSparq di Telegram

Kelola semua fitur EduSparq langsung dari Telegram — tanpa buka browser.

### Setup

1. Buka **Settings → Telegram** di dashboard
2. Klik **Generate OTP**
3. Buka bot Telegram, ketik \`/link <otp>\`
4. Akun terhubung otomatis

### Perintah Bot

| Perintah | Fungsi |
|----------|--------|
| \`/start\` | Menu utama |
| \`/help\` | Bantuan & daftar perintah |
| \`/link <otp>\` | Hubungkan akun |
| \`/unlink\` | Putuskan koneksi |
| \`/saldo\` | Cek saldo credit |
| \`/mode\` | Ubah mode AI |
| \`/tugas\` | Lihat tugas mendatang |
| \`/jadwal\` | Lihat jadwal hari ini |

### Fitur

- **Notifikasi otomatis** — Deadline 1-3 hari sebelum jatuh
- **Peringatan saldo** — Alert jika credit < 50
- **Inline keyboard** — Navigasi cepat tanpa ketik perintah
- **Percakapan AI** — Ketik pesan langsung untuk bertanya
`,
  },
  {
    id: "credits",
    title: "Sistem Credit",
    icon: Wallet,
    category: "Billing",
    content: `## Cara Kerja Credit

Setiap penggunaan AI mengonsumsi credit. Credit dihitung berdasarkan **token** yang dipakai (mirip pulsa telepon).

### Rumus Perhitungan

\`\`\`
cost = (tokensMasuk × 0.2 + tokensKeluar × 1.0) × bobotFitur
\`\`\`

| Fitur | Bobot | Contoh |
|-------|-------|--------|
| Chat biasa | 1.0× | Tanya jawab sederhana |
| Tutor | 1.2× | Mode pendidikan step-by-step |
| Menulis | 1.5× | Generate draft dokumen |
| Agent Simple | 1.0× | 1 AI call |
| Agent Medium | 2.0× | 2 AI calls |
| Agent Complex | 5.0× | 6-7 AI calls |

### Cara Top Up

1. Buka **Billing** di sidebar
2. Klik **Top Up**
3. Pilih paket atau masukkan nominal
4. Bayar via invoice manual

> **Catatan**: 1 credit ≈ 1 token keluar. Chat biasa sekitar 200-800 credit per respons.
`,
  },
  {
    id: "byok",
    title: "BYOK (Bawa Key Sendiri)",
    icon: KeyRound,
    category: "Billing",
    content: `## Bring Your Own Key

Tidak ingin pakai credit kami? Gunakan API key AI milik Anda sendiri — **bebas biaya platform**.

### API yang Didukung

| Provider | Model | Key Format |
|----------|-------|------------|
| OpenAI | GPT-4o, GPT-4o-mini | \`sk-\` prefix |
| Google | Gemini Pro | \`AI-\` prefix |

### Cara Setup

1. Buka **Settings → Kunci AI** di sidebar
2. Pilih provider (OpenAI / Google)
3. Paste API key Anda
4. Klik **Simpan**

### Keamanan

- Key dienkripsi dengan **AES-256-GCM** sebelum disimpan
- Hanya server yang bisa mendekripsi
- Anda bisa hapus key kapan saja
`,
  },
  {
    id: "architecture",
    title: "Arsitektur Teknis",
    icon: Shield,
    category: "Teknis",
    content: `## Stack & Arsitektur

### Frontend
- **Next.js 14** (App Router)
- **Tailwind CSS** + dark mode
- **Framer Motion** untuk animasi
- **React Markdown** untuk render output AI

### Backend
- **Next.js API Routes** (serverless)
- **MongoDB** (Mongoose ODM)
- **NextAuth v5** (JWT-based)
- **Server-Sent Events** untuk streaming

### AI Integration
- **OpenAI GPT-4o** untuk generasi
- **GPT-4o-mini** untuk klasifikasi ringan
- **Orchestrator heuristic** (rule-based, gratis)
- **Multi-agent pipeline** dengan credit metering

### Telegram
- **node-telegram-bot-api** dengan webhook
- **OTP link** dengan TTL 5 menit
- **Inline keyboard** untuk navigasi
- **Cron notifier** untuk deadline & saldo

### Keamanan
- AES-256-GCM encryption untuk BYOK keys
- Atomic credit deduction (race-condition safe)
- Rate limiting per user di Telegram
- JWT session tanpa DB roundtrip per request
`,
  },
];

const CATEGORIES = [...new Set(SECTIONS.map((s) => s.category))];

// ─── Component ────────────────────────────────────────────────────────────────

export default function DocsPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filteredSections = activeCategory
    ? SECTIONS.filter((s) => s.category === activeCategory)
    : SECTIONS;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-8">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-foreground">
          Dokumentasi
        </h1>
        <p className="text-sm font-medium text-muted-foreground">
          Panduan lengkap menggunakan semua fitur EduSparq
        </p>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all ${
            !activeCategory
              ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary))]"
              : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          Semua
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold tracking-tight transition-all ${
              activeCategory === cat
                ? "bg-primary text-primary-foreground shadow-[0_8px_20px_-12px_hsl(var(--primary))]"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Accordion sections */}
      <div className="space-y-3">
        {filteredSections.map((section, i) => {
          const isOpen = activeId === section.id;
          const Icon = section.icon;
          return (
            <motion.div
              key={section.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 40, duration: 0.3 }}
              className="rounded-2xl border border-border/70 bg-card/80 backdrop-blur-sm overflow-hidden"
            >
              <button
                onClick={() => setActiveId(isOpen ? null : section.id)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-muted/40 transition-colors"
              >
                <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0">
                  <Icon size={17} />
                </span>
                <div className="flex-1 min-w-0">
                  <span className="block text-sm font-bold tracking-tight text-foreground truncate">
                    {section.title}
                  </span>
                  <span className="block text-[10px] font-medium text-muted-foreground mt-0.5">
                    {section.category}
                  </span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-muted-foreground shrink-0 transition-transform duration-200 ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              <AnimatePresence>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 border-t border-border/50 pt-4">
                      <div className="prose prose-sm dark:prose-invert max-w-none prose-headings:font-bold prose-headings:tracking-tight prose-p:text-sm prose-p:font-medium prose-p:leading-relaxed prose-li:text-sm prose-table:text-xs prose-code:text-xs prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-pre:bg-muted prose-pre:text-xs prose-strong:font-bold">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {section.content}
                        </ReactMarkdown>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
