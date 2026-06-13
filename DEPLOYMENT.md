# Panduan Deploy & Mengatasi "Internal Server Error" saat Daftar/Login

Dokumen ini fokus pada penyebab paling umum error saat **mendaftar / masuk** di lingkungan produksi (Wasmer, Docker, VPS, atau platform self-host lain) dan cara memperbaikinya.

---

## 1. Penyebab utama: `UntrustedHost` (sudah diperbaiki di kode)

NextAuth v5 (Auth.js) **menolak** permintaan dari host yang tidak ia kenali ketika berjalan di belakang proxy (semua platform selain Vercel). Gejalanya: *Internal Server Error* generik saat login/daftar, dengan log server `code: 'UntrustedHost'`.

**Perbaikan (sudah diterapkan):** `src/lib/auth.ts` kini menyetel `trustHost: true`. Sebagai cadangan, Anda juga boleh menyetel env `AUTH_TRUST_HOST=true`.

Referensi: <https://authjs.dev/getting-started/deployment>

---

## 2. Checklist environment variables (paling sering jadi sumber 500)

Pastikan SEMUA ini terisi di dashboard environment Wasmer (bukan hanya di `.env.local` lokal):

| Variabel | Wajib | Catatan |
|----------|:-----:|---------|
| `MONGODB_URI` | ✅ | Harus bisa **dijangkau dari host** (lihat §3). |
| `NEXTAUTH_SECRET` (atau `AUTH_SECRET`) | ✅ | String acak; tanpa ini Auth.js melempar error → 500. |
| `NEXTAUTH_URL` | ✅ (self-host) | URL publik persis, mis. `https://edusparq-namamu.wasmer.app`. |
| `AUTH_TRUST_HOST` | opsional | `true` (sudah dihandle kode, tapi aman untuk diset). |
| `GROQ_API_KEY` | untuk AI | Tutor/Outline/Riset. |
| `GOOGLE_CLIENT_ID/SECRET` | jika pakai Google | Redirect URI: `<NEXTAUTH_URL>/api/auth/callback/google`. |

> Setelah mengubah env di Wasmer, **redeploy** — sebagian platform tidak menerapkan env baru tanpa deploy ulang.

---

## 3. Penyebab kedua: database tidak terjangkau dari host

Endpoint daftar/login menulis ke MongoDB. Jika koneksi gagal, kode kini membalas **503 dengan pesan jelas** ("server tidak dapat terhubung ke database") alih-alih 500 buntu. Jika Anda melihat pesan itu:

1. **MongoDB Atlas → Network Access:** tambahkan `0.0.0.0/0` (Wasmer/serverless tidak punya IP statis untuk di-allowlist).
2. Pastikan `MONGODB_URI` benar (user, password, nama database `edusparq`).
3. Connection string `mongodb+srv://` memerlukan DNS SRV. Jika runtime host bermasalah dengan SRV, gunakan format **non-SRV** (`mongodb://host1,host2/...`) dari Atlas (Connect → "I'll set up my driver" → versi lama).

Kode juga sudah diberi `serverSelectionTimeoutMS: 8000` agar gagal cepat (bukan menggantung sampai gateway timeout 502/504).

---

## 4. Build untuk Wasmer

Aplikasi memakai `output: "standalone"` (lihat `next.config.mjs`) sehingga cocok untuk runtime Node mandiri.

Alur umum (lihat template resmi Wasmer untuk Next.js SSR):

```bash
wasmer deploy        # dijalankan di folder yang berisi wasmer.toml & app.yaml
```

- Untuk app SSR/Server Components, template Wasmer biasanya memakai langkah build `npm run edge:build`.
- Ganti `namespace` di `wasmer.toml` dan `name` di `app.yaml` sesuai akun Anda.
- Sediakan semua env (§2) di `app.yaml` (atau dashboard).

Referensi: <https://docs.wasmer.io/edge/configuration/> · template: <https://wasmer.io/templates/nextjs-starter>

---

## 5. Cara cepat memastikan penyebabnya

- Buka **log runtime** di Wasmer saat mencoba daftar. Cari `UntrustedHost`, `MissingSecret`, atau error koneksi Mongo.
- Coba endpoint daftar langsung:
  ```bash
  curl -i -X POST https://<app>.wasmer.app/api/auth/register \
    -H "Content-Type: application/json" \
    -d '{"name":"Uji","email":"uji@contoh.ac.id","password":"rahasia123"}'
  ```
  - `201` → DB & auth OK.
  - `503` + pesan database → masalah koneksi Mongo (§3).
  - `500` → cek log untuk `UntrustedHost`/secret (§1, §2).
