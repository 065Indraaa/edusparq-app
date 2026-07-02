"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { navHubs, isHubActive, isChildActive, matchLen } from "./nav-config";

/**
 * Desktop sidebar: 7 consolidated hubs. The active hub (or a manually
 * opened one) expands into a tree of its sub-destinations so the sidebar
 * stays short without hiding anything.
 */
export function SidebarNav() {
  const pathname = usePathname();
  const [opened, setOpened] = useState<string | null>(null);

  // Follow route changes: the hub owning the current route is expanded.
  useEffect(() => {
    setOpened(null);
  }, [pathname]);

  return (
    <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto no-scrollbar">
      {navHubs.map((hub, index) => {
        const Icon = hub.icon;
        const active = isHubActive(pathname, hub);
        const visibleChildren = (hub.children ?? []).filter((c) => !c.hidden);
        const expandable = visibleChildren.length > 0;
        const expanded = expandable && (opened === hub.name || (opened === null && active));

        return (
          <div key={hub.name} className="animate-fade-up" style={{ animationDelay: `${index * 40}ms` }}>
            <div
              className={`nav-command group relative flex items-center gap-3 rounded-2xl overflow-hidden ${
                active ? "is-active" : ""
              }`}
            >
              {active && (
                <motion.span
                  layoutId="sidebar-active-glow"
                  className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/14 via-primary/8 to-transparent"
                  transition={{ type: "spring", stiffness: 380, damping: 34 }}
                />
              )}
              <Link
                href={hub.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex flex-1 items-center gap-3 px-2.5 py-2.5 min-h-[52px] text-sm font-bold min-w-0 ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <span
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-all ${
                    active
                      ? "border-primary/25 bg-primary text-primary-foreground shadow-[0_10px_24px_-14px_hsl(var(--primary))]"
                      : "border-border/70 bg-background/70 text-muted-foreground group-hover:border-primary/25 group-hover:text-primary group-hover:bg-primary/8"
                  }`}
                >
                  <Icon size={17} strokeWidth={active ? 2.8 : 2.2} />
                </span>
                <span className="min-w-0 flex-1 leading-tight">
                  <span className="block truncate tracking-tight">{hub.name}</span>
                  {hub.desc && (
                    <span className="mt-0.5 block truncate text-[10px] font-medium tracking-normal text-muted-foreground group-hover:text-foreground/70">
                      {hub.desc}
                    </span>
                  )}
                </span>
              </Link>
              {expandable && (
                <button
                  type="button"
                  onClick={() => setOpened(expanded ? (active ? hub.name + ":closed" : null) : hub.name)}
                  aria-label={expanded ? `Tutup ${hub.name}` : `Buka ${hub.name}`}
                  aria-expanded={expanded}
                  className="relative mr-2 grid h-7 w-7 shrink-0 place-items-center rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors"
                >
                  <ChevronDown
                    size={14}
                    className={`transition-transform duration-200 ${expanded ? "" : "-rotate-90"}`}
                  />
                </button>
              )}
            </div>

            <AnimatePresence initial={false}>
              {expanded && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="relative ml-[1.4rem] mt-1 mb-2 space-y-0.5 border-l border-border/70 pl-3">
                    {visibleChildren.map((child) => {
                      const childActive = isChildActive(pathname, hub, child);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          aria-current={childActive ? "page" : undefined}
                          className={`relative flex items-center gap-2 rounded-xl px-2.5 py-2 text-[13px] font-semibold transition-colors ${
                            childActive
                              ? "bg-primary/10 text-primary"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
                          }`}
                        >
                          {childActive && (
                            <span className="absolute -left-[13px] top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary" />
                          )}
                          <span className="truncate">{child.name}</span>
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
    </nav>
  );
}

/** Mobile bottom navigation: 4 primary hubs + a "Menu" sheet with everything. */
export function BottomNav() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const primary = [navHubs[0], navHubs[2], navHubs[1], navHubs[6]];

  return (
    <>
      <nav className="md:hidden fixed bottom-3 left-3 right-3 z-40 mobile-dock px-2 py-1.5 flex justify-around items-center select-none">
        {primary.map((hub) => {
          const Icon = hub.icon;
          const active = isHubActive(pathname, hub);
          return (
            <Link
              key={hub.name}
              href={hub.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center justify-center flex-1 gap-1 py-1.5 min-h-[52px] rounded-2xl transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-[0_12px_28px_-18px_hsl(var(--primary))]"
                  : "text-muted-foreground hover:text-primary active:text-primary"
              }`}
            >
              <span className={`flex items-center justify-center transition-transform ${active ? "scale-110" : "scale-100"}`}>
                <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              </span>
              <span className={`text-[10px] tracking-tight text-center transition-all ${active ? "font-bold" : "font-medium"}`}>
                {hub.name}
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
                {navHubs.map((hub) => {
                  const items = hub.children?.filter((c) => !c.hidden) ?? [
                    { name: hub.name, href: hub.href, icon: hub.icon, desc: hub.desc },
                  ];
                  return (
                    <div key={hub.name} className="space-y-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                        {hub.name}
                      </span>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((item) => {
                          const Icon = item.icon;
                          const active = matchLen(pathname, item.href) > 0;
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              onClick={() => setMenuOpen(false)}
                              aria-current={active ? "page" : undefined}
                              className={`flex flex-col items-center justify-center gap-1.5 p-3 rounded-2xl border text-center transition-colors min-h-[96px] ${
                                active
                                  ? "border-primary/30 bg-primary/10 text-primary"
                                  : "border-border bg-muted/30 text-foreground hover:bg-muted"
                              }`}
                            >
                              <Icon size={20} className={active ? "text-primary" : "text-muted-foreground"} />
                              <span className="text-[11px] font-bold leading-tight">{item.name}</span>
                              {item.desc && (
                                <span className="text-[9px] leading-tight text-muted-foreground line-clamp-2">{item.desc}</span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
