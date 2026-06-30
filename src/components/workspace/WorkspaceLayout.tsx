"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, PanelRightClose, PanelRightOpen, X } from "lucide-react";

interface WorkspaceLayoutProps {
  /** Left rail (file explorer). */
  leftPanel?: React.ReactNode;
  /** Center column (chat / editor). Always visible. */
  centerPanel?: React.ReactNode;
  /** Right rail (sources / citations). */
  rightPanel?: React.ReactNode;
  /** Optional toolbar rendered above the center column (e.g. chat header). */
  centerHeader?: React.ReactNode;
  /** Labels used for the mobile drawers + aria. */
  leftLabel?: string;
  rightLabel?: string;
}

const MIN_LEFT = 200;
const MAX_LEFT = 440;
const MIN_RIGHT = 240;
const MAX_RIGHT = 480;

/**
 * A 3-panel, VS Code / Figma style workspace.
 *
 * Desktop: left + right rails are flex columns separated by drag-to-resize
 * dividers; both can be collapsed to icons-only width. The center column is
 * always flex-1.
 *
 * Mobile (<md): the rails become overlay bottom-sheets toggled by buttons in
 * a slim toolbar above the center column.
 */
export function WorkspaceLayout({
  leftPanel,
  centerPanel,
  rightPanel,
  centerHeader,
  leftLabel = "Berkas",
  rightLabel = "Sumber",
}: WorkspaceLayoutProps) {
  const [leftWidth, setLeftWidth] = useState(240);
  const [rightWidth, setRightWidth] = useState(300);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);

  // Mobile overlay drawers.
  const [mobileLeftOpen, setMobileLeftOpen] = useState(false);
  const [mobileRightOpen, setMobileRightOpen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);

  const startResize = useCallback(
    (side: "left" | "right") => (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startLeft = leftWidth;
      const startRight = rightWidth;

      const onMove = (ev: MouseEvent) => {
        if (side === "left") {
          const delta = ev.clientX - startX;
          setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, startLeft + delta)));
        } else {
          const delta = ev.clientX - startX;
          setRightWidth(Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, startRight - delta)));
        }
      };
      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [leftWidth, rightWidth],
  );

  // Touch support for the dividers (mirrors the mouse logic).
  const startTouchResize = useCallback(
    (side: "left" | "right") => (e: React.TouchEvent) => {
      const startX = e.touches[0]?.clientX ?? 0;
      const startLeft = leftWidth;
      const startRight = rightWidth;
      const onMove = (ev: TouchEvent) => {
        const x = ev.touches[0]?.clientX ?? startX;
        if (side === "left") {
          const delta = x - startX;
          setLeftWidth(Math.min(MAX_LEFT, Math.max(MIN_LEFT, startLeft + delta)));
        } else {
          const delta = x - startX;
          setRightWidth(Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, startRight - delta)));
        }
      };
      const onEnd = () => {
        document.removeEventListener("touchmove", onMove);
        document.removeEventListener("touchend", onEnd);
      };
      document.addEventListener("touchmove", onMove, { passive: false });
      document.addEventListener("touchend", onEnd);
    },
    [leftWidth, rightWidth],
  );

  // Close mobile drawers on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileLeftOpen(false);
        setMobileRightOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const toggleLeft = useCallback(() => {
    setLeftCollapsed((c) => !c);
  }, []);
  const toggleRight = useCallback(() => {
    setRightCollapsed((c) => !c);
  }, []);

  const Divider = ({ side }: { side: "left" | "right" }) => (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={`Ubah ukuran panel ${side === "left" ? "kiri" : "kanan"}`}
      onMouseDown={startResize(side)}
      onTouchStart={startTouchResize(side)}
      className="group/drag relative w-px shrink-0 cursor-col-resize bg-border hover:bg-primary/40 transition-colors"
    >
      <span className="absolute inset-y-0 -left-1 -right-1 z-10" />
      <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-10 w-1 rounded-full bg-transparent group-hover/drag:bg-primary/30 transition-colors" />
    </div>
  );

  const CollapseButton = ({ side }: { side: "left" | "right" }) => {
    const collapsed = side === "left" ? leftCollapsed : rightCollapsed;
    const onClick = side === "left" ? toggleLeft : toggleRight;
    const Icon = collapsed
      ? side === "left"
        ? PanelLeftOpen
        : PanelRightOpen
      : side === "left"
        ? PanelLeftClose
        : PanelRightClose;
    const label = `${collapsed ? "Buka" : "Tutup"} panel ${side === "left" ? "berkas" : "sumber"}`;
    return (
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        title={label}
        className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        <Icon size={16} />
      </button>
    );
  };

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-border bg-card/40 shadow-sm backdrop-blur-sm"
    >
      {/* Slim top toolbar — collapse toggles live here. */}
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border bg-card/60 px-3 py-2">
        <div className="flex items-center gap-1.5">
          {/* Mobile: open left drawer */}
          <button
            type="button"
            onClick={() => setMobileLeftOpen(true)}
            aria-label={`Buka ${leftLabel}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors md:hidden"
          >
            <PanelLeftOpen size={16} />
          </button>
          <div className="hidden md:block">
            <CollapseButton side="left" />
          </div>
        </div>

        {centerHeader ? (
          <div className="min-w-0 flex-1 overflow-hidden">{centerHeader}</div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="flex items-center gap-1.5">
          <div className="hidden md:block">
            <CollapseButton side="right" />
          </div>
          <button
            type="button"
            onClick={() => setMobileRightOpen(true)}
            aria-label={`Buka ${rightLabel}`}
            className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors md:hidden"
          >
            <PanelRightOpen size={16} />
          </button>
        </div>
      </div>

      {/* Body: 3 columns on desktop, single column on mobile. */}
      <div className="flex min-h-0 flex-1">
        {/* Left rail (desktop) */}
        <AnimatePresence initial={false}>
          {!leftCollapsed && (
            <motion.aside
              key="left-rail"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: leftWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="hidden min-h-0 shrink-0 overflow-hidden md:block"
              style={{ width: leftWidth }}
            >
              <div className="flex h-full w-full flex-col bg-card/40">{leftPanel}</div>
            </motion.aside>
          )}
        </AnimatePresence>
        {!leftCollapsed && <div className="hidden md:block"><Divider side="left" /></div>}

        {/* Center column */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{centerPanel}</div>

        {/* Right rail (desktop) */}
        {!rightCollapsed && <div className="hidden md:block"><Divider side="right" /></div>}
        <AnimatePresence initial={false}>
          {!rightCollapsed && (
            <motion.aside
              key="right-rail"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: rightWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="hidden min-h-0 shrink-0 overflow-hidden md:block"
              style={{ width: rightWidth }}
            >
              <div className="flex h-full w-full flex-col bg-card/40">{rightPanel}</div>
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* Mobile left drawer (bottom sheet) */}
      <AnimatePresence>
        {mobileLeftOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileLeftOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={leftLabel}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="flex h-[80vh] w-full flex-col rounded-t-3xl border-t border-border bg-card p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-sm font-bold text-foreground">{leftLabel}</span>
                <button
                  type="button"
                  onClick={() => setMobileLeftOpen(false)}
                  aria-label="Tutup"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{leftPanel}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mobile right drawer (bottom sheet) */}
      <AnimatePresence>
        {mobileRightOpen && (
          <motion.div
            className="fixed inset-0 z-50 flex items-end bg-black/55 backdrop-blur-sm md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileRightOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={rightLabel}
          >
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 32 }}
              className="flex h-[75vh] w-full flex-col rounded-t-3xl border-t border-border bg-card p-3 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-2 pb-2">
                <span className="text-sm font-bold text-foreground">{rightLabel}</span>
                <button
                  type="button"
                  onClick={() => setMobileRightOpen(false)}
                  aria-label="Tutup"
                  className="grid h-8 w-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">{rightPanel}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default WorkspaceLayout;
