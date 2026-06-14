import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { SidebarNav, BottomNav } from "@/components/app-nav"; import { OnboardingGate } from "@/components/onboarding-gate";
import { auth, signOut } from "@/lib/auth";
import {
  Bell,
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
    <div className="min-h-screen flex flex-col md:flex-row bg-background text-foreground transition-colors duration-300">
      {/* Top Header for Mobile */}
      <header className="sticky top-0 z-40 w-full glass-panel-solid px-4 py-3 flex items-center justify-between md:hidden shrink-0 border-b border-border">
        <Link href="/dashboard" className="flex items-center gap-2.5">
          <div className="bg-primary/10 text-primary p-1.5 rounded-lg flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <span className="font-extrabold text-base tracking-tight text-foreground">EduSparq</span>
        </Link>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            className="relative rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Notifikasi"
          >
            <Bell size={18} />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-warning rounded-full ring-2 ring-background" />
          </button>
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
      <aside className="hidden md:flex flex-col w-64 glass-panel-solid h-screen sticky top-0 shrink-0 border-r border-border">
        <div className="px-5 py-5 border-b border-border flex items-center justify-between gap-2">
          <Link href="/dashboard" className="flex items-center gap-3 min-w-0">
            <div className="bg-primary/10 text-primary p-2 rounded-xl flex items-center justify-center shrink-0">
              <Sparkles size={20} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground truncate">EduSparq</span>
          </Link>
          <ThemeToggle />
        </div>

        <SidebarNav />

        <div className="p-3 border-t border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 px-1">
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
      <main className="flex-1 overflow-y-auto w-full px-4 py-6 md:p-8 pb-24 md:pb-8 flex flex-col min-h-screen bg-slate-50/50 dark:bg-transparent transition-colors duration-300">
 <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col"> <OnboardingGate />
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav />
    </div>
  );
}
