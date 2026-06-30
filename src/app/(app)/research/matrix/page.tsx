"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FileText, Loader2, Sparkles, AlertCircle, Library } from "lucide-react";

export default function MatrixPage() {
  const [docs, setDocs] = useState<any[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [matrixResult, setMatrixResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [focusArea, setFocusArea] = useState("Metodologi dan Temuan");

  useEffect(() => {
    fetch("/api/documents")
      .then(r => r.json())
      .then(d => {
        if (d && Array.isArray(d)) setDocs(d);
        else if (d.documents && Array.isArray(d.documents)) setDocs(d.documents);
      })
      .catch(console.error);
  }, []);

  const toggleSelect = (id: string) => {
    if (selectedDocs.includes(id)) {
      setSelectedDocs(selectedDocs.filter(d => d !== id));
    } else {
      setSelectedDocs([...selectedDocs, id]);
    }
  };

  const handleGenerate = async () => {
    if (selectedDocs.length < 2) {
      alert("Pilih minimal 2 dokumen untuk dibandingkan.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/research/matrix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: selectedDocs, focusArea })
      });
      const data = await res.json();
      if (data.matrix) setMatrixResult(data.matrix);
      else alert(data.error || "Gagal membuat matriks");
    } catch (e) {
      alert("Gagal memanggil API");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col pb-10 max-w-5xl mx-auto pt-6">
      <div className="flex items-center gap-2 mb-4">
         <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-2">
            <Library size={14} /> EduSparq Scholar
          </div>
      </div>
      <h1 className="font-display text-4xl font-bold tracking-tight text-foreground">Literature Matrix</h1>
      <p className="text-muted-foreground">Pilih jurnal atau materi yang telah Anda unggah, dan AI akan membuat matriks perbandingan tinjauan pustaka secara otomatis.</p>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-card border rounded-xl p-4 flex flex-col h-[500px]">
          <h2 className="font-semibold mb-4">Pilih Dokumen ({selectedDocs.length} dipilih)</h2>
          <div className="flex-1 overflow-y-auto space-y-2">
            {docs.map((d: any) => (
              <div 
                key={d._id || d.id} 
                onClick={() => toggleSelect(d._id || d.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${selectedDocs.includes(d._id || d.id) ? 'bg-primary/10 border-primary' : 'hover:bg-accent'}`}
              >
                <div className="flex items-center gap-3">
                  <FileText size={18} className="text-muted-foreground" />
                  <span className="font-medium text-sm truncate">{d.originalName || d.filename || d.name}</span>
                </div>
              </div>
            ))}
            {docs.length === 0 && <p className="text-sm text-muted-foreground">Belum ada dokumen. Unggah dokumen di Workspace terlebih dahulu.</p>}
          </div>

          <div className="mt-6">
            <label className="text-sm font-medium mb-2 block">Fokus Perbandingan</label>
            <input 
              type="text" 
              value={focusArea}
              onChange={(e) => setFocusArea(e.target.value)}
              className="w-full bg-background border rounded-lg p-2 text-sm"
              placeholder="Contoh: Metodologi, Temuan, atau Variabel"
            />
          </div>

          <button 
            onClick={handleGenerate} 
            disabled={loading || selectedDocs.length < 2}
            className="w-full mt-4 bg-primary text-primary-foreground font-semibold py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={18} /> : <Sparkles size={18} />}
            {loading ? "Menyusun Matriks..." : "Buat Literature Matrix"}
          </button>
        </div>

        <div className="bg-card border rounded-xl p-4 flex flex-col h-[500px]">
          <h2 className="font-semibold mb-4">Hasil Matriks</h2>
          <div className="flex-1 overflow-auto bg-background rounded-lg border p-4">
            {matrixResult ? (
              <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: matrixResult.replace(/\\n/g, '<br/>') }} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                <AlertCircle size={32} className="mb-2 opacity-20" />
                <p className="text-sm text-center">Pilih minimal 2 dokumen dan klik Buat Matriks untuk melihat hasilnya di sini.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
