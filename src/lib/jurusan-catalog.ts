/**
 * Jurusan Catalog — data terstruktur 4 fakultas × ~15 jurusan populer.
 *
 * Setiap jurusan punya:
 *   - keywords: alias/ sinonim untuk matching (case-insensitive substring)
 *   - icon: emoji untuk UI
 *   - color: tailwind color class untuk badge
 *   - description: deskripsi singkat jurusan
 *   - promptContext: blok instruksi yang diinjeksi ke sistem AI saat user
 *     dari jurusan ini bertanya — membantu AI menyesuaikan contoh, analogi,
 *     terminologi, dan depth.
 *   - popularCourses: template mata kuliah populer per semester (opsional)
 */

export interface JurusanEntry {
  id: string;
  name: string;
  fakultasId: string;
  fakultasName: string;
  keywords: string[];
  icon: string;
  color: string;
  description: string;
  /** Diinjeksi sebagai blok konteks tambahan di sistem prompt AI. */
  promptContext: string;
  /** Template mata kuliah populer [semester, namaMatkul, sks]. */
  popularCourses?: [number, string, number][];
}

export interface FakultasEntry {
  id: string;
  name: string;
  icon: string;
  color: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// FAKULTAS
// ─────────────────────────────────────────────────────────────────────────────

export const FAKULTAS: FakultasEntry[] = [
  { id: "fti", name: "Teknik & Informatika", icon: "⚙️", color: "text-cyan-600 dark:text-cyan-400" },
  { id: "feb", name: "Ekonomi & Bisnis", icon: "📊", color: "text-amber-600 dark:text-amber-400" },
  { id: "fhukum", name: "Hukum", icon: "⚖️", color: "text-rose-600 dark:text-rose-400" },
  { id: "fmipa", name: "MIPA & Ilmu Alam", icon: "🔬", color: "text-emerald-600 dark:text-emerald-400" },
];

// ─────────────────────────────────────────────────────────────────────────────
// JURUSAN
// ─────────────────────────────────────────────────────────────────────────────

export const JURUSAN: JurusanEntry[] = [
  // ─── TEKNIK & INFORMATIKA ─────────────────────────────────────────────────
  {
    id: "ti",
    name: "Teknik Informatika",
    fakultasId: "fti",
    fakultasName: "Teknik & Informatika",
    keywords: ["informatika", "ilmu komputer", "computer science", "teknik informasi", "sistem informasi", "teknik komputer", "sains data", "data science"],
    icon: "💻",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    description: "Algoritma, pemrograman, basis data, jaringan, AI, software engineering",
    promptContext: `KONTEKS JURUSAN — Teknik Informatika:
- Bahasa utama: Python, Java, JavaScript/TypeScript, C++, SQL
- Paradigma: OOP, functional, event-driven
- Istilah umum: algoritma, big-O, stack/queue/tree/graph, API, REST, MVC, CI/CD, git, framework (React, Next.js, Spring, Django, Laravel)
- Gaya jawaban: sertakan pseudocode atau contoh kode bila relevan. Gunakan analogi teknologi yang relatable untuk mahasiswa IT.
- Format output: gunakan code block dengan syntax highlight bila menjelaskan kode.`,
    popularCourses: [
      [1, "Pengantar Algoritma & Pemrograman", 3],
      [1, "Matematika Diskrit", 3],
      [1, "Fisika Dasar", 2],
      [2, "Struktur Data", 3],
      [2, "Basis Data", 3],
      [2, "Pemrograman Berorientasi Objek", 3],
      [3, "Jaringan Komputer", 3],
      [3, "Sistem Operasi", 3],
      [3, "Rekayasa Perangkat Lunak", 3],
      [4, "Kecerdasan Buatan", 3],
      [4, "Pemrosesan Citra", 3],
      [4, "Pemrograman Web", 3],
      [5, "Machine Learning", 3],
      [5, "Keamanan Informasi", 3],
      [5, "Proyek Perangkat Lunak", 4],
      [6, "Cloud Computing", 3],
      [6, "Data Engineering", 3],
      [7, "Tugas Akhir / Skripsi", 6],
    ],
  },
  {
    id: "si",
    name: "Sistem Informasi",
    fakultasId: "fti",
    fakultasName: "Teknik & Informatika",
    keywords: ["sistem informasi", "information system", "management informasi", "sistem informasi bisnis"],
    icon: "🗃️",
    color: "bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20",
    description: "Analisis sistem, basis data, ERP, manajemen proyek IT, business intelligence",
    promptContext: `KONTEKS JURUSAN — Sistem Informasi:
- Fokus: perancangan sistem informasi, analisis kebutuhan, ERD, DFD, UML
- Tools umum: Visio/Draw.io (diagram), MySQL/PostgreSQL, SAP, ERP
- Gaya jawaban: tekankan aspek bisnis dan proses. Bila menjelaskan sistem, gunakan pendekatan input-proses-output.
- Istilah kunci: requirement elicitation, use case, CRUD, normalization, waterfall, agile, scrum`,
    popularCourses: [
      [1, "Pengantar Sistem Informasi", 3],
      [1, "Algoritma & Pemrograman", 3],
      [2, "Basis Data", 3],
      [2, "Analisis Sistem Informasi", 3],
      [3, "Perancangan Sistem Informasi", 3],
      [3, "Manajemen Proyek", 3],
      [4, "Enterprise Resource Planning", 3],
      [4, "E-Commerce", 3],
      [5, "Business Intelligence", 3],
      [5, "Audit Sistem Informasi", 3],
      [7, "Tugas Akhir / Skripsi", 6],
    ],
  },
  {
    id: "te",
    name: "Teknik Elektro",
    fakultasId: "fti",
    fakultasName: "Teknik & Informatika",
    keywords: ["elektro", "electrical", "teknik elektro", "teknik listrik"],
    icon: "⚡",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Rangkaian listrik, elektronika, kontrol, telekomunikasi, tenaga listrik",
    promptContext: `KONTEKS JURUSAN — Teknik Elektro:
- Fokus: rangkaian listrik, elektronika analog/digital, sinyal, kontrol, telekomunikasi
- Istilah umum: tegangan, arus, impedansi, transistor, op-amp, filter, Fourier, Laplace, PLC, mikrokontroler
- Gaya jawaban: sertakan rumus dan perhitungan bila relevan. Gunakan diagram teks sederhana bila menjelaskan rangkaian.
- Satuan standar: Volt, Ampere, Ohm, Farad, Henry, Watt`,
  },
  {
    id: "tsipil",
    name: "Teknik Sipil",
    fakultasId: "fti",
    fakultasName: "Teknik & Informatika",
    keywords: ["sipil", "civil", "teknik sipil", "struktur", "konstruksi"],
    icon: "🏗️",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Struktur beton, mekanika tanah, hidrolika, manajemen konstruksi, transportasi",
    promptContext: `KONTEKS JURUSAN — Teknik Sipil:
- Fokus: analisis struktur, mekanika tanah, hidrolika, material bangunan, manajemen proyek konstruksi
- Istilah umum: momen lentur, gaya geser, tegangan, regangan, beton bertulang, pondasi, RAB, SNI
- Gaya jawaban: sertakan perhitungan engineering bila relevan. Rujuk standar SNI bila memungkinkan.
- Satuan standar: kN, MPa, m³, kg/cm²`,
  },

  // ─── EKONOMI & BISNIS ─────────────────────────────────────────────────────
  {
    id: "manajemen",
    name: "Manajemen",
    fakultasId: "feb",
    fakultasName: "Ekonomi & Bisnis",
    keywords: ["manajemen", "management", "administrasi bisnis", "business administration"],
    icon: "📈",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Manajemen SDM, pemasaran, keuangan, operasional, strategi bisnis",
    promptContext: `KONTEKS JURUSAN — Manajemen:
- Fokus: perencanaan, pengorganisasian, pengarahan, pengendalian organisasi bisnis
- Teori utama: Taylor, Fayol, McGregor, Porter (5 Forces), SWOT, BSC, Balanced Scorecard
- Istilah umum: KPI, ROI, NPV, IRR, cash flow, marketing mix (4P/7P), supply chain, CRM
- Gaya jawaban: gunakan studi kasus perusahaan nyata sebagai contoh. Tekankan implikasi praktis.
- Format: bila analisis strategis, gunakan framework (SWOT, Porter, TOWS) secara eksplisit.`,
    popularCourses: [
      [1, "Pengantar Manajemen", 3],
      [1, "Pengantar Akuntansi", 3],
      [1, "Matematika Ekonomi", 3],
      [2, "Manajemen SDM", 3],
      [2, "Manajemen Pemasaran", 3],
      [3, "Manajemen Keuangan", 3],
      [3, "Manajemen Operasional", 3],
      [4, "Manajemen Strategik", 3],
      [4, "Kewirausahaan", 3],
      [5, "Etika Bisnis", 2],
      [5, "Bisnis Digital", 3],
      [7, "Skripsi", 6],
    ],
  },
  {
    id: "akuntansi",
    name: "Akuntansi",
    fakultasId: "feb",
    fakultasName: "Ekonomi & Bisnis",
    keywords: ["akuntansi", "accounting", "akuntan"],
    icon: "📒",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Akuntansi keuangan, manajemen, perpajakan, auditing, PSAK/IFRS",
    promptContext: `KONTEKS JURUSAN — Akuntansi:
- Standar acuan: PSAK (Indonesia), IFRS (internasional)
- Istilah umum: jurnal umum, buku besar, neraca saldo, laporan laba/rugi, arus kas, akrual, depreciation
- Jenis: akuntansi keuangan, akuntansi biaya, akuntansi manajemen, auditing, perpajakan
- Gaya jawaban: sertakan contoh jurnal (debet/kredit) bila menjelaskan transaksi. Rujuk PSAK bila relevan.
- Catatan: jelaskan perbedaan treatment akuntansi antar kasus secara eksplisit.`,
    popularCourses: [
      [1, "Pengantar Akuntansi 1", 3],
      [2, "Pengantar Akuntansi 2", 3],
      [2, "Akuntansi Biaya", 3],
      [3, "Akuntansi Keuangan Menengah", 3],
      [3, "Perpajakan", 3],
      [4, "Akuntansi Manajemen", 3],
      [4, "Auditing", 3],
      [5, "Akuntansi Keuangan Lanjutan", 3],
      [5, "Sistem Informasi Akuntansi", 3],
      [7, "Skripsi", 6],
    ],
  },
  {
    id: "ekonomi",
    name: "Ekonomi Pembangunan",
    fakultasId: "feb",
    fakultasName: "Ekonomi & Bisnis",
    keywords: ["ekonomi", "economics", "ekonomi pembangunan", "ekonomi syariah"],
    icon: "💰",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Mikroekonomi, makroekonomi, ekonometrika, kebijakan publik, pembangunan",
    promptContext: `KONTEKS JURUSAN — Ekonomi Pembangunan:
- Teori utama: Keynes, Friedman, Solow, Harrod-Domar, Lewis, endogenous growth
- Istilah umum: GDP, inflasi, pengangguran, multiplier, elastisitas, comparative advantage, FDI
- Alat: ekonometrika (regresi, OLS), analisis kebijakan publik, cost-benefit analysis
- Gaya jawaban: gunakan data Indonesia sebagai contoh bila relevan. Sertakan persamaan ekonomi bila menjelaskan teori.
- Konteks: mahasiswa Indonesia — fokus pada ekonomi emerging market dan kebijakan Indonesia.`,
  },
  {
    id: "bisnisdigital",
    name: "Bisnis Digital",
    fakultasId: "feb",
    fakultasName: "Ekonomi & Bisnis",
    keywords: ["bisnis digital", "digital business", "e-commerce", "digital marketing", "startup"],
    icon: "🚀",
    color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    description: "Digital marketing, e-commerce, business model canvas, startup, data analytics bisnis",
    promptContext: `KONTEKS JURUSAN — Bisnis Digital:
- Framework: Business Model Canvas, Lean Startup, Design Thinking, Growth Hacking
- Platform: marketplace (Tokopedia, Shopee), social media marketing, content marketing
- Istilah umum: conversion rate, customer acquisition, MVP, pivot, A/B testing, funnel
- Gaya jawaban: gunakan contoh startup/platform digital Indonesia. Tekankan actionable strategy.
- Fokus: model bisnis digital, go-to-market strategy, user acquisition, monetization.`,
  },

  // ─── HUKUM ────────────────────────────────────────────────────────────────
  {
    id: "hukum",
    name: "Ilmu Hukum",
    fakultasId: "fhukum",
    fakultasName: "Hukum",
    keywords: ["hukum", "law", "ilmu hukum", "hukum bisnis", "hukum pidana", "hukum perdata"],
    icon: "⚖️",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    description: "Hukum perdata, pidana, administrasi negara, HTN, hukum internasional, hukum bisnis",
    promptContext: `KONTEKS JURUSAN — Ilmu Hukum:
- Sistem hukum Indonesia: civil law, Pancasila sebagai sumber segala sumber hukum
- Hierarki peraturan: UUD 1945 → UU → PP → Peraturan Daerah
- Kitab Undang-Undang utama: KUHPerdata (Burgerlijk Wetboek), KUHP, KUHAP, UU PT
- Metode: penafsiran hukum (gramatikal, teleologis, historis, sistematis)
- Gaya jawaban: rujuk pasal/kitab undang-undang spesifik bila relevan. Sertakan yurisprudensi MA bila memungkinkan.
- Format: analisis kasus menggunakan IRAC (Issue, Rule, Application, Conclusion) atau fakta-berdasarkan-analisis.`,
    popularCourses: [
      [1, "Pengantar Ilmu Hukum", 3],
      [1, "Hukum Tata Negara", 3],
      [2, "Hukum Perdata", 4],
      [2, "Hukum Pidana", 4],
      [3, "Hukum Administrasi Negara", 3],
      [3, "Hukum Internasional", 3],
      [4, "Hukum Dagang", 3],
      [4, "Hukum Acara", 3],
      [5, "Hukum Lingkungan", 3],
      [5, "Hukum Siber", 2],
      [6, "Hukum Hak Kekayaan Intelektual", 3],
      [7, "Skripsi", 6],
    ],
  },

  // ─── MIPA & ILMU ALAM ────────────────────────────────────────────────────
  {
    id: "matematika",
    name: "Matematika",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["matematika", "mathematics", "matematika murni", "matematika terapan", "statistika", "aktuaria"],
    icon: "📐",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Kalkulus, aljabar linear, statistika, matematika diskrit, analisis numerik",
    promptContext: `KONTEKS JURUSAN — Matematika:
- Bahasa: notasi matematika formal (Σ, ∫, ∂, ∀, ∃, ∈, ⊂, →)
- Area utama: aljabar (grup, ring, field), analisis (kalkulus, real/complex analysis), statistika & probabilitas
- Gaya jawaban: sertakan derivasi langkah demi langkah bila menjelaskan teorema atau bukti. Gunakan notasi LaTeX bila perlu (tulis sebagai teks bold: **f(x) = ∫₀¹ x² dx**).
- Format: proof → tulis secara runtut (Given → Assume → Therefore). Problem solving → step-by-step.`,
  },
  {
    id: "fisika",
    name: "Fisika",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["fisika", "physics", "fisika murni", "fisika terapan"],
    icon: "🌟",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Mekanika, termodinamika, optika, kuantum, elektromagnetik, fisika komputasi",
    promptContext: `KONTEKS JURUSAN — Fisika:
- Hukum fundamental: Newton, Maxwell, termodinamika, relativitas, mekanika kuantum
- Gaya jawaban: sertakan persamaan dan dimensi satuan. Bila perhitungan, tulis langkah-langkah eksplisit.
- Satuan SI standar: kg, m, s, K, A, mol, cd. Prefiks: μ, m, k, M, G.
- Analogi: gunakan fenomena fisika sehari-hari untuk penjelasan konsep.`,
  },
  {
    id: "kimia",
    name: "Kimia",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["kimia", "chemistry", "kimia murni", "kimia analitik", "kimia organik"],
    icon: "🧪",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Kimia organik, anorganik, fisika, analitik, biokimia",
    promptContext: `KONTEKS JURUSAN — Kimia:
- Cabang: kimia organik, anorganik, fisika, analitik, biokimia
- Gaya jawaban: sertakan reaksi kimia (reaktan → produk) bila relevan. Gunakan nama IUPAC bila menyebut senyawa.
- Satuan: mol, L, g/mol, M (molaritas), ppm.
- Tekankan mekanisme reaksi (arrow-pushing) bila menjelaskan kimia organik.`,
  },
  {
    id: "biologi",
    name: "Biologi",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["biologi", "biology", "ilmu biologi", "biologi murni", "mikrobiologi", "genetika"],
    icon: "🧬",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Biologi sel, genetika, ekologi, fisiologi, mikrobiologi, biologi molekuler",
    promptContext: `KONTEKS JURUSAN — Biologi:
- Area: sel, genetika (Mendel, DNA, RNA), evolusi, ekologi, fisiologi, mikrobiologi
- Gaya jawaban: gunakan terminologi biologi standar (nama ilmiah Latin bila relevan). Sertakan diagram siklus/proses bila menjelaskan mekanisme.
- Klasifikasi: domain → kingdom → filum → kelas → ordo → famili → genus → spesies.
- Fokus: mekanisme proses biologis (bukan deskripsi permukaan).`,
  },
  {
    id: "farmasi",
    name: "Farmasi",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["farmasi", "pharmacy", "farmakologi", "ilmu kefarmasian"],
    icon: "💊",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Farmakologi, kimia farmasi, formulasi, farmakognosi, farmakoterapi",
    promptContext: `KONTEKS JURUSAN — Farmasi:
- Area: farmakologi (mekanisme obat, interaksi), kimia farmasi, formulasi sediaan, farmakognosi
- Istilah umum: bioavailabilitas, half-life, dosis, kontraindikasi, efek samping, galenik
- Gaya jawaban: rujuk mekanisme kerja obat secara molekuler bila relevan. Sertakan interaksi obat bila membahas farmakoterapi.
- Catatan: semua rekomendasi bersifat edukatif, bukan resep medis.`,
  },
  {
    id: "kedokteran",
    name: "Pendidikan Dokter",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["kedokteran", "dokter", "medicine", "medical", "pendidikan dokter", "kedokteran umum"],
    icon: "🩺",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    description: "Anatomi, fisiologi, patologi, farmakologi klinis, diagnosis",
    promptContext: `KONTEKS JURUSAN — Pendidikan Dokter:
- Area: anatomi, fisiologi, biokimia klinis, patologi, farmakologi, mikrobiologi klinis, diagnosis
- Pendekatan: clinical reasoning — anamnesis → pemeriksaan → diagnosis diferensial → diagnosis → tata laksana
- Gaya jawaban: gunakan pendekatan evidence-based medicine. Sertakan guideline/standar bila relevan.
- CATATAN PENTING: Semua informasi bersifat edukatif untuk mahasiswa kedokteran. Bukan untuk self-diagnosis atau pengganti konsultasi dokter.`,
  },
  {
    id: "psikologi",
    name: "Psikologi",
    fakultasId: "fmipa",
    fakultasName: "MIPA & Ilmu Alam",
    keywords: ["psikologi", "psychology", "ilmu psikologi"],
    icon: "🧠",
    color: "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
    description: "Psikologi umum, klinis, pendidikan, industri-organisasi, perkembangan",
    promptContext: `KONTEKS JURUSAN — Psikologi:
- Aliran: behaviorisme, kognitif, psikoanalisis, humanistik, biologis
- Metode: eksperimen, survei, studi kasus, observasi, wawancara klinis
- Tes: IQ, kepribadian (MMPI, MBTI, Big Five), aptitude, proyektif
- Gaya jawaban: bedakan antara teori, temuan empiris, dan opini klinis secara eksplisit.
- Catatan: semua konten bersifat edukatif. Bukan untuk self-diagnosis gangguan psikologis.`,
    popularCourses: [
      [1, "Psikologi Umum", 3],
      [1, "Statistika Psikologi", 3],
      [2, "Psikologi Perkembangan", 3],
      [2, "Psikologi Sosial", 3],
      [3, "Psikologi Klinis", 3],
      [3, "Psikologi Kepribadian", 3],
      [4, "Psikologi Industri & Organisasi", 3],
      [4, "Metode Penelitian", 3],
      [5, "Psikologi Abnormal", 3],
      [5, "Psikologi Pendidikan", 3],
      [7, "Skripsi", 6],
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Match prodi string (dari PDDIKTI atau input manual user) ke JurusanEntry.
 * Menggunakan substring match case-insensitive pada keywords.
 * Returns null jika tidak ditemukan.
 */
export function matchJurusan(prodi: string): JurusanEntry | null {
  if (!prodi) return null;
  const p = prodi.toLowerCase().trim();

  // Direct exact match on name first
  const exact = JURUSAN.find((j) => j.name.toLowerCase() === p);
  if (exact) return exact;

  // Substring match on keywords
  for (const j of JURUSAN) {
    if (j.keywords.some((kw) => p.includes(kw) || kw.includes(p))) {
      return j;
    }
  }

  return null;
}

/**
 * Get all jurusan entries for a specific fakultas.
 */
export function getJurusanByFakultas(fakultasId: string): JurusanEntry[] {
  return JURUSAN.filter((j) => j.fakultasId === fakultasId);
}

/**
 * Get prompt context for a specific prodi string.
 * Returns empty string if no match.
 */
export function getJurusanPromptContext(prodi: string): string {
  const jurusan = matchJurusan(prodi);
  return jurusan?.promptContext ?? "";
}

/**
 * Get popular courses for a specific prodi string.
 */
export function getPopularCourses(prodi: string): [number, string, number][] {
  const jurusan = matchJurusan(prodi);
  return jurusan?.popularCourses ?? [];
}
