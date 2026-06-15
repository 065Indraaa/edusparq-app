"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bookmark, Search, Trash2, ExternalLink, CalendarDays, BookOpen, Quote } from "lucide-react";
import { useSession } from "next-auth/react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 25 } },
};

export default function LibraryPage() {
  const { data: session } = useSession();
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLibrary = async () => {
    try {
      const res = await fetch("/api/library");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch (error) {
      console.error("Failed to fetch library", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (session?.user) {
      fetchLibrary();
    }
  }, [session]);

  const handleDelete = async (id: string) => {
    if (!confirm("Hapus dari Pustaka Saya?")) return;
    try {
      const res = await fetch(`/api/library?id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setItems(items.filter((item) => item._id !== id));
      }
    } catch (error) {
      alert("Gagal menghapus.");
    }
  };

  const filteredItems = items.filter((item) =>
    item.title?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="w-full pb-24">
      {/* Header */}
      <motion.div variants={itemVariants} className="flex flex-col md:flex-row justify-between items-start md:items-end mb-10 gap-6">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-bold tracking-tight text-foreground mb-2 flex items-center gap-3">
            <Bookmark className="text-primary" size={36} /> Pustaka Saya
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl">
            Semua hasil riset, jurnal, dan dokumen penting yang telah Anda simpan.
          </p>
        </div>
      </motion.div>

      {/* Control Bar */}
      <motion.div variants={itemVariants} className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-card border border-border rounded-2xl p-2 shadow-sm mb-8">
        <div className="relative w-full flex-1">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari dalam pustaka..."
            className="w-full pl-12 pr-4 py-3 rounded-xl bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-0"
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto px-4 border-t sm:border-t-0 sm:border-l border-border pt-3 sm:pt-0 text-sm text-muted-foreground whitespace-nowrap">
          {items.length} Dokumen Tersimpan
        </div>
      </motion.div>

      {/* Grid List */}
      <motion.div variants={itemVariants} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-12 flex justify-center text-muted-foreground">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="col-span-full py-16 text-center bg-card/50 backdrop-blur-md rounded-3xl border border-dashed border-border">
            <BookOpen size={48} className="mx-auto mb-4 text-muted-foreground opacity-20" />
            <h3 className="text-xl font-bold text-foreground mb-2">Pustaka Masih Kosong</h3>
            <p className="text-sm text-muted-foreground">
              Anda belum menyimpan hasil riset apapun. Kunjungi halaman Katalog Riset untuk mulai bereksplorasi.
            </p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <article key={item._id} className="bg-card/80 backdrop-blur-md rounded-2xl p-6 border border-border shadow-sm flex flex-col justify-between group hover:border-primary/30 transition-colors">
              <div>
                <div className="flex justify-between items-start mb-4">
                  <span className="px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold tracking-widest uppercase rounded">
                    {item.typeLabel || "Sintesis Riset"}
                  </span>
                  <button onClick={() => handleDelete(item._id)} className="text-muted-foreground hover:text-red-500 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-bold text-foreground mb-3 leading-tight line-clamp-2">
                  {item.title}
                </h3>
                <div className="text-xs text-muted-foreground mb-4 flex items-center gap-2">
                  <CalendarDays size={14} /> 
                  {new Date(item.savedAt).toLocaleDateString("id-ID", { day: 'numeric', month: 'short', year: 'numeric' })}
                </div>
                <p className="text-sm text-muted-foreground line-clamp-4 leading-relaxed mb-6">
                  {item.content || item.url || "Tidak ada abstrak."}
                </p>
              </div>
              <div className="pt-4 border-t border-border flex justify-between items-center">
                <div className="flex -space-x-2">
                  <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary border border-background">AI</div>
                </div>
                <button 
                  onClick={() => alert('Fitur baca penuh sedang dikembangkan.')}
                  className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                >
                  Baca Penuh <ExternalLink size={12} />
                </button>
              </div>
            </article>
          ))
        )}
      </motion.div>
    </motion.div>
  );
}
