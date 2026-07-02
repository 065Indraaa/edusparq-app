"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft, ArrowUp, ArrowDown, Command as CommandIcon } from "lucide-react";
import { allDestinations, navGroups, primaryItem, type NavItem } from "./app-nav";

type Entry = NavItem & { section: string };

const ENTRIES: Entry[] = [
  { ...primaryItem, section: "Utama" },
  ...navGroups.flatMap((g) => g.items.map((it) => ({ ...it, section: g.label }))),
];

function score(entry: Entry, q: string): number {
  const query = q.trim().toLowerCase();
  if (!query) return 1;
  const name = entry.name.toLowerCase();
  const hay = `${name} ${entry.desc ?? ""} ${entry.keywords ?? ""} ${entry.section}`.toLowerCase();
  if (name.startsWith(query)) return 100;
  if (name.includes(query)) return 60;
  // token-wise: every query word must appear somewhere
  const tokens = query.split(/\s+/);
  if (tokens.every((t) => hay.includes(t))) return 30;
  return 0;
}

/**
 * Global ⌘K / Ctrl+K command palette — a single launcher for every destination
 * in the app. Opens via the keyboard shortcut or the `edusparq:command-palette`
 * window event dispatched from the sidebar search button.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const results = useMemo(() => {
    return ENTRIES.map((e) => ({ e, s: score(e, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.e);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setCursor(0);
  }, []);

  const go = useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  // Open triggers: keyboard shortcut + custom event.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onEvt = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("edusparq:command-palette", onEvt as EventListener);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("edusparq:command-palette", onEvt as EventListener);
    };
  }, []);

  // Focus input & reset cursor whenever it opens.
  useEffect(() => {
    if (open) {
      setCursor(0);
      const t = setTimeout(() => inputRef.current?.focus(), 40);
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keep the active row scrolled into view.
  useEffect(() => {
    if (!open) return;
    const el = listRef.current?.querySelector(`[data-idx="${cursor}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [cursor, open]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setCursor((c) => Math.min(c + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setCursor((c) => Math.max(c - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = results[cursor];
      if (target) go(target.href);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-start justify-center bg-black/50 backdrop-blur-sm px-4 pt-[12vh]"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 32 }}
            className="w-full max-w-xl overflow-hidden rounded-3xl border border-border bg-card shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
          >
            <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
              <Search size={18} className="shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Cari fitur, halaman, atau tindakan…"
                className="flex-1 bg-transparent text-[15px] font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
                aria-label="Cari"
              />
              <kbd className="hidden sm:inline-flex items-center gap-1 rounded-md border border-border bg-muted/70 px-1.5 py-1 text-[10px] font-bold text-muted-foreground">
                ESC
              </kbd>
            </div>

            <div ref={listRef} className="max-h-[52vh] overflow-y-auto no-scrollbar p-2">
              {results.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Tidak ada hasil untuk “{query}”.
                </div>
              ) : (
                results.map((entry, idx) => {
                  const Icon = entry.icon;
                  const active = idx === cursor;
                  return (
                    <button
                      key={entry.href}
                      data-idx={idx}
                      type="button"
                      onMouseEnter={() => setCursor(idx)}
                      onClick={() => go(entry.href)}
                      className={`group flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        active ? "bg-primary/10" : "hover:bg-muted/50"
                      }`}
                    >
                      <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl border transition-colors ${
                        active ? "border-primary/30 bg-primary/15 text-primary" : "border-border bg-background/70 text-muted-foreground"
                      }`}>
                        <Icon size={17} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-bold ${active ? "text-primary" : "text-foreground"}`}>
                          {entry.name}
                        </span>
                        {entry.desc && (
                          <span className="block truncate text-[11px] text-muted-foreground">{entry.desc}</span>
                        )}
                      </span>
                      <span className="shrink-0 rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                        {entry.section}
                      </span>
                      {active && <CornerDownLeft size={15} className="shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/25 px-4 py-2.5 text-[11px] font-medium text-muted-foreground">
              <span className="inline-flex items-center gap-1.5">
                <ArrowUp size={12} /> <ArrowDown size={12} /> navigasi
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CornerDownLeft size={12} /> buka
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CommandIcon size={12} /> K buka/tutup
              </span>
              <span className="ml-auto">{results.length} hasil</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
