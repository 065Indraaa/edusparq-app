import React from "react";
import { InfoIcon, ShieldIcon } from "./Icons";

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Unknown";

export interface SourceAttribution {
  title: string;
  author: string;
  year: string;
  page?: string | number;
  exactQuote?: string;
  url?: string;
}

interface ConfidenceBadgeProps {
  level: ConfidenceLevel;
  sources?: SourceAttribution[];
}

export const ConfidenceBadge = ({ level, sources = [] }: ConfidenceBadgeProps) => {
  const config = {
    High: {
      label: "Akurasi Tinggi",
      bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
      dot: "bg-emerald-500",
      description: "Informasi didasarkan pada sumber data kuat dan telah diverifikasi silang.",
    },
    Medium: {
      label: "Akurasi Sedang",
      bg: "bg-amber-400/10 border-amber-400/30 text-amber-600 dark:text-amber-400",
      dot: "bg-amber-400",
      description: "Didasarkan pada referensi yang konsisten namun dengan cakupan terbatas.",
    },
    Low: {
      label: "Akurasi Rendah",
      bg: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
      dot: "bg-rose-500",
      description: "Hasil kesimpulan/inferensi AI yang kekurangan data primer. Harap periksa kembali.",
    },
    Unknown: {
      label: "Tidak Diketahui",
      bg: "bg-muted border-border text-muted-foreground",
      dot: "bg-slate-400",
      description: "Kurangnya informasi pendukung yang cukup dalam pangkalan data.",
    },
  }[level];

  return (
    <div className="space-y-3 mt-2">
      {/* Badge Pill */}
      <div className="flex items-center space-x-2 flex-wrap gap-y-1">
        <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${config.bg}`}>
          <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`} />
          {config.label}
        </div>
        <span className="text-[11px] text-muted-foreground font-normal select-none">
          {config.description}
        </span>
      </div>

      {/* Low/Unknown Confidence Banner */}
      {(level === "Low" || level === "Unknown") && (
        <div className="flex items-start gap-2.5 p-3 rounded-lg border border-rose-500/20 bg-rose-500/5 text-xs text-rose-600 dark:text-rose-300 animate-pulse-glow">
          <InfoIcon size={16} className="shrink-0 mt-0.5 text-rose-500 dark:text-rose-400" />
          <div className="space-y-0.5">
            <span className="font-semibold block">Rekomendasi Verifikasi</span>
            <p className="leading-relaxed">
              Jawaban ini didasarkan pada inferensi atau dokumen dengan konteks terbatas. Mahasiswa sangat disarankan untuk melakukan verifikasi silang secara mandiri menggunakan modul literatur atau buku panduan terkait.
            </p>
          </div>
        </div>
      )}

      {/* Sources Attribution */}
      {sources.length > 0 && (
        <div className="space-y-1.5 bg-muted p-3 rounded-lg border border-border">
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
            Rujukan Dokumen ({sources.length})
          </span>
          <div className="space-y-2.5 divide-y divide-border">
            {sources.map((src, idx) => (
              <div key={idx} className={`text-xs ${idx > 0 ? "pt-2" : ""}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="font-medium text-foreground block hover:underline cursor-pointer">
                      {src.title}
                    </span>
                    {(src.author || src.year || src.page) && (
                      <span className="text-muted-foreground text-[11px]">
                        {src.author} {src.year && `(${src.year})`} {src.page && `• Hal. ${src.page}`}
                      </span>
                    )}
                  </div>
                  {src.url && (
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-teal-600 dark:text-teal-400 hover:underline font-semibold underline shrink-0"
                    >
                      Buka Paper
                    </a>
                  )}
                </div>
                {src.exactQuote && (
                  <p className="mt-1.5 p-2 bg-card text-[11px] italic text-muted-foreground border-l-2 border-teal-500 rounded-r font-mono leading-relaxed break-words">
                    &ldquo;{src.exactQuote}&rdquo;
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
