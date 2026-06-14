"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Bot,
  PenTool,
  Users,
  GraduationCap,
  BarChart3,
  Search,
  UserCircle,
  Building2,
  Library,
  ClipboardCheck,
  Menu,
  X,
  CalendarRange,
  NotebookPen,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
};

export type NavGroup = {
  label: string;
  items: NavItem[];
};

// Grouped navigation. Defined in this Client Component module so the lucide icon
// components never cross the Server -> Client boundary as props (that throws
// "Functions cannot be passed directly to Client Components").
//
// Grouping keeps the sidebar scannable: a handful of labelled sections instead
// of one long flat list of buttons.
export const navGroups: NavGroup[] = [
  {
    label: "Utama",
    items: [{ name: "Beranda", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Belajar",
    items: [
      { name: "Materi", href: "/workspace", icon: FolderOpen },
      { name: "Tutor AI", href: "/tutor", icon: Bot },
      { name: "Menulis", href: "/writing", icon: PenTool },
      { name: "Riset", href: "/research", icon: Search },
      { name: "Katalog", href: "/katalog", icon: Library },
      { name: "Latihan Ujian", href: "/exams", icon: GraduationCap },
      { name: "Dosen Virtual", href: "/dosen", icon: ClipboardCheck },
      { name: "Catatan", href: "/catatan", icon: NotebookPen },
    ],
  },
  {
    label: "Produktivitas",
    items: [
      { name: "Jadwal", href: "/jadwal", icon: CalendarRange },
      { name: "Tugas & Tenggat", href: "/deadlines", icon: CalendarDays },
      { name: "Kelompok", href: "/collab", icon: Users },
    ],
  },
  {
    label: "Organisasi",
    items: [{ name: "HIMA", href: "/hima", icon: Building2 }],
  },
  {
    label: "Akun",
    items: [
      { name: "Analitik", href: "/analytics", icon: BarChart3 },
      { name: "Profil", href: "/profile", icon: UserCircle },
    ],
  },
];

// Flat list (kept for compatibility / any consumer that wants every item).
export const navigation: NavItem[] = navGroups.flatMap((g) => g.items);

// The 5 most-used destinations for the mobile bottom bar.
const mobileNav: NavItem[] = [
  { name: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { name: "Materi", href: "/workspace", icon: FolderOpen },
  { name: "Tutor", href: "/tutor", icon: Bot },
  { name: "Tenggat", href: "/deadlines", icon: CalendarDays },
  { name: "Profil", href: "/profile", icon: UserCircle },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar navigation with grouped command-center sections. */
export function SidebarNav({ groups = navGroups }: { groups?: NavGroup[] }) {
  const pathname = usePathname();

  return (
    <nav className="flex-1 px-3 py-3 space-y-3 overflow-y-auto no-scrollbar">
      {groups.map((group, groupIndex) => (
        <div key={group.label} className="nav-group-card p-2.5" style={{ animationDelay: `${groupIndex * 55}ms` }}>
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-[10px] font-black uppercase tracking-[0.22em] text-muted-foreground/75 select-none">
              {group.label}
            </span>
            <span className="h-px flex-1 ml-3 bg-gradient-to-r from-border to-transparent" />
          </div>
          <div className="space-y-1">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`nav-command group relative flex items-center gap-3 px-2.5 py-2.5 text-sm font-bold rounded-2xl min-h-[46px] overflow-hidden ${
                    active ? "is-active text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="sidebar-active-glow"
                      className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/14 via-primary/8 to-transparent"
                      transition={{ type: "spring", stiffness: 380, damping: 34 }}
                    />
                  )}
                  <span className={`relative grid h-9 w-9 place-items-center rounded-xl border transition-all ${
                    active
                      ? "border-primary/25 bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_hsl(var(--primary))]"
                      : "border-border/70 bg-background/70 text-muted-foreground group-hover:border-primary/25 group-hover:text-primary group-hover:bg-primary/8"
                  }`}>
                    <Icon size={17} strokeWidth={active ? 2.8 : 2.2} />
                  </span>
                  <span className="relative truncate tracking-tight">{item.name}</span>
                  {active && <span className="relative ml-auto h-2 w-2 rounded-full bg-primary shadow-[0_0_18px_hsl(var(--primary))]" />}
                </Link>
              );
            })}
          </div>
        </div>
      ))}
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
                            key={item.name}
                            href={item.href}
                            onClick={() => setMenuOpen(false)}
                            aria-current={active ? "page" : undefined}
                            className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-center transition-colors min-h-[76px] ${
                              active
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-muted/30 text-foreground hover:bg-muted"
                            }`}
                          >
                            <Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
                            <span className="text-[11px] font-semibold leading-tight">{item.name}</span>
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
