import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav, BottomNav } from "@/components/app-nav"; import { OnboardingGate } from "@/components/onboarding-gate";
import { NotificationBell } from "@/components/notification-bell";
import { auth, signOut } from "@/lib/auth";
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

  return (
    <div className="app-shell min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      <div className="edus-ambient" aria-hidden="true" />
      {/* Top Header for Mobile */}
      <header className="sticky top-0 z-40 w-full mobile-topbar px-4 py-3 flex items-center justify-between md:hidden shrink-0">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="brand-orb h-10 w-10 rounded-2xl flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <div className="leading-tight">
            <span className="font-black text-base tracking-tight text-foreground block">EduSparq</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-primary">Campus OS</span>
          </div>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell />
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name || "Pengguna"} className="w-9 h-9 rounded-full border border-border object-cover" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-teal-400 flex items-center justify-center font-bold text-xs shadow-sm text-white border border-border select-none">
              {initials}
            </div>
          )}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="command-sidebar hidden md:flex flex-col w-[18rem] h-screen sticky top-0 shrink-0">
        <div className="relative px-5 pt-5 pb-4 flex items-center justify-between gap-2">
          <Link href="/dashboard" className="group flex items-center gap-3 min-w-0">
            <div className="brand-orb h-12 w-12 rounded-3xl flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
              <Sparkles size={22} />
            </div>
            <div className="min-w-0 leading-tight">
              <span className="font-black text-xl tracking-tight text-foreground truncate block">EduSparq</span>
              <span className="text-[10px] font-black uppercase tracking-[0.24em] text-primary/80">Campus OS</span>
            </div>
          </Link>
          <div className="flex items-center gap-1">
            <NotificationBell />
            <ThemeToggle />
          </div>
        </div>

        <SidebarNav />

        <div className="px-3 pb-3">
          <div className="sidebar-insight-card p-4 mb-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.22em] text-primary">Next move</span>
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.8)]" />
            </div>
            <p className="mt-2 text-xs font-semibold leading-relaxed text-foreground/80">
              Fokus hari ini: unggah materi, tanya Tutor, lalu buat latihan ujian.
            </p>
          </div>
          <div className="user-dock flex items-center gap-3 px-3 py-3">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name || ""} className="w-10 h-10 rounded-xl border border-border object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-teal-400 flex items-center justify-center font-bold text-sm shadow-sm text-white select-none shrink-0">
                {initials}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-200 block truncate">
                {user?.name || "Tamu"}
              </span>
              <span className="text-[11px] text-primary block font-medium truncate">
                {user ? "Mahasiswa" : "Belum masuk"}
              </span>
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
      <main id="main-content" className="edus-main flex-1 overflow-y-auto w-full px-4 py-6 md:p-8 pb-24 md:pb-8 flex flex-col min-h-screen transition-colors duration-300">
        <div className="max-w-screen-2xl w-full mx-auto flex-1 flex flex-col animate-fade-up"> <OnboardingGate />
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
