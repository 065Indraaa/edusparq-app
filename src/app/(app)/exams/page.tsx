"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { GraduationCap, Sparkles, BookOpen, LayoutGrid, Plus, Trash2, RefreshCw, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Wand2 } from "lucide-react";
import { useSession } from "next-auth/react";
import { CourseSelect } from "@/components/course-select";

interface Flashcard {
  _id: string;
  front: string;
  back: string;
  courseName: string;
  difficulty: "easy" | "medium" | "hard";
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function ExamsPage() {
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<"predict" | "flashcard">("predict");

  // Real courses, used to prefill the prediction course field and flashcard form.
  const [courses, setCourses] = useState<string[]>([]);

  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [loadingCards, setLoadingCards] = useState(true);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newCard, setNewCard] = useState({
    front: "",
    back: "",
    courseName: "",
    difficulty: "medium" as "easy" | "medium" | "hard",
  });

  // AI exam-prediction state.
  const [predictCourse, setPredictCourse] = useState("");
  const [predictTopic, setPredictTopic] = useState("");
  const [predicting, setPredicting] = useState(false);
  const [predictResult, setPredictResult] = useState("");
  const [predictError, setPredictError] = useState("");

  const [documents, setDocuments] = useState<{ _id: string; originalName: string }[]>([]);
  const [genDocId, setGenDocId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  const handlePredict = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!predictCourse.trim() || predicting) return;

    setPredicting(true);
    setPredictResult("");
    setPredictError("");

    const message =
      `Susun prediksi soal ujian (UTS/UAS) untuk mata kuliah "${predictCourse.trim()}"` +
      (predictTopic.trim() ? ` dengan fokus topik "${predictTopic.trim()}"` : "") +
      `. Sebutkan 4-6 topik yang kemungkinan besar keluar beserta jenis soalnya ` +
      `(misalnya pilihan ganda, esai, hitungan, atau studi kasus), dan berikan estimasi tingkat kemungkinan ` +
      `secara kualitatif (tinggi/sedang/rendah). Tulis dalam bahasa Indonesia baku, terstruktur, dan ringkas. ` +
      `Tegaskan bahwa ini perkiraan, bukan bocoran soal.`;

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, mode: "helper" }),
      });

      if (!res.ok || !res.body) {
        setPredictError("Gagal menyusun prediksi. Silakan coba lagi sebentar.");
        setPredicting(false);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (!value) continue;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data:")) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(payload);
            setPredictResult((prev) => prev + (parsed.text || ""));
          } catch {
            // Ignore malformed/partial SSE lines.
          }
        }
      }
    } catch {
      setPredictError("Terjadi kendala koneksi. Silakan coba lagi.");
    } finally {
      setPredicting(false);
    }
  };

  useEffect(() => {
    if (!session?.user) return;
    setLoadingCards(true);
    fetch("/api/flashcards")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setFlashcards(data))
      .finally(() => setLoadingCards(false));
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/courses")
      .then((r) => r.json())
      .then((data) => setCourses((Array.isArray(data) ? data : []).map((c: any) => c.name).filter(Boolean)))
      .catch(() => {});
  }, [session]);

  useEffect(() => {
    if (!session?.user) return;
    fetch("/api/documents")
      .then((r) => r.json())
      .then((data) => Array.isArray(data) && setDocuments(data.map((d: any) => ({ _id: String(d._id), originalName: d.originalName || d.filename || "Dokumen" }))))
      .catch(() => {});
  }, [session]);

  const handleAddCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCard.front || !newCard.back) return;
    setSubmitting(true);

    const res = await fetch("/api/flashcards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCard),
    });

    if (res.ok) {
      const card = await res.json();
      setFlashcards((prev) => [...prev, card]);
      setCurrentIdx(flashcards.length);
      setNewCard({ front: "", back: "", courseName: "", difficulty: "medium" });
      setShowAddForm(false);
      setIsFlipped(false);
    }
    setSubmitting(false);
  };

  const handleDeleteCard = async (id: string) => {
    await fetch(`/api/flashcards/${id}`, { method: "DELETE" });
    setFlashcards((prev) => {
      const next = prev.filter((c) => c._id !== id);
      setCurrentIdx((i) => Math.min(i, Math.max(0, next.length - 1)));
      return next;
    });
    setIsFlipped(false);
  };

  const handleGenerateFromDoc = async () => {
    if (!genDocId || generating) return;
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: genDocId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setGenError(err?.error || "Gagal membuat flashcard dari materi ini.");
        return;
      }
      const data = await res.json();
      const created: Flashcard[] = Array.isArray(data.created) ? data.created : [];
      if (created.length > 0) {
        setFlashcards((prev) => [...created, ...prev]);
        setCurrentIdx(0);
        setIsFlipped(false);
      }
    } catch {
      setGenError("Terjadi kendala koneksi. Silakan coba lagi.");
    } finally {
      setGenerating(false);
    }
  };

  const goNext = () => {
    if (currentIdx < flashcards.length - 1) {
      setCurrentIdx((i) => i + 1);
      setIsFlipped(false);
    }
  };

  const goPrev = () => {
    if (currentIdx > 0) {
      setCurrentIdx((i) => i - 1);
      setIsFlipped(false);
    }
  };

  const currentCard = flashcards[currentIdx];

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
            <GraduationCap size={14} /> Siap Ujian
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient">Persiapan Ujian</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Susun flashcard dari materi kuliah Anda dan buat perkiraan topik yang berpeluang muncul saat ujian.
          </p>
        </div>
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemVariants} className="flex bg-muted p-1 rounded-2xl gap-1 max-w-xs">
        {[
          { id: "predict", label: "Prediksi Soal", icon: Sparkles },
          { id: "flashcard", label: "Flashcard", icon: LayoutGrid },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id as typeof activeTab)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-sm font-semibold transition-all ${
              activeTab === id
                ? "bg-card text-foreground shadow-sm border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon size={14} />
            {label}
          </button>
        ))}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <motion.div variants={itemVariants} className="lg:col-span-2">

          {/* Predictions */}
          {activeTab === "predict" && (
            <div className="space-y-6">

              {/* AI prediction generator */}
              <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
                <div className="flex items-center gap-2">
                  <Wand2 size={16} className="text-primary" />
                  <h2 className="font-bold text-foreground">Susun prediksi dari materi</h2>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Masukkan mata kuliah Anda, lalu Tutor AI akan menyusun perkiraan jenis soal dan topik
                  yang berpeluang muncul pada UTS/UAS. Hasil ini bersifat perkiraan, bukan bocoran soal.
                </p>

                <form onSubmit={handlePredict} className="space-y-3">
                  <input
                    required
                    placeholder="Mata kuliah (misal: Statistika Sosial)"
                    value={predictCourse}
                    onChange={(e) => setPredictCourse(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                    list="course-list"
                  />
                  <datalist id="course-list">
                    {courses.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                  <input
                    placeholder="Fokus topik (opsional, misal: Uji Hipotesis)"
                    value={predictTopic}
                    onChange={(e) => setPredictTopic(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  />
                  <button
                    type="submit"
                    disabled={predicting || !predictCourse.trim()}
                    className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                  >
                    {predicting ? (
                      <>
                        <RefreshCw size={15} className="animate-spin" /> Menyusun prediksi...
                      </>
                    ) : (
                      <>
                        <Sparkles size={15} /> Susun prediksi
                      </>
                    )}
                  </button>
                </form>

                {predictError && (
                  <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">
                    {predictError}
                  </p>
                )}

                <AnimatePresence>
                  {(predictResult || predicting) && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="rounded-2xl bg-muted/40 border border-border p-4"
                    >
                      <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-2">
                        Prediksi Tutor AI
                      </span>
                      <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
                        {predictResult}
                        {predicting && <span className="inline-block w-1.5 h-4 align-middle bg-primary/60 animate-pulse ml-0.5" />}
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

            </div>
          )}

          {/* Flashcards */}
          {activeTab === "flashcard" && (
            <div className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-foreground">Flashcard Anda</h2>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all"
                >
                  <Plus size={14} /> Kartu baru
                </button>
              </div>

              {/* Buat dari materi */}
              <div className="flex items-center gap-2">
                <select
                  value={genDocId}
                  onChange={(e) => setGenDocId(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-muted border border-border text-xs text-foreground focus:outline-none focus:border-primary transition-all"
                >
                  <option value="">Pilih materi untuk buat flashcard...</option>
                  {documents.map((d) => (
                    <option key={d._id} value={d._id}>{d.originalName}</option>
                  ))}
                </select>
                <button
                  onClick={handleGenerateFromDoc}
                  disabled={!genDocId || generating}
                  className="flex items-center gap-1.5 px-3 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                >
                  {generating ? <RefreshCw size={13} className="animate-spin" /> : <Wand2 size={13} />}
                  Buat
                </button>
              </div>
              {genError && (
                <p className="text-xs font-semibold text-destructive bg-destructive/10 border border-destructive/20 px-3 py-2 rounded-xl">
                  {genError}
                </p>
              )}

              {loadingCards ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                </div>
              ) : flashcards.length === 0 ? (
                <div className="py-12 text-center space-y-3">
                  <BookOpen size={40} className="text-muted-foreground/30 mx-auto" />
                  <p className="text-sm font-semibold text-foreground">Belum ada flashcard</p>
                  <p className="text-xs text-muted-foreground">Susun kartu pertama Anda dari istilah atau konsep kuliah yang sulit diingat.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{currentCard?.courseName || "Umum"}</span>
                    <span>Kartu {currentIdx + 1} dari {flashcards.length}</span>
                  </div>

                  {/* Flip Card */}
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentCard._id + (isFlipped ? "-back" : "-front")}
                      initial={{ opacity: 0, rotateY: isFlipped ? -90 : 90 }}
                      animate={{ opacity: 1, rotateY: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      onClick={() => setIsFlipped(!isFlipped)}
                      className={`min-h-[180px] p-8 rounded-3xl border-2 flex flex-col items-center justify-center cursor-pointer text-center transition-colors ${
                        isFlipped
                          ? "border-primary/40 bg-primary/5"
                          : "border-border bg-muted/30 hover:border-primary/30"
                      }`}
                    >
                      <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest block mb-4">
                        {isFlipped ? "Definisi. Klik untuk membalik" : "Istilah. Klik untuk melihat definisi"}
                      </span>
                      <p className="text-lg font-extrabold text-foreground leading-snug max-w-sm">
                        {isFlipped ? currentCard.back : currentCard.front}
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  {/* Navigation */}
                  <div className="flex items-center gap-3">
                    <button
                      onClick={goPrev}
                      disabled={currentIdx === 0}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-border bg-muted hover:bg-muted/80 text-sm font-semibold text-foreground disabled:opacity-40 transition-all"
                    >
                      <ChevronLeft size={16} /> Sebelumnya
                    </button>
                    <button
                      onClick={() => handleDeleteCard(currentCard._id)}
                      className="p-2.5 rounded-xl hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors border border-border"
                    >
                      <Trash2 size={16} />
                    </button>
                    <button
                      onClick={goNext}
                      disabled={currentIdx === flashcards.length - 1}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-all"
                    >
                      Selanjutnya <ChevronRight size={16} />
                    </button>
                  </div>
                </>
              )}

              {/* Add Card Form */}
              <AnimatePresence>
                {showAddForm && (
                  <motion.form
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    onSubmit={handleAddCard}
                    className="border-t border-border pt-5 space-y-3 overflow-hidden"
                  >
                    <h3 className="font-bold text-sm text-foreground">Tambah flashcard baru</h3>
                    <input required placeholder="Istilah atau konsep (sisi depan kartu)" value={newCard.front}
                      onChange={(e) => setNewCard({ ...newCard, front: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all" />
                    <textarea required rows={3} placeholder="Definisi atau penjelasan (sisi belakang kartu)" value={newCard.back}
                      onChange={(e) => setNewCard({ ...newCard, back: e.target.value })}
                      className="w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all resize-none" />
                    <div className="grid grid-cols-2 gap-3">
                      <CourseSelect
                        value={newCard.courseName}
                        onChange={(v) => setNewCard({ ...newCard, courseName: v })}
                        placeholder="Mata kuliah (opsional)"
                      />
                      <select value={newCard.difficulty} onChange={(e) => setNewCard({ ...newCard, difficulty: e.target.value as Flashcard["difficulty"] })}
                        className="px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all">
                        <option value="easy">Mudah</option>
                        <option value="medium">Sedang</option>
                        <option value="hard">Susah</option>
                      </select>
                    </div>
                    <div className="flex gap-3">
                      <button type="submit" disabled={submitting}
                        className="flex-1 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 flex items-center justify-center gap-2">
                        {submitting ? <RefreshCw size={14} className="animate-spin" /> : "Simpan"}
                      </button>
                      <button type="button" onClick={() => setShowAddForm(false)}
                        className="px-4 py-2.5 rounded-2xl border border-border text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
                        Batal
                      </button>
                    </div>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          )}
        </motion.div>

        {/* Right: Tips */}
        <motion.div variants={itemVariants} className="space-y-4">
          <div className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-4">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <BookOpen size={15} className="text-primary" />
              Tips belajar efektif
            </h3>
            <div className="space-y-3 text-xs">
              {[
                { icon: CheckCircle2, color: "text-emerald-500", title: "Pengulangan berjarak", desc: "Tinjau kartu yang sulit lebih sering, dan yang mudah lebih jarang." },
                { icon: CheckCircle2, color: "text-primary", title: "Mengingat aktif", desc: "Cobalah mengingat jawaban sebelum membalik kartu agar materi lebih melekat." },
                { icon: XCircle, color: "text-destructive", title: "Hindari membaca pasif", desc: "Membaca ulang catatan kurang efektif. Lebih baik menguji diri sendiri." },
              ].map(({ icon: Icon, color, title, desc }, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/50">
                  <Icon size={15} className={`${color} shrink-0 mt-0.5`} />
                  <div>
                    <span className="font-bold text-foreground block">{title}</span>
                    <span className="text-muted-foreground leading-relaxed">{desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
}
