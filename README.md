<div align="center">

<img src="public/logo.png" alt="EduSparq" width="100" height="100" />

# EduSparq

### Igniting Academic Intelligence

**Platform asisten akademik AI multi-agen untuk mahasiswa Indonesia**

[![Next.js](https://img.shields.io/badge/Next.js-14.2-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Mongoose-green?logo=mongodb)](https://www.mongodb.com/)
[![NextAuth](https://img.shields.io/badge/Auth-NextAuth_v5-red?logo=auth0)](https://authjs.dev/)

</div>

---

## 📑 Daftar Isi

- [Tentang EduSparq](#-tentang-edusparq)
- [Fitur Utama](#-fitur-utama)
- [Arsitektur Sistem](#-arsitektur-sistem)
- [Tech Stack](#-tech-stack)
- [Instalasi & Setup](#-instalasi--setup)
- [Environment Variables](#-environment-variables)
- [Menjalankan Aplikasi](#-menjalankan-aplikasi)
- [Struktur Proyek](#-struktur-proyek)
- [API Reference](#-api-reference)
- [Sistem Credit & Billing](#-sistem-credit--billing)
- [Sistem Multi-Agent](#-sistem-multi-agent)
- [Integrasi Telegram](#-integrasi-telegram)
- [Katalog Jurusan](#-katalog-jurusan)
- [Deployment](#-deployment)
- [Testing](#-testing)
- [Lisensi](#-lisensi)

---

## 🎯 Tentang EduSparq

EduSparq adalah platform "Super App" akademik yang menyatukan semua kebutuhan mahasiswa Indonesia dalam satu tempat: Tutor AI, asisten menulis, manajemen tugas, kolaborasi kelompok, dan bot Telegram — semuanya didukung sistem **multi-agen AI** yang hemat token.

### Yang Membedakan EduSparq

| Fitur | Deskripsi |
|-------|-----------|
| 🤖 **Multi-Agent System** | Orchestrator + 7 sub-agen on-demand (Klarifikasi, Spesifikasi, Plan, Task, Implementasi, Kualitas) |
| 💬 **Telegram Bot** | Akses semua fitur langsung dari chat Telegram dengan OTP linking |
| 🎓 **Jurusan-Aware AI** | AI menyesuaikan jawaban untuk 17 jurusan (Informatika, Akuntansi, Hukum, dll) |
| 💳 **Credit System** | Metering transparan + BYOK (Bring Your Own Key) untuk pemakaian unlimited |
| 📚 **RAG Grounding** | Jawaban AI berbasis materi kuliah user sendiri (bukan mengarang) |
| 🌐 **PDDIKTI Integration** | Auto-fill profil dari data resmi Kemdiktisaintek |

---

## ✨ Fitur Utama

### 🧠 AI & Pembelajaran
- **Tutor AI** — Tanya jawab per mata kuliah dengan mode Socratic/Helper/Research
- **Agent AI** — Pipeline multi-agen untuk tugas kompleks (makalah, ERD, coding, analisis)
- **Menulis Akademik** — Draft dokumen, outline, parafrase, sitasi APA/IEEE
- **Riset** — Eksplorasi topik & sudut pandang penelitian
- **Latihan Ujian** — Generate soal + evaluasi jawaban dengan rubrik
- **Dosen Virtual** — Penilaian esai berbasis rubrik akademis
- **Flashcards** — Kartu pengingat interaktif dari materi

### 📋 Produktivitas
- **Workspace** — Upload & kelola materi kuliah (PDF, DOCX)
- **Jadwal** — Susun jadwal kuliah mingguan
- **Tugas & Tenggat** — Pantau deadline dengan prioritas otomatis
- **Kelompok** — Kolaborasi realtime (dokumen bersama, to-do list)
- **Catatan** — Rapikan coretan kuliah

### 💳 Akun & Billing
- **Billing** — Saldo credit, top up via invoice manual, riwayat transaksi
- **Harga** — Paket credit transparan + estimasi pemakaian
- **BYOK** — Pakai API key sendiri (OpenAI/Google) tanpa biaya platform
- **Telegram Settings** — Hubungkan akun + kelola webhook

### 🏛️ Organisasi
- **HIMA** — Kelola program kerja organisasi mahasiswa
- **Katalog Jurusan** — Template mata kuliah populer untuk 17 jurusan

---

## 🏗️ Arsitektur Sistem

```
┌─────────────────────────────────────────────────────────────────┐
│                         CLIENT (Browser)                         │
│  Next.js App Router • React 18 • Tailwind CSS • Framer Motion   │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                      NEXT.JS API ROUTES                          │
│  /api/chat     /api/agent/run    /api/tutor/grade    /api/exams │
│  /api/writing  /api/billing      /api/byok           /api/jurusan│
│  /api/telegram (webhook)         /api/telegram/setup /api/campus│
└──────┬──────────────┬───────────────────────┬───────────────────┘
       │              │                       │
       ▼              ▼                       ▼
┌─────────────┐ ┌──────────────┐  ┌────────────────────┐
│  MongoDB    │ │  AI Client   │  │   Telegram Bot     │
│  (Mongoose) │ │  (OpenAI SDK)│  │ (node-telegram-bot)│
│             │ │              │  │                    │
│ • User      │ │ Resolve:     │  │ Webhook handler    │
│ • Course    │ │ 1. BYOK key  │  │ OTP linking        │
│ • Document  │ │ 2. Platform  │  │ Inline keyboards   │
│ • ChatMsg   │ │              │  │ Cron notifications │
│ • Deadline  │ │ Metering:    │  │                    │
│ • CreditTxn │ │ atomic deduct│  │                    │
│ • ApiKey    │ │ + refund     │  │                    │
└─────────────┘ └──────┬───────┘  └────────────────────┘
                       │
                       ▼
              ┌─────────────────┐
              │  ORCHESTRATOR   │
              │  (multi-agent)  │
              │                 │
              │ Heuristic Class │
              │       ↓         │
              │ Simple(1 call)  │
              │ Medium(2 calls) │
              │ Complex(6-7)    │
              │                 │
              │ 7 Agents:       │
              │ • Classifier    │
              │ • Clarifier     │
              │ • Specifier     │
              │ • Planner       │
              │ • Tasker        │
              │ • Implementer   │
              │ • Reviewer      │
              └─────────────────┘
```

### Alur Eksekusi AI

```
User Request
     │
     ▼
┌─────────────┐     ┌───────────────┐
│ Heuristic   │────▶│  Ambiguous?   │
│ Classifier  │     │               │
│ (FREE)      │     │  YES → AI     │
└─────────────┘     │  Classifier   │
                    │  (1 lite call)│
                    └───────┬───────┘
                            │
              ┌─────────────┼─────────────┐
              ▼             ▼             ▼
         ┌────────┐   ┌────────┐   ┌────────────┐
         │ SIMPLE │   │ MEDIUM │   │  COMPLEX   │
         │ (1 call│   │ (2 call│   │ (6-7 calls │
         │ helper)│   │clar+imp│   │ full pipe) │
         └────────┘   └────────┘   └────────────┘
```

---

## 🛠️ Tech Stack

### Frontend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| [Next.js](https://nextjs.org/) | 14.2 | App Router, SSR, API routes |
| [React](https://react.dev/) | 18 | UI library |
| [TypeScript](https://www.typescriptlang.org/) | 5.0 | Type safety |
| [Tailwind CSS](https://tailwindcss.com/) | 3.4 | Styling + dark mode |
| [Framer Motion](https://www.framer.com/motion/) | 12 | Animasi |
| [React Markdown](https://github.com/remarkjs/react-markdown) | 10 | Render output AI |

### Backend
| Teknologi | Versi | Fungsi |
|-----------|-------|--------|
| [MongoDB](https://www.mongodb.com/) | Atlas | Database utama |
| [Mongoose](https://mongoosejs.com/) | 9.7 | ODM |
| [NextAuth.js](https://authjs.dev/) | 5.0 beta | Autentikasi (JWT + OAuth) |
| [OpenAI SDK](https://github.com/openai/openai-node) | 6.42 | AI client (compatible API) |
| [node-telegram-bot-api](https://github.com/yagop/node-telegram-bot-api) | 1.1 | Telegram bot |

### Layanan Eksternal
| Layanan | Fungsi |
|---------|--------|
| [MongoDB Atlas](https://www.mongodb.com/atlas) | Database hosted |
| [Cloudinary](https://cloudinary.com/) | Upload materi (PDF/DOCX) |
| [Pusher](https://pusher.com/) | Kolaborasi realtime |
| [PDDIKTI](https://pddikti.kemdiktisaintek.go.id/) | Data kampus resmi |
| [Groq](https://groq.com/) / [Moonshot](https://platform.moonshot.ai/) | AI inference |

---

## 🚀 Instalasi & Setup

### Prasyarat

- **Node.js** 18.17+ dan npm
- **MongoDB** Atlas account (gratis) atau MongoDB lokal
- Akun [Cloudinary](https://cloudinary.com/) (opsional, untuk upload)
- API key AI: [Groq](https://console.groq.com/) (gratis) atau [Moonshot](https://platform.moonshot.ai/)

### Langkah Instalasi

```bash
# 1. Clone repository
git clone <repo-url>
cd edusparq-app

# 2. Install dependencies
npm install

# 3. Copy env example
cp .env.local.example .env.local

# 4. Edit .env.local — isi semua nilai (lihat section di bawah)
#    WAJIB: MONGODB_URI, NEXTAUTH_SECRET

# 5. Jalankan development server
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000) di browser.

---

## 🔐 Environment Variables

Salin `.env.local.example` ke `.env.local` dan isi nilai berikut:

### WAJIB (App tidak jalan tanpa ini)

```env
# MongoDB Atlas — dari Connect → Drivers
MONGODB_URI=mongodb+srv://<user>:<password>@cluster.xxxxx.mongodb.net/edusparq?retryWrites=true&w=majority

# NextAuth — generate dengan: openssl rand -base64 32
NEXTAUTH_SECRET=<string-acak-32-karakter>
NEXTAUTH_URL=http://localhost:3000
```

### AI (Wajib untuk fitur AI)

```env
# Pilih salah satu (atau keduanya untuk fallback):
GROQ_API_KEY=gsk_xxxxxxxxxxxx        # https://console.groq.com (GRATIS)
MOONSHOT_API_KEY=sk-xxxxxxxxxxxx     # https://platform.moonshot.ai

# Platform AI default (opsional — default: Kimi via phanrouter)
PLATFORM_AI_BASE_URL=https://www.phanrouter.com/phanrouter/v1
PLATFORM_AI_MODEL=kimi-k2.6
PLATFORM_AI_LITE_MODEL=kimi-k2.6
```

### Credit & BYOK (Produksi)

```env
# Kunci master enkripsi API key user (BYOK)
# Generate: openssl rand -base64 32
# Bila kosong, fallback ke NEXTAUTH_SECRET (tidak direkomendasikan)
CREDIT_ENCRYPTION_KEY=<string-acak>

# ID user admin (approve invoice top up) — MongoDB _id, dipisah koma
ADMIN_USER_IDS=<mongodb_object_id>
```

### Telegram Bot (Opsional)

```env
# Dari @BotFather di Telegram
TELEGRAM_BOT_TOKEN=<bot_id>:<35-char-secret>

# Username bot (tanpa @) — ditampilkan di UI
NEXT_PUBLIC_TELEGRAM_BOT_USERNAME=EduSparqBot

# Token rahasia untuk cron notifikasi
# Generate: openssl rand -hex 16
TELEGRAM_NOTIFY_TOKEN=<string-acak>
```

### Opsional Lainnya

```env
# Google OAuth
GOOGLE_CLIENT_ID=<id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<secret>

# Cloudinary (upload materi)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<name>
CLOUDINARY_API_KEY=<key>
CLOUDINARY_API_SECRET=<secret>

# Pusher (kolaborasi realtime)
PUSHER_APP_ID=<id>
PUSHER_KEY=<key>
PUSHER_SECRET=<secret>
PUSHER_CLUSTER=ap1
NEXT_PUBLIC_PUSHER_KEY=<key>
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
```

> ⚠️ **Jangan commit `.env.local`!** File ini sudah di-gitignore.

---

## ▶️ Menjalankan Aplikasi

```bash
# Development (hot reload)
npm run dev

# Production build
npm run build

# Jalankan production server
npm start

# Lint check
npm run lint

# Smoke test (pastikan dev server berjalan dulu)
node scripts/smoke-test.mjs
```

---

## 📁 Struktur Proyek

```
edusparq-app/
├── public/                          # Static assets (logo, favicon)
│   └── logo.png
├── scripts/
│   └── smoke-test.mjs              # E2E smoke test
├── src/
│   ├── app/                        # Next.js App Router
│   │   ├── (app)/                  # Route group: halaman authenticated
│   │   │   ├── dashboard/          # Beranda
│   │   │   ├── workspace/          # Upload materi
│   │   │   ├── tutor/              # Tutor AI
│   │   │   ├── writing/            # Asisten menulis
│   │   │   ├── research/           # Mode riset
│   │   │   ├── exams/              # Latihan ujian
│   │   │   ├── dosen/              # Dosen virtual
│   │   │   ├── agents/             # Agent AI (multi-agen)
│   │   │   ├── jurusan/            # Katalog jurusan
│   │   │   ├── docs/               # Dokumentasi
│   │   │   ├── pricing/            # Paket credit
│   │   │   ├── billing/            # Saldo & top up
│   │   │   ├── settings/
│   │   │   │   ├── ai/             # BYOK setup
│   │   │   │   └── telegram/       # Telegram linking
│   │   │   ├── profile/            # Profil user
│   │   │   ├── analytics/          # Analitik belajar
│   │   │   ├── deadlines/          # Tugas & tenggat
│   │   │   ├── jadwal/             # Jadwal kuliah
│   │   │   ├── collab/             # Kolaborasi kelompok
│   │   │   ├── catatan/            # Catatan kuliah
│   │   │   ├── katalog/            # Katalog referensi
│   │   │   ├── library/            # Perpustakaan
│   │   │   ├── hima/               # Organisasi mahasiswa
│   │   │   └── layout.tsx          # Layout app (sidebar + nav)
│   │   ├── api/                    # API Routes
│   │   │   ├── chat/               # Chat AI (orchestrator + streaming)
│   │   │   ├── agent/              # Agent endpoints
│   │   │   │   ├── run/            # Jalankan orchestrator
│   │   │   │   └── sessions/       # Riwayat sesi agent
│   │   │   ├── telegram/           # Telegram bot
│   │   │   │   ├── route.ts        # Webhook handler
│   │   │   │   ├── link/           # OTP linking
│   │   │   │   ├── notify/         # Cron notifications
│   │   │   │   └── setup/          # Webhook management
│   │   │   ├── billing/            # Credit & invoice
│   │   │   ├── byok/               # API key management
│   │   │   ├── jurusan/            # Jurusan catalog API
│   │   │   ├── tutor/              # Tutor grading
│   │   │   ├── writing/            # Writing tools
│   │   │   ├── exams/              # Exam tools
│   │   │   ├── campus/             # PDDIKTI integration
│   │   │   ├── courses/            # Mata kuliah CRUD
│   │   │   ├── documents/          # Materi CRUD + RAG
│   │   │   └── ...                 # 60+ endpoints lainnya
│   │   ├── login/                  # Halaman login
│   │   ├── page.tsx                # Landing page
│   │   ├── layout.tsx              # Root layout
│   │   └── globals.css             # Global styles + brand palette
│   ├── components/                 # React components
│   │   ├── app-nav.tsx             # Sidebar + bottom nav
│   │   ├── theme-toggle.tsx        # Dark/light toggle
│   │   ├── notification-bell.tsx   # Notifikasi
│   │   ├── onboarding-gate.tsx     # Onboarding modal
│   │   └── page-transition.tsx     # Route transitions
│   ├── lib/                        # Business logic
│   │   ├── agents/                 # Multi-agent system
│   │   │   ├── orchestrator.ts     # Router pintar
│   │   │   ├── definitions.ts      # Definisi 7 agen
│   │   │   ├── registry.ts         # Agent runner + metering
│   │   │   └── context.ts          # SessionContext
│   │   ├── db/models/              # Mongoose models
│   │   │   ├── User.ts
│   │   │   ├── Course.ts
│   │   │   ├── Document.ts
│   │   │   ├── Deadline.ts
│   │   │   ├── CreditTransaction.ts
│   │   │   ├── ApiKey.ts           # BYOK keys (encrypted)
│   │   │   ├── TelegramLink.ts
│   │   │   ├── AgentSession.ts
│   │   │   └── ...
│   │   ├── ai-client.ts            # Universal AI resolver
│   │   ├── ai-prompts.ts           # System prompt engine
│   │   ├── credit-billing.ts       # Atomic credit deduction
│   │   ├── credit-config.ts        # Feature weights + pricing
│   │   ├── crypto.ts               # AES-256-GCM encryption
│   │   ├── rag.ts                  # Retrieval-Augmented Generation
│   │   ├── telegram.ts             # Bot helpers + OTP store
│   │   ├── jurusan-catalog.ts      # 17 jurusan + prompt context
│   │   ├── jurusan-context.ts      # Jurusan-aware context builder
│   │   ├── env-check.ts            # Startup env validator
│   │   └── auth.ts                 # NextAuth config
│   ├── instrumentation.ts          # Startup hook
│   └── middleware.ts               # Auth middleware
├── .env.local                      # ⚠️ Secrets (gitignored)
├── .env.local.example              # Template env
├── package.json
├── tailwind.config.ts
├── tsconfig.json
└── next.config.mjs
```

---

## 🔌 API Reference

### Autentikasi

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/auth/register` | Registrasi akun baru |
| `POST` | `/api/auth/[...nextauth]` | Login (NextAuth) |
| `GET` | `/api/user/profile` | Profil user |
| `PATCH` | `/api/user/profile` | Update profil |

### AI & Agent

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/chat` | Chat AI (streaming SSE) |
| `POST` | `/api/agent/run` | Jalankan multi-agent orchestrator |
| `GET` | `/api/agent/sessions` | Riwayat sesi agent |
| `POST` | `/api/tutor/grade` | Penilaian jawaban (Dosen Virtual) |
| `POST` | `/api/exams/solve` | Assignment solver (streaming) |
| `POST` | `/api/exams/practice` | Generate soal latihan |
| `POST` | `/api/writing/draft` | Generate draft dokumen |
| `POST` | `/api/writing/outline` | Generate outline |
| `POST` | `/api/writing/paraphrase` | Parafrase teks |

### Jurusan

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/jurusan` | Katalog jurusan + fakultas |
| `GET` | `/api/jurusan?prodi=...` | Match prodi → jurusan detail |
| `GET` | `/api/jurusan/courses` | Template matkul untuk prodi user |

### Billing & BYOK

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET` | `/api/billing` | Saldo & riwayat transaksi |
| `POST` | `/api/billing` | Top up (request invoice) |
| `GET` | `/api/byok` | List API keys user |
| `POST` | `/api/byok` | Tambah API key (BYOK) |
| `DELETE` | `/api/byok/[id]` | Hapus API key |

### Telegram

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `POST` | `/api/telegram` | Webhook handler (dari Telegram) |
| `POST` | `/api/telegram/link` | Generate OTP linking |
| `GET` | `/api/telegram/link` | Cek status link |
| `DELETE` | `/api/telegram/link` | Putuskan link |
| `GET` | `/api/telegram/notify?token=...` | Cron notifikasi (deadline + saldo) |
| `GET` | `/api/telegram/setup?action=set\|delete\|status` | Kelola webhook |

### Mata Kuliah & Materi

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| `GET/POST` | `/api/courses` | List/tambah mata kuliah |
| `GET/POST` | `/api/documents` | List/upload materi |
| `POST` | `/api/documents/[id]/analyze` | Analisis materi dengan AI |
| `POST` | `/api/documents/[id]/summarize` | Ringkasan materi |
| `GET/POST` | `/api/deadlines` | List/tambah tugas |

> Total: **102 routes** (60+ API endpoints + 20+ halaman)

---

## 💰 Sistem Credit & Billing

### Cara Kerja Credit

Setiap penggunaan AI mengonsumsi credit berdasarkan token:

```
cost = (tokensMasuk × 0.2 + tokensKeluar × 1.0) × bobotFitur
```

| Fitur | Bobot | Estimasi Credit |
|-------|-------|-----------------|
| Chat sederhana | 1.0× | 200–800 |
| Tutor (sesi) | 1.2× | 500–1.500 |
| Draft dokumen | 1.5× | 2.000–5.000 |
| Agent Simple | 1.0× | 200–800 |
| Agent Medium | 2.0× | 1.000–3.000 |
| Agent Complex | 5.0× | 5.000–15.000 |

### Keamanan Billing

- ✅ **Atomic deduction** — `findOneAndUpdate` dengan `$gte` guard (race-condition safe)
- ✅ **Pre-check** — `canAfford()` sebelum AI call → `InsufficientCreditsError` → HTTP 402
- ✅ **Auto-refund** — AI gagal setelah pre-deduct → credit dikembalikan
- ✅ **Metering** — Semua usage tercatat di `UsageLog` + `CreditTransaction`

### BYOK (Bring Your Own Key)

Gunakan API key AI milik sendiri — **tanpa biaya platform**:

1. Buka **Settings → Kunci AI**
2. Pilih provider (OpenAI / Google)
3. Paste API key
4. Key dienkripsi **AES-256-GCM** sebelum disimpan di DB

Saat BYOK aktif: AI call pakai key user, credit EduSparq **tidak berkurang**, usage tetap di-log untuk statistik.

---

## 🤖 Sistem Multi-Agent

### 7 Agen dalam Pipeline

| Agen | Nama | Fungsi |
|------|------|--------|
| 🧭 **Classifier** | Pengarah | Klasifikasi kompleksitas (heuristic + AI lite) |
| ❓ **Clarifier** | Klarifikasi | Identifikasi ambiguitas, ajukan pertanyaan esensial |
| 📋 **Specifier** | Spesifikasi | Ubah request jadi spec teknis (tujuan, scope, batasan) |
| 🗺️ **Planner** | Perencanaan | Pecah spec jadi urutan langkah (outline) |
| ✅ **Tasker** | Penugasasan | Konversi plan jadi task atomic |
| ⚙️ **Implementer** | Implementasi | Eksekusi task, hasilkan output final |
| 🔍 **Reviewer** | Kualitas | Audit output vs spec, revisi bila perlu |

### 3 Tier Eksekusi

| Tier | Agen yang Dijalankan | Jumlah AI Call | Contoh |
|------|----------------------|----------------|--------|
| **Simple** | Helper langsung | 1 | "Apa itu inflasi?" |
| **Medium** | Clarifier → Implementer | 2 | "Bandingkan regresi linear vs logistik" |
| **Complex** | Full pipeline (6-7 agen) | 6–7 | "Buat bab 3 skripsi tentang blockchain" |

### Optimasi Token

- **Heuristic classifier** (rule-based, GRATIS) dipakai pertama
- AI classifier hanya bila heuristic ambigu (1 call model lite)
- Persona tutor tetap dihormati di semua tier
- Context sharing antar agen (tidak repeat prompt dari nol)

---

## 📱 Integrasi Telegram

### Setup Bot

1. **Buat bot** via [@BotFather](https://t.me/BotFather) di Telegram
2. Copy token → paste ke `.env.local` (`TELEGRAM_BOT_TOKEN`)
3. Buka **Settings → Telegram** di dashboard EduSparq
4. Masukkan URL webhook (HTTPS) → klik **"Daftarkan Webhook"**

### Perintah Bot

| Perintah | Fungsi |
|----------|--------|
| `/start` | Menu utama + inline keyboard |
| `/help` | Daftar perintah |
| `/link <otp>` | Hubungkan akun EduSparq |
| `/unlink` | Putuskan hubungan |
| `/saldo` | Cek saldo credit |
| `/mode` | Ubah mode agent (auto/simple) |
| `/tugas` | Deadline terdekat |
| `/jadwal` | Jadwal kuliah hari ini |
| *pesan bebas* | Tanya AI langsung (via orchestrator) |

### Notifikasi Otomatis

Set via cron job (eksternal) memanggil `GET /api/telegram/notify?token=<TELEGRAM_NOTIFY_TOKEN>`:

- **Deadline reminder** — tugas jatuh tempo dalam 1–3 hari
- **Low credit alert** — saldo < 50 credit

Rekomendasi cron: setiap 12 jam (08:00 & 20:00 WIB).

---

## 🎓 Katalog Jurusan

EduSparq mendukung **17 jurusan** dalam **4 fakultas** dengan personalisasi AI:

### Teknik & Informatika ⚙️
- 💻 Teknik Informatika (18 template matkul)
- 🗃️ Sistem Informasi (11 template matkul)
- ⚡ Teknik Elektro
- 🏗️ Teknik Sipil

### Ekonomi & Bisnis 📊
- 📈 Manajemen (12 template matkul)
- 📒 Akuntansi (10 template matkul)
- 💰 Ekonomi Pembangunan
- 🚀 Bisnis Digital

### Hukum ⚖️
- ⚖️ Ilmu Hukum (12 template matkul)

### MIPA & Ilmu Alam 🔬
- 📐 Matematika
- 🌟 Fisika
- 🧪 Kimia
- 🧬 Biologi
- 💊 Farmasi
- 🩺 Pendidikan Dokter
- 🧠 Psikologi (11 template matkul)

Setiap jurusan punya **prompt context** khusus yang diinjeksi ke AI — menyesuaikan terminologi, contoh, analogi, dan gaya jawaban.

---

## 🚢 Deployment

### Platform yang Direkomendasikan

| Platform | Kelebihan | Catatan |
|----------|-----------|---------|
| **Vercel** | Native Next.js, edge functions | Paling mudah |
| **Wasmer** | Docker-based, persistent | Untuk long-running |
| **Railway** | Simple, MongoDB addon | Good free tier |
| **Self-hosted** | Full control | Butuh VPS + Node.js |

### Langkah Deploy (Vercel)

```bash
# 1. Push ke GitHub
git add . && git commit -m "ready for deploy"
git push origin main

# 2. Import di Vercel
# Buka vercel.com → New Project → import repo

# 3. Set environment variables di Vercel dashboard
# (copy semua dari .env.local)

# 4. Deploy → dapat URL HTTPS publik

# 5. Set Telegram webhook
# Buka: https://<url-anda>.vercel.app/settings/telegram
# Masukkan: https://<url-anda>.vercel.app/api/telegram
# Klik: "Daftarkan Webhook"
```

### Setup Cron untuk Notifikasi Telegram

Gunakan layanan cron eksternal:
- [cron-job.org](https://cron-job.org/) (gratis)
- [GitHub Actions](https://docs.github.com/en/actions)
- Vercel Cron (bila deploy di Vercel)

Panggil setiap 12 jam:
```
GET https://<url-anda>/api/telegram/notify?token=<TELEGRAM_NOTIFY_TOKEN>
```

### MongoDB Atlas Setup

1. Buat cluster gratis di [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Network Access** → tambah IP `0.0.0.0/0` (untuk serverless)
3. **Database Access** → buat user + password
4. **Connect** → Drivers → copy connection string ke `MONGODB_URI`

---

## 🧪 Testing

### Smoke Test

```bash
# Pastikan dev server berjalan
npm run dev

# Di terminal lain:
node scripts/smoke-test.mjs
```

Test memverifikasi:
- ✅ Health endpoint
- ✅ Jurusan catalog API
- ✅ Jurusan match (exact + fuzzy)
- ✅ Telegram setup route (auth guard)
- ✅ Landing page render
- ✅ Login page render
- ✅ Pricing page (auth redirect)

### Manual Testing Checklist

- [ ] Registrasi akun baru
- [ ] Lengkapi profil (universitas, prodi via PDDIKTI)
- [ ] Upload materi (PDF/DOCX)
- [ ] Chat dengan Tutor AI
- [ ] Jalankan Agent AI (tier complex)
- [ ] Generate draft makalah
- [ ] Top up credit (invoice)
- [ ] Setup BYOK
- [ ] Link Telegram via OTP
- [ ] Kirim pesan via Telegram bot
- [ ] Set webhook Telegram

---

## 📝 Lisensi

© 2026 EduSparq Studio. Hak Cipta Dilindungi.

---

<div align="center">

**Dibuat dengan ❤️ untuk pendidikan tinggi Indonesia**

[🌍 Website](https://edusparq.app) · [📚 Docs](https://edusparq.app/docs) · [💬 Telegram](https://t.me/EduSparqBot)

</div>
