"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, CornerDownLeft } from "lucide-react";
import { allDestinations, type Destination } from "./nav-config";

function score(dest: Destination, query: string): number {
  const q = query.toLowerCase().trim();
  if (!q) return 1;
  const name = dest.name.toLowerCase();
  const desc = (dest.desc ?? "").toLowerCase();
  const hub = dest.hub.toLowerCase();
  if (name.startsWith(q)) return 100;
  if (name.includes(q)) return 60;
  if (hub.includes(q)) return 30;
  if (desc.includes(q)) return 20;
  // Loose subsequence match on the name (e.g. "krs" -> "KRS & Nilai").
  let i = 0;
  for (const ch of name) if (ch === q[i]) i++;
  return i === q.length ? 10 : 0;
}

/**
 * Global command palette (Ctrl+K / Cmd+K): fuzzy search over every
 * destination in the app, including pages not shown in the sidebar.
 */
export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => {
    return allDestinations
      .map((d) => ({ d, s: score(d, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .map((r) => r.d)
      .slice(0, 12);
  }, [query]);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setSelected(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      } else if (e.key === "Escape") {
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    setSelected(0);
  }, [query]);

  const go = useCallback(
    (dest: Destination) => {
      close();
      router.push(dest.href);
    },
    [close, router]
  );

  const onInputKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelected((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelected((s) => Math.max(s - 1, 0));
    } else if (e.key === "Enter" && results[selected]) {
      e.preventDefault();
      go(results[selected]);
    }
  };

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-index="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-sm flex items-start justify-center px-4 pt-[14vh]"
          onClick={close}
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian cepat"
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="w-full max-w-lg rounded-3xl border border-border bg-card/95 backdrop-blur-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-border/70 px-4 py-3">
              <Search size={16} className="text-muted-foreground shrink-0" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onInputKey}
                placeholder="Cari halaman atau fitur…"
                className="flex-1 bg-transparent text-sm font-medium text-foreground placeholder:text-muted-foreground outline-none"
                aria-label="Cari halaman atau fitur"
              />
              <kbd className="hidden sm:block rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground">
                ESC
              </kbd>
            </div>
            <div ref={listRef} className="max-h-[46vh] overflow-y-auto no-scrollbar p-2">
              {results.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                  Tidak ada hasil untuk “{query}”
                </p>
              ) : (
                results.map((dest, i) => {
                  const Icon = dest.icon;
                  const isSel = i === selected;
                  return (
                    <button
                      key={dest.href}
                      type="button"
                      data-index={i}
                      onClick={() => go(dest)}
                      onMouseEnter={() => setSelected(i)}
                      className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${
                        isSel ? "bg-primary/10" : ""
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-xl border ${
                          isSel
                            ? "border-primary/25 bg-primary text-primary-foreground"
                            : "border-border/70 bg-background/70 text-muted-foreground"
                        }`}
                      >
                        <Icon size={15} strokeWidth={2.2} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block truncate text-sm font-bold ${isSel ? "text-primary" : "text-foreground"}`}>
                          {dest.name}
                        </span>
                        <span className="block truncate text-[11px] text-muted-foreground">
                          {dest.hub}
                          {dest.desc ? ` · ${dest.desc}` : ""}
                        </span>
                      </span>
                      {isSel && <CornerDownLeft size={14} className="shrink-0 text-primary" />}
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/** Small trigger button for the palette (sidebar / topbar). */
export function CommandPaletteTrigger() {
  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(
          new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
        );
      }}
      aria-label="Pencarian cepat (Ctrl+K)"
      className="group flex w-full items-center gap-2 rounded-2xl border border-border/70 bg-background/70 px-3 py-2 text-left text-xs font-semibold text-muted-foreground hover:border-primary/25 hover:text-foreground transition-colors"
    >
      <Search size={13} className="shrink-0 group-hover:text-primary transition-colors" />
      <span className="flex-1 truncate">Cari cepat…</span>
      <kbd className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold">
        Ctrl K
      </kbd>
    </button>
  );
}
