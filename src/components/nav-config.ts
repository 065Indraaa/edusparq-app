import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Brain,
  PenTool,
  GraduationCap,
  BarChart3,
  Search,
  UserCircle,
  Library,
  ClipboardCheck,
  NotebookPen,
  Wallet,
  Cpu,
  BookOpen,
  Scale,
  Briefcase,
  FileText,
  Target,
  MessageSquareText,
  Send,
  KeyRound,
  Users,
  Building2,
  CalendarRange,
} from "lucide-react";

export type NavChild = {
  name: string;
  href: string;
  icon: LucideIcon;
  desc?: string;
  /** Not shown in sidebar/tabs, but reachable via command palette. */
  hidden?: boolean;
};

export type NavHub = {
  name: string;
  href: string;
  icon: LucideIcon;
  desc?: string;
  children?: NavChild[];
};

/**
 * Consolidated navigation: 7 hubs instead of a long flat menu.
 * Every sub-page lives under one hub; sub-pages render as contextual
 * tabs (SectionTabs) and expand under the active hub in the sidebar.
 */
export const navHubs: NavHub[] = [
  {
    name: "Beranda",
    href: "/dashboard",
    icon: LayoutDashboard,
    desc: "Ringkasan studi & copilot",
  },
  {
    name: "AI Center",
    href: "/ai",
    icon: Cpu,
    desc: "Tutor, agent, memori AI",
    children: [
      { name: "AI Hub", href: "/ai", icon: Cpu, desc: "6 mode AI dalam satu tempat" },
      { name: "Agent Pipeline", href: "/agents", icon: Brain, desc: "Multi-agen untuk tugas kompleks" },
      { name: "Memori AI", href: "/memory", icon: BookOpen, desc: "Pengetahuan yang dipelajari AI" },
      { name: "Tutor Klasik", href: "/tutor", icon: GraduationCap, desc: "Mode tutor lama", hidden: true },
      { name: "AI Dosen", href: "/dosen", icon: Users, desc: "Simulasi dosen penguji", hidden: true },
      { name: "Riset Hukum", href: "/hukum", icon: Scale, desc: "Pencarian pasal & UU", hidden: true },
    ],
  },
  {
    name: "Akademik",
    href: "/workspace",
    icon: GraduationCap,
    desc: "Materi, matkul, KRS, catatan",
    children: [
      { name: "Materi Kuliah", href: "/workspace", icon: FolderOpen, desc: "Basis pengetahuan pintar" },
      { name: "Mata Kuliah", href: "/courses", icon: GraduationCap, desc: "Kelola matkul & SKS" },
      { name: "KRS & Nilai", href: "/krs", icon: ClipboardCheck, desc: "Import KRS, lihat IPK" },
      { name: "Catatan Cerdas", href: "/catatan", icon: NotebookPen, desc: "Rapikan coretan dengan AI" },
      { name: "Jadwal Kuliah", href: "/jadwal", icon: CalendarRange, desc: "Jadwal kelas mingguan", hidden: true },
      { name: "Kolaborasi", href: "/collab", icon: Users, desc: "Kerja kelompok & dokumen bersama", hidden: true },
      { name: "Himpunan", href: "/hima", icon: Building2, desc: "Organisasi & kegiatan kampus", hidden: true },
    ],
  },
  {
    name: "Riset & Pustaka",
    href: "/research",
    icon: Search,
    desc: "Eksplorasi topik & referensi",
    children: [
      { name: "Riset", href: "/research", icon: Search, desc: "Eksplorasi topik + hukum" },
      { name: "Literature Matrix", href: "/research/matrix", icon: BookOpen, desc: "Perbandingan matriks jurnal" },
      { name: "Pustaka Jurusan", href: "/jurusan", icon: Library, desc: "Katalog referensi & template" },
      { name: "Perpustakaan", href: "/library", icon: Library, desc: "Koleksi dokumenmu", hidden: true },
      { name: "Katalog", href: "/katalog", icon: BookOpen, desc: "Cari buku & jurnal", hidden: true },
    ],
  },
  {
    name: "Studio",
    href: "/writing",
    icon: PenTool,
    desc: "Menulis, tenggat, ujian",
    children: [
      { name: "Studio Menulis", href: "/writing", icon: PenTool, desc: "Penelitian, sitasi, dan draf" },
      { name: "Jadwal & Tenggat", href: "/deadlines", icon: CalendarDays, desc: "Kalender dan manajemen tugas" },
      { name: "Persiapan Ujian", href: "/exams", icon: GraduationCap, desc: "Soal latihan dan evaluasi" },
    ],
  },
  {
    name: "Karier",
    href: "/karir",
    icon: Briefcase,
    desc: "Tren, lowongan, CV, wawancara",
    children: [
      { name: "Career Center", href: "/karir", icon: Briefcase, desc: "Tren karir & ringkasan" },
      { name: "Lowongan", href: "/karir/lowongan", icon: Search, desc: "Magang & entry-level" },
      { name: "Skill Gap", href: "/karir/skill-gap", icon: Target, desc: "Analisis kekurangan skill" },
      { name: "CV Builder", href: "/karir/cv", icon: FileText, desc: "CV ATS-friendly dari profilmu" },
      { name: "Wawancara", href: "/karir/wawancara", icon: MessageSquareText, desc: "Latihan interview AI" },
    ],
  },
  {
    name: "Akun",
    href: "/profile",
    icon: UserCircle,
    desc: "Profil, analitik, billing",
    children: [
      { name: "Profil & Keamanan", href: "/profile", icon: UserCircle, desc: "Data diri, Telegram & BYOK" },
      { name: "Analitik Belajar", href: "/analytics", icon: BarChart3, desc: "Lihat pola dan progres" },
      { name: "Billing & Paket", href: "/billing", icon: Wallet, desc: "Saldo credit & langganan" },
      { name: "Pengaturan AI", href: "/settings/ai", icon: KeyRound, desc: "Provider & BYOK", hidden: true },
      { name: "Telegram", href: "/settings/telegram", icon: Send, desc: "Notifikasi Telegram", hidden: true },
    ],
  },
];

export function matchLen(pathname: string, href: string): number {
  if (pathname === href) return href.length + 1;
  if (pathname.startsWith(`${href}/`)) return href.length;
  return 0;
}

/** True when this hub owns the current pathname (itself or any child). */
export function isHubActive(pathname: string, hub: NavHub): boolean {
  if (hub.href === "/dashboard") return pathname === hub.href;
  if (matchLen(pathname, hub.href) > 0) return true;
  return (hub.children ?? []).some((c) => matchLen(pathname, c.href) > 0);
}

/** Finds the hub owning the pathname, if any. */
export function findActiveHub(pathname: string): NavHub | undefined {
  return navHubs.find((hub) => isHubActive(pathname, hub));
}

/** True when this child is the best (longest) match among its siblings. */
export function isChildActive(pathname: string, hub: NavHub, child: NavChild): boolean {
  const len = matchLen(pathname, child.href);
  if (len === 0) return false;
  const best = Math.max(...(hub.children ?? []).map((c) => matchLen(pathname, c.href)));
  return len === best;
}

export type Destination = NavChild & { hub: string };

/** Every reachable destination (for the command palette). */
export const allDestinations: Destination[] = navHubs.flatMap((hub) => {
  if (!hub.children?.length) {
    return [{ name: hub.name, href: hub.href, icon: hub.icon, desc: hub.desc, hub: hub.name }];
  }
  return hub.children.map((c) => ({ ...c, hub: hub.name }));
});
