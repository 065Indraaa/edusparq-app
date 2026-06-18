"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "next-auth/react";
import {
  FolderOpen as WorkspaceIcon,
  UploadCloud as UploadIcon,
  BookOpen as BookIcon,
  FileText as FileTextIcon,
  Headphones as AudioIcon,
  Video as VideoIcon,
  Sparkles as SparklesIcon,
  ChevronDown as ChevronIcon,
  CheckCircle2 as CheckIcon,
  Info as InfoIcon,
  Eye as EyeIcon,
  X as CloseIcon,
  ExternalLink as ExternalLinkIcon,
  Database as DatabaseIcon,
  RefreshCw as RefreshIcon
} from "lucide-react";
import { extractText, isExtractable } from "@/lib/extract-text";
import { CourseSelect } from "../../../components/course-select-dropdown";
import { AddCourseForm } from "@/components/add-course-form";

interface DocumentFile {
  id: string;
  name: string;
  type: "pdf" | "docx" | "audio" | "video" | "image";
  size: string;
  uploadedAt: string;
  status: "Indexed" | "Processing" | "Failed";
  subject: string;
  // True when plain text was extracted client-side and indexed for the tutor.
  indexed?: boolean;
  // Cloudinary URL of the stored file (used by the PDF viewer / open action).
  fileUrl?: string;
}

const initialFiles: DocumentFile[] = [];

const mockChunks: { id: string; heading: string; content: string; type: string; page: number; source: string }[] = [];

// Maps a fileType enum value to the UI type and an icon.
function normalizeType(t: string): DocumentFile["type"] {
  if (t === "docx" || t === "audio" || t === "video" || t === "image") return t;
  return "pdf";
}

function deriveTypeFromName(fileName: string): DocumentFile["type"] {
  const n = fileName.toLowerCase();
  if (n.endsWith(".docx") || n.endsWith(".doc") || n.endsWith(".txt")) return "docx";
  if (n.endsWith(".mp3") || n.endsWith(".wav") || n.endsWith(".m4a")) return "audio";
  if (n.endsWith(".mp4") || n.endsWith(".mov") || n.endsWith(".webm")) return "video";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg") || n.endsWith(".png")) return "image";
  return "pdf";
}

function formatDate(d: string | Date | undefined): string {
  if (!d) return "Hari ini";
  try {
    return new Date(d).toLocaleDateString("id-ID", { day: "2-digit", month: "2-digit", year: "numeric" });
  } catch {
    return "Hari ini";
  }
}

// Maps a raw API document into the card/table UI shape.
function mapApiDoc(doc: any): DocumentFile {
  const statusMap: Record<string, DocumentFile["status"]> = {
    indexed: "Indexed",
    processing: "Processing",
    failed: "Failed",
  };
  return {
    id: String(doc._id || doc.id),
    name: doc.originalName || doc.filename || "Dokumen",
    type: normalizeType(doc.fileType),
    size: doc.fileSize || "-",
    uploadedAt: formatDate(doc.uploadedAt),
    status: statusMap[doc.status] || "Indexed",
    subject: doc.courseName || "",
    fileUrl: doc.fileUrl || undefined,
    // The GET payload does not expose chunk counts, so we cannot reliably know
    // whether an existing document was indexed for the tutor. Leave it unknown
    // (the badge then shows the neutral "Tersimpan" state).
    indexed: undefined,
  };
}

// Returns true when a document can be opened in the in-app PDF viewer.
function isPdf(file: DocumentFile): boolean {
  return file.type === "pdf" || (file.fileUrl || "").toLowerCase().endsWith(".pdf");
}

export default function WorkspacePage() {
  const { status: authStatus } = useSession();
  const isLoggedIn = authStatus === "authenticated";

  const [selectedSemester, setSelectedSemester] = useState<string>("");
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [courseRefresh, setCourseRefresh] = useState(0);
  const [autofillingCourses, setAutofillingCourses] = useState(false);
  const [addTugas, setAddTugas] = useState(false);
  const [tugasTitle, setTugasTitle] = useState("");
  const [tugasDate, setTugasDate] = useState("");
  const [tugasTime, setTugasTime] = useState("23:59");
  const [files, setFiles] = useState<DocumentFile[]>([]);
  const [usingSampleData, setUsingSampleData] = useState<boolean>(true);
  const [notice, setNotice] = useState<string>("");

  const [isDragging, setIsDragging] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadStep, setUploadStep] = useState<string>("");
  const [uploadFileName, setUploadFileName] = useState<string>("");
  const [inspectingFile, setInspectingFile] = useState<DocumentFile | null>(null);
  const [viewerFile, setViewerFile] = useState<DocumentFile | null>(null);
  const viewerCloseRef = useRef<HTMLButtonElement | null>(null);

  const [inspectorChunks, setInspectorChunks] = useState<{ content: string; chunkIndex: number }[]>([]);
  const [loadingChunks, setLoadingChunks] = useState(false);
  const [summaryContent, setSummaryContent] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [flashcardGenerating, setFlashcardGenerating] = useState(false);
  const [reindexing, setReindexing] = useState(false);

  // Accessibility: close the viewer on Esc and move focus to the close button.
  useEffect(() => {
    if (!viewerFile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setViewerFile(null);
    };
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => viewerCloseRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [viewerFile]);

  useEffect(() => {
    if (!inspectingFile) {
      setInspectorChunks([]);
      setSummaryContent("");
      return;
    }
    const isReal =
      !inspectingFile.id.startsWith("demo-") &&
      !usingSampleData &&
      !/^\d+$/.test(inspectingFile.id);
    if (!isReal) {
      setInspectorChunks([]);
      setSummaryContent("");
      return;
    }
    setLoadingChunks(true);
    fetch(`/api/documents/${inspectingFile.id}/chunks`)
      .then((r) => r.json())
      .then((data) => setInspectorChunks(Array.isArray(data) ? data : []))
      .catch(() => setInspectorChunks([]))
      .finally(() => setLoadingChunks(false));
  }, [inspectingFile?.id, usingSampleData]);

  // Opens the in-app viewer for all supported media/docs; 
  // falls back to the inspector if no URL is available.
  const handleOpen = (file: DocumentFile) => {
    if (file.fileUrl) {
      setViewerFile(file);
    } else {
      // No stored URL (sample/demo data) — fall back to the inspector.
      setInspectingFile(file);
    }
  };

  // Fetch the user's real documents once authenticated.
  const refreshDocuments = useCallback(async () => {
    try {
      const res = await fetch("/api/documents");
      if (!res.ok) {
        setUsingSampleData(true);
        return;
      }
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(mapApiDoc);
        setFiles(mapped);
        setUsingSampleData(false);
        setNotice("");
        // Keep selected subject sensible if it has docs.
        const subjects = Array.from(new Set(mapped.map((f) => f.subject).filter(Boolean)));
        if (subjects.length > 0 && !subjects.includes(selectedSubject)) {
          setSelectedSubject(subjects[0]);
        }
      } else {
        // Logged in but no docs yet — keep samples as a friendly empty-state demo.
        setUsingSampleData(true);
        setNotice("Belum ada materi asli. Menampilkan contoh — unggah berkas untuk memulai basis pengetahuanmu.");
      }
    } catch {
      setUsingSampleData(true);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (isLoggedIn) {
      refreshDocuments();
    } else if (authStatus === "unauthenticated") {
      setUsingSampleData(true);
      setNotice("Menampilkan contoh — masuk untuk mengelola materi aslimu.");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, authStatus]);

  // Subjects derived from uploaded documents
  const allSubjects = Array.from(new Set(files.map(f => f.subject).filter(Boolean)));
  const subjects = allSubjects;
  // Semesters dropdown: static list
  const semesters = ["Semua", "Semester 1", "Semester 2", "Semester 3", "Semester 4", "Semester 5", "Semester 6", "Semester 7", "Semester 8"];

  // Real upload flow: upload to Cloudinary via /api/upload, then persist
  // metadata via /api/documents, then refresh the list. Degrades gracefully.
  const realUpload = async (fileObj: File) => {
    const fileName = fileObj.name;
    setUploadFileName(fileName);
    setUploadProgress(10);
    setUploadStep("Mengunggah berkas ke penyimpanan aman (Cloudinary)...");

    try {
      const fd = new FormData();
      fd.append("file", fileObj);

      const upRes = await fetch("/api/upload", { method: "POST", body: fd });

      if (upRes.status === 503) {
        // Cloudinary not configured — fall back to a demo simulated add.
        setNotice("Penyimpanan file belum dikonfigurasi (Cloudinary). Menambahkan dalam mode demo.");
        simulateUpload(fileObj);
        return;
      }

      if (upRes.status === 401) {
        setNotice("Masuk terlebih dahulu untuk mengunggah materi asli. Menambahkan dalam mode demo.");
        simulateUpload(fileObj);
        return;
      }

      if (!upRes.ok) {
        const err = await upRes.json().catch(() => ({}));
        setNotice(err?.error || "Gagal mengunggah berkas. Menambahkan dalam mode demo.");
        simulateUpload(fileObj);
        return;
      }

      const meta = await upRes.json();

      // Client-side text extraction (dependency-free). For plain-text formats
      // this yields content that the server splits into chunks and indexes for
      // the AI tutor (RAG). PDF/DOCX/media return "" and are stored only.
      setUploadProgress(45);
      setUploadStep(
        isExtractable(fileObj)
          ? "Mengekstraksi teks untuk pengindeksan Tutor AI..."
          : "Menyimpan berkas (ekstraksi teks belum tersedia untuk format ini)..."
      );
      const textContent = await extractText(fileObj);
      const wasIndexed = textContent.trim().length > 0;

      setUploadProgress(65);
      setUploadStep(
        wasIndexed
          ? "Mengindeks konten ke basis pengetahuan privat Anda..."
          : "Menyimpan metadata berkas dengan aman..."
      );

      const docRes = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: selectedSubject,
          originalName: fileName,
          fileUrl: meta.url,
          publicId: meta.publicId,
          fileType: meta.fileType,
          fileSize: meta.fileSize,
          // Only send extracted plain text; empty string is omitted so the
          // server does not create empty chunks.
          ...(wasIndexed ? { textContent } : {}),
        }),
      });

      setUploadProgress(95);
      setUploadStep(
        wasIndexed
          ? "Selesai. Berkas tersimpan dan terindeks untuk Tutor AI."
          : "Selesai. Berkas tersimpan dengan aman."
      );

      if (docRes.ok) {
        await refreshDocuments();
        // Reflect the honest indexing state on the just-uploaded document.
        if (wasIndexed) {
          setFiles((prev) =>
            prev.map((f) => (f.name === fileName ? { ...f, indexed: true } : f))
          );
        }
        setNotice("");

        // Materi punya tugas? Otomatis buat tenggat untuk mata kuliah yang sama.
        if (addTugas && tugasTitle.trim() && tugasDate && selectedSubject) {
          try {
            await fetch("/api/deadlines", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                courseName: selectedSubject,
                title: tugasTitle.trim(),
                dueDate: tugasDate,
                dueTime: tugasTime || "23:59",
              }),
            });
            setNotice(`Materi tersimpan & tugas "${tugasTitle.trim()}" ditambahkan ke Tugas & Tenggat.`);
            setAddTugas(false);
            setTugasTitle("");
            setTugasDate("");
          } catch {
            setNotice("Materi tersimpan, tapi gagal menambahkan tugas.");
          }
        }
      } else {
        setNotice("Berkas terunggah, namun metadata gagal disimpan.");
      }

      setUploadProgress(100);
      setTimeout(() => setUploadProgress(null), 1200);
    } catch {
      setNotice("Terjadi kendala jaringan. Menambahkan dalam mode demo.");
      simulateUpload(fileObj);
    }
  };

  // Demo/offline fallback: simulate the pipeline locally (no backend).
  const simulateUpload = (fileObj: File) => {
    const fileName = fileObj.name;
    const fileSize = (fileObj.size / (1024 * 1024)).toFixed(1) + " MB";
    const fileType = deriveTypeFromName(fileName);

    setUploadFileName(fileName);
    setUploadProgress(0);
    setUploadStep("Mengunggah berkas (mode demo)...");

    const canIndex = isExtractable(fileObj);
    const newFileId = "demo-" + Date.now();
    const newFile: DocumentFile = {
      id: newFileId,
      name: fileName,
      type: fileType,
      size: fileSize,
      uploadedAt: "Hari ini",
      status: "Processing",
      subject: selectedSubject,
      indexed: canIndex,
    };
    setFiles((prev) => [newFile, ...prev]);

    let currentProgress = 0;
    const interval = setInterval(() => {
      currentProgress += 10;
      setUploadProgress(currentProgress);

      if (currentProgress < 35) {
        setUploadStep("Mengunggah berkas (mode demo)...");
      } else if (currentProgress < 70) {
        setUploadStep(
          canIndex
            ? "Mengekstraksi teks untuk pengindeksan Tutor AI..."
            : "Menyimpan berkas (ekstraksi teks belum tersedia untuk format ini)..."
        );
      } else if (currentProgress < 95) {
        setUploadStep(
          canIndex
            ? "Membuat indeks basis pengetahuan privat..."
            : "Menyimpan metadata berkas..."
        );
      } else {
        setUploadStep(
          canIndex
            ? "Selesai. Berkas tersimpan dan terindeks (mode demo)."
            : "Selesai. Berkas tersimpan (mode demo)."
        );
      }

      if (currentProgress >= 100) {
        clearInterval(interval);
        setFiles((prev) => prev.map((f) => (f.id === newFileId ? { ...f, status: "Indexed" } : f)));
        setInspectingFile({ ...newFile, status: "Indexed" });
        setTimeout(() => setUploadProgress(null), 1500);
      }
    }, 400);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement> | React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);

    let fileObj: File | null = null;
    if ("files" in e.target && (e.target as HTMLInputElement).files && (e.target as HTMLInputElement).files!.length > 0) {
      fileObj = (e.target as HTMLInputElement).files![0];
    } else if ("dataTransfer" in e && e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      fileObj = e.dataTransfer.files[0];
    }

    if (!fileObj) return;

    if (isLoggedIn) {
      realUpload(fileObj);
    } else {
      setNotice("Masuk terlebih dahulu untuk menyimpan materi secara permanen. Berkas ditambahkan dalam mode demo.");
      simulateUpload(fileObj);
    }
  };

  const handleDelete = async (file: DocumentFile) => {
    // Optimistic removal from UI.
    setFiles((prev) => prev.filter((f) => f.id !== file.id));
    if (inspectingFile?.id === file.id) setInspectingFile(null);

    // Persist deletion only for real (non-sample, non-demo) documents.
    const isReal = isLoggedIn && !usingSampleData && !file.id.startsWith("demo-");
    if (isReal) {
      try {
        await fetch(`/api/documents/${file.id}`, { method: "DELETE" });
        await refreshDocuments();
      } catch {
        // ignore — UI already updated optimistically.
      }
    }
  };

  const getFileIcon = (type: DocumentFile["type"]) => {
    switch (type) {
      case "pdf":
      case "docx":
        return <FileTextIcon size={16} className="text-primary" />;
      case "audio":
        return <AudioIcon size={16} className="text-emerald-500" />;
      case "video":
        return <VideoIcon size={16} className="text-amber-500" />;
      case "image":
        return <BookIcon size={16} className="text-pink-500" />;
    }
  };

  // Honest RAG status badge: "Terindeks untuk Tutor AI" only when plain text
  // was actually extracted and chunked; otherwise the file is merely stored.
  const renderIndexBadge = (file: DocumentFile) => {
    if (file.status === "Processing") {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-primary bg-primary/10 px-2.5 py-1 rounded-md border border-primary/20 animate-pulse">
          Memproses...
        </span>
      );
    }
    if (file.status === "Failed") {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-destructive bg-destructive/10 px-2.5 py-1 rounded-md border border-destructive/20">
          Gagal
        </span>
      );
    }
    if (file.indexed) {
      return (
        <span className="inline-flex items-center text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
          <SparklesIcon size={11} className="mr-1.5" /> Terindeks untuk Tutor AI
        </span>
      );
    }
    return (
      <span className="inline-flex items-center text-[10px] font-bold text-muted-foreground bg-muted px-2.5 py-1 rounded-md border border-border">
        <CheckIcon size={11} className="mr-1.5" /> Tersimpan
      </span>
    );
  };

  const isRealDocFile = (file: DocumentFile) =>
    !file.id.startsWith("demo-") && !usingSampleData && !/^\d+$/.test(file.id);

  const handleSummarize = async () => {
    if (!inspectingFile || summarizing) return;
    setSummarizing(true);
    setSummaryContent("");
    try {
      const res = await fetch(`/api/documents/${inspectingFile.id}/summarize`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNotice(err?.error || "Gagal meringkas dokumen.");
        return;
      }
      const data = await res.json();
      setSummaryContent(data?.note?.content || "");
    } catch {
      setNotice("Terjadi kendala koneksi saat meringkas.");
    } finally {
      setSummarizing(false);
    }
  };

  const handleGenerateFlashcards = async () => {
    if (!inspectingFile || flashcardGenerating) return;
    setFlashcardGenerating(true);
    try {
      const res = await fetch("/api/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: inspectingFile.id }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNotice(err?.error || "Gagal membuat flashcard.");
        return;
      }
      const data = await res.json();
      const n = Array.isArray(data.created) ? data.created.length : 0;
      setNotice(`${n} flashcard dibuat dari materi ini. Buka halaman Persiapan Ujian untuk melihatnya.`);
    } catch {
      setNotice("Terjadi kendala koneksi saat membuat flashcard.");
    } finally {
      setFlashcardGenerating(false);
    }
  };

  const handleReindex = async () => {
    if (!inspectingFile || reindexing) return;
    setReindexing(true);
    try {
      const res = await fetch(`/api/documents/${inspectingFile.id}/extract`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setNotice(err?.error || "Gagal mengindeks ulang dokumen.");
        return;
      }
      const data = await res.json();
      setNotice(data.indexed ? `Berhasil mengindeks ${data.chunks} bagian.` : (data.reason || "Tidak ada teks yang bisa diekstraksi."));
      setLoadingChunks(true);
      fetch(`/api/documents/${inspectingFile.id}/chunks`)
        .then((r) => r.json())
        .then((d) => setInspectorChunks(Array.isArray(d) ? d : []))
        .catch(() => setInspectorChunks([]))
        .finally(() => setLoadingChunks(false));
    } catch {
      setNotice("Terjadi kendala koneksi saat mengindeks ulang.");
    } finally {
      setReindexing(false);
    }
  };

  const filteredFiles = selectedSubject ? files.filter(f => f.subject === selectedSubject) : files;

  const containerVariants = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } }
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
            <WorkspaceIcon size={14} /> Basis Pengetahuan
          </div>
          <h1 className="font-display tracking-tight text-3xl sm:text-4xl font-black tracking-tight text-gradient">Ruang Kerja Akademik</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-2 leading-relaxed max-w-2xl">
            Kelola materi kuliah, unggah dokumen, dan bangun basis pengetahuan pribadi untuk Tutor AI Anda.
          </p>
        </div>
      </motion.div>

      {/* Sample / status notice */}
      {(usingSampleData || notice) && (
        <motion.div variants={itemVariants} className="flex items-start gap-2 p-3 rounded-xl border border-amber-400/30 bg-amber-400/10 text-[12px] text-foreground/80">
          <InfoIcon size={15} className="mt-0.5 text-amber-500 shrink-0" />
          <span>{notice || "Menampilkan contoh — masuk untuk mengelola materi asli Anda."}</span>
        </motion.div>
      )}

      {/* Upload Progress */}
      {uploadProgress !== null && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="p-4 rounded-xl border border-primary/20 bg-primary/5 space-y-3 shadow-sm">
          <div className="flex justify-between items-center text-xs">
            <span className="font-semibold text-foreground flex items-center">
              <SparklesIcon size={14} className="mr-2 text-primary animate-spin" />
              Memproses: {uploadFileName}
            </span>
            <span className="font-bold text-primary">{uploadProgress}%</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-[11px] text-muted-foreground italic font-mono">{uploadStep}</p>
        </motion.div>
      )}

      {/* Core Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Side: Semester & Subject Folders */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-4">
          <div className="bg-card border border-border rounded-3xl p-5 space-y-5 shadow-sm">

            {/* Semester selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Pilih Semester</label>
              <div className="relative">
                <select
                  value={selectedSemester}
                  onChange={(e) => {
                    setSelectedSemester(e.target.value);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm font-semibold bg-muted text-foreground border border-transparent focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer appearance-none outline-none transition-all"
                >
                  {semesters.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                  <ChevronIcon size={16} />
                </div>
              </div>
            </div>

            {/* Folder list */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-2">Mata Kuliah</label>
              {subjects.map((sub, idx) => (
                <button
                  key={idx}
                  onClick={() => setSelectedSubject(sub)}
                  className={`w-full text-left px-4 py-3 rounded-xl text-xs font-semibold flex items-center justify-between transition-all ${
                    selectedSubject === sub
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  <span className="truncate pr-2">{sub}</span>
                  <WorkspaceIcon size={14} className={selectedSubject === sub ? "opacity-100" : "opacity-50"} />
                </button>
              ))}
            </div>

            <AddCourseForm
              defaultSemester={Number((selectedSemester || "").replace(/\D/g, "")) || undefined}
              onAdded={() => setCourseRefresh((x) => x + 1)}
            />

            <button
              type="button"
              disabled={autofillingCourses}
              onClick={async () => {
                setAutofillingCourses(true);
                try {
                  const res = await fetch("/api/courses/autofill", { method: "POST" });
                  const data = await res.json();
                  setNotice(data?.message || "");
                  if (data?.created > 0) setCourseRefresh((x) => x + 1);
                } catch {
                  setNotice("Gagal mengisi mata kuliah otomatis.");
                } finally {
                  setAutofillingCourses(false);
                }
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 transition-colors min-h-[42px] disabled:opacity-60"
            >
              {autofillingCourses ? <RefreshIcon size={14} className="animate-spin" /> : <SparklesIcon size={14} />}
              Isi otomatis dari kurikulum prodi
            </button>

          </div>
        </motion.div>

        {/* Center: File Table & Drag Drop Upload */}
        <motion.div variants={itemVariants} className="lg:col-span-3 space-y-6">

          <div className="bg-card border border-border rounded-3xl p-4 space-y-2 shadow-sm">
            <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Mata kuliah untuk materi ini</label>
            <CourseSelect
              value={selectedSubject}
              onChange={setSelectedSubject}
              refreshKey={courseRefresh}
              placeholder="Pilih mata kuliah sebelum mengunggah"
            />
            <p className="text-[11px] text-muted-foreground">Materi yang diunggah akan dikelompokkan ke mata kuliah ini.</p>
            <div className="pt-2 mt-1 border-t border-border">
              <label className="flex items-center gap-2 cursor-pointer select-none py-1">
                <input
                  type="checkbox"
                  checked={addTugas}
                  onChange={(e) => setAddTugas(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
                <span className="text-xs font-semibold text-foreground">Ada tugas dari materi ini?</span>
              </label>
              {addTugas && (
                <div className="space-y-2 mt-2">
                  <input
                    value={tugasTitle}
                    onChange={(e) => setTugasTitle(e.target.value)}
                    placeholder="Judul tugas, mis. Laporan Bab 3"
                    className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-all"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="date"
                      value={tugasDate}
                      onChange={(e) => setTugasDate(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                    />
                    <input
                      type="time"
                      value={tugasTime}
                      onChange={(e) => setTugasTime(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-muted border border-border text-sm text-foreground focus:outline-none focus:border-primary transition-all"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">Tugas otomatis masuk ke Tugas &amp; Tenggat sesuai deadline ini.</p>
                </div>
              )}
            </div>
          </div>

          {/* Drag & Drop Zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileUpload}
            className={`border-2 border-dashed rounded-3xl p-8 transition-all duration-300 text-center flex flex-col items-center justify-center cursor-pointer ${
              isDragging
                ? "border-primary bg-primary/5 scale-[1.02]"
                : "border-border hover:border-primary/50 bg-card hover:bg-muted/30"
            }`}
          >
            <input
              type="file"
              id="file-input"
              onChange={handleFileUpload}
              className="hidden"
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.json,.mp3,.wav,.m4a,.mp4,.png,.jpg,.jpeg"
            />
            <label htmlFor="file-input" className="cursor-pointer space-y-3 flex flex-col items-center">
              <div className="p-4 bg-muted rounded-2xl text-primary shadow-sm group-hover:scale-110 transition-transform">
                <UploadIcon size={28} />
              </div>
              <div className="space-y-1.5">
                <span className="font-bold text-sm text-foreground block">Tarik dan lepaskan materi kuliah di sini, atau klik untuk memilih berkas</span>
                <span className="text-[11px] text-muted-foreground block max-w-md mx-auto leading-relaxed">Mendukung PDF, Word (DOCX), teks (TXT/MD/CSV), gambar (JPG/PNG), audio (MP3), dan video (MP4). Berkas teks otomatis terindeks untuk Tutor AI.</span>
              </div>
            </label>
          </div>

          {/* Files List Table */}
          <div className="bg-card border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="px-6 py-5 border-b border-border flex items-center justify-between bg-muted/30">
              <span className="font-bold text-sm text-foreground">Daftar Dokumen ({filteredFiles.length})</span>
              <span className="text-[11px] text-muted-foreground italic hidden sm:block">Ruang penyimpanan privat dan terisolasi</span>
            </div>

            {uploadProgress !== null ? (
              <div className="p-6 space-y-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="skeleton h-9 w-9 rounded-xl shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="skeleton h-3 w-1/2 rounded" />
                      <div className="skeleton h-2.5 w-1/4 rounded" />
                    </div>
                    <div className="skeleton h-6 w-24 rounded-md" />
                  </div>
                ))}
              </div>
            ) : filteredFiles.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
                  <UploadIcon size={24} />
                </div>
                <p className="text-foreground text-sm font-semibold">Belum ada dokumen pada mata kuliah ini</p>
                <p className="text-muted-foreground text-xs max-w-sm mx-auto leading-relaxed">
                  Unggah materi kuliah Anda untuk mulai membangun basis pengetahuan Tutor AI. Berkas teks akan langsung terindeks.
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-muted/50 text-muted-foreground uppercase tracking-wider text-[10px] border-b border-border">
                      <th className="px-6 py-4 font-semibold">Nama File</th>
                      <th className="px-6 py-4 font-semibold">Ukuran</th>
                      <th className="px-6 py-4 font-semibold">Tanggal Unggah</th>
                      <th className="px-6 py-4 font-semibold">Status Indeks</th>
                      <th className="px-6 py-4 font-semibold text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredFiles.map((file) => (
                      <tr
                        key={file.id}
                        onClick={() => setInspectingFile(file)}
                        className={`hover:bg-muted/50 transition-colors cursor-pointer ${
                          inspectingFile?.id === file.id ? "bg-primary/5 border-l-[3px] border-l-primary" : "border-l-[3px] border-l-transparent"
                        }`}
                      >
                        <td className="px-6 py-4 flex items-center space-x-3 font-medium text-foreground">
                          {getFileIcon(file.type)}
                          <span className="truncate max-w-[200px] md:max-w-xs">{file.name}</span>
                        </td>
                        <td className="px-6 py-4 text-muted-foreground">{file.size}</td>
                        <td className="px-6 py-4 text-muted-foreground">{file.uploadedAt}</td>
                        <td className="px-6 py-4">
                          {renderIndexBadge(file)}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpen(file);
                              }}
                              aria-label={`Buka ${file.name}`}
                              title={isPdf(file) ? "Pratinjau PDF" : "Buka berkas"}
                              className="inline-flex items-center text-muted-foreground hover:text-primary px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors font-semibold min-h-[36px]"
                            >
                              <EyeIcon size={14} className="mr-1.5" /> Buka
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDelete(file);
                              }}
                              aria-label={`Hapus ${file.name}`}
                              className="inline-flex items-center text-muted-foreground hover:text-destructive px-3 py-1.5 rounded-lg hover:bg-destructive/10 transition-colors font-semibold min-h-[36px]"
                            >
                              Hapus
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Chunk Inspector */}
          {inspectingFile && inspectingFile.status === "Indexed" && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-3xl p-6 space-y-5 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h3 className="font-bold text-sm text-foreground flex items-center">
                    <DatabaseIcon size={16} className="mr-2 text-primary" />
                    Inspektor Pengindeksan
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pratinjau potongan teks (chunk) untuk: <span className="font-mono text-foreground font-semibold">{inspectingFile.name}</span>
                  </p>
                </div>
                <span className="text-[10px] font-bold px-3 py-1.5 rounded-md bg-muted text-muted-foreground border border-border font-mono shrink-0">
                  basis pengetahuan privat
                </span>
              </div>

              {/* AI actions — real indexed documents only */}
              {isRealDocFile(inspectingFile) && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={handleSummarize}
                    disabled={summarizing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {summarizing ? <RefreshIcon size={12} className="animate-spin" /> : <SparklesIcon size={12} />}
                    Ringkas
                  </button>
                  <button
                    onClick={handleGenerateFlashcards}
                    disabled={flashcardGenerating}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {flashcardGenerating ? <RefreshIcon size={12} className="animate-spin" /> : <DatabaseIcon size={12} />}
                    Buat Flashcard
                  </button>
                  <button
                    onClick={handleReindex}
                    disabled={reindexing}
                    className="flex items-center gap-1.5 px-3 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl text-xs font-bold transition-all disabled:opacity-60"
                  >
                    {reindexing ? <RefreshIcon size={12} className="animate-spin" /> : <CheckIcon size={12} />}
                    Indeks ulang
                  </button>
                </div>
              )}
              {summaryContent && (
                <div className="rounded-2xl bg-muted/40 border border-border p-4 space-y-2">
                  <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Ringkasan</span>
                  <p className="text-xs text-foreground leading-relaxed whitespace-pre-wrap">{summaryContent}</p>
                </div>
              )}
              {loadingChunks ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshIcon size={18} className="animate-spin text-muted-foreground" />
                </div>
              ) : inspectorChunks.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground text-sm font-medium bg-muted/20 rounded-2xl border border-dashed border-border space-y-2">
                  <p className="font-semibold text-foreground">
                    {inspectingFile.indexed
                      ? "Konten berkas ini telah terindeks untuk Tutor AI."
                      : "Pratinjau potongan teks belum tersedia untuk berkas ini."}
                  </p>
                  <p className="text-xs leading-relaxed max-w-md mx-auto">
                    Konten teks (TXT, MD, CSV, JSON) diekstraksi di peramban dan diindeks secara aman ke basis pengetahuan privat Anda. Berkas PDF, DOCX, gambar, audio, dan video saat ini hanya disimpan; ekstraksi teksnya memerlukan pustaka tambahan atau pipeline di sisi server.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {inspectorChunks.map((chunk, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.04 }}
                      className="p-5 rounded-2xl bg-muted/30 border border-border space-y-3 hover:border-primary/30 transition-colors"
                    >
                      <span className="font-bold text-xs text-foreground block">Bagian {chunk.chunkIndex + 1}</span>
                      <p className="text-xs text-muted-foreground italic leading-relaxed font-mono">
                        &ldquo;{chunk.content}&rdquo;
                      </p>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </motion.div>

      </div>

      {/* In-app PDF viewer (browsers render PDFs natively via <iframe>). */}
      <AnimatePresence>
        {viewerFile && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label={`Pratinjau dokumen ${viewerFile.name}`}
            onClick={() => setViewerFile(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 12 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              className="bg-card border border-border rounded-3xl shadow-xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Title bar */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-muted/30 shrink-0">
                <div className="flex items-center gap-2.5 min-w-0">
                  <FileTextIcon size={18} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">{viewerFile.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{viewerFile.subject}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {viewerFile.fileUrl && (
                    <a
                      href={viewerFile.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-primary px-3 py-2 rounded-lg hover:bg-primary/10 transition-colors min-h-[40px]"
                    >
                      <ExternalLinkIcon size={14} /> Buka di tab baru
                    </a>
                  )}
                  <button
                    ref={viewerCloseRef}
                    onClick={() => setViewerFile(null)}
                    aria-label="Tutup pratinjau"
                    className="inline-flex items-center justify-center w-10 h-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  >
                    <CloseIcon size={18} />
                  </button>
                </div>
              </div>

              {/* Document frame */}
              <div className="flex-1 bg-muted/20 min-h-0 relative flex items-center justify-center">
                {viewerFile.fileUrl ? (
                  viewerFile.type === "image" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={viewerFile.fileUrl} alt={viewerFile.name} className="max-w-full max-h-full object-contain p-4" />
                  ) : viewerFile.type === "video" ? (
                    <video src={viewerFile.fileUrl} controls className="max-w-full max-h-full p-4" />
                  ) : viewerFile.type === "audio" ? (
                    <audio src={viewerFile.fileUrl} controls className="w-full max-w-md p-4" />
                  ) : (
                    <iframe
                      src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewerFile.fileUrl)}&embedded=true`}
                      title={`Pratinjau ${viewerFile.name}`}
                      className="w-full h-full border-0"
                    />
                  )
                ) : (
                  <div className="h-full flex items-center justify-center p-8 text-center w-full">
                    <p className="text-sm text-muted-foreground max-w-sm leading-relaxed">
                      Pratinjau tidak tersedia karena berkas ini belum memiliki tautan penyimpanan (mode contoh atau demo).
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </motion.div>
  );
}
