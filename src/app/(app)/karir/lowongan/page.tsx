"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  Briefcase,
  Search,
  MapPin,
  Clock,
  Wallet,
  ArrowLeft,
  Filter,
  Building2,
  ExternalLink,
  X,
} from "lucide-react";

interface CareerJob {
  _id: string;
  title: string;
  company: string;
  location: string;
  workLocation: "remote" | "hybrid" | "onsite";
  type: "internship" | "entry" | "part-time" | "contract";
  category: string;
  skills: string[];
  salaryRange?: string;
  description: string;
  requirements: string[];
  responsibilities: string[];
  sourceName: string;
  sourceUrl?: string;
  postedAt: string;
  closesAt?: string;
}

const TYPE_LABEL: Record<CareerJob["type"], string> = {
  internship: "Magang",
  entry: "Entry Level",
  "part-time": "Part Time",
  contract: "Kontrak",
};

const LOCATION_LABEL: Record<CareerJob["workLocation"], string> = {
  remote: "Remote",
  hybrid: "Hybrid",
  onsite: "On-site",
};

const TYPE_FILTERS = [
  { value: "", label: "Semua Tipe" },
  { value: "internship", label: "Magang" },
  { value: "entry", label: "Entry Level" },
  { value: "part-time", label: "Part Time" },
  { value: "contract", label: "Kontrak" },
];

const LOCATION_FILTERS = [
  { value: "", label: "Semua Lokasi" },
  { value: "remote", label: "Remote" },
  { value: "hybrid", label: "Hybrid" },
  { value: "onsite", label: "On-site" },
];

const CATEGORY_FILTERS = [
  { value: "", label: "Semua Kategori" },
  { value: "Data & Analytics", label: "Data & Analytics" },
  { value: "Engineering", label: "Engineering" },
  { value: "AI & Emerging Tech", label: "AI & Emerging Tech" },
  { value: "Security", label: "Security" },
  { value: "Infrastructure", label: "Infrastructure" },
  { value: "Marketing", label: "Marketing" },
  { value: "Design", label: "Design" },
  { value: "Product", label: "Product" },
  { value: "Business", label: "Business" },
  { value: "Energy & Sustainability", label: "Energy & Sustainability" },
  { value: "Web3 & Blockchain", label: "Web3 & Blockchain" },
];

export default function LowonganPage() {
  const [jobs, setJobs] = useState<CareerJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [workLocation, setWorkLocation] = useState("");
  const [category, setCategory] = useState("");

  const [selected, setSelected] = useState<CareerJob | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const params = new URLSearchParams();
    if (type) params.set("type", type);
    if (workLocation) params.set("workLocation", workLocation);
    if (category) params.set("category", category);
    if (search.trim()) params.set("search", search.trim());

    fetch(`/api/career/jobs?${params.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d) return;
        setJobs(Array.isArray(d.jobs) ? d.jobs : []);
      })
      .catch(() => setError("Gagal memuat lowongan."))
      .finally(() => setLoading(false));

    return () => {
      cancelled = true;
    };
  }, [type, workLocation, category, search]);

  return (
    <div className="space-y-5 w-full mx-auto max-w-6xl pb-8">
      {/* Header */}
      <section className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Link
            href="/karir"
            className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft size={14} /> Kembali ke Career Center
          </Link>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-foreground flex items-center gap-3">
            <Briefcase size={28} className="text-primary" /> Lowongan & Magang
          </h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
            Lowongan entry-level, magang, part-time, dan remote yang dikurasi untuk mahasiswa Indonesia.
          </p>
        </div>
      </section>

      {/* Filters */}
      <section className="rounded-xl border border-border bg-card shadow-sm p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari posisi, perusahaan, atau skill..."
              className="w-full h-10 pl-9 pr-4 rounded-lg border border-border bg-background text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {TYPE_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={workLocation}
              onChange={(e) => setWorkLocation(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {LOCATION_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="h-10 px-3 rounded-lg border border-border bg-background text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {CATEGORY_FILTERS.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Filter size={12} />
          <span>Data dikurasi dari riset pasar 2025–2026 (LinkedIn, JobStreet, Glints, Kalibrr, Dealls, web3.career).</span>
        </div>
      </section>

      {/* Job List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-40 rounded-xl bg-muted/50" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center text-sm text-destructive">
          {error}
        </div>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card shadow-sm p-10 text-center">
          <Briefcase size={40} className="mx-auto text-muted-foreground/40 mb-3" />
          <h3 className="font-bold text-foreground">Belum ada lowongan</h3>
          <p className="text-sm text-muted-foreground mt-1">Coba ubah filter atau kata kunci pencarian.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {jobs.map((job) => (
            <motion.div
              key={job._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-xl border border-border bg-card shadow-sm p-5 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setSelected(job)}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Building2 size={20} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm text-foreground line-clamp-1">{job.title}</h3>
                    <p className="text-xs text-muted-foreground">{job.company}</p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted text-muted-foreground shrink-0">
                  {TYPE_LABEL[job.type]}
                </span>
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <MapPin size={11} /> {job.location}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Clock size={11} /> {LOCATION_LABEL[job.workLocation]}
                </span>
                {job.salaryRange && (
                  <span className="inline-flex items-center gap-1 text-primary font-semibold">
                    <Wallet size={11} /> {job.salaryRange}
                  </span>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
                {job.description}
              </p>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {job.skills.slice(0, 5).map((s) => (
                  <span
                    key={s}
                    className="px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-muted text-muted-foreground"
                  >
                    {s}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] overflow-y-auto"
          >
            <div className="sticky top-0 bg-card border-b border-border p-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <Building2 size={20} />
                </div>
                <div>
                  <h2 className="font-black text-base text-foreground">{selected.title}</h2>
                  <p className="text-xs text-muted-foreground">{selected.company}</p>
                </div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-5 space-y-5">
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  {TYPE_LABEL[selected.type]}
                </span>
                <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  {LOCATION_LABEL[selected.workLocation]}
                </span>
                <span className="px-2 py-1 rounded-lg bg-muted text-muted-foreground font-medium">
                  {selected.location}
                </span>
                {selected.salaryRange && (
                  <span className="px-2 py-1 rounded-lg bg-primary/10 text-primary font-bold">
                    {selected.salaryRange}
                  </span>
                )}
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground mb-1">Deskripsi</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{selected.description}</p>
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground mb-1">Tanggung Jawab</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {selected.responsibilities.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground mb-1">Kualifikasi</h3>
                <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1">
                  {selected.requirements.map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-bold text-sm text-foreground mb-2">Skill</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selected.skills.map((s) => (
                    <span
                      key={s}
                      className="px-2 py-1 rounded-md text-xs font-medium bg-muted text-muted-foreground"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>

              {selected.sourceUrl && (
                <a
                  href={selected.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors"
                >
                  <ExternalLink size={16} /> Cek di {selected.sourceName}
                </a>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
