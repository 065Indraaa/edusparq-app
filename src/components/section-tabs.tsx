"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { findActiveHub, isChildActive } from "./nav-config";

/**
 * Contextual sub-navigation: renders the active hub's sub-pages as a
 * horizontal tab rail at the top of the content area. Keeps deep pages
 * one tap away without inflating the sidebar.
 */
export function SectionTabs() {
  const pathname = usePathname();
  const hub = findActiveHub(pathname);
  const tabs = hub?.children?.filter((c) => !c.hidden) ?? [];
  if (!hub || tabs.length < 2) return null;

  return (
    <div className="section-tabs mb-5 -mx-1 px-1 overflow-x-auto no-scrollbar">
      <div className="inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-card/70 backdrop-blur-md p-1 shadow-sm">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isChildActive(pathname, hub, tab);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={`relative flex items-center gap-1.5 whitespace-nowrap rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {active && (
                <motion.span
                  layoutId="section-tab-pill"
                  className="absolute inset-0 rounded-xl bg-primary shadow-[0_10px_24px_-14px_hsl(var(--primary))]"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              )}
              <Icon size={13} className="relative" strokeWidth={active ? 2.6 : 2.1} />
              <span className="relative">{tab.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
