/**
 * Career data curated from real market research for Indonesian students/fresh graduates.
 *
 * Sources aggregated:
 * - DigitalCV, Apabetul, CNBC Indonesia — "12 Profesi Paling Dicari di Indonesia 2026"
 * - Haibunda, Kompas — fresh graduate job market challenges
 * - LinkedIn Jobs / JobStreet — general job platform trends
 * - WEF Future of Jobs Report 2025 — global AI/data role growth
 * - web3.career Indonesia — Web3/blockchain openings (Pintu, Tokocrypto, NOBI, Ajaib, Binance, Chainalysis, Tether)
 *
 * Data is illustrative and should be refreshed from primary sources regularly.
 */

export interface TrendingRole {
  id: string;
  title: string;
  category: string;
  entrySalary: string;
  demand: "high" | "very-high" | "stable";
  skills: string[];
  majorMatches: string[];
  description: string;
}

export interface CareerTrend {
  year: number;
  topSectors: string[];
  keySkills: string[];
  salaryNote: string;
  sourceNote: string;
}

export const careerTrend2026: CareerTrend = {
  year: 2026,
  topSectors: [
    "Teknologi / Startup / Platform Digital",
    "Perbankan & Keuangan (termasuk Fintech)",
    "BUMN & Instansi Pemerintah",
    "Manufaktur, Ritel & E-commerce",
    "Kesehatan / Health Tech",
    "Energi Terbarukan & Keberlanjutan",
    "Konsultasi Manajemen & Profesional Services",
    "Web3 / Crypto / Blockchain (regulated)",
  ],
  keySkills: [
    "Python",
    "SQL",
    "Data Analysis & Visualization",
    "Machine Learning / AI",
    "Cloud (AWS / GCP / Azure)",
    "Cybersecurity fundamentals",
    "Digital Marketing & Analytics",
    "UI/UX Design",
    "Product Thinking",
    "Bahasa Inggris profesional",
  ],
  salaryNote:
    "Gaji entry-level populer berkisar Rp 6–20 juta/bulan. AI/ML, cybersecurity, dan cloud engineer berada di level atas. Bahasa Inggris + sertifikasi internasional dapat menaikkan gaji 30–60%.",
  sourceNote:
    "Agregasi dari DigitalCV, Apabetul, CNBC Indonesia, Haibunda, Kompas, LinkedIn/JobStreet, WEF Future of Jobs Report 2025, web3.career.",
};

export const trendingRoles: TrendingRole[] = [
  {
    id: "data-analyst",
    title: "Data Analyst",
    category: "Data & Analytics",
    entrySalary: "Rp 8–12 juta/bulan",
    demand: "very-high",
    skills: ["SQL", "Python/R", "Excel", "Tableau/Looker", "Data Storytelling"],
    majorMatches: ["Statistika", "Matematika", "Data Science", "Sistem Informasi", "Teknik Informatika"],
    description:
      "Permintaan tinggi di perbankan, e-commerce, ritel, logistik, dan pemerintahan. Fokus pada pengolahan data menjadi insight bisnis.",
  },
  {
    id: "software-engineer",
    title: "Software Engineer / Full Stack Developer",
    category: "Engineering",
    entrySalary: "Rp 7–12 juta/bulan",
    demand: "very-high",
    skills: ["JavaScript/TypeScript", "React/Vue", "Node.js/Python/Go", "SQL/NoSQL", "Git"],
    majorMatches: ["Teknik Informatika", "Ilmu Komputer", "Sistem Informasi"],
    description:
      "Posisi klasik yang dibutuhkan hampir semua industri. Portofolio proyek nyata jauh lebih bernilai dari sekadar ijazah.",
  },
  {
    id: "ai-ml-engineer",
    title: "AI / Machine Learning Engineer",
    category: "AI & Emerging Tech",
    entrySalary: "Rp 15–30 juta/bulan",
    demand: "very-high",
    skills: ["Python", "TensorFlow/PyTorch", "Statistik", "Pemodelan Prediktif", "LLM API"],
    majorMatches: ["Teknik Informatika", "Statistika", "Matematika", "Data Science"],
    description:
      "Profesi paling langka dan banyak dicari startup hingga BUMN. WEF memproyeksikan pertumbuhan kuat hingga 2030.",
  },
  {
    id: "cybersecurity",
    title: "Cybersecurity Specialist",
    category: "Security",
    entrySalary: "Rp 12–20 juta/bulan",
    demand: "high",
    skills: ["Network Security", "Ethical Hacking", "SIEM", "Cloud Security", "CompTIA Security+ / CEH"],
    majorMatches: ["Teknik Informatika", "Sistem Informasi", "Teknik Elektro"],
    description:
      "Kebutuhan melonjak karena serangan siber berbasis AI dan UU PDP. Sertifikasi internasional sangat membantu.",
  },
  {
    id: "cloud-engineer",
    title: "Cloud Engineer",
    category: "Infrastructure",
    entrySalary: "Rp 10–22 juta/bulan",
    demand: "high",
    skills: ["AWS/Azure/GCP", "Docker", "Kubernetes", "Terraform", "Networking"],
    majorMatches: ["Teknik Informatika", "Sistem Informasi", "Teknik Elektro"],
    description:
      "Seiring migrasi perusahaan ke cloud, role ini dibutuhkan untuk infrastruktur dan DevOps.",
  },
  {
    id: "digital-marketing",
    title: "Digital Marketing Specialist",
    category: "Marketing",
    entrySalary: "Rp 6–15 juta/bulan",
    demand: "high",
    skills: ["SEO/SEM", "Meta & Google Ads", "Marketing Analytics", "A/B Testing", "Content Strategy"],
    majorMatches: ["Manajemen", "Ilmu Komunikasi", "Psikologi", "Sistem Informasi"],
    description:
      "Banyak peluang freelance & kerja jarak jauh. Cocok untuk jalur non-formal dan career switcher.",
  },
  {
    id: "ui-ux-designer",
    title: "UI/UX Designer",
    category: "Design",
    entrySalary: "Rp 7–18 juta/bulan",
    demand: "high",
    skills: ["Figma", "User Research", "Wireframing", "Prototyping", "Design Systems"],
    majorMatches: ["Desain Komunikasi Visual", "Desain Produk", "Teknik Informatika"],
    description:
      "Dibutuhkan di setiap pengembangan produk digital. Portofolio visual sangat penting.",
  },
  {
    id: "product-manager",
    title: "Product Manager (Tech)",
    category: "Product",
    entrySalary: "Rp 12–20 juta/bulan",
    demand: "high",
    skills: ["Product Thinking", "Agile/Scrum", "User Research", "Data-Driven Decisions", "Komunikasi"],
    majorMatches: ["Manajemen", "Teknik Informatika", "Sistem Informasi", "Psikologi"],
    description:
      "Kombinasi bisnis + teknologi. Biasanya membutuhkan pengalaman, tapi entry-level associate PM mulai banyak muncul.",
  },
  {
    id: "business-development",
    title: "Business Development / Sales Digital",
    category: "Business",
    entrySalary: "Rp 7–15 juta/bulan + komisi",
    demand: "stable",
    skills: ["Negotiation", "Digital Channels", "CRM", "Market Research", "Komunikasi"],
    majorMatches: ["Manajemen", "Akuntansi", "Ilmu Komunikasi", "Hubungan Internasional"],
    description:
      "Terbuka untuk jalur non-formal. Komisi bisa menjadi sumber penghasilan signifikan.",
  },
  {
    id: "green-energy",
    title: "Green Energy Specialist",
    category: "Energy & Sustainability",
    entrySalary: "Rp 8–20 juta/bulan",
    demand: "high",
    skills: ["Renewable Energy Systems", "Energy Audit", "Project Management", "ESG Awareness"],
    majorMatches: ["Teknik Elektro", "Teknik Mesin", "Teknik Industri", "Fisika"],
    description:
      "Tumbuh pesat karena transisi energi dan fokus ESG perusahaan.",
  },
  {
    id: "web3-compliance",
    title: "Web3 / Crypto Compliance & Operations",
    category: "Web3 & Blockchain",
    entrySalary: "Rp 6–15 juta/bulan",
    demand: "high",
    skills: ["APU-PPT / KYC", "OJK/Bappebti Regulation", "AML/CFT", "On-chain Analysis", "Bahasa Inggris"],
    majorMatches: ["Hukum", "Akuntansi", "Manajemen", "Teknik Informatika"],
    description:
      "Web3 Indonesia masih aktif merekrut di exchange, compliance, product, dan komunikasi. Fokus regulasi semakin penting.",
  },
  {
    id: "blockchain-developer",
    title: "Blockchain / Smart Contract Developer",
    category: "Web3 & Blockchain",
    entrySalary: "Rp 8–18 juta/bulan",
    demand: "stable",
    skills: ["Solidity / Rust", "Ethereum/EVM", "Smart Contract Security", "DeFi", "Git"],
    majorMatches: ["Teknik Informatika", "Ilmu Komputer", "Sistem Informasi"],
    description:
      "Jumlah lowongan lebih sedikit dari role operasional Web3, tapi kompensasi menarik untuk yang punya portofolio nyata.",
  },
];

export const roleById = Object.fromEntries(trendingRoles.map((r) => [r.id, r]));

export const recommendedCertifications: Record<string, string[]> = {
  "Data Analyst": ["Google Data Analytics Certificate", "Dicoding: Data Analysis with Python", "IBM Data Analyst Professional"],
  "Software Engineer / Full Stack Developer": ["Meta Front-End Developer", "AWS Cloud Practitioner", "freeCodeCamp Full Stack"],
  "AI / Machine Learning Engineer": ["Deep Learning Specialization (Coursera)", "Machine Learning by Andrew Ng", "TensorFlow Developer Certificate"],
  "Cybersecurity Specialist": ["CompTIA Security+", "Certified Ethical Hacker (CEH)", "ISC2 CC"],
  "Cloud Engineer": ["AWS Cloud Practitioner", "Google Cloud Digital Leader", "Microsoft AZ-900"],
  "Digital Marketing Specialist": ["Meta Blueprint", "Google Digital Marketing", "HubSpot Content Marketing"],
  "UI/UX Designer": ["Google UX Design Certificate", "NN/g UX Masterclass", "Interaction Design Specialization"],
  "Product Manager (Tech)": ["Product Management by Google", "Scrum.org PSM I", "Reforge PM Program"],
  "Business Development / Sales Digital": ["HubSpot Sales Software", "Sandler Training", "LinkedIn Sales Navigator"],
  "Green Energy Specialist": ["NABCEP PV Associate", "IRENA Renewable Energy Certificate", "LEED Green Associate"],
  "Web3 / Crypto Compliance & Operations": ["Chainalysis KYT Certification", "ACAMS CAMS (entry awareness)", "Coursera Blockchain Basics"],
  "Blockchain / Smart Contract Developer": ["CryptoZombies Solidity", "Ethereum Developer Bootcamp", "OpenZeppelin Defender"],
};
