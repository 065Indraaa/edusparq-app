"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Bot,
  Brain,
  PenTool,
  Users,
  GraduationCap,
  BarChart3,
  Search,
  UserCircle,
  Library,
  ClipboardCheck,
  Menu,
  X,
  NotebookPen,
  Wallet,
  Cpu,
  Send,
  BookOpen,
  ChevronDown,
  Scale,
  Briefcase,
  FileText,
  Target,
  Mic,
  Building2,
  CalendarRange,
  Command,
  KeyRound,
  Sparkles,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  desc?: string;
  keywords?: string;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

// The single, always-pinned entry point (AI home).
export const primaryItem: NavItem = {
  name: "Copilot",
  href: "/dashboard",
  icon: Bot,
  desc: "Asisten AI & orkestrator akademik",
  keywords: "beranda home chat ai dashboard",
};

// Consolidated navigation. Instead of one long flat list, every destination
// lives in one of six labelled sections. The sidebar shows an accordion where
// only one section is expanded at a time, so the surface stays short and
// scannable while every feature remains one click away (and instantly
// reachable through the ⌘K command palette).
export const navGroups: NavGroup[] = [
  {
    label: "AI Studio",
    icon: Cpu,
    items: [
      { name: "AI Hub", desc: "6 mode: tutor, agent, hukum, riset", href: "/ai", icon: Cpu, keywords: "mode writing dosen" },
      { name: "Agent Pipeline", desc: "Multi-agen untuk tugas kompleks", href: "/agents", icon: Brain, keywords: "orchestrator planner" },
      { name: "Tutor", desc: "Tanya jawab konsep interaktif", href: "/tutor", icon: GraduationCap, keywords: "belajar penjelasan" },
      { name: "Dosen Virtual", desc: "Diskusi mendalam ala dosen", href: "/dosen", icon: Users, keywords: "diskusi" },
      { name: "Memori AI", desc: "Pengetahuan yang dipelajari AI", href: "/memory", icon: BookOpen, keywords: "ingatan preferensi" },
    ],
  },
  {
    label: "Akademik",
    icon: GraduationCap,
    items: [
      { name: "Materi Kuliah", desc: "Basis pengetahuan pintar (RAG)", href: "/workspace", icon: FolderOpen, keywords: "upload pdf docx materi" },
      { name: "Mata Kuliah", desc: "Kelola matkul, SKS & nilai", href: "/courses", icon: GraduationCap, keywords: "matkul sks ipk" },
      { name: "KRS & Nilai", desc: "Import KRS, pantau IPK", href: "/krs", icon: ClipboardCheck, keywords: "ipk transkrip" },
      { name: "Catatan Cerdas", desc: "Rapikan coretan dengan AI", href: "/catatan", icon: NotebookPen, keywords: "notes ringkasan" },
      { name: "Persiapan Ujian", desc: "Soal latihan & evaluasi", href: "/exams", icon: Target, keywords: "quiz latihan srs" },
      { name: "Studio Menulis", desc: "Draf, parafrase, sitasi", href: "/writing", icon: PenTool, keywords: "makalah docx sitasi" },
    ],
  },
  {
    label: "Riset & Referensi",
    icon: Search,
    items: [
      { name: "Riset Akademik", desc: "Eksplorasi topik + jurnal", href: "/research", icon: Search, keywords: "crossref jurnal doi" },
      { name: "Literature Matrix", desc: "Matriks perbandingan jurnal", href: "/research/matrix", icon: BookOpen, keywords: "review literatur" },
      { name: "Pustaka Jurusan", desc: "Template & referensi jurusan", href: "/jurusan", icon: Library, keywords: "katalog referensi" },
      { name: "Riset Hukum", desc: "Cari UU & pasal (Pasal.id)", href: "/hukum", icon: Scale, keywords: "hukum pasal undang" },
      { name: "Pustaka", desc: "Koleksi sumber tersimpan", href: "/library", icon: Library, keywords: "simpanan bookmark" },
    ],
  },
  {
    label: "Rencana",
    icon: CalendarDays,
    items: [
      { name: "Jadwal & Tenggat", desc: "Deadline + prioritas otomatis", href: "/deadlines", icon: CalendarDays, keywords: "tugas deadline kanban" },
      { name: "Jadwal Kuliah", desc: "Kalender kelas mingguan", href: "/jadwal", icon: CalendarRange, keywords: "kalender kelas" },
    ],
  },
  {
    label: "Karier & Kampus",
    icon: Briefcase,
    items: [
      { name: "Career Center", desc: "Tren karir & panduan", href: "/karir", icon: Briefcase, keywords: "karir 2026" },
      { name: "CV Builder", desc: "Generate CV ATS-friendly", href: "/karir/cv", icon: FileText, keywords: "resume lamaran" },
      { name: "Skill Gap", desc: "Analisis skill yang dibutuhkan", href: "/karir/skill-gap", icon: Target, keywords: "kompetensi" },
      { name: "Interview Coach", desc: "Simulasi wawancara + feedback", href: "/karir/wawancara", icon: Mic, keywords: "wawancara interview" },
      { name: "Lowongan", desc: "Lowongan kerja terkurasi", href: "/karir/lowongan", icon: Briefcase, keywords: "kerja magang" },
      { name: "Organisasi", desc: "Kelola HIMA/BEM & proker", href: "/hima", icon: Building2, keywords: "hima bem divisi" },
      { name: "Kolaborasi", desc: "Ruang kerja tim realtime", href: "/collab", icon: Users, keywords: "tim kelompok" },
    ],
  },
  {
    label: "Akun & Pengaturan",
    icon: UserCircle,
    items: [
      { name: "Analitik Belajar", desc: "Pola & progres belajar", href: "/analytics", icon: BarChart3, keywords: "statistik" },
      { name: "Billing & Paket", desc: "Saldo credit & langganan", href: "/billing", icon: Wallet, keywords: "kredit bayar" },
      { name: "Profil & Keamanan", desc: "Data diri & Telegram", href: "/profile", icon: UserCircle, keywords: "akun" },
      { name: "Pengaturan AI", desc: "BYOK & pilihan model", href: "/settings/ai", icon: KeyRound, keywords: "api key model byok" },
      { name: "Telegram Bot", desc: "Hubungkan & notifikasi", href: "/settings/telegram", icon: Send, keywords: "bot notif" },
      { name: "Katalog Kampus", desc: "Data kampus & prodi (PDDIKTI)", href: "/katalog", icon: Building2, keywords: "kampus pddikti" },
    ],
  },
];

// Flat list of every destination (pinned item first). Used by the command
// palette and any consumer that wants the whole map.
export const allDestinations: NavItem[] = [primaryItem, ...navGroups.flatMap((g) => g.items)];

// Backwards-compatible aliases.
export const navigation: NavItem[] = allDestinations;

// The primary destinations for the mobile bottom bar.
const mobileNav: NavItem[] = [
  { name: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { name: "Materi", href: "/workspace", icon: FolderOpen },
  { name: "Karir", href: "/karir", icon: Briefcase },
  { name: "Tenggat", href: "/deadlines", icon: CalendarDays },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function activeSectionLabel(pathname: string): string | null {
  for (const g of navGroups) {
    if (g.items.some((it) => isActive(pathname, it.href))) return g.label;
  }
  return null;
}

/** Fire the global event that opens the ⌘K command palette. */
export function openCommandPalette() {
  window.dispatchEvent(new CustomEvent("edusparq:command-palette"));
}

/** Desktop sidebar: pinned Copilot + a single-open accordion of feature sections. */
export function SidebarNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState<string | null>(() => activeSectionLabel(pathname) ?? navGroups[0].label);

  // Keep the section containing the current route expanded on navigation.
  useEffect(() => {
    const label = activeSectionLabel(pathname);
    if (label) setOpen(label);
  }, [pathname]);

  const PrimaryIcon = primaryItem.icon;
  const primaryActive = isActive(pathname, primaryItem.href);

  return (
    <nav className="flex-1 px-3 pb-2 space-y-3 overflow-y-auto no-scrollbar">
      {/* Command palette launcher */}
      <button
        type="button"
        onClick={openCommandPalette}
        className="w-full flex items-center gap-2.5 rounded-2xl border border-border bg-background/60 px-3 py-2.5 text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-background transition-colors"
      >
        <Search size={16} className="shrink-0" />
        <span className="flex-1 text-left font-medium">Cari fitur…</span>
        <kbd className="hidden lg:inline-flex items-center gap-0.5 rounded-md border border-border bg-muted/70 px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
          <Command size={10} /> K
        </kbd>
      </button>

      {/* Pinned primary destination */}
      <Link
        href={primaryItem.href}
        aria-current={primaryActive ? "page" : undefined}
        className={`group relative flex items-center gap-3 rounded-2xl px-3 py-3 text-sm font-bold transition-colors ${
          primaryActive
            ? "bg-primary text-primary-foreground shadow-[0_14px_30px_-16px_hsl(var(--primary))]"
            : "border border-border bg-card/60 text-foreground hover:border-primary/40"
        }`}
      >
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${primaryActive ? "bg-white/15" : "bg-primary/10 text-primary"}`}>
          <PrimaryIcon size={18} strokeWidth={2.4} />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate">{primaryItem.name}</span>
          <span className={`block truncate text-[10px] font-medium ${primaryActive ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
            {primaryItem.desc}
          </span>
        </span>
        <Sparkles size={15} className={primaryActive ? "text-primary-foreground/90" : "text-primary/70"} />
      </Link>

      {/* Accordion sections */}
      <div className="space-y-1.5 pt-1">
        {navGroups.map((group) => {
          const SectionIcon = group.icon;
          const isOpen = open === group.label;
          const hasActive = group.items.some((it) => isActive(pathname, it.href));
          return (
            <div key={group.label} className="rounded-2xl">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : group.label)}
                aria-expanded={isOpen}
                className={`group w-full flex items-center gap-2.5 rounded-2xl px-2.5 py-2.5 transition-colors ${
                  isOpen ? "bg-muted/50" : "hover:bg-muted/40"
                }`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-xl border transition-colors ${
                  hasActive ? "border-primary/30 bg-primary/10 text-primary" : "border-border bg-background/70 text-muted-foreground group-hover:text-foreground"
                }`}>
                  <SectionIcon size={16} strokeWidth={2.2} />
                </span>
                <span className="flex-1 text-left text-[13px] font-bold tracking-tight text-foreground">
                  {group.label}
                </span>
                {hasActive && !isOpen && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                <ChevronDown
                  size={15}
                  className={`text-muted-foreground/70 transition-transform duration-200 ${isOpen ? "" : "-rotate-90"}`}
                />
              </button>

              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18, ease: "easeOut" }}
                    className="overflow-hidden"
                  >
                    <div className="mt-1 ml-4 space-y-0.5 border-l border-border pl-3 py-1">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            aria-current={active ? "page" : undefined}
                            className={`group relative flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[13px] transition-colors ${
                              active
                                ? "font-bold text-primary"
                                : "font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50"
                            }`}
                          >
                            {active && (
                              <motion.span
                                layoutId="sidebar-active"
                                className="absolute inset-0 rounded-xl bg-primary/10"
                                transition={{ type: "spring", stiffness: 400, damping: 34 }}
                              />
                            )}
                            <Icon size={15} strokeWidth={active ? 2.6 : 2} className="relative shrink-0" />
                            <span className="relative truncate">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** Mobile bottom navigation: 4 primary destinations + a "Menu" sheet with everything. */
export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = mobileNav.slice(0, 4);

  return (
    <>
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 mobile-dock px-2 py-1.5 flex justify-around items-center select-none">
        {primary.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 gap-1 py-1.5 min-h-[52px] rounded-2xl transition-all ${
                active ? "bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_hsl(var(--primary))]" : "text-muted-foreground hover:text-primary active:text-primary"
              }`}
            >
              <span className={`flex items-center justify-center transition-transform ${active ? "scale-110" : "scale-100"}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className={`text-[10px] tracking-tight text-center transition-all ${active ? "font-bold" : "font-medium"}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          aria-label="Buka semua menu"
          className="flex flex-col items-center justify-center flex-1 gap-1 py-1.5 min-h-[52px] rounded-2xl transition-all text-muted-foreground hover:text-primary active:text-primary"
        >
          <span className="flex items-center justify-center">
            <Menu size={20} strokeWidth={2} />
          </span>
          <span className="text-[10px] tracking-tight text-center font-medium">Menu</span>
        </button>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="md:hidden fixed inset-0 z-50 bg-black/55 backdrop-blur-md flex items-end"
            onClick={() => setMenuOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Semua menu"
          >
            <motion.div
              initial={{ y: "100%", scale: 0.98 }}
              animate={{ y: 0, scale: 1 }}
              exit={{ y: "100%", scale: 0.98 }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="w-full bg-card/95 backdrop-blur-2xl border-t border-border rounded-t-[2rem] max-h-[82vh] overflow-y-auto no-scrollbar p-5 pb-8 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-muted" />
              <div className="flex items-center justify-between mb-4">
                <span className="text-base font-extrabold tracking-tight text-foreground">Semua Menu</span>
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Tutup"
                  className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="space-y-5">
                {navGroups.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                      {group.label}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {group.items.map((item) => {
                        const Icon = item.icon;
                        const active = isActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-center transition-colors min-h-[92px] ${
                              active
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
                            <span className="text-[11px] font-bold leading-tight">{item.name}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
