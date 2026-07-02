"use client";

import { Search } from "lucide-react";
import { openCommandPalette } from "./app-nav";

/** Icon button (mobile top bar) that opens the global ⌘K command palette. */
export function CommandPaletteButton() {
  return (
    <button
      type="button"
      onClick={openCommandPalette}
      aria-label="Cari fitur (Ctrl+K)"
      className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
    >
      <Search className="h-5 w-5" />
    </button>
  );
}
