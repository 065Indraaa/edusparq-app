"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users,
  Building2,
  Plus,
  Trash2,
  CheckCircle2,
  Calendar,
  GraduationCap,
  Megaphone,
  FileText,
  UserPlus,
  Crown,
  Search,
  ChevronRight,
  X,
  Loader2,
  Hash,
} from "lucide-react";
import { useSession } from "next-auth/react";

// ─── Animation variants ────────────────────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

// ─── Types ────────────────────────────────────────────────────────────────
interface Org {
  _id: string;
  nama: string;
  prodi?: string;
  fakultas?: string;
  universitas?: string;
  visi?: string;
  misi?: string;
  joinCode: string;
  ownerId: string;
}

interface OrgMember {
  _id: string;
  userId: string;
  nama: string;
  role: string;
  status: string;
}

interface Section {
  _id: string;
  nama: string;
  deskripsi?: string;
}

interface ProgjaItem {
  _id: string;
  nama: string;
  deskripsi?: string;
  tujuan?: string;
  mulai?: string;
  selesai?: string;
  anggaran?: number;
  picNama?: string;
  status: string;
}

interface MentoringItem {
  _id: string;
  mentorNama?: string;
  menteeNama?: string;
  courseName?: string;
  jadwal?: string;
  status: string;
  catatan?: string;
}

interface AlumniItem {
  _id: string;
  nama: string;
  tahunLulus?: string;
  pekerjaan?: string;
  perusahaan?: string;
  posisi?: string;
  kontak?: string;
  linkedin?: string;
  bersediaKonsultasi?: boolean;
}

interface AdvocacyItem {
  _id: string;
  pelaporNama?: string;
  kategori?: string;
  judul: string;
  isi?: string;
  status: string;
  nomorTiket?: string;
  createdAt: string;
}

interface DocItem {
  _id: string;
  periode?: string;
  jenis?: string;
  judul: string;
  fileUrl?: string;
  uploadedByNama?: string;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────
const STATUS_PROGJA: Record<string, { label: string; color: string }> = {
  rencana: { label: "Rencana", color: "bg-amber-400/10 text-amber-600 dark:text-amber-400" },
  berjalan: { label: "Berjalan", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  selesai: { label: "Selesai", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  batal: { label: "Batal", color: "bg-destructive/10 text-destructive" },
};
const STATUS_MENTORING: Record<string, { label: string; color: string }> = {
  dijadwalkan: { label: "Dijadwalkan", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  selesai: { label: "Selesai", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  batal: { label: "Batal", color: "bg-destructive/10 text-destructive" },
};
const STATUS_ADVOCACY: Record<string, { label: string; color: string }> = {
  baru: { label: "Baru", color: "bg-amber-400/10 text-amber-600 dark:text-amber-400" },
  diproses: { label: "Diproses", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  selesai: { label: "Selesai", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
};
const ROLE_LABELS: Record<string, string> = {
  ketua: "Ketua",
  wakil: "Wakil Ketua",
  sekretaris: "Sekretaris",
  bendahara: "Bendahara",
  kadiv: "Kadiv",
  anggota: "Anggota",
};

function Badge({ status, map }: { status: string; map: Record<string, { label: string; color: string }> }) {
  const s = map[status] ?? { label: status, color: "bg-muted text-muted-foreground" };
  return (
    <span className={`inline-block text-xs font-bold px-2.5 py-0.5 rounded-lg ${s.color}`}>
      {s.label}
    </span>
  );
}

function inputCls() {
  return "w-full px-4 py-3 rounded-2xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
}
function btnPrimary(extra = "") {
  return `inline-flex items-center justify-center gap-2 py-3 px-6 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-2xl transition-all disabled:opacity-60 shadow-sm ${extra}`;
}

// ─── Main Page ────────────────────────────────────────────────────────────
export default function HimaPage() {
  const { data: sessionData } = useSession();
  const myId = sessionData?.user?.id || null;

  const [orgs, setOrgs] = useState<Org[]>([]);
  const [loadingOrgs, setLoadingOrgs] = useState(true);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);

  // Create/join screen
  const [showForm, setShowForm] = useState<"create" | "join" | null>(null);
  const [formError, setFormError] = useState("");
  const [formLoading, setFormLoading] = useState(false);

  // Create fields
  const [createNama, setCreateNama] = useState("");
  const [createProdi, setCreateProdi] = useState("");
  const [createFakultas, setCreateFakultas] = useState("");
  const [createUniversitas, setCreateUniversitas] = useState("");
  const [createVisi, setCreateVisi] = useState("");
  const [createMisi, setCreateMisi] = useState("");

  // Join field
  const [joinCode, setJoinCode] = useState("");

  // Dashboard data
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [progjaList, setProgjaList] = useState<ProgjaItem[]>([]);
  const [mentoringList, setMentoringList] = useState<MentoringItem[]>([]);
  const [alumniList, setAlumniList] = useState<AlumniItem[]>([]);
  const [advocacyList, setAdvocacyList] = useState<AdvocacyItem[]>([]);
  const [docList, setDocList] = useState<DocItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Active tab
  type Tab = "dashboard" | "progja" | "mentoring" | "alumni" | "advokasi" | "dokumen";
  const [activeTab, setActiveTab] = useState<Tab>("dashboard");

  // Copied joinCode
  const [copied, setCopied] = useState(false);

  // ── Alumni search ──────────────────────────────────────────────────────
  const [alumniSearch, setAlumniSearch] = useState("");

  // ── Add forms ─────────────────────────────────────────────────────────
  const [showProgjaForm, setShowProgjaForm] = useState(false);
  const [showMentoringForm, setShowMentoringForm] = useState(false);
  const [showAlumniForm, setShowAlumniForm] = useState(false);
  const [showAdvocacyForm, setShowAdvocacyForm] = useState(false);
  const [showDocForm, setShowDocForm] = useState(false);

  // ── Progja form fields ────────────────────────────────────────────────
  const [pjNama, setPjNama] = useState("");
  const [pjDeskripsi, setPjDeskripsi] = useState("");
  const [pjTujuan, setPjTujuan] = useState("");
  const [pjMulai, setPjMulai] = useState("");
  const [pjSelesai, setPjSelesai] = useState("");
  const [pjAnggaran, setPjAnggaran] = useState("");
  const [pjPic, setPjPic] = useState("");
  const [pjSubmitting, setPjSubmitting] = useState(false);

  // ── Mentoring form fields ──────────────────────────────────────────────
  const [mMentorNama, setMMentorNama] = useState("");
  const [mMenteeNama, setMMenteeNama] = useState("");
  const [mCourse, setMCourse] = useState("");
  const [mJadwal, setMJadwal] = useState("");
  const [mCatatan, setMCatatan] = useState("");
  const [mSubmitting, setMSubmitting] = useState(false);

  // ── Alumni form fields ─────────────────────────────────────────────────
  const [aNama, setANama] = useState("");
  const [aTahun, setATahun] = useState("");
  const [aPekerjaan, setAPekerjaan] = useState("");
  const [aPerusahaan, setAPerusahaan] = useState("");
  const [aPosisi, setAPosisi] = useState("");
  const [aKontak, setAKontak] = useState("");
  const [aLinkedin, setALinkedin] = useState("");
  const [aKonsultasi, setAKonsultasi] = useState(false);
  const [aSubmitting, setASubmitting] = useState(false);

  // ── Advocacy form fields ───────────────────────────────────────────────
  const [advKategori, setAdvKategori] = useState("");
  const [advJudul, setAdvJudul] = useState("");
  const [advIsi, setAdvIsi] = useState("");
  const [advAnonim, setAdvAnonim] = useState(false);
  const [advSubmitting, setAdvSubmitting] = useState(false);

  // ── Document form fields ───────────────────────────────────────────────
  const [docPeriode, setDocPeriode] = useState("");
  const [docJenis, setDocJenis] = useState("");
  const [docJudul, setDocJudul] = useState("");
  const [docFileUrl, setDocFileUrl] = useState("");
  const [docSubmitting, setDocSubmitting] = useState(false);

  // ── Load orgs ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionData?.user) return;
    let active = true;
    setLoadingOrgs(true);
    fetch("/api/hima/orgs")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!active) return;
        const list: Org[] = Array.isArray(data) ? data : [];
        setOrgs(list);
        if (list.length > 0) setActiveOrg(list[0]);
      })
      .catch(() => active && setOrgs([]))
      .finally(() => active && setLoadingOrgs(false));
    return () => { active = false; };
  }, [sessionData]);

  // ── Load org detail when activeOrg changes ──────────────────────────────
  useEffect(() => {
    if (!activeOrg) return;
    let active = true;
    setDataLoading(true);
    const orgId = activeOrg._id;

    Promise.all([
      fetch(`/api/hima/${orgId}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([detail]) => {
      if (!active || !detail) return;
      setMembers(Array.isArray(detail.members) ? detail.members : []);
      setSections(Array.isArray(detail.sections) ? detail.sections : []);
    }).finally(() => active && setDataLoading(false));

    return () => { active = false; };
  }, [activeOrg?._id]);

  // ── Load tab data lazily ───────────────────────────────────────────────
  const loadTabData = useCallback(
    async (tab: Tab) => {
      if (!activeOrg) return;
      const orgId = activeOrg._id;
      if (tab === "progja") {
        const data = await fetch(`/api/hima/progja?orgId=${orgId}`).then((r) => r.ok ? r.json() : []).catch(() => []);
        setProgjaList(Array.isArray(data) ? data : []);
      } else if (tab === "mentoring") {
        const data = await fetch(`/api/hima/mentoring?orgId=${orgId}`).then((r) => r.ok ? r.json() : []).catch(() => []);
        setMentoringList(Array.isArray(data) ? data : []);
      } else if (tab === "alumni") {
        const data = await fetch(`/api/hima/alumni?orgId=${orgId}`).then((r) => r.ok ? r.json() : []).catch(() => []);
        setAlumniList(Array.isArray(data) ? data : []);
      } else if (tab === "advokasi") {
        const data = await fetch(`/api/hima/advocacy?orgId=${orgId}`).then((r) => r.ok ? r.json() : []).catch(() => []);
        setAdvocacyList(Array.isArray(data) ? data : []);
      } else if (tab === "dokumen") {
        const data = await fetch(`/api/hima/documents?orgId=${orgId}`).then((r) => r.ok ? r.json() : []).catch(() => []);
        setDocList(Array.isArray(data) ? data : []);
      }
    },
    [activeOrg]
  );

  const switchTab = (tab: Tab) => {
    setActiveTab(tab);
    loadTabData(tab);
  };

  // ─── Auth guard ─────────────────────────────────────────────────────────
  if (!sessionData?.user) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center">
        <div className="space-y-3">
          <Building2 size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">Masuk untuk menggunakan fitur HIMA.</p>
        </div>
      </div>
    );
  }

  // ─── Loading orgs ────────────────────────────────────────────────────────
  if (loadingOrgs) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 w-full rounded-3xl" />
        ))}
      </div>
    );
  }

  // ─── No org: create / join screen ────────────────────────────────────────
  if (!activeOrg) {
    const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!createNama.trim()) return;
      setFormLoading(true);
      setFormError("");
      try {
        const res = await fetch("/api/hima/orgs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "create",
            nama: createNama,
            prodi: createProdi,
            fakultas: createFakultas,
            universitas: createUniversitas,
            visi: createVisi,
            misi: createMisi,
          }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || "Gagal membuat organisasi."); return; }
        setOrgs((prev) => [data, ...prev]);
        setActiveOrg(data);
        setShowForm(null);
      } catch {
        setFormError("Terjadi kesalahan jaringan.");
      } finally {
        setFormLoading(false);
      }
    };

    const handleJoin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!joinCode.trim()) return;
      setFormLoading(true);
      setFormError("");
      try {
        const res = await fetch("/api/hima/orgs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "join", joinCode: joinCode.toUpperCase() }),
        });
        const data = await res.json();
        if (!res.ok) { setFormError(data.error || "Kode tidak ditemukan."); return; }
        setOrgs((prev) => (prev.find((o) => o._id === data._id) ? prev : [data, ...prev]));
        setActiveOrg(data);
        setShowForm(null);
        setJoinCode("");
      } catch {
        setFormError("Terjadi kesalahan jaringan.");
      } finally {
        setFormLoading(false);
      }
    };

    return (
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-3xl mx-auto pt-4">
        <motion.div variants={itemVariants} className="relative overflow-hidden text-center space-y-3 rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-6 sm:p-8 shadow-sm">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto">
            <Building2 size={32} className="text-primary" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient">Sistem Informasi HIMA</h1>
          <p className="text-sm text-muted-foreground">Buat organisasi baru atau bergabung dengan kode undangan.</p>
        </motion.div>

        {formError && (
          <motion.p variants={itemVariants} className="text-xs font-semibold text-destructive text-center bg-destructive/10 px-4 py-2 rounded-xl">
            {formError}
          </motion.p>
        )}

        <motion.div variants={itemVariants} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <button
            onClick={() => { setShowForm("create"); setFormError(""); }}
            className={`p-5 sm:p-6 rounded-[1.75rem] border text-center space-y-3 transition-all hover:shadow-md ${showForm === "create" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Plus size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Buat HIMA</p>
              <p className="text-xs text-muted-foreground mt-1">Daftarkan organisasi baru</p>
            </div>
          </button>
          <button
            onClick={() => { setShowForm("join"); setFormError(""); }}
            className={`p-5 sm:p-6 rounded-[1.75rem] border text-center space-y-3 transition-all hover:shadow-md ${showForm === "join" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <UserPlus size={24} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Gabung HIMA</p>
              <p className="text-xs text-muted-foreground mt-1">Masukkan kode undangan</p>
            </div>
          </button>
        </motion.div>

        {showForm === "create" && (
          <motion.form
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreate}
            className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-bold text-foreground">Detail Organisasi Baru</h2>
            <input required value={createNama} onChange={(e) => setCreateNama(e.target.value)} placeholder="Nama HIMA / organisasi *" className={inputCls()} />
            <input value={createProdi} onChange={(e) => setCreateProdi(e.target.value)} placeholder="Program studi" className={inputCls()} />
            <input value={createFakultas} onChange={(e) => setCreateFakultas(e.target.value)} placeholder="Fakultas" className={inputCls()} />
            <input value={createUniversitas} onChange={(e) => setCreateUniversitas(e.target.value)} placeholder="Universitas" className={inputCls()} />
            <textarea value={createVisi} onChange={(e) => setCreateVisi(e.target.value)} placeholder="Visi (opsional)" rows={2} className={inputCls() + " resize-none"} />
            <textarea value={createMisi} onChange={(e) => setCreateMisi(e.target.value)} placeholder="Misi (opsional)" rows={2} className={inputCls() + " resize-none"} />
            <button type="submit" disabled={formLoading} className={btnPrimary("w-full")}>
              {formLoading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
              {formLoading ? "Membuat..." : "Buat Organisasi"}
            </button>
          </motion.form>
        )}

        {showForm === "join" && (
          <motion.form
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleJoin}
            className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-bold text-foreground">Kode Undangan</h2>
            <input
              required
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Contoh: ABK3X2"
              className={inputCls() + " font-mono tracking-widest uppercase"}
              maxLength={10}
            />
            <button type="submit" disabled={formLoading} className={btnPrimary("w-full")}>
              {formLoading ? <Loader2 size={16} className="inline animate-spin mr-2" /> : null}
              {formLoading ? "Bergabung..." : "Gabung Organisasi"}
            </button>
          </motion.form>
        )}
      </motion.div>
    );
  }

  // ─── Dashboard (org exists) ──────────────────────────────────────────────
  const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "dashboard", label: "Dashboard", icon: <Building2 size={15} /> },
    { key: "progja", label: "Program Kerja", icon: <CheckCircle2 size={15} /> },
    { key: "mentoring", label: "Mentoring", icon: <GraduationCap size={15} /> },
    { key: "alumni", label: "Alumni", icon: <Crown size={15} /> },
    { key: "advokasi", label: "Advokasi", icon: <Megaphone size={15} /> },
    { key: "dokumen", label: "Dokumen", icon: <FileText size={15} /> },
  ];

  const copyJoinCode = () => {
    navigator.clipboard.writeText(activeOrg.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── Progja submit ─────────────────────────────────────────────────────
  const handleAddProgja = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pjNama.trim()) return;
    setPjSubmitting(true);
    try {
      const res = await fetch("/api/hima/progja", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orgId: activeOrg._id,
          nama: pjNama,
          deskripsi: pjDeskripsi,
          tujuan: pjTujuan,
          mulai: pjMulai,
          selesai: pjSelesai,
          anggaran: pjAnggaran ? Number(pjAnggaran) : 0,
          picNama: pjPic,
        }),
      });
      if (res.ok) {
        const added = await res.json();
        setProgjaList((prev) => [added, ...prev]);
        setPjNama(""); setPjDeskripsi(""); setPjTujuan(""); setPjMulai(""); setPjSelesai(""); setPjAnggaran(""); setPjPic("");
        setShowProgjaForm(false);
      }
    } finally {
      setPjSubmitting(false);
    }
  };

  const handleDeleteProgja = async (id: string) => {
    await fetch(`/api/hima/progja?id=${id}`, { method: "DELETE" });
    setProgjaList((prev) => prev.filter((p) => p._id !== id));
  };

  const handleProgjaStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/hima/progja?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setProgjaList((prev) => prev.map((p) => (p._id === id ? updated : p)));
    }
  };

  // ── Mentoring submit ──────────────────────────────────────────────────
  const handleAddMentoring = async (e: React.FormEvent) => {
    e.preventDefault();
    setMSubmitting(true);
    try {
      const res = await fetch("/api/hima/mentoring", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrg._id, mentorNama: mMentorNama, menteeNama: mMenteeNama, courseName: mCourse, jadwal: mJadwal, catatan: mCatatan }),
      });
      if (res.ok) {
        const added = await res.json();
        setMentoringList((prev) => [added, ...prev]);
        setMMentorNama(""); setMMenteeNama(""); setMCourse(""); setMJadwal(""); setMCatatan("");
        setShowMentoringForm(false);
      }
    } finally {
      setMSubmitting(false);
    }
  };

  const handleDeleteMentoring = async (id: string) => {
    await fetch(`/api/hima/mentoring?id=${id}`, { method: "DELETE" });
    setMentoringList((prev) => prev.filter((m) => m._id !== id));
  };

  // ── Alumni submit ─────────────────────────────────────────────────────
  const handleAddAlumni = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aNama.trim()) return;
    setASubmitting(true);
    try {
      const res = await fetch("/api/hima/alumni", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrg._id, nama: aNama, tahunLulus: aTahun, pekerjaan: aPekerjaan, perusahaan: aPerusahaan, posisi: aPosisi, kontak: aKontak, linkedin: aLinkedin, bersediaKonsultasi: aKonsultasi }),
      });
      if (res.ok) {
        const added = await res.json();
        setAlumniList((prev) => [added, ...prev]);
        setANama(""); setATahun(""); setAPekerjaan(""); setAPerusahaan(""); setAPosisi(""); setAKontak(""); setALinkedin(""); setAKonsultasi(false);
        setShowAlumniForm(false);
      }
    } finally {
      setASubmitting(false);
    }
  };

  const handleDeleteAlumni = async (id: string) => {
    await fetch(`/api/hima/alumni?id=${id}`, { method: "DELETE" });
    setAlumniList((prev) => prev.filter((a) => a._id !== id));
  };

  // ── Advocacy submit ───────────────────────────────────────────────────
  const handleAddAdvocacy = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advJudul.trim()) return;
    setAdvSubmitting(true);
    try {
      const res = await fetch("/api/hima/advocacy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrg._id, kategori: advKategori, judul: advJudul, isi: advIsi, anonim: advAnonim }),
      });
      if (res.ok) {
        const added = await res.json();
        setAdvocacyList((prev) => [added, ...prev]);
        setAdvKategori(""); setAdvJudul(""); setAdvIsi(""); setAdvAnonim(false);
        setShowAdvocacyForm(false);
      }
    } finally {
      setAdvSubmitting(false);
    }
  };

  const handleAdvocacyStatus = async (id: string, status: string) => {
    const res = await fetch(`/api/hima/advocacy?id=${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) {
      const updated = await res.json();
      setAdvocacyList((prev) => prev.map((a) => (a._id === id ? updated : a)));
    }
  };

  // ── Document submit ───────────────────────────────────────────────────
  const handleAddDoc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!docJudul.trim()) return;
    setDocSubmitting(true);
    try {
      const res = await fetch("/api/hima/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: activeOrg._id, periode: docPeriode, jenis: docJenis, judul: docJudul, fileUrl: docFileUrl }),
      });
      if (res.ok) {
        const added = await res.json();
        setDocList((prev) => [added, ...prev]);
        setDocPeriode(""); setDocJenis(""); setDocJudul(""); setDocFileUrl("");
        setShowDocForm(false);
      }
    } finally {
      setDocSubmitting(false);
    }
  };

  const handleDeleteDoc = async (id: string) => {
    await fetch(`/api/hima/documents?id=${id}`, { method: "DELETE" });
    setDocList((prev) => prev.filter((d) => d._id !== id));
  };

  // ── Filtered alumni ───────────────────────────────────────────────────
  const filteredAlumni = alumniList.filter(
    (a) =>
      alumniSearch.trim() === "" ||
      a.nama.toLowerCase().includes(alumniSearch.toLowerCase()) ||
      (a.perusahaan || "").toLowerCase().includes(alumniSearch.toLowerCase())
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-7xl">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <div className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
          <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div className="min-w-0">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em] text-primary mb-4">
                <Crown size={14} /> HIMA Workspace
              </div>
              <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-gradient truncate">{activeOrg.nama}</h1>
              <p className="text-sm text-muted-foreground mt-2">
              {activeOrg.prodi && <span>{activeOrg.prodi} · </span>}
              {activeOrg.universitas && <span>{activeOrg.universitas} · </span>}
              Kode:{" "}
              <button
                onClick={copyJoinCode}
                className="font-mono font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors"
              >
                <Hash size={12} />
                {activeOrg.joinCode}
                {copied ? <CheckCircle2 size={12} /> : null}
              </button>
            </p>
          </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            {orgs.length > 1 && (
              <select
                value={activeOrg._id}
                onChange={(e) => {
                  const org = orgs.find((o) => o._id === e.target.value) || null;
                  setActiveOrg(org);
                  setActiveTab("dashboard");
                }}
                className="px-3 py-2 rounded-xl bg-background/80 border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {orgs.map((o) => (
                  <option key={o._id} value={o._id}>{o.nama}</option>
                ))}
              </select>
            )}
            <button
              onClick={() => setActiveOrg(null)}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border bg-background/70 hover:bg-muted transition-colors"
            >
              + Organisasi Lain
            </button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Tab bar */}
      <motion.div variants={itemVariants}>
        <div className="flex gap-1 overflow-x-auto no-scrollbar rounded-2xl border border-border bg-muted/40 p-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              className={`shrink-0 flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === tab.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Tab content */}
      {dataLoading && activeTab === "dashboard" ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}
        </div>
      ) : (
        <motion.div key={activeTab} variants={itemVariants}>
          {/* ─────────── DASHBOARD TAB ─────────── */}
          {activeTab === "dashboard" && (
            <div className="space-y-6">
              {/* Org info card */}
              <div className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 shadow-sm space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                    <Building2 size={24} className="text-primary" />
                  </div>
                  <div>
                    <h2 className="font-extrabold text-foreground">{activeOrg.nama}</h2>
                    {activeOrg.fakultas && <p className="text-xs text-muted-foreground">{activeOrg.fakultas}</p>}
                  </div>
                </div>
                {(activeOrg.visi || activeOrg.misi) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeOrg.visi && (
                      <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Visi</p>
                        <p className="text-sm text-foreground">{activeOrg.visi}</p>
                      </div>
                    )}
                    {activeOrg.misi && (
                      <div className="bg-muted/50 rounded-2xl p-4 space-y-1">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Misi</p>
                        <p className="text-sm text-foreground">{activeOrg.misi}</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-primary/5 rounded-2xl border border-primary/20">
                  <span className="text-xs font-semibold text-muted-foreground">Kode undangan anggota</span>
                  <button
                    onClick={copyJoinCode}
                    className="font-mono font-bold text-primary text-sm hover:text-primary/80 flex items-center gap-1.5 transition-colors"
                  >
                    <Hash size={14} />
                    {activeOrg.joinCode}
                    {copied ? <CheckCircle2 size={14} className="text-emerald-500" /> : <ChevronRight size={14} />}
                  </button>
                </div>
              </div>

              {/* Members */}
              <div className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 shadow-sm space-y-4">
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <Users size={18} className="text-primary" />
                  Anggota ({members.length})
                </h2>
                {members.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-6">Belum ada anggota terdaftar.</p>
                ) : (
                  <div className="space-y-2">
                    {members.map((m) => (
                      <div key={m._id} className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-indigo-600 flex items-center justify-center font-bold text-xs text-white shrink-0">
                          {(m.nama || "?").charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-foreground truncate">{m.nama || "Anggota"}</p>
                          <p className="text-xs text-muted-foreground">{ROLE_LABELS[m.role] ?? m.role}</p>
                        </div>
                        {m.userId === myId && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/10 text-primary rounded-lg">Kamu</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sections */}
              {sections.length > 0 && (
                <div className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 shadow-sm space-y-4">
                  <h2 className="font-bold text-foreground">Divisi / Seksi</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {sections.map((s) => (
                      <div key={s._id} className="p-4 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                        <p className="font-bold text-sm text-foreground">{s.nama}</p>
                        {s.deskripsi && <p className="text-xs text-muted-foreground mt-1">{s.deskripsi}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─────────── PROGRAM KERJA TAB ─────────── */}
          {activeTab === "progja" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="font-bold text-foreground text-lg">Program Kerja</h2>
                <button
                  onClick={() => setShowProgjaForm((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto"
                >
                  {showProgjaForm ? <X size={14} /> : <Plus size={14} />}
                  {showProgjaForm ? "Batal" : "Tambah Proker"}
                </button>
              </div>

              {showProgjaForm && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddProgja}
                  className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
                >
                  <input required value={pjNama} onChange={(e) => setPjNama(e.target.value)} placeholder="Nama program kerja *" className={inputCls()} />
                  <textarea value={pjDeskripsi} onChange={(e) => setPjDeskripsi(e.target.value)} placeholder="Deskripsi" rows={2} className={inputCls() + " resize-none"} />
                  <textarea value={pjTujuan} onChange={(e) => setPjTujuan(e.target.value)} placeholder="Tujuan" rows={2} className={inputCls() + " resize-none"} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={pjMulai} onChange={(e) => setPjMulai(e.target.value)} placeholder="Tanggal mulai" className={inputCls()} />
                    <input value={pjSelesai} onChange={(e) => setPjSelesai(e.target.value)} placeholder="Tanggal selesai" className={inputCls()} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={pjAnggaran} onChange={(e) => setPjAnggaran(e.target.value)} placeholder="Anggaran (Rp)" type="number" className={inputCls()} />
                    <input value={pjPic} onChange={(e) => setPjPic(e.target.value)} placeholder="PIC / Penanggung jawab" className={inputCls()} />
                  </div>
                  <button type="submit" disabled={pjSubmitting} className={btnPrimary("w-full")}>
                    {pjSubmitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                    {pjSubmitting ? "Menyimpan..." : "Simpan Program Kerja"}
                  </button>
                </motion.form>
              )}

              {progjaList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <CheckCircle2 size={32} className="mx-auto mb-3 opacity-30" />
                  Belum ada program kerja. Tambahkan yang pertama!
                </div>
              ) : (
                <div className="space-y-3">
                  {progjaList.map((pj) => (
                    <div key={pj._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3 group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-bold text-foreground">{pj.nama}</p>
                          {pj.deskripsi && <p className="text-xs text-muted-foreground">{pj.deskripsi}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge status={pj.status} map={STATUS_PROGJA} />
                          <button
                            onClick={() => handleDeleteProgja(pj._id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {pj.mulai && <span className="flex items-center gap-1"><Calendar size={12} />{pj.mulai} — {pj.selesai || "?"}</span>}
                        {pj.picNama && <span>PIC: <strong className="text-foreground">{pj.picNama}</strong></span>}
                        {pj.anggaran ? <span>Anggaran: <strong className="text-foreground">Rp {pj.anggaran.toLocaleString("id-ID")}</strong></span> : null}
                      </div>
                      {/* Status changer */}
                      <div className="flex gap-1.5 flex-wrap">
                        {(["rencana", "berjalan", "selesai", "batal"] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleProgjaStatus(pj._id, st)}
                            disabled={pj.status === st}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors border ${pj.status === st ? "opacity-50 cursor-default border-border" : "border-border hover:border-primary hover:text-primary"}`}
                          >
                            {STATUS_PROGJA[st].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── MENTORING TAB ─────────── */}
          {activeTab === "mentoring" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="font-bold text-foreground text-lg">Sesi Mentoring</h2>
                <button
                  onClick={() => setShowMentoringForm((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto"
                >
                  {showMentoringForm ? <X size={14} /> : <Plus size={14} />}
                  {showMentoringForm ? "Batal" : "Tambah Sesi"}
                </button>
              </div>

              {showMentoringForm && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddMentoring}
                  className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={mMentorNama} onChange={(e) => setMMentorNama(e.target.value)} placeholder="Nama mentor" className={inputCls()} />
                    <input value={mMenteeNama} onChange={(e) => setMMenteeNama(e.target.value)} placeholder="Nama mentee" className={inputCls()} />
                  </div>
                  <input value={mCourse} onChange={(e) => setMCourse(e.target.value)} placeholder="Mata kuliah / topik" className={inputCls()} />
                  <input value={mJadwal} onChange={(e) => setMJadwal(e.target.value)} placeholder="Jadwal (misal: Senin 15 Juni, 14.00)" className={inputCls()} />
                  <textarea value={mCatatan} onChange={(e) => setMCatatan(e.target.value)} placeholder="Catatan (opsional)" rows={2} className={inputCls() + " resize-none"} />
                  <button type="submit" disabled={mSubmitting} className={btnPrimary("w-full")}>
                    {mSubmitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                    {mSubmitting ? "Menyimpan..." : "Simpan Sesi"}
                  </button>
                </motion.form>
              )}

              {mentoringList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <GraduationCap size={32} className="mx-auto mb-3 opacity-30" />
                  Belum ada sesi mentoring. Jadwalkan yang pertama!
                </div>
              ) : (
                <div className="space-y-3">
                  {mentoringList.map((m) => (
                    <div key={m._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm group">
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1 min-w-0">
                          <p className="font-bold text-foreground">{m.courseName || "Mentoring Umum"}</p>
                          <div className="flex gap-3 text-xs text-muted-foreground flex-wrap">
                            {m.mentorNama && <span>Mentor: <strong className="text-foreground">{m.mentorNama}</strong></span>}
                            {m.menteeNama && <span>Mentee: <strong className="text-foreground">{m.menteeNama}</strong></span>}
                          </div>
                          {m.jadwal && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              <Calendar size={11} />{m.jadwal}
                            </p>
                          )}
                          {m.catatan && <p className="text-xs text-muted-foreground italic">{m.catatan}</p>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge status={m.status} map={STATUS_MENTORING} />
                          <button
                            onClick={() => handleDeleteMentoring(m._id)}
                            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── ALUMNI TAB ─────────── */}
          {activeTab === "alumni" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <h2 className="font-bold text-foreground text-lg">Direktori Alumni</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      value={alumniSearch}
                      onChange={(e) => setAlumniSearch(e.target.value)}
                      placeholder="Cari alumni..."
                      className="pl-8 pr-4 py-2 rounded-xl bg-muted border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors w-full sm:w-40"
                    />
                  </div>
                  <button
                    onClick={() => setShowAlumniForm((v) => !v)}
                    className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto"
                  >
                    {showAlumniForm ? <X size={14} /> : <Plus size={14} />}
                    {showAlumniForm ? "Batal" : "Tambah"}
                  </button>
                </div>
              </div>

              {showAlumniForm && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddAlumni}
                  className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input required value={aNama} onChange={(e) => setANama(e.target.value)} placeholder="Nama lengkap *" className={inputCls()} />
                    <input value={aTahun} onChange={(e) => setATahun(e.target.value)} placeholder="Tahun lulus" className={inputCls()} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={aPerusahaan} onChange={(e) => setAPerusahaan(e.target.value)} placeholder="Perusahaan / institusi" className={inputCls()} />
                    <input value={aPosisi} onChange={(e) => setAPosisi(e.target.value)} placeholder="Posisi / jabatan" className={inputCls()} />
                  </div>
                  <input value={aPekerjaan} onChange={(e) => setAPekerjaan(e.target.value)} placeholder="Bidang pekerjaan" className={inputCls()} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={aKontak} onChange={(e) => setAKontak(e.target.value)} placeholder="Kontak (WA / email)" className={inputCls()} />
                    <input value={aLinkedin} onChange={(e) => setALinkedin(e.target.value)} placeholder="LinkedIn URL" className={inputCls()} />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={aKonsultasi} onChange={(e) => setAKonsultasi(e.target.checked)} className="w-4 h-4 accent-primary" />
                    Bersedia untuk konsultasi mahasiswa
                  </label>
                  <button type="submit" disabled={aSubmitting} className={btnPrimary("w-full")}>
                    {aSubmitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                    {aSubmitting ? "Menyimpan..." : "Simpan Data Alumni"}
                  </button>
                </motion.form>
              )}

              {filteredAlumni.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Crown size={32} className="mx-auto mb-3 opacity-30" />
                  {alumniSearch ? "Tidak ada alumni yang cocok." : "Belum ada data alumni."}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filteredAlumni.map((a) => (
                    <div key={a._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm group space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-foreground">{a.nama}</p>
                          {a.tahunLulus && <p className="text-xs text-muted-foreground">Lulus {a.tahunLulus}</p>}
                        </div>
                        <button
                          onClick={() => handleDeleteAlumni(a._id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all shrink-0"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      {(a.posisi || a.perusahaan) && (
                        <p className="text-xs text-foreground">
                          {[a.posisi, a.perusahaan].filter(Boolean).join(" @ ")}
                        </p>
                      )}
                      {a.bersediaKonsultasi && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                          <CheckCircle2 size={10} /> Bersedia konsultasi
                        </span>
                      )}
                      {a.kontak && (
                        <p className="text-xs text-muted-foreground">📞 {a.kontak}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── ADVOKASI TAB ─────────── */}
          {activeTab === "advokasi" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="font-bold text-foreground text-lg">Advokasi Mahasiswa</h2>
                <button
                  onClick={() => setShowAdvocacyForm((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto"
                >
                  {showAdvocacyForm ? <X size={14} /> : <Plus size={14} />}
                  {showAdvocacyForm ? "Batal" : "Buat Tiket"}
                </button>
              </div>

              {showAdvocacyForm && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddAdvocacy}
                  className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={advKategori} onChange={(e) => setAdvKategori(e.target.value)} placeholder="Kategori (misal: Akademik)" className={inputCls()} />
                    <input required value={advJudul} onChange={(e) => setAdvJudul(e.target.value)} placeholder="Judul masalah *" className={inputCls()} />
                  </div>
                  <textarea value={advIsi} onChange={(e) => setAdvIsi(e.target.value)} placeholder="Deskripsi detail masalah..." rows={4} className={inputCls() + " resize-none"} />
                  <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={advAnonim} onChange={(e) => setAdvAnonim(e.target.checked)} className="w-4 h-4 accent-primary" />
                    Kirim secara anonim
                  </label>
                  <button type="submit" disabled={advSubmitting} className={btnPrimary("w-full")}>
                    {advSubmitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                    {advSubmitting ? "Mengirim..." : "Kirim Tiket"}
                  </button>
                </motion.form>
              )}

              {advocacyList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <Megaphone size={32} className="mx-auto mb-3 opacity-30" />
                  Tidak ada tiket advokasi. Buat tiket pertamamu!
                </div>
              ) : (
                <div className="space-y-3">
                  {advocacyList.map((t) => (
                    <div key={t._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-bold text-foreground">{t.judul}</p>
                            {t.kategori && (
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-muted rounded-lg text-muted-foreground">{t.kategori}</span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground">
                            #{t.nomorTiket} · {t.pelaporNama}
                          </p>
                          {t.isi && <p className="text-xs text-muted-foreground line-clamp-2">{t.isi}</p>}
                        </div>
                        <Badge status={t.status} map={STATUS_ADVOCACY} />
                      </div>
                      {/* Status changer */}
                      <div className="flex gap-1.5 flex-wrap">
                        {(["baru", "diproses", "selesai"] as const).map((st) => (
                          <button
                            key={st}
                            onClick={() => handleAdvocacyStatus(t._id, st)}
                            disabled={t.status === st}
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-lg transition-colors border ${t.status === st ? "opacity-50 cursor-default border-border" : "border-border hover:border-primary hover:text-primary"}`}
                          >
                            {STATUS_ADVOCACY[st].label}
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ─────────── DOKUMEN TAB ─────────── */}
          {activeTab === "dokumen" && (
            <div className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <h2 className="font-bold text-foreground text-lg">Arsip Dokumen</h2>
                <button
                  onClick={() => setShowDocForm((v) => !v)}
                  className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/20 px-3 py-2 rounded-xl transition-colors w-full sm:w-auto"
                >
                  {showDocForm ? <X size={14} /> : <Plus size={14} />}
                  {showDocForm ? "Batal" : "Tambah Dokumen"}
                </button>
              </div>

              {showDocForm && (
                <motion.form
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  onSubmit={handleAddDoc}
                  className="bg-card border border-border rounded-[1.75rem] p-4 sm:p-6 space-y-4 shadow-sm"
                >
                  <input required value={docJudul} onChange={(e) => setDocJudul(e.target.value)} placeholder="Judul dokumen *" className={inputCls()} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input value={docPeriode} onChange={(e) => setDocPeriode(e.target.value)} placeholder="Periode (misal: 2024/2025)" className={inputCls()} />
                    <input value={docJenis} onChange={(e) => setDocJenis(e.target.value)} placeholder="Jenis (misal: LPJ, AD/ART)" className={inputCls()} />
                  </div>
                  <input value={docFileUrl} onChange={(e) => setDocFileUrl(e.target.value)} placeholder="URL file (Google Drive, Dropbox, dll)" className={inputCls()} />
                  <button type="submit" disabled={docSubmitting} className={btnPrimary("w-full")}>
                    {docSubmitting ? <Loader2 size={14} className="inline animate-spin mr-2" /> : null}
                    {docSubmitting ? "Menyimpan..." : "Simpan Dokumen"}
                  </button>
                </motion.form>
              )}

              {docList.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  <FileText size={32} className="mx-auto mb-3 opacity-30" />
                  Belum ada dokumen. Tambahkan dokumen organisasi pertama!
                </div>
              ) : (
                <div className="space-y-3">
                  {docList.map((d) => (
                    <div key={d._id} className="bg-card border border-border rounded-3xl p-5 shadow-sm group flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText size={18} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-bold text-foreground text-sm truncate">{d.judul}</p>
                        <div className="flex gap-2 text-xs text-muted-foreground flex-wrap">
                          {d.jenis && <span className="bg-muted px-2 py-0.5 rounded-md font-medium">{d.jenis}</span>}
                          {d.periode && <span>{d.periode}</span>}
                          {d.uploadedByNama && <span>oleh {d.uploadedByNama}</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {d.fileUrl && (
                          <a
                            href={d.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                          >
                            Buka <ChevronRight size={12} />
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteDoc(d._id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
