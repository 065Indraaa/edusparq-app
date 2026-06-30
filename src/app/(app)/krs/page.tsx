"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, Calendar, GraduationCap, Plus, FileText, BookOpen, TrendingUp } from "lucide-react";

interface Course { _id: string; name: string; sks?: number; schedule?: string; }
interface KRS { _id: string; academicYear: string; semester: string; courses: Course[]; status: string; }
interface Grade { _id: string; courseName: string; gradeLetter: string; gradePoint: number; sks: number; semester: string; }
interface StudentContext { gpa?: { ips: number; ipk: number; totalSks: number }; activeCourses?: Course[]; }

const TABS = [
  { id: "import", label: "Import KRS", icon: Upload },
  { id: "active", label: "KRS Aktif", icon: Calendar },
  { id: "grades", label: "Nilai & IPK", icon: GraduationCap },
];

export default function KRSPage() {
  const [tab, setTab] = useState("import");
  const [krsText, setKrsText] = useState("");
  const [parsedCourses, setParsedCourses] = useState<Course[]>([]);
  const [activeKRS, setActiveKRS] = useState<KRS | null>(null);
  const [grades, setGrades] = useState<Grade[]>([]);
  const [studentCtx, setStudentCtx] = useState<StudentContext | null>(null);
  const [loading, setLoading] = useState(false);

  // Grade form state
  const [newGrade, setNewGrade] = useState({ courseName: "", gradeLetter: "A", sks: "3", semester: "" });
  const [gradeMsg, setGradeMsg] = useState("");

  const fetchActiveKRS = useCallback(async () => {
    try {
      const res = await fetch("/api/krs/current");
      if (res.ok) { const data = await res.json(); setActiveKRS(data); }
    } catch {}
  }, []);

  const fetchGrades = useCallback(async () => {
    try {
      const res = await fetch("/api/grades");
      if (res.ok) { const data = await res.json(); setGrades(Array.isArray(data) ? data : []); }
    } catch {}
  }, []);

  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch("/api/student/context");
      if (res.ok) { const data = await res.json(); setStudentCtx(data); }
    } catch {}
  }, []);

  useEffect(() => { fetchActiveKRS(); fetchGrades(); fetchContext(); }, [fetchActiveKRS, fetchGrades, fetchContext]);

  const handleParse = async () => {
    if (!krsText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/krs/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: krsText }),
      });
      if (res.ok) {
        const data = await res.json();
        setParsedCourses(data.courses || []);
      }
    } catch {} finally { setLoading(false); }
  };

  const handleAddGrade = async () => {
    if (!newGrade.courseName || !newGrade.semester) { setGradeMsg("Isi semua field"); return; }
    try {
      const res = await fetch("/api/grades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newGrade),
      });
      if (res.ok) {
        setGradeMsg("Nilai ditambahkan!");
        setNewGrade({ courseName: "", gradeLetter: "A", sks: "3", semester: "" });
        fetchGrades();
        fetchContext();
        setTimeout(() => setGradeMsg(""), 3000);
      }
    } catch {}
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground mb-1">KRS & Nilai</h1>
        <p className="text-sm text-muted-foreground">Kelola kartu rencana studi dan pantau IPK Anda.</p>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-xs font-semibold transition-all ${
                tab === t.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "import" && (
        <div className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-5">
            <label className="text-sm font-semibold text-foreground mb-2 block">Tempel teks KRS Anda</label>
            <textarea
              value={krsText}
              onChange={(e) => setKrsText(e.target.value)}
              placeholder="Contoh:&#10;Pemrograman Web - 3 SKS - Senin 08:00&#10;Basis Data - 4 SKS - Selasa 10:00&#10;Algoritma - 3 SKS - Rabu 13:00"
              className="w-full h-40 p-3 text-sm bg-muted rounded-lg border-0 focus:ring-2 focus:ring-primary/30 focus:outline-none resize-none text-foreground placeholder:text-muted-foreground"
            />
            <button
              onClick={handleParse}
              disabled={!krsText.trim() || loading}
              className="mt-3 px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg disabled:opacity-30 flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              {loading ? "Memproses..." : "Parse & Import"}
            </button>
          </div>

          {parsedCourses.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Preview Mata Kuliah</h3>
              <div className="space-y-2">
                {parsedCourses.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <span className="font-medium text-foreground">{c.name}</span>
                    <span className="text-muted-foreground text-xs">{c.sks} SKS</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "active" && (
        <div className="bg-card border border-border rounded-xl p-5">
          <h3 className="text-sm font-bold text-foreground mb-3">KRS Semester Aktif</h3>
          {activeKRS?.courses && activeKRS.courses.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-border">
                    <th className="pb-2 pr-4">No</th>
                    <th className="pb-2 pr-4">Mata Kuliah</th>
                    <th className="pb-2 pr-4">SKS</th>
                    <th className="pb-2">Jadwal</th>
                  </tr>
                </thead>
                <tbody>
                  {activeKRS.courses.map((c, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 pr-4 text-muted-foreground">{i + 1}</td>
                      <td className="py-2 pr-4 font-medium text-foreground">{c.name}</td>
                      <td className="py-2 pr-4 text-muted-foreground">{c.sks || "-"}</td>
                      <td className="py-2 text-muted-foreground">{c.schedule || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">Belum ada KRS aktif. Import KRS Anda di tab pertama.</p>
          )}
        </div>
      )}

      {tab === "grades" && (
        <div className="space-y-4">
          {studentCtx?.gpa && (
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">IPS</p>
                <p className="text-2xl font-bold text-foreground">{studentCtx.gpa.ips?.toFixed(2) || "-"}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">IPK</p>
                <p className="text-2xl font-bold text-foreground">{studentCtx.gpa.ipk?.toFixed(2) || "-"}</p>
              </div>
              <div className="bg-card border border-border rounded-xl p-4 text-center">
                <p className="text-xs text-muted-foreground mb-1">Total SKS</p>
                <p className="text-2xl font-bold text-foreground">{studentCtx.gpa.totalSks || 0}</p>
              </div>
            </div>
          )}

          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-bold text-foreground mb-3">Tambah Nilai</h3>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <input
                value={newGrade.courseName}
                onChange={(e) => setNewGrade({ ...newGrade, courseName: e.target.value })}
                placeholder="Nama Mata Kuliah"
                className="px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-1 focus:ring-primary/30 focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              <select
                value={newGrade.gradeLetter}
                onChange={(e) => setNewGrade({ ...newGrade, gradeLetter: e.target.value })}
                className="px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-1 focus:ring-primary/30 focus:outline-none text-foreground"
              >
                {["A", "AB", "B", "BC", "C", "D", "E"].map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <input
                value={newGrade.sks}
                onChange={(e) => setNewGrade({ ...newGrade, sks: e.target.value })}
                placeholder="SKS"
                type="number"
                className="px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-1 focus:ring-primary/30 focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
              <input
                value={newGrade.semester}
                onChange={(e) => setNewGrade({ ...newGrade, semester: e.target.value })}
                placeholder="Semester (cth: 2024/2025 Ganjil)"
                className="px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:ring-1 focus:ring-primary/30 focus:outline-none text-foreground placeholder:text-muted-foreground"
              />
            </div>
            <button
              onClick={handleAddGrade}
              className="px-4 py-2 bg-primary text-background text-sm font-semibold rounded-lg flex items-center gap-2 hover:opacity-90 transition-opacity"
            >
              <Plus className="w-4 h-4" /> Tambah
            </button>
            {gradeMsg && <p className="mt-2 text-xs text-green-500">{gradeMsg}</p>}
          </div>

          {grades.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-bold text-foreground mb-3">Riwayat Nilai</h3>
              <div className="space-y-2">
                {grades.map((g) => (
                  <div key={g._id} className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm">
                    <div>
                      <span className="font-medium text-foreground">{g.courseName}</span>
                      <span className="text-xs text-muted-foreground ml-2">{g.semester}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{g.sks} SKS</span>
                      <span className={`font-bold ${g.gradePoint >= 3 ? "text-green-500" : g.gradePoint >= 2 ? "text-yellow-500" : "text-red-500"}`}>
                        {g.gradeLetter}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
