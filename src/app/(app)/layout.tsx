import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { auth, signOut } from "@/lib/auth";
import {
  LayoutDashboard,
  FolderOpen,
  CalendarDays,
  Bot,
  PenTool,
  Users,
  GraduationCap,
  BarChart3,
  Bell,
  Sparkles,
  LogOut,
  Search,
} from "lucide-react";

const navigation = [
  { name: "Beranda", href: "/dashboard", icon: LayoutDashboard },
  { name: "Materi", href: "/workspace", icon: FolderOpen },
  { name: "Tenggat", href: "/deadlines", icon: CalendarDays },
  { name: "Tutor AI", href: "/tutor", icon: Bot },
  { name: "Nulis", href: "/writing", icon: PenTool },
  { name: "Riset", href: "/research", icon: Search },
  { name: "Kelompok", href: "/collab", icon: Users },
  { name: "Ujian", href: "/exams", icon: GraduationCap },
  { name: "Analitik", href: "/analytics", icon: BarChart3 },
];

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
      <header className="sticky top-0 z-40 w-full glass-panel-solid px-4 py-3 flex items-center justify-between md:hidden shrink-0">
        <Link href="/dashboard" className="flex items-center space-x-2">
          <div className="bg-primary/10 text-primary p-1.5 rounded-lg flex items-center justify-center">
            <Sparkles size={18} />
          </div>
          <span className="font-extrabold text-base tracking-tight text-foreground">EduSparq</span>
        </Link>
        <div className="flex items-center space-x-3">
          <ThemeToggle />
          <button className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center" aria-label="Notifikasi">
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-warning rounded-full ring-2 ring-background" />
          </button>
          {user?.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt={user.name || "User"} className="w-8 h-8 rounded-full border border-border object-cover" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary to-teal-400 flex items-center justify-center font-bold text-xs shadow-sm text-white border border-border select-none cursor-pointer">
              {initials}
            </div>
          )}
        </div>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 glass-panel-solid h-screen sticky top-0 shrink-0 border-r border-border">
        <div className="p-6 border-b border-border flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="bg-primary/10 text-primary p-2 rounded-xl flex items-center justify-center">
              <Sparkles size={20} />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-foreground">EduSparq</span>
          </Link>
          <ThemeToggle />
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto no-scrollbar">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex items-center px-4 py-3 text-sm font-medium text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100 transition-all group"
              >
                <Icon size={18} className="mr-3 text-slate-400 group-hover:text-primary transition-colors" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center space-x-3">
            {user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.image} alt={user.name || ""} className="w-10 h-10 rounded-xl border border-border object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-teal-400 flex items-center justify-center font-bold text-sm shadow-sm text-white select-none">
                {initials}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <span className="font-semibold text-sm text-slate-900 dark:text-slate-200 block truncate">
                {user?.name || "Tamu"}
              </span>
              <span className="text-[10px] text-primary block font-medium truncate">
                {user ? "Mahasiswa" : "Belum login"}
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
                  className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 hover:text-destructive transition-colors"
                  aria-label="Keluar"
                  title="Keluar"
                >
                  <LogOut size={16} />
                </button>
              </form>
            ) : (
              <Link href="/login" className="p-2 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-800 text-primary transition-colors text-xs font-bold">
                Masuk
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto w-full px-4 py-6 md:p-8 pb-24 md:pb-8 flex flex-col min-h-screen bg-slate-50/50 dark:bg-transparent transition-colors duration-300">
        <div className="max-w-6xl w-full mx-auto flex-1 flex flex-col">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 glass-panel border-t border-border px-2 py-2 flex justify-around items-center select-none shadow-glass">
        {navigation.slice(0, 5).map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 py-1 min-h-[48px] text-slate-500 hover:text-primary active:text-primary transition-all"
            >
              <Icon size={20} className="mb-1" />
              <span className="text-[10px] font-medium tracking-tight text-center">{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
