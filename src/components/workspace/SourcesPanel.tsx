"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Globe, BookOpen, ExternalLink, ShieldCheck, AlertCircle } from "lucide-react";

export interface Source {
  id: string;
  type: "document" | "web" | "journal";
  title: string;
  content: string;
  url?: string;
  doi?: string;
  score: number;
}

interface SourcesPanelProps {
  sources: Source[];
  confidence?: { score: number; level: string };
  onSelectSource?: (source: Source) => void;
  selectedSourceId?: string;
}

const TYPE_CONFIG = {
  document: { icon: FileText, label: "Materi", color: "text-blue-500" },
  web: { icon: Globe, label: "Web", color: "text-green-500" },
  journal: { icon: BookOpen, label: "Jurnal", color: "text-purple-500" },
};

export function SourcesPanel({ sources, confidence, onSelectSource, selectedSourceId }: SourcesPanelProps) {
  return (
    <div className="h-full flex flex-col bg-background">
      <div className="px-4 py-3 border-b border-border">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Sumber & Referensi
        </h3>
      </div>

      {confidence && (
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-muted-foreground">Tingkat Keyakinan</span>
            <span className={`text-xs font-bold ${
              confidence.level === "High" ? "text-green-500" :
              confidence.level === "Medium" ? "text-yellow-500" :
              confidence.level === "Low" ? "text-orange-500" : "text-red-500"
            }`}>
              {confidence.level} ({confidence.score}%)
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                confidence.score >= 75 ? "bg-green-500" :
                confidence.score >= 50 ? "bg-yellow-500" :
                confidence.score >= 25 ? "bg-orange-500" : "bg-red-500"
              }`}
              style={{ width: `${confidence.score}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {sources.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <ShieldCheck className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              AI belum menggunakan sumber eksternal. Upload materi kuliah untuk grounding yang lebih kuat.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {sources.map((source, i) => {
              const config = TYPE_CONFIG[source.type] || TYPE_CONFIG.web;
              const Icon = config.icon;
              const isSelected = selectedSourceId === source.id;
              return (
                <motion.button
                  key={source.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  onClick={() => onSelectSource?.(source)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    isSelected
                      ? "bg-muted border-primary"
                      : "bg-card border-border hover:border-muted-foreground/30"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${config.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                          [{i + 1}] {config.label}
                        </span>
                        {source.score > 0.7 && (
                          <ShieldCheck className="w-3 h-3 text-green-500" />
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground line-clamp-2 mb-1">
                        {source.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {source.content}
                      </p>
                      {source.url && (
                        <div className="flex items-center gap-1 mt-1.5 text-[10px] text-muted-foreground">
                          <ExternalLink className="w-3 h-3" />
                          <span className="truncate">{source.url}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
