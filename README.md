# EduSparq — Asisten Akademik AI untuk Mahasiswa Indonesia

EduSparq adalah aplikasi web (Next.js 14) yang menyatukan kebutuhan kuliah mahasiswa Indonesia dalam satu tempat: **tutor AI**, **manajemen tugas/tenggat**, **manajemen materi**, **asisten menulis & sitasi**, **persiapan ujian (flashcard & prediksi soal)**, **kolaborasi kelompok**, dan **analitik belajar**. Dirancang **mobile-first** dengan palet warna akademik (navy + teal + amber).

> **Status proyek:** prototipe fungsional. Sebagian fitur sudah tersambung ke database (live), sebagian lain masih memakai data contoh (mock) untuk demo UI. Lihat tabel [Status Fitur](#-status-fitur) di bawah.

---

## 📑 Daftar Isi

1. [Cuplikan Cepat](#-cuplikan-cepat)
2. [Tech Stack](#-tech-stack)
3. [Status Fitur](#-status-fitur)
4. [Arsitektur & Struktur Folder](#-arsitektur--struktur-folder)
5. [Sistem Desain](#-sistem-desain)
6. [Model Data](#-model-data)
7. [Referensi API](#-referensi-api)
8. [Cara Menjalankan](#-cara-menjalankan)
9. [Variabel Lingkungan (.env.local)](#-variabel-lingkungan-envlocal)
10. [Skrip NPM](#-skrip-npm)
11. [Keterbatasan yang Diketahui](#-keterbatasan-yang-diketahui)
12. [Rekomendasi Pengembangan (Roadmap)](#-rekomendasi-pengembangan-roadmap)

---

## ⚡ Cuplikan Cepat

```bash
# 1. Install dependency
npm install

# 2. Isi kredensial di .env.local (lihat bagian Variabel Lingkungan)

# 3. Jalankan dev server
npm run dev        # buka http://localhost:3000
```

Halaman yang tersedia:

| URL | Akses | Deskripsi |
|-----|-------|-----------|
| `/` | Publik | **Landing page** pemasaran (hero, fitur, transparansi AI, CTA) |
| `/login` | Publik | Masuk / daftar (email-password atau Google) |
| `/dashboard` | Aplikasi | Beranda: ringkasan semester, tenggat terdekat, akses cepat |
| `/workspace` | Aplikasi | Manajemen & unggah materi kuliah |
| `/deadlines` | Aplikasi | Kalender & manajemen tenggat tugas |
| `/tutor` | Aplikasi | Tutor AI (mode Socratic / Penjelasan / Riset) |
| `/writing` | Aplikasi | Outline, parafrase, manajer sitasi |
| `/exams` | Aplikasi | Prediksi soal + flashcard |
| `/collab` | Aplikasi | Workspace kolaborasi kelompok |
| `/analytics` | Aplikasi | Analitik belajar |

---

## 🧰 Tech Stack

| Lapisan | Teknologi |
|--------|-----------|
| Framework | **Next.js 14.2** (App Router) |
| Bahasa | **TypeScript** (strict mode) |
| Styling | **Tailwind CSS 3.4** + CSS variables (token desain HSL) |
| Animasi | **Framer Motion 12** |
| Ikon | **lucide-react** |
| Tema (dark/light) | **next-themes** |
| Autentikasi | **NextAuth v5 (beta)** — Google OAuth + Credentials (bcrypt) |
| Database | **MongoDB** via **Mongoose** |
| AI / LLM | **Groq SDK** (model `llama3-70b-8192`, streaming) |
| Penyimpanan file | **Cloudinary** (disiapkan, belum tersambung penuh) |
| Realtime | **Pusher** (disiapkan, belum dipakai di UI) |
| Validasi | **Zod** |

---

## ✅ Status Fitur

| Fitur / Halaman | API Nyata | Persisten ke DB | Status |
|-----------------|:---------:|:---------------:|--------|
| Landing page (`/`) | — | — | ✅ Selesai |
| Autentikasi (`/login`) | ✅ `/api/auth/*`, `/api/auth/register` | ✅ | ✅ Selesai (perlu kredensial) |
| Dashboard (`/dashboard`) | ❌ (data contoh) | ❌ | 🟡 UI selesai, data masih mock |
| Tutor AI (`/tutor`) | ✅ `/api/chat` (streaming Groq) | ✅ riwayat chat | ✅ Berfungsi (perlu Groq key) |
| Tenggat (`/deadlines`) | ✅ `/api/deadlines` (GET/POST/PATCH/DELETE) | ✅ | ✅ **Tersambung penuh** |
| Menulis — Sitasi (`/writing`) | ✅ `/api/citations` | ✅ | ✅ Tersambung |
| Menulis — Parafrase | ✅ `/api/chat` | ❌ (output sementara) | 🟡 Live tapi tidak disimpan |
| Menulis — Outline | ❌ (template hardcoded) | ❌ | 🟡 Mock / belum AI |
| Ujian — Flashcard (`/exams`) | ✅ `/api/flashcards` | ✅ | ✅ Tersambung |
| Ujian — Prediksi soal | ❌ (hardcoded) | ❌ | 🟡 Mock |
| Materi (`/workspace`) | ❌ (mock + upload simulasi) | ❌ | 🟡 UI-only, backend belum ada |
| Kolaborasi (`/collab`) | ❌ | ❌ | 🟡 Prototipe client-side |
| Analitik (`/analytics`) | ❌ (hardcoded) | ❌ | 🟡 Dashboard statis |

Legenda: ✅ siap · 🟡 sebagian/perlu pengembangan · ❌ belum

---

## 🏗 Arsitektur & Struktur Folder

Aplikasi memakai **Route Groups** Next.js agar **app shell** (sidebar, header, bottom-nav) hanya membungkus halaman aplikasi — sedangkan landing & login tampil tanpa shell.

```
src/
├── app/
│   ├── layout.tsx              # Root layout: HANYA provider (tema + session), tanpa shell
│   ├── globals.css             # Token desain (warna HSL), utilitas, keyframes animasi
│   ├── page.tsx                # 🌐 Landing page publik (/)
│   ├── login/page.tsx          # 🔐 Halaman masuk/daftar (tanpa shell)
│   │
│   ├── (app)/                  # ── Route group: semua halaman ber-"shell" ──
│   │   ├── layout.tsx          # App shell: sidebar desktop + header + bottom-nav mobile
│   │   ├── dashboard/page.tsx
│   │   ├── workspace/page.tsx
│   │   ├── deadlines/page.tsx
│   │   ├── tutor/page.tsx
│   │   ├── writing/page.tsx
│   │   ├── collab/page.tsx
│   │   ├── exams/page.tsx
│   │   └── analytics/page.tsx
│   │
│   └── api/                    # ── Route handlers (server) ──
│       ├── auth/[...nextauth]/route.ts
│       ├── auth/register/route.ts
│       ├── chat/route.ts       # GET riwayat · POST streaming AI · DELETE
│       ├── courses/route.ts
│       ├── deadlines/route.ts  &  deadlines/[id]/route.ts
│       ├── citations/route.ts  &  citations/[id]/route.ts
│       ├── flashcards/route.ts &  flashcards/[id]/route.ts
│       └── user/profile/route.ts
│
├── components/
│   ├── session-provider.tsx    # Pembungkus NextAuth SessionProvider
│   ├── theme-provider.tsx      # Pembungkus next-themes
│   ├── theme-toggle.tsx        # Tombol dark/light
│   └── ui/
│       ├── ConfidenceBadge.tsx # Indikator tingkat kepercayaan + atribusi sumber
│       └── Icons.tsx           # Re-export ikon lucide (alias)
│
├── lib/
│   ├── auth.ts                 # Konfigurasi NextAuth (Google + Credentials)
│   └── db/
│       ├── mongodb.ts          # Koneksi Mongoose (cached)
│       └── models/             # User, Course, Document, Deadline, Citation, Flashcard, ChatMessage
│
└── types/next-auth.d.ts        # Augmentasi tipe session (user.id)
```

**Konsekuensi penting:** Dashboard berada di `/dashboard` (bukan `/`). Tautan navigasi dan redirect login sudah diarahkan ke `/dashboard`.

---

## 🎨 Sistem Desain

Token didefinisikan sebagai CSS variable HSL di `src/app/globals.css` (`:root` dan `.dark`), dipetakan ke Tailwind di `tailwind.config.ts`.

### Palet warna

| Token | Nilai (light) | Hex | Penggunaan |
|-------|---------------|-----|-----------|
| `--primary` | `211 56% 23%` | **#1A3A5C** (navy) | Warna merek utama, tombol, tautan |
| `--warning` | `43 96% 56%` | **#FBBF24** (amber) | Perhatian, tenggat mendesak, pencapaian |
| `--info` | `172 66% 50%` | **#2DD4BF** (teal) | Aksen pertumbuhan/energi |
| `--background` | `0 0% 100%` | #FFFFFF | Latar utama |
| `--muted` / bg sekunder | `210 40% 96%` | ~#F8FAFC | Area fungsional |
| `--foreground` | `222 84% 5%` | ~#1E293B | Teks utama |
| `--destructive` | `0 84% 60%` | merah | Error / hapus |

> Token netral (`secondary`, `muted`, `accent`) sengaja dibiarkan abu-abu agar komponen lama tidak rusak. Warna **teal** dan **amber** dipakai langsung via utilitas Tailwind `teal-400/500` dan `amber-400`. Mode gelap mencerahkan `--primary` agar kontras (WCAG AA).

### Tipografi
- Font: **Plus Jakarta Sans** (via `next/font/google`, variabel `--font-sans`). *Catatan: spec menyebut Inter; bisa diganti dengan mudah di `layout.tsx`.*
- Skala dipakai konsisten dengan utilitas Tailwind (`text-xs` … `text-4xl`).

### Animasi (di `globals.css`)
- `.animate-pulse-glow` — sorotan lembut untuk banner peringatan.
- `.skeleton` — shimmer loader.
- `.animate-float-slow` — blob latar hero.
- `@media (prefers-reduced-motion)` — menonaktifkan animasi untuk aksesibilitas.

### Utilitas khusus
`.glass-panel`, `.glass-panel-solid` (glassmorphism), `.text-gradient`, `.no-scrollbar`.

---

## 🗄 Model Data

Semua dokumen di-scope per pengguna lewat `userId` (kecuali `User`).

| Model | Field utama |
|-------|-------------|
| **User** | `name`, `email` (unik), `password` (null untuk OAuth), `image`, `universitas`, `fakultas`, `prodi`, `semester` |
| **Course** | `userId`, `name`, `semester`, … |
| **Document** | `userId`, `courseName`, `filename`, `fileUrl` (Cloudinary), `fileType` (pdf/docx/audio/video/image), `status` (processing/indexed/failed) |
| **Deadline** | `userId`, `courseName`, `title`, `dueDate` (YYYY-MM-DD), `dueTime`, `weight`, `status` (pending/done/overdue) |
| **Citation** | `userId`, `author`, `title`, `year`, … |
| **Flashcard** | `userId`, `front`, `back`, … |
| **ChatMessage** | `userId`, `role` (user/assistant), `content`, `mode`, `createdAt` |

---

## 🔌 Referensi API

Semua endpoint (kecuali `register`) **memerlukan sesi login**; tanpa sesi mengembalikan `401`.

| Method | Endpoint | Fungsi |
|--------|----------|--------|
| `POST` | `/api/auth/register` | Daftar akun baru (hash bcrypt) |
| `*` | `/api/auth/[...nextauth]` | Handler NextAuth (login/logout/callback) |
| `GET` | `/api/chat` | Ambil 100 pesan terakhir |
| `POST` | `/api/chat` | Kirim pesan → **streaming** jawaban AI (Groq), simpan ke DB |
| `DELETE` | `/api/chat` | Hapus seluruh riwayat chat |
| `GET/POST` | `/api/deadlines` | List / buat tenggat (validasi Zod) |
| `PATCH/DELETE` | `/api/deadlines/[id]` | Ubah status / hapus tenggat |
| `GET/POST` | `/api/citations` | List / tambah sitasi |
| `DELETE` | `/api/citations/[id]` | Hapus sitasi |
| `GET/POST` | `/api/flashcards` | List / tambah flashcard |
| `DELETE` | `/api/flashcards/[id]` | Hapus flashcard |
| `GET/POST` | `/api/courses` | List / buat mata kuliah |
| `GET` | `/api/user/profile` | Profil + statistik ringkas (jumlah tenggat/matkul/dokumen) |
| `PATCH` | `/api/user/profile` | Update profil (name, universitas, fakultas, prodi, semester) |

---

## 🚀 Cara Menjalankan

**Prasyarat:** Node.js 18+ dan akun untuk layanan eksternal (MongoDB Atlas, Google Cloud, Groq; Cloudinary & Pusher opsional).

```bash
# 1) Install dependency
npm install

# 2) Buat & isi file kredensial
cp .env.local .env.local.example   # (atau edit langsung .env.local)
#    -> isi MONGODB_URI, NEXTAUTH_SECRET, GROQ_API_KEY, dll.

# 3) Mode pengembangan
npm run dev

# 4) Build produksi
npm run build
npm run start
```

> Build sudah diverifikasi berhasil (`next build` → exit 0, 21 halaman). Jika build pernah "menggantung", hapus cache: `rm -rf .next` lalu ulangi.

---

## 🔑 Variabel Lingkungan (.env.local)

File `.env.local` saat ini masih berisi **placeholder** — UI & navigasi tetap jalan, tapi fitur berbasis data baru aktif setelah diisi nilai asli.

```bash
# MongoDB Atlas
MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/edusparq?retryWrites=true&w=majority

# NextAuth
NEXTAUTH_SECRET=<openssl rand -base64 32>
NEXTAUTH_URL=http://localhost:3000

# Google OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Groq (gratis di console.groq.com) — wajib untuk Tutor AI & Parafrase
GROQ_API_KEY=gsk_...

# Cloudinary (opsional, untuk unggah materi)
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...

# Pusher (opsional, untuk kolaborasi realtime)
PUSHER_APP_ID=...
PUSHER_KEY=...
PUSHER_SECRET=...
PUSHER_CLUSTER=ap1
NEXT_PUBLIC_PUSHER_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=ap1
```

---

## 📜 Skrip NPM

| Skrip | Aksi |
|-------|------|
| `npm run dev` | Dev server (hot reload) |
| `npm run build` | Build produksi |
| `npm run start` | Jalankan hasil build |
| `npm run lint` | ESLint |

> Catatan: `next.config.mjs` mengaktifkan `ignoreDuringBuilds` (ESLint) dan `ignoreBuildErrors` (TypeScript) agar build tidak gagal karena lint/tipe. **Disarankan dimatikan** sebelum produksi sungguhan agar error tertangkap.

---

## ⚠️ Keterbatasan yang Diketahui

1. **Belum ada proteksi route.** Halaman di grup `(app)` bisa dibuka tanpa login (API tetap balas `401`). Belum ada `middleware.ts`.
2. **Beberapa fitur masih mock:** Dashboard, Workspace (unggah disimulasikan), Outline, Prediksi soal, Kolaborasi, dan Analitik memakai data contoh / state lokal yang hilang saat reload.
3. **Cloudinary & Pusher** sudah terpasang sebagai dependency tetapi belum tersambung ke alur unggah file / realtime.
4. **`.env.local` berisi placeholder** — perlu kredensial asli.
5. **ConfidenceBadge** belum dipakai di alur Tutor AI; warnanya masih diasumsikan untuk latar gelap.
6. **Build flags longgar** (lihat catatan skrip) — error TS/ESLint disembunyikan saat build.

---

## 🧭 Rekomendasi Pengembangan (Roadmap)

Diurutkan dari paling berdampak & cepat.

### Prioritas 1 — Keamanan & integritas (wajib sebelum dipakai nyata)
- [ ] **Tambah `middleware.ts`** untuk melindungi grup `(app)`: redirect ke `/login` bila belum ada sesi.
- [ ] **Validasi Zod konsisten** di semua endpoint POST/PATCH (saat ini hanya `/api/deadlines` yang memakai Zod penuh).
- [ ] **Rate limiting** pada `/api/chat` (mencegah abuse Groq) + batas panjang input.
- [ ] **Matikan `ignoreBuildErrors`/`ignoreDuringBuilds`** dan bereskan error yang muncul.

### Prioritas 2 — Sambungkan fitur mock ke data nyata
- [ ] **Dashboard:** ganti angka statis dengan data dari `/api/user/profile` + `/api/deadlines` (tenggat terdekat, progress nyata).
- [ ] **Workspace / Unggah materi:** implementasikan unggah ke **Cloudinary** (signed upload), simpan ke model `Document`, lalu pipeline ekstraksi teks (mis. `pdf-parse`) → embedding → pencarian semantik (RAG) untuk Tutor AI.
- [ ] **Outline Generator:** sambungkan ke `/api/chat` agar benar-benar menyesuaikan topik dengan template kampus (bukan template statis).
- [ ] **Prediksi soal ujian:** hasilkan dari dokumen pengguna (analisis materi + pola) alih-alih hardcoded.
- [ ] **Analitik:** agregasi nyata dari koleksi `ChatMessage`, `Deadline`, `Flashcard` (jam belajar, ketepatan tenggat, penggunaan fitur).

### Prioritas 3 — Fitur unggulan sesuai spec desain
- [ ] **Confidence Meter + Panel Sumber** terintegrasi penuh di Tutor AI (RAG): tampilkan tingkat kepercayaan + kutipan persis dari dokumen pengguna/jurnal. Manfaatkan `ConfidenceBadge.tsx` yang sudah ada.
- [ ] **Mode Socratic** sebagai toggle visual dengan indikator tetap (saat ini hanya pilihan mode).
- [ ] **Penampil PDF** in-app dengan zoom & lompat halaman pada detail materi.
- [ ] **Kolaborasi realtime** via **Pusher** (sinkronisasi dokumen, indikator ketik nyata, voting persisten).
- [ ] **Halaman Penelitian** terpisah (pencarian jurnal, akses terbuka, ekspor kutipan APA/MLA/IEEE/Harvard) sesuai spec.

### Prioritas 4 — Kualitas & pengalaman
- [ ] **PWA & offline:** caching agresif, "mode hemat data", unduh materi untuk akses offline (sesuai konteks Indonesia di spec).
- [ ] **Optimasi gambar** WebP + lazy loading.
- [ ] **Aksesibilitas:** audit kontras WCAG AA, label ARIA, fokus keyboard yang jelas.
- [ ] **Konsistensi font** ke Inter bila ingin presisi dengan spec.
- [ ] **Notifikasi & pengingat** (in-app, email, push) untuk tenggat — model & UI dialog pengingat.
- [ ] **Pengujian:** unit test untuk util & integration test untuk route API.
- [ ] **Skeleton loader** dipakai konsisten di semua halaman yang fetch (kelas `.skeleton` sudah tersedia).

### Prioritas 5 — Operasional
- [ ] Tambah `.env.local.example` (tanpa rahasia) ke repo, jaga `.env.local` tetap di-`.gitignore`.
- [ ] CI/CD (lint + build) dan deploy ke Vercel.
- [ ] Logging & monitoring error (mis. Sentry).

---

<p align="center"><sub>© 2026 EduSparq · Dibuat dengan ❤️ untuk mahasiswa Indonesia</sub></p>
