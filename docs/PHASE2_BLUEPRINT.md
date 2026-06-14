# EduSparq — Blueprint Pengembangan Fase 2

**Peran:** Lead Developer / AI Engineer
**Tanggal:** 14 Juni 2026
**Basis:** PRD Fase 2 (HIMA, Tugas Kelompok Detail, Personalisasi Kampus, Integrasi Google, Analitik Materi)
**Prinsip wajib:** Additive — TIDAK mengubah struktur kode yang sudah ada. Semua bahasa UI = Bahasa Indonesia.

> Dokumen ini adalah peta jalan teknis + desain IA + onboarding. Belum ada kode yang ditulis dari blueprint ini; ini cetak biru yang kita eksekusi bertahap.

---

## 0. STOP-SHIP: yang harus dibereskan SEBELUM Fase 2

| # | Masalah | Dampak | Fix |
|---|---------|--------|-----|
| **P0** | Model Groq `llama3-70b-8192` **sudah di-decommission (30 Agt 2025)**. Dipakai di `chat/route.ts`, `summarize`, `flashcards/generate`, `quiz/generate`, exams predict, research. | **SEMUA fitur AI error di produksi** (`400 model has been decommissioned`). Tutor, ringkasan, flashcard, kuis, prediksi — mati semua. | Ganti ke `llama-3.3-70b-versatile` (context 131k). Sentralisasi ke 1 konstanta `src/lib/ai.ts` biar gak tersebar. Sekalian naikkan cap konteks RAG dari 12k → 24k char. |
| **P0** | Tidak ada konstanta model terpusat — string model di-hardcode di tiap route. | Tiap kali Groq deprecate model, harus edit banyak file. | Buat `src/lib/ai.ts` → `export const AI_MODEL`, `getGroqClient()`, `generateJSON()` helper. Semua route impor dari sini. |
| **P1** | Env wajib di Render belum tentu terisi: `GROQ_API_KEY`, `CLOUDINARY_*`. | Fitur AI & upload diam-diam gagal. | Verifikasi di Render dashboard sebelum rilis Fase 2. Tambah `/api/health` check untuk env penting. |

**Rekomendasi:** P0 dikerjakan dalam 1 commit kecil dulu, deploy, pastikan tutor jalan, baru mulai Fase 2.

---

## 1. RINGKASAN EKSEKUTIF

PRD menambah 5 modul besar, ~24 model, ~11 halaman, 3 integrasi eksternal. Kalau diterjemahkan mentah-mentah → sidebar jadi 21+ menu (kacau), dan ada beberapa **jebakan** yang PRD tak sebut (lihat §10). Sebagai lead dev saya rekomendasikan:

1. **Reconcile, jangan duplikat.** PRD minta model `GroupTask/GroupMember/...` padahal kita SUDAH punya `CollabGroup/CollabTask/CollabDoc/CollabPoll`. Kita extend yang ada, bukan bikin paralel. Modul "Analitik Materi" (PRD 2.5) ~40% sudah jadi sesi lalu (`summarize`, `flashcards/generate`, `quiz/generate`).
2. **IA dirombak ke 6 grup**, bukan 21 tombol. Pakai sidebar bergrup + sub-tab kontekstual + reveal berbasis peran (HIMA hanya muncul kalau user anggota HIMA).
3. **Onboarding wizard + checklist** berbasis data nyata (bukan flag yang gampang basi).
4. **Background worker = jebakan di Render free** (gak ada worker dyno). Solusi: proses on-demand + status, atau Render Cron. Lihat §7.

---

## 2. AUDIT KONDISI SAAT INI

**Halaman (10):** dashboard, workspace, tutor, writing, research, exams, collab, analytics, deadlines, profile.
**Model (13):** User, Course, Document, DocumentChunk, Deadline, Citation, Flashcard, ChatMessage, CollabGroup, CollabTask, CollabDoc, CollabPoll, + (baru sesi lalu) StudyNote, Quiz.
**Sudah jadi sesi lalu (relevan ke PRD 2.5):** ekstraksi PDF/DOCX server-side (`unpdf`+`mammoth`) → auto-index RAG; `/api/documents/[id]/summarize`, `/api/flashcards/generate`, `/api/quiz/generate`, `/api/documents/[id]/extract`.
**Stack:** Next.js 14 App Router, TS, Mongoose, NextAuth v5 (Google+credentials sudah ada), Groq, Cloudinary, Pusher. Deploy Render (auto-deploy `main`, `npm install && npm run build`).

---

## 3. INFORMATION ARCHITECTURE — solusi "sidebar jangan kebanyakan tombol"

### Prinsip
- **Maks 6 destinasi utama** di sidebar, dikelompokkan dengan header section.
- **Sub-navigasi pakai tab** di dalam halaman (bukan nambah item sidebar).
- **Progressive disclosure** — HIMA & fitur lanjutan hanya muncul saat relevan/berbasis peran.
- File halaman lama TIDAK dihapus; kita bungkus dengan grup route + tab. Tidak mengubah struktur, hanya menata navigasi.

### Sidebar baru (bergrup)

```
EduSparq
─────────────────────────
🏠  Beranda                     → /dashboard (overview + checklist onboarding)

BELAJAR
📚  Materi & Analitik           → /workspace  (tab: Dokumen · Ringkasan · Flashcard · Prediksi Soal)
🤖  Asisten AI                  → /assistant  (tab: Tutor · Menulis · Riset)
🎓  Latihan Ujian               → /exams      (tab: Flashcard · Kuis · Prediksi)

PRODUKTIVITAS
🗓️  Tugas & Tenggat            → /deadlines  (tab: Tenggat · Kalender · Kalender Kampus)
👥  Kelompok                    → /collab     (workspace tugas kelompok detail)

ORGANISASI                      (muncul hanya jika user anggota HIMA)
🏛️  HIMA                        → /hima       (sub-nav: Dashboard · Progja · Mentoring · Alumni · Advokasi · Dokumen)
─────────────────────────
⚙️  Profil & Pengaturan         → /profile    (tab: Profil · Kampus · Integrasi Google · Akun)
```

→ **6 item utama + 1 settings**, padahal mencakup ~21 layar. HIMA punya sub-nav sendiri begitu user masuk (sidebar sekunder / tab di dalam halaman HIMA).

### Pemetaan lama → baru

| Halaman lama | Rumah baru |
|---|---|
| dashboard | Beranda (tetap, + checklist onboarding) |
| workspace | Materi & Analitik → tab "Dokumen" |
| (baru) summary/flashcard/prediksi materi | Materi & Analitik → tab lain |
| tutor / writing / research | digabung jadi **Asisten AI** (3 tab) |
| exams | Latihan Ujian (3 tab) |
| deadlines | Tugas & Tenggat → tab "Tenggat" + "Kalender" baru |
| collab | Kelompok (di-upgrade jadi workspace detail) |
| analytics | dilebur: metrik engagement → kartu kecil di Beranda; analitik konten → Materi & Analitik |
| profile | Profil & Pengaturan (4 tab, termasuk Kampus & Google) |

> Catatan: penggabungan tutor/writing/research jadi "Asisten AI" itu perubahan **navigasi**, bukan rewrite — tiap halaman jadi satu tab, kode intinya tetap.

---

## 4. ONBOARDING — "biar user baru gak bingung"

### 4.1 Deteksi user baru
Jangan andalkan satu flag yang gampang basi. **Turunkan status dari data nyata** + 1 flag dismiss:
- `profilDone` = universitas & prodi terisi
- `adaMatkul` = `Course.count > 0`
- `adaMateri` = `Document.count > 0`
- `googleTerhubung` = `User.googleAccessToken` ada
- `himaTerhubung` = ada keanggotaan Organization
- `User.onboardingDismissed` (boolean) → sembunyikan wizard tapi checklist tetap bisa dibuka

### 4.2 Welcome modal (saat pertama login)
Modal bertahap (3–5 langkah), tiap langkah punya tombol CTA yang deep-link:

```
┌─────────────────────────────────────────┐
│  👋 Selamat datang di EduSparq, [Nama]   │
│  Yuk siapkan 3 hal ini biar maksimal:    │
│                                          │
│  ① Lengkapi profil kampus       [Isi →]  │  → /profile?tab=kampus
│     Universitas, Fakultas, Prodi, Smt    │
│  ② Tambah mata kuliah           [Tambah→] │  → /workspace?action=add-course
│  ③ Upload materi pertama (PDF)  [Upload→] │  → /workspace?action=upload
│                                          │
│  Opsional:                               │
│  ④ Hubungkan Google Calendar    [Sambung→]│
│  ⑤ Gabung / buat HIMA           [Buka →]  │
│                                          │
│        [Lewati dulu]   [Mulai ①]         │
└─────────────────────────────────────────┘
```

### 4.3 Checklist persisten di Beranda
Setelah modal ditutup, kartu progress tetap di dashboard sampai semua inti selesai:
`Progress setup: ███░░ 2/3` dengan tiap item bisa diklik → deep-link. Hilang otomatis saat 3 inti beres (atau di-dismiss).

### 4.4 Empty state di mana-mana
Tiap halaman/tab tanpa data → ilustrasi + 1 kalimat + 1 tombol CTA primer (bukan layar kosong membingungkan). Contoh: Materi kosong → "Belum ada materi. Upload PDF/slide kuliahmu, AI akan langsung membacanya." [Upload].

### 4.5 Coachmark ringan (opsional, fase polish)
Tooltip 1x saat pertama buka tiap modul besar (HIMA, Kelompok). Disimpan `User.seenCoachmarks: string[]`.

### 4.6 Model change
`User` + `{ onboardingDismissed: Boolean, seenCoachmarks: [String] }`. Status checklist diturunkan runtime via endpoint `GET /api/user/onboarding`.

---

## 5. BREAKDOWN MODUL

> Tiap modul: tujuan · halaman/tab · komponen · model · API · pemakaian AI · acceptance criteria · estimasi.

### 5.1 MODUL HIMA (`/hima`)
**Tujuan:** ruang digital himpunan — organisasi, progja, mentoring, alumni, advokasi, dokumen.

**Sub-nav (di dalam /hima):** Dashboard · Struktur · Program Kerja · Mentoring · Alumni · Advokasi · Dokumen.

**Komponen:** OrgStructureTree, ProgjaTimeline, MentoringMatcher, AlumniDirectory, AdvocacyTicketBoard, DocVault.

**Model (reconciled):**
| Model | Field inti |
|---|---|
| `Organization` | nama, prodi, fakultas, universitas, visi, misi, logoUrl, joinCode, createdBy |
| `OrganizationMember` | orgId, userId, role (`ketua`/`wakil`/`sekretaris`/`bendahara`/`kadiv`/`anggota`), sectionId, status (`pending`/`active`) |
| `OrganizationSection` | orgId, nama, deskripsi, kepalaUserId |
| `ProgramKerja` | orgId, sectionId, nama, deskripsi, tujuan, mulai, selesai, anggaran, picUserId, status, milestones[] |
| `MentoringSession` | orgId, mentorId, menteeId, courseName, jadwal, status, catatan, materiUrls[] |
| `Alumni` | orgId, nama, tahunLulus, pekerjaan, perusahaan, posisi, kontak, linkedin, bersediaKonsultasi |
| `AdvocacyTicket` | orgId, pelaporId (opsional anonim), kategori, judul, isi, status (`baru`/`diproses`/`selesai`), nomorTiket, handlerUserId, timeline[] |
| `OrganizationDocument` | orgId, sectionId, periode, jenis, judul, fileUrl, uploadedBy |

**API:** `/api/hima/orgs` (create/join/list), `/api/hima/sections`, `/api/hima/progja`, `/api/hima/mentoring`, `/api/hima/alumni`, `/api/hima/advocacy`, `/api/hima/documents` — semua scoped ke keanggotaan + cek role untuk aksi pengurus.

**AI:** opsional — auto-draft notulen/proposal dari template (pakai `generateJSON`).

**AC:** lihat PRD §5.1 (9 kriteria). **Estimasi:** paling besar (3 minggu). Bisa di-fan-out per sub-fitur.

---

### 5.2 TUGAS KELOMPOK DETAIL (`/collab`) — EXTEND, bukan rebuild
**Tujuan:** upgrade kolaborasi dari (grup+task+doc+poll yang sudah ada) → workspace lengkap: kontribusi tracking, shared doc (Google Docs embed), peer review, voting, konflik, chat threaded.

**Reconcile dengan model existing:**
| PRD minta | Keputusan |
|---|---|
| GroupTask, GroupMember | sudah ada `CollabGroup` + `members[]`. **Extend**, jangan bikin baru. |
| GroupTaskItem | extend `CollabTask` + `{ assigneeUserId, bobotKontribusi, status, hasilUrl, deadline }` |
| GroupDocument | model baru `CollabDocLink` { groupId, judul, googleDocUrl, createdBy } (Google Docs embed) |
| GroupVote | sudah ada `CollabPoll`. cukup. |
| GroupReview | model baru `CollabReview` { groupId, targetTaskId, reviewerId, komentar, rating } |
| GroupConflict | model baru `CollabConflict` { groupId, isu, status, riwayat[] } |

**Kontribusi tracking:** dihitung dari `CollabTask` selesai × bobot. Komponen `ContributionTracker` (bar % per anggota, transparan).

**Komponen:** GroupWorkspaceHeader, TaskBoard (assign+bobot), ContributionTracker, GoogleDocsEmbed, PeerReviewPanel, VotingCard (sudah ada), ConflictResolver, ThreadedChat (extend Pusher).

**API:** extend `/api/collab/*`; tambah `/api/collab/reviews`, `/api/collab/conflicts`, `/api/collab/docs` (buat Google Doc via Google Docs API — lihat §6.3).

**AC:** PRD §5.2. **Estimasi:** 2–3 minggu.

---

### 5.3 PERSONALISASI KAMPUS (`/profile?tab=kampus`)
**Tujuan:** sesuaikan pengalaman per kampus/prodi: pemilihan universitas via API, kalender akademik, pedoman penulisan, matkul default, database dosen.

**Komponen:** UniversityPicker (autocomplete → Univ API), AcademicCalendarSync, GuidelinePicker, DefaultCourseSuggester, LecturerDirectory.

**Model:**
| Model | Field |
|---|---|
| `CampusCalendar` | universitas, tahunAjaran, events[] {jenis, judul, mulai, selesai}, sumber (`scrape`/`crowdsource`/`manual`), verified |
| `CampusGuideline` | universitas, margin, spasi, font, ukuranFont, formatHeading, formatDaftarPustaka, rules[], verified |
| `DefaultCourse` | prodi, semester, namaMatkul, sks, jumlahKontributor (threshold crowdsource) |
| `LecturerDatabase` | universitas, prodi, nama, matkulDiampu[], researchInterest, kontak, verified |
| `User` (extend) | `universitasId` (dari API), sudah ada universitas/fakultas/prodi/semester |

**API:** `/api/campus/universities` (proxy ke Univ API + cache), `/api/campus/calendar`, `/api/campus/guideline`, `/api/campus/default-courses`, `/api/campus/lecturers`.

**Integrasi Univ API (terverifikasi):** `GET https://use.api.co.id/regional/indonesia/universities?name=...&size=...` header `x-api-co-id: <key>`. Field: name, short_name, province, regency, lat, long, university_type. **Wajib di-cache** (limit 3000/bln) → simpan hasil pencarian ke koleksi `UniversityCache` 30 hari.

**Efek lintas fitur:** pedoman penulisan auto-dipakai di Asisten AI → Menulis; matkul default muncul di onboarding & Materi.

**AC:** PRD §5.3. **Estimasi:** 2 minggu. **Catatan governance crowdsource:** butuh verifikasi admin → lihat §10.

---

### 5.4 INTEGRASI GOOGLE (`/profile?tab=integrasi`)
**Tujuan:** Calendar sync deadline, Google Docs untuk tugas kelompok, Google OAuth sign-in (sudah ada — tinggal perluas scope).

**Model (extend User):** `googleAccessToken, googleRefreshToken, googleTokenExpiry, connectedGoogleCalendar, connectedGoogleDocs`. `Deadline` + `googleCalendarEventId`.

**Komponen:** GoogleConnectButton, CalendarSyncStatus, ImportEventsModal, GoogleDocsEmbed.

**API:** `/api/google/connect` (OAuth incremental), `/api/google/calendar/sync`, `/api/google/calendar/import`, `/api/google/docs/create`.

**Detail teknis:** §6.

**AC:** PRD §5.4. **Estimasi:** 1.5–2 minggu. **Decision:** sign-in Google sudah jalan via NextAuth; Calendar/Docs butuh scope tambahan + simpan refresh token (NextAuth default JWT tak simpan refresh token → perlu kustomisasi callback / simpan ke User). Lihat §6.

---

### 5.5 ANALITIK MATERI (`/workspace` tab Ringkasan/Flashcard/Prediksi) — ~40% SUDAH JADI
**Tujuan:** analisis konten dokumen → topik, konsep, summary, flashcard otomatis, prediksi soal, rekomendasi belajar.

**Sudah ada (sesi lalu):** ekstraksi PDF/DOCX→RAG, `summarize`, `flashcards/generate`, `quiz/generate`.

**Sisa yang perlu dibangun:**
| Fitur | Model | API |
|---|---|---|
| Content analysis (keyword/konsep/relasi) | `MaterialAnalysis` {documentId, keywords[], concepts[], relations[], contentTypes[], status} | `/api/documents/[id]/analyze` |
| Summary per topik (bukan per dokumen) | `MaterialSummary` {documentId, topic, content} | extend summarize |
| Prediksi soal dari pattern | `QuestionPrediction` {courseName, topik, tipeSoal, kemungkinan} | `/api/courses/[id]/predict` (ganti yang hardcoded — sebagian sudah dibereskan) |
| Rekomendasi belajar | `LearningRecommendation` {userId, topik, alasan, prioritas, jadwal} | `/api/recommendations` |

**AI:** semua via `generateJSON` (model `llama-3.3-70b-versatile`). Analisis = ekstraksi terstruktur dari chunk RAG.
**AC:** PRD §5.5. **Estimasi:** 1.5 minggu (karena fondasi sudah ada).

---

## 6. INTEGRASI EKSTERNAL — detail teknis

### 6.1 Indonesia University Data API ✅ terverifikasi
Base `https://use.api.co.id/regional/indonesia/universities`, header `x-api-co-id`. Limit 3000/bln, 20 req/s. **Wajib cache** (koleksi `UniversityCache`, TTL 30 hari) + debounce autocomplete (min 3 char, 300ms). Fallback: kalau API down, pakai cache; kalau kosong, input manual.

### 6.2 Google Calendar API v3
Scope `https://www.googleapis.com/auth/calendar`. `events.insert/update/delete/list`. Saat buat/edit/hapus Deadline → sinkron event, simpan `googleCalendarEventId`. **Hemat quota:** jangan polling; pakai sync token untuk import. 1jt query/hari (aman).

### 6.3 Google Docs API v1
Scope `documents` + `drive.file`. `documents.create` saat kelompok bikin dokumen baru → share ke anggota (Drive permissions) → simpan URL di `CollabDocLink` → embed iframe. **Decision lead-dev:** untuk MVP, lebih murah & andal pakai **template Google Doc + tombol "Buat salinan"** (link `.../copy`) daripada full Docs API (butuh Drive permission management per anggota). Full API menyusul kalau perlu.

### 6.4 Google OAuth (refresh token)
NextAuth v5 sudah handle sign-in. Untuk Calendar/Docs perlu **offline access + refresh token**. Default JWT NextAuth tak simpan refresh token → tambah `account` callback yang simpan `access_token/refresh_token/expiry` ke `User`. Refresh otomatis saat expiry. Izin diminta **incremental** (saat user klik "Hubungkan", bukan saat login) biar gak nakutin user baru.

### 6.5 Gemini sebagai fallback AI (rekomendasi)
Karena Groq sempat decommission model, bijak punya fallback. `src/lib/ai.ts` → coba Groq dulu, kalau error fallback ke Gemini (`gemini-2.5-flash`, free tier via AI Studio key). Abstraksi 1 fungsi `generateText()/generateJSON()` → route gak peduli provider.

---

## 7. BACKGROUND PROCESSING — jebakan Render free tier ⚠️

PRD §4.2 minta "queue-based worker untuk analisis materi". **Masalah:** Render free tier = web service tunggal yang **spin-down saat idle**, TANPA worker dyno. Worker terus-menerus = tidak gratis.

**Opsi (rekomendasi berurut):**
1. **On-demand synchronous + status** (rekomendasi MVP): analisis jalan saat user klik "Analisis", tampilkan progress, simpan hasil. Sederhana, gratis, sudah pola yang dipakai untuk ekstraksi PDF sekarang. Risiko: dokumen besar → timeout (mitigasi: batasi chunk, proses bertahap di klik).
2. **MongoDB-as-queue + Render Cron Job** (gratis, terjadwal): upload bikin job `status: pending`; Render Cron (mis. tiap 5 menit) proses antrian. Async beneran tanpa worky 24/7.
3. **Vercel/Upstash QStash atau worker berbayar**: kalau sudah scale.

→ Pilih **opsi 1 untuk MVP**, siapkan model `AnalysisJob` agar mudah pindah ke opsi 2 nanti.

---

## 8. RBAC & NOTIFIKASI (gap PRD — lead-dev catch)

### 8.1 Role/permission (PRD menyiratkan, tak mendefinisikan)
- **HIMA:** ketua/wakil/sekretaris/bendahara/kadiv/anggota → matriks izin (siapa boleh kelola progja, approve anggota, dll).
- **Kelompok:** ketua vs anggota (assign task, hapus, resolve konflik).
- Implementasi: helper `can(user, action, resource)` di `src/lib/permissions.ts`. Tiap API cek izin.

### 8.2 Notifikasi (PRD sebut "notifikasi" 6×, tak ada modelnya)
Butuh sistem notifikasi: undangan kelompok, approval HIMA, mentoring, advokasi update, deadline, analisis selesai.
- Model `Notification` {userId, tipe, judul, isi, link, dibaca, createdAt}.
- API `/api/notifications` (list/mark-read). Komponen bell + dropdown di header. Realtime via Pusher (sudah ada).

---

## 9. DAFTAR MODEL — net setelah reconcile

**Baru (~22):** Organization, OrganizationMember, OrganizationSection, ProgramKerja, MentoringSession, Alumni, AdvocacyTicket, OrganizationDocument, CollabDocLink, CollabReview, CollabConflict, CampusCalendar, CampusGuideline, DefaultCourse, LecturerDatabase, UniversityCache, MaterialAnalysis, MaterialSummary, QuestionPrediction, LearningRecommendation, AnalysisJob, Notification.
**Extend:** User (+Google tokens, +onboarding, +seenCoachmarks, +universitasId), Deadline (+googleCalendarEventId), CollabTask (+assignee/bobot/status/hasil), Document (+analysisStatus/analysisResult/analysisCompletedAt).
**Reuse (jangan duplikat):** CollabGroup/Task/Doc/Poll, StudyNote, Quiz, Flashcard.

---

## 10. KEPUTUSAN LEAD-DEV & GAP PRD yang saya tangkap

1. **Model AI mati (P0)** — bukan bagian PRD tapi memblokir semuanya. Fix dulu.
2. **Duplikasi model kelompok** — PRD bikin GroupTask/GroupMember; kita SUDAH punya Collab*. Extend, hindari 2 sumber kebenaran.
3. **Background worker di free tier** — PRD asumsikan worker; realitanya gak gratis. Pakai on-demand/cron.
4. **Sidebar overload** — 21 menu = bingung. Diselesaikan via IA bergrup + tab (§3).
5. **RBAC tak didefinisikan** — wajib untuk HIMA & kelompok (§8.1).
6. **Sistem notifikasi tak ada modelnya** — PRD mengandalkannya berkali-kali (§8.2).
7. **Google Docs full API mahal** — MVP pakai template "Buat salinan" (§6.3).
8. **Refresh token Google** — NextAuth default tak simpan; perlu kustomisasi (§6.4).
9. **Cache Univ API** — limit 3000/bln gampang habis tanpa cache (§6.1).
10. **Governance crowdsource** (kalender/pedoman/dosen) — perlu verifikasi admin + voting akurasi, kalau tidak data jadi sampah. Butuh role admin + antrian moderasi.
11. **Privasi kontribusi tracking** — sebagian mahasiswa risih. Sediakan toggle privasi (PRD §6.2).
12. **Analitik Materi sebagian sudah jadi** — jangan kerjakan ulang; lanjutkan dari yang ada.

---

## 11. URUTAN EKSEKUSI + STRATEGI FAN-OUT AGENT

> Pola sukses sesi sebelumnya: tulis spec kontrak bersama → fan-out agent dengan **kepemilikan file yang tidak tumpang tindih** → verifikasi → push. Build diverifikasi di Render (sandbox blokir `next build`).

| Fase | Isi | Fan-out |
|---|---|---|
| **0. Stop-ship** | `src/lib/ai.ts` (model `llama-3.3-70b-versatile` + Gemini fallback), ganti semua route, naikkan cap RAG | 1 agent kecil, deploy, verifikasi tutor |
| **1. Fondasi** | model dasar + RBAC helper + Notification + IA shell (sidebar bergrup + grup route) + onboarding wizard/checklist | Agent A: model+RBAC+notif · Agent B: IA/nav+onboarding (UI) |
| **2. Personalisasi Kampus** | Univ API proxy+cache, UniversityPicker, kalender, pedoman, matkul default, dosen | Agent C: backend campus · Agent D: frontend profil/kampus |
| **3. Integrasi Google** | OAuth refresh token, Calendar sync, Docs template | Agent E: google backend · Agent F: UI integrasi + deadline sync |
| **4. Tugas Kelompok Detail** | extend Collab*, kontribusi, review, konflik, docs embed, chat threaded | Agent G: backend collab · Agent H: workspace UI |
| **5. HIMA** | 8 model + 7 API + 7 sub-halaman | Agent I: org+progja+sections · Agent J: mentoring+alumni · Agent K: advokasi+dokumen+UI |
| **6. Analitik Materi lanjutan** | analyze, recommendations, prediksi dari pattern | Agent L (fondasi sudah ada) |
| **7. Polish & test** | empty states, coachmarks, mobile, QA, dok | 1–2 agent |

Tiap fase: spec → fan-out → review manual → push ke `main` → verifikasi Render → lanjut.

---

## 12. YANG SAYA BUTUHKAN DARI KAMU (keputusan & kredensial)

**Keputusan:**
1. Setuju **fix P0 (model AI) dulu** sebelum Fase 2? (sangat disarankan)
2. Setuju **IA bergrup 6-menu + gabung tutor/menulis/riset jadi "Asisten AI"**? Atau mau pertahankan tiap halaman terpisah di sidebar?
3. Google Docs: **template "Buat salinan" (cepat)** atau **full Docs API (kompleks)** untuk MVP?
4. Mulai dari mana? Saran saya: **P0 → Fondasi+Onboarding → Personalisasi Kampus** (paling kelihatan dampaknya buat user baru).

**Kredensial yang perlu disiapkan (env Render):**
- `GROQ_API_KEY` (pastikan aktif), opsional `GEMINI_API_KEY` (fallback)
- `API_CO_ID_KEY` (daftar gratis di api.co.id) — untuk Univ API
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` + aktifkan Calendar API & Docs API di Google Cloud Console
- `CLOUDINARY_*`, `PUSHER_*` (sudah dipakai)

---

*Akhir blueprint. Begitu kamu pilih arah di §12, saya susun spec kontrak per fase dan fan-out agent-nya.*
