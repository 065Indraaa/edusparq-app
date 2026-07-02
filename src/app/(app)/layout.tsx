import Link from "next/link";
import { ThemeToggle } from "../../components/theme-toggle";
import { SidebarNav, BottomNav } from "../../components/app-nav";
import { CommandPalette } from "../../components/command-palette";
import { CommandPaletteButton } from "../../components/command-palette-button";
import { OnboardingGate } from "../../components/onboarding-gate";
import { NotificationBell } from "../../components/notification-bell";
import { PageTransition } from "../../components/page-transition";
import { auth, signOut } from "../../lib/auth";
import { User } from "../../lib/db/models/User";
import { matchJurusan } from "../../lib/jurusan-catalog";
import {
  Sparkles,
  LogOut,
} from "lucide-react";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await auth();
  const user = session?.user;
  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")
    : "?";

  // Fetch jurusan info untuk badge personalisasi (best-effort).
  let jurusanIcon = "";
  let jurusanName = "";
  let prodiLabel = "";
  try {
    if (user?.id) {
      const dbUser = await User.findById(user.id).select("prodi semester").lean();
      if (dbUser?.prodi) {
        prodiLabel = dbUser.prodi;
        const matched = matchJurusan(dbUser.prodi);
        if (matched) {
          jurusanIcon = matched.icon;
          jurusanName = matched.name;
        }
      }
    }
  } catch {
    /* non-fatal */
  }

  return (
    <div className="app-shell min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      <div className="edus-ambient" aria-hidden="true" />
      {/* Top Header for Mobile */}
      <header className="sticky top-0 z-40 w-full mobile-topbar px-4 py-3 flex items-center justify-between md:hidden shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">

          <img src="/logo.png" alt="EduSparq" className="h-10 w-10 rounded-2xl object-cover shadow-sm" />
          <div className="leading-tight">
            <span className="font-black text-base tracking-tight text-foreground block">EduSparq</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Ruang Belajar</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <CommandPaletteButton />
          <ThemeToggle />
          <NotificationBell />
          {user?.image ? (

            <img src={user.image} alt={user.name || "Pengguna"} className="w-9 h-9 rounded-full border border-border object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-foreground text-background flex items-center justify-center font-bold text-xs shadow-sm border border-border select-none">
              {initials}
            </div>
          )}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="command-sidebar hidden md:flex flex-col w-[17.5rem] h-[calc(100vh-2rem)] my-4 ml-4 rounded-[2rem] sticky top-4 shrink-0 overflow-hidden shadow-md border border-border">
        <div className="relative px-5 pt-5 pb-4 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="group flex items-center gap-3 min-w-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="EduSparq" className="h-12 w-12 rounded-3xl object-cover shadow-sm group-hover:scale-105 transition-transform shrink-0" />
            <div className="min-w-0 leading-tight">
              <span className="font-black text-xl tracking-tight text-foreground truncate block">EduSparq</span>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-muted-foreground">Ruang Belajar</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>

        <SidebarNav />

        <div className="px-3 pb-3 pt-2">
          <div className="user-dock flex items-center gap-3 px-3 py-3">
            {user?.image ? (

              <img src={user.image} alt={user.name || ""} className="w-10 h-10 rounded-xl border border-border object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-foreground text-background flex items-center justify-center font-bold text-sm shadow-sm select-none shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-200 block truncate">
                {user?.name || "Tamu"}
              </span>
              {jurusanName ? (
                <span className="text-[11px] text-primary block font-medium truncate flex items-center gap-1">
                  <span>{jurusanIcon}</span>
                  {jurusanName}
                </span>
              ) : prodiLabel ? (
                <span className="text-[11px] text-primary block font-medium truncate">
                  {prodiLabel}
                </span>
              ) : (
                <span className="text-[11px] text-primary block font-medium truncate">
                  {user ? "Mahasiswa" : "Belum masuk"}
                </span>
              )}
            </div>
            {user ? (
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/login" });
                }}
              >
                <button
                  type="submit"
                  className="rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-destructive transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label="Keluar"
                  title="Keluar"
                >
                  <LogOut size={16} />
                </button>
              </form>
            ) : (
              <Link
                href="/login"
                className="rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-primary transition-colors text-xs font-bold min-w-[44px] min-h-[44px] flex items-center justify-center px-3"
              >
                Masuk
              </Link>
            )}
          </div>
          </div>
      </aside>

      {/* Main Content Area */}
      <main id="main-content" className="edus-main flex-1 overflow-y-auto w-full px-4 py-6 md:px-8 md:py-4 pb-24 md:pb-4 flex flex-col min-h-screen transition-colors duration-300">
        <div className="max-w-screen-2xl w-full mx-auto flex-1 flex flex-col"> 
          <OnboardingGate />
          <PageTransition>
            {children}
          </PageTransition>
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />

      {/* Global ⌘K command palette */}
      <CommandPalette />
    </div>
  );
}
