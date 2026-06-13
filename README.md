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
| `/writing` | Aplikasi | Outline AI, parafrase, manajer + ekspor sitasi |
| `/research` | Aplikasi | Pencarian riset + jawaban AI mode riset |
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
| Penyimpanan file | **Cloudinary** (tersambung: upload + hapus aset) |
| Realtime | **Pusher** (tersambung di Kolaborasi; fallback mode lokal) |
| Validasi | **Zod** (di seluruh endpoint tulis) |
| Proteksi route | **Next.js Middleware** (cookie-gate → redirect `/login`) |

---

## ✅ Status Fitur

| Fitur / Halaman | API Nyata | Persisten ke DB | Status |
|-----------------|:---------:|:---------------:|--------|
| Landing page (`/`) | — | — | ✅ Selesai |
| Autentikasi (`/login`) | ✅ `/api/auth/*`, `/api/auth/register` | ✅ | ✅ Selesai (perlu kredensial) |
| **Proteksi route** | ✅ `src/middleware.ts` | — | ✅ Aktif (redirect ke `/login`) |
| Dashboard (`/dashboard`) | ✅ `/api/user/profile` + `/api/deadlines` | ✅ (fallback contoh) | ✅ Live + sapaan adaptif |
| Tutor AI (`/tutor`) | ✅ `/api/chat` (streaming Groq **+ RAG**) | ✅ riwayat chat | ✅ + Confidence Meter & sumber |
| Tenggat (`/deadlines`) | ✅ `/api/deadlines` (GET/POST/PATCH/DELETE) | ✅ | ✅ **Tersambung penuh** |
| Materi (`/workspace`) | ✅ `/api/upload` + `/api/documents` | ✅ (Document + chunk RAG) | ✅ Upload nyata (perlu Cloudinary) |
| Menulis — Sitasi (`/writing`) | ✅ `/api/citations` | ✅ | ✅ + ekspor 4 gaya (APA/MLA/IEEE/Harvard) |
| Menulis — Parafrase | ✅ `/api/chat` | ❌ (output sementara) | 🟡 Live tapi tidak disimpan |
| Menulis — Outline | ✅ `/api/chat` (AI streaming) | ❌ (unduh `.md`) | ✅ AI + adaptif template kampus |
| Riset (`/research`) | ✅ `/api/chat` (mode riset) | ❌ | ✅ Halaman baru (sesuai spec) |
| Ujian — Flashcard (`/exams`) | ✅ `/api/flashcards` | ✅ | ✅ Tersambung |
| Ujian — Prediksi soal | ❌ (hardcoded) | ❌ | 🟡 Mock |
| Kolaborasi (`/collab`) | ✅ `/api/collab` (Pusher) | ❌ (in-memory) | ✅ Realtime + fallback lokal |
| Analitik (`/analytics`) | ❌ (hardcoded) | ❌ | 🟡 Dashboard statis |

Legenda: ✅ siap · 🟡 sebagian/perlu pengembangan · ❌ belum

> **Update P1–P3 (selesai):** proteksi route (middleware), validasi Zod menyeluruh, rate-limit `/api/chat` (20 req/menit) + batas input 4000 char, dashboard live, upload Cloudinary + backend dokumen & RAG leksikal, Confidence Meter + atribusi sumber di Tutor, outline AI, ekspor sitasi, halaman Riset baru, dan kolaborasi realtime Pusher. Semua dengan **fallback aman** saat kredensial belum diisi. `tsc --noEmit` bersih; semua route & API baru ter-compile di dev server.

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
│   │   ├── dashboard/page.tsx  # Live: profil + tenggat, sapaan adaptif
│   │   ├── workspace/page.tsx  # Upload Cloudinary + daftar dokumen + chunk
│   │   ├── deadlines/page.tsx
│   │   ├── tutor/page.tsx      # RAG + Confidence Meter + toggle Sokratik
│   │   ├── writing/page.tsx    # Outline AI + ekspor sitasi 4 gaya
│   │   ├── research/page.tsx   # 🔎 Halaman Riset (baru)
│   │   ├── collab/page.tsx     # Realtime Pusher + fallback lokal
│   │   ├── exams/page.tsx
│   │   └── analytics/page.tsx
│   │
│   └── api/                    # ── Route handlers (server) ──
│       ├── auth/[...nextauth]/route.ts  &  auth/register/route.ts
│       ├── chat/route.ts       # POST streaming AI + RAG + meta + rate-limit
│       ├── upload/route.ts     # Unggah file → Cloudinary
│       ├── documents/route.ts  &  documents/[id]/route.ts
│       ├── collab/route.ts     # Trigger event Pusher
│       ├── courses/route.ts
│       ├── deadlines/route.ts  &  deadlines/[id]/route.ts
│       ├── citations/route.ts  &  citations/[id]/route.ts
│       ├── flashcards/route.ts &  flashcards/[id]/route.ts
│       └── user/profile/route.ts
│
├── middleware.ts               # 🔒 Proteksi route (cookie-gate → /login)
│
├── components/
│   ├── session-provider.tsx · theme-provider.tsx · theme-toggle.tsx
│   └── ui/
│       ├── ConfidenceBadge.tsx # Tingkat kepercayaan + sumber (theme-aware)
│       └── Icons.tsx
│
├── lib/
│   ├── auth.ts                 # Konfigurasi NextAuth (Google + Credentials)
│   ├── validations.ts          # Skema Zod bersama
│   ├── rate-limit.ts           # Limiter in-memory (sliding window)
│   ├── cloudinary.ts           # Helper upload/destroy aset
│   ├── rag.ts                  # chunkText · retrieveChunks · computeConfidence
│   ├── citation-format.ts      # formatCitation (APA/MLA/IEEE/Harvard)
│   ├── pusher.ts               # Server Pusher + isPusherConfigured()
│   └── db/
│       ├── mongodb.ts          # Koneksi Mongoose (cached)
│       └── models/             # User, Course, Document, DocumentChunk, Deadline, Citation, Flashcard, ChatMessage
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
- Font: **Inter** (via `next/font/google`, variabel `--font-sans`) — sesuai spec.
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
| **Document** | `userId`, `courseName`, `filename`, `fileUrl` (Cloudinary), `publicId`, `fileType` (pdf/docx/audio/video/image), `status` (processing/indexed/failed) |
| **DocumentChunk** | `userId`, `documentId`, `courseName`, `content` (text-index utk RAG), `chunkIndex` |
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
| `POST` | `/api/chat` | Kirim pesan → **streaming** jawaban AI (Groq) **+ RAG** (retrieval chunk materi) + event meta `{sources, confidence}`. Rate-limit 20/menit, batas input 4000 char |
| `DELETE` | `/api/chat` | Hapus seluruh riwayat chat |
| `POST` | `/api/upload` | Unggah file ke Cloudinary (multipart, maks 25MB; 503 bila Cloudinary belum dikonfigurasi) |
| `GET/POST` | `/api/documents` | List / simpan dokumen (chunking RAG bila ada `textContent`) |
| `DELETE` | `/api/documents/[id]` | Hapus dokumen + chunk + aset Cloudinary |
| `POST` | `/api/collab` | Trigger event realtime Pusher (503 bila Pusher belum dikonfigurasi) |
| `GET/POST` | `/api/deadlines` | List / buat tenggat (validasi Zod) |
| `PATCH/DELETE` | `/api/deadlines/[id]` | Ubah status / hapus tenggat |
| `GET/POST` | `/api/citations` | List / tambah sitasi (validasi Zod) |
| `DELETE` | `/api/citations/[id]` | Hapus sitasi |
| `GET/POST` | `/api/flashcards` | List / tambah flashcard (validasi Zod) |
| `DELETE` | `/api/flashcards/[id]` | Hapus flashcard |
| `GET/POST` | `/api/courses` | List / buat mata kuliah (validasi Zod) |
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

> **Verifikasi:** `npx tsc --noEmit` bersih (0 error) dan seluruh route/API ter-compile sukses di dev server. Pada sebagian mesin Windows, `next build` bisa terlihat "menggantung" di tahap webpack (kendala lingkungan, bukan kode) — jalankan `rm -rf .next` lalu ulangi, atau verifikasi via `npm run dev`. Middleware membuat route privat membalas `307 → /login?callbackUrl=...` saat belum login (perilaku yang diharapkan).

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

> Catatan: pengecekan **TypeScript saat build kini aktif** (`ignoreBuildErrors: false`). **ESLint** masih dilewati saat build (`ignoreDuringBuilds: true`) karena ada lint nits lama — aktifkan kembali setelah dibersihkan.

---

## ⚠️ Keterbatasan yang Diketahui

1. **Middleware adalah cookie-gate ringan** (cek keberadaan cookie sesi, bukan verifikasi token di Edge). Validasi sesungguhnya tetap di route API (`401`). Disarankan upgrade ke `auth.config.ts` edge-safe terpisah.
2. **RAG masih leksikal** (MongoDB `$text` + fallback regex), belum embedding/vektor. **Ekstraksi teks file biner** (PDF/audio/video) belum ada — chunk hanya terbentuk bila `textContent` dikirim, jadi retrieval kosong sampai pipeline ekstraksi ditambahkan.
3. **Masih mock:** Prediksi soal ujian & Analitik memakai data statis. Parafrase & outline tidak disimpan (outline bisa diunduh `.md`). Kolaborasi realtime memakai satu channel demo tanpa presence-auth dan **tidak persisten** (in-memory).
4. **`.env.local` berisi placeholder** — semua fitur berbasis data memakai *fallback aman*: Cloudinary/Pusher belum dikonfigurasi → 503 + mode demo/lokal; Groq/Mongo belum diisi → pesan ramah tanpa crash.
5. **ESLint masih dilewati saat build** (`ignoreDuringBuilds: true`); pengecekan TypeScript kini **aktif** (`ignoreBuildErrors: false`).
6. **`.docx` export** belum ada (butuh dependency); outline diekspor sebagai `.md`.

---

## 🧭 Rekomendasi Pengembangan (Roadmap)

### Prioritas 1 — Keamanan & integritas ✅ **SELESAI**
- [x] **`src/middleware.ts`** melindungi grup `(app)` → redirect `/login?callbackUrl=...` bila belum login.
- [x] **Validasi Zod** di semua endpoint tulis (`citations`, `courses`, `flashcards`, `deadlines`, `documents`) via `src/lib/validations.ts`.
- [x] **Rate limiting** `/api/chat` (20 req/menit, `src/lib/rate-limit.ts`) + batas input 4000 char.
- [x] **Pengecekan TypeScript saat build diaktifkan** (`ignoreBuildErrors: false`).
- [ ] *Sisa:* upgrade middleware ke verifikasi token edge-safe; rate-limit berbasis Redis (multi-instance); aktifkan ESLint-in-build.

### Prioritas 2 — Sambungkan fitur mock ke data nyata ✅ **SEBAGIAN BESAR SELESAI**
- [x] **Dashboard** live dari `/api/user/profile` + `/api/deadlines` (tenggat terdekat nyata, sapaan adaptif, skeleton) — fallback ke contoh saat offline.
- [x] **Workspace / Unggah materi:** unggah nyata ke **Cloudinary** (`/api/upload`) → simpan `Document` (`/api/documents`) → **RAG leksikal** (model `DocumentChunk`, `src/lib/rag.ts`).
- [x] **Outline Generator** kini streaming dari `/api/chat` & adaptif terhadap template kampus.
- [ ] **Prediksi soal ujian:** hasilkan dari dokumen pengguna (masih hardcoded).
- [ ] **Analitik:** agregasi nyata dari `ChatMessage`/`Deadline`/`Flashcard` (masih statis).
- [ ] *Sisa RAG:* pipeline ekstraksi teks biner (PDF/docx/audio) + embedding/vektor.

### Prioritas 3 — Fitur unggulan sesuai spec desain ✅ **SELESAI**
- [x] **Confidence Meter + Panel Sumber** di Tutor AI (RAG): event meta `{sources, confidence}`, `ConfidenceBadge` kini theme-aware.
- [x] **Mode Socratic** dengan indikator persisten "Mode Sokratik aktif".
- [x] **Kolaborasi realtime** via **Pusher** (`/api/collab`, channel `collab-demo`, event doc/vote/task/typing) + fallback mode lokal.
- [x] **Halaman Riset** (`/research`) baru: pencarian, topik populer, jawaban AI mode riset + disclaimer. Ekspor sitasi 4 gaya di `/writing`.
- [ ] *Sisa:* **Penampil PDF** in-app (zoom & lompat halaman); pencarian jurnal eksternal nyata + akses terbuka; presence-auth & persistensi untuk kolaborasi.

### Prioritas 4 — Kualitas & pengalaman
### Prioritas 4 — Kualitas & pengalaman ✅ **SEBAGIAN BESAR SELESAI**
- [x] **PWA dasar:** `src/app/manifest.ts` (installable, theme-color, start_url `/dashboard`). *Sisa: service worker + caching offline + "mode hemat data".*
- [x] **Aksesibilitas:** fokus keyboard terlihat (`:focus-visible`), `prefers-reduced-motion`, label ARIA pada kontrol, target sentuh ≥44px, `aria-current` pada nav aktif. *Sisa: audit kontras WCAG AA menyeluruh.*
- [x] **Font Inter** (sesuai spec) menggantikan Plus Jakarta Sans.
- [x] **Skeleton loader** konsisten di halaman yang fetch (Dashboard, Analitik, Tenggat, dll).
- [x] **Poles UI/UX menyeluruh:** seluruh halaman dimodernkan, layout terstruktur, animasi (`framer-motion` + utilitas `globals.css`), dan **copy ditulis ulang ke bahasa Indonesia baku** (bukan gaya template AI).
- [ ] *Sisa:* notifikasi/pengingat tenggat (in-app/email/push) yang persisten; optimasi gambar WebP + lazy-load; pengujian (unit/integration) — belum ada test runner terpasang.

### Prioritas 5 — Operasional ✅ **SEBAGIAN SELESAI**
- [x] **`.env.local.example`** ditambahkan (tanpa rahasia).
- [x] **CI** GitHub Actions (`.github/workflows/ci.yml`): `tsc` + `next build` pada setiap push/PR.
- [x] **Panduan deploy** `DEPLOYMENT.md` (fokus mengatasi 500 saat daftar/login di Wasmer).
- [ ] *Sisa:* logging & monitoring error (mis. Sentry); pipeline CD otomatis ke host.

---

## 🚑 Catatan Deploy (Wasmer) & Perbaikan 500 saat Daftar/Login

Penyebab umum *Internal Server Error* saat daftar/login di host non-Vercel sudah ditangani:
- **`trustHost: true`** di `src/lib/auth.ts` (mengatasi `UntrustedHost` Auth.js v5).
- **Sesi JWT** — id pengguna disimpan di token, sehingga verifikasi sesi tidak menghubungi DB di setiap request (lebih tahan saat DB lambat/terputus).
- **Endpoint daftar** kini membalas **503 + pesan jelas** bila DB tak terjangkau (bukan 500 buntu), dan koneksi DB gagal-cepat (`serverSelectionTimeoutMS`).

**Wajib dicek di environment Wasmer:** `NEXTAUTH_SECRET` (atau `AUTH_SECRET`), `NEXTAUTH_URL` = URL publik, dan **MongoDB Atlas → Network Access = `0.0.0.0/0`** (host serverless tanpa IP statis). Detail lengkap & langkah diagnosis ada di **[`DEPLOYMENT.md`](./DEPLOYMENT.md)**.

---

<p align="center"><sub>© 2026 EduSparq · Dibuat dengan ❤️ untuk mahasiswa Indonesia</sub></p>
