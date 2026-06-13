"use client";

import React, { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles, Mail, Lock, User, Eye, EyeOff, ArrowRight, Globe } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ name: "", email: "", password: "" });

  const handleGoogleLogin = () => {
    setLoading(true);
    signIn("google", { callbackUrl: "/dashboard" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (mode === "register") {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Pendaftaran gagal");
          setLoading(false);
          return;
        }
      }

      const result = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (result?.error) {
        setError("Email atau password salah");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Terjadi kesalahan. Coba lagi.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left — Branding Panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-950 dark:bg-slate-900 flex-col justify-between p-12 relative overflow-hidden">
        {/* Background gradient blobs */}
        <div className="absolute top-0 left-0 w-full h-full">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-violet-500/15 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3">
            <div className="bg-primary/20 text-primary p-2.5 rounded-xl border border-primary/30">
              <Sparkles size={22} />
            </div>
            <span className="font-extrabold text-2xl tracking-tight text-white">EduSparq</span>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="text-4xl font-extrabold text-white leading-tight tracking-tight">
            Kuliah lebih cerdas,<br />
            <span className="text-primary">bukan lebih keras.</span>
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            Dari nyatat materi sampai siap ujian — semua ada di satu tempat. 
            Khusus buat mahasiswa Indonesia yang mau kuliah lebih efisien.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {[
              { label: "Tutor AI", desc: "Bimbingan Socratic 24/7" },
              { label: "Manajemen Tugas", desc: "Deadline nggak kelewat" },
              { label: "Asisten Nulis", desc: "Outline & sitasi akademik" },
              { label: "Persiapan UTS", desc: "Prediksi soal dari materi" },
            ].map((f, i) => (
              <div key={i} className="p-3 rounded-xl bg-white/5 border border-white/10">
                <span className="font-bold text-white text-sm block">{f.label}</span>
                <span className="text-slate-400 text-xs">{f.desc}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-slate-600 text-xs">
          © 2026 EduSparq · Dibuat dengan ❤️ untuk mahasiswa Indonesia
        </p>
      </div>

      {/* Right — Auth Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          
          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center space-x-2 justify-center">
            <div className="bg-primary/10 text-primary p-2 rounded-xl">
              <Sparkles size={20} />
            </div>
            <span className="font-extrabold text-xl text-foreground">EduSparq</span>
          </Link>

          {/* Header */}
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
              {mode === "login" ? "Masuk ke akunmu" : "Buat akun baru"}
            </h2>
            <p className="text-muted-foreground text-sm">
              {mode === "login"
                ? "Lanjutkan sesi belajarmu hari ini."
                : "Gratis, tanpa kartu kredit, langsung bisa dipakai."}
            </p>
          </div>

          {/* Google OAuth */}
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-2xl border border-border bg-card hover:bg-muted text-foreground font-semibold text-sm transition-all hover:shadow-sm disabled:opacity-60"
          >
            <Globe size={18} className="text-primary" />
            Lanjutkan dengan Google
          </button>

          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">atau</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <AnimatePresence>
              {mode === "register" && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden"
                >
                  <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nama Lengkap</label>
                  <div className="relative">
                    <User size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                      type="text"
                      required={mode === "register"}
                      placeholder="Budi Santoso"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email kampus</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  required
                  placeholder="budi@ui.ac.id"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="w-full pl-10 pr-4 py-3 rounded-2xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  placeholder={mode === "register" ? "Minimal 8 karakter" : "Password kamu"}
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className="w-full pl-10 pr-12 py-3 rounded-2xl bg-muted border border-border text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium"
              >
                {error}
              </motion.div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm transition-all shadow-sm hover:shadow-md disabled:opacity-60"
            >
              {loading ? (
                <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
              ) : (
                <>
                  {mode === "login" ? "Masuk" : "Daftar sekarang"}
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}{" "}
            <button
              onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
              className="text-primary font-semibold hover:underline"
            >
              {mode === "login" ? "Daftar gratis" : "Masuk"}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
