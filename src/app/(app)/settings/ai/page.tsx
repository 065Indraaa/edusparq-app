"use client";

import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  KeyRound,
  Plus,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  ExternalLink,
  Zap,
  Power,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

interface Provider {
  id: string;
  name: string;
  baseURL: string;
  defaultModel: string;
  models: string[];
  keyUrl: string;
  note: string;
  freeTier?: boolean;
}

interface ApiKeyItem {
  id: string;
  label: string;
  provider: string;
  baseURL: string;
  model: string;
  keyHint: string;
  active: boolean;
  validationStatus: "ok" | "invalid" | "unknown";
  lastValidated: string | null;
}

interface ByokData {
  providers: Provider[];
  keys: ApiKeyItem[];
  byokEnabled: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function AiSettingsPage() {
  const [data, setData] = useState<ByokData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // form add key
  const [showForm, setShowForm] = useState(false);
  const [providerId, setProviderId] = useState("openai");
  const [label, setLabel] = useState("");
  const [baseURL, setBaseURL] = useState("");
  const [model, setModel] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [testOnAdd, setTestOnAdd] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/byok");
      if (!res.ok) throw new Error();
      const d = await res.json();
      setData(d);
    } catch {
      setError("Gagal memuat konfigurasi AI.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Saat provider berubah, prefill baseURL + model.
  useEffect(() => {
    const p = data?.providers.find((x) => x.id === providerId);
    if (p) {
      setBaseURL(p.baseURL);
      setModel(p.defaultModel);
    }
  }, [providerId, data]);

  const handleAdd = async () => {
    if (!apiKey.trim() || !baseURL.trim()) {
      setError("API key dan Base URL wajib diisi.");
      return;
    }
    setAdding(true);
    setError("");
    try {
      const res = await fetch("/api/byok", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          providerId,
          label,
          baseURL,
          model,
          apiKey,
          test: testOnAdd,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Gagal menambah kunci");
      if (testOnAdd && json.key?.validationStatus === "invalid") {
        setError("Koneksi gagal: " + (json.key.validationError || "cek kembali key/baseURL/model"));
      }
      setApiKey("");
      setLabel("");
      setShowForm(false);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal menambah kunci.");
    } finally {
      setAdding(false);
    }
  };

  const handleAction = async (id: string, action: string) => {
    setBusy(`${id}:${action}`);
    try {
      const res = await fetch(`/api/byok/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || "Gagal");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal.");
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const selectedProvider = data?.providers.find((p) => p.id === providerId);

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-4xl">
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          <KeyRound className="w-7 h-7" /> Kunci AI (BYOK)
        </h1>
        <p className="text-muted-foreground mt-1">
          Pakai API key sendiri untuk akses gratis tanpa potong credit EduSparq. Token tetap dihitung untuk statistik.
        </p>
      </motion.div>

      {/* Status banner */}
      <motion.div
        variants={itemVariants}
        className={`rounded-2xl border p-5 ${
          data?.byokEnabled
            ? "border-foreground/30 bg-foreground/[0.03]"
            : "border-dashed border-border bg-card"
        }`}
      >
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                data?.byokEnabled ? "bg-foreground text-background" : "bg-foreground/5"
              }`}
            >
              <Power className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold">
                BYOK: {data?.byokEnabled ? "Aktif" : "Nonaktif"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {data?.byokEnabled
                  ? "Semua panggilan AI pakai kunci Anda sendiri (tidak potong credit)."
                  : "Pakai AI platform EduSparq — credit dipotong per pemakaian."}
              </p>
            </div>
          </div>
          {data?.byokEnabled && (
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground">
              <Zap className="w-3.5 h-3.5" /> Hemat 100% credit
            </span>
          )}
        </div>
      </motion.div>

      {error && (
        <div className="rounded-xl border border-foreground/20 bg-foreground/5 p-3 flex items-start gap-2 text-sm">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{error}</span>
          <button onClick={() => setError("")} className="ml-auto text-muted-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Existing keys */}
      <motion.div variants={itemVariants} className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold">Kunci Tersimpan</h2>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-foreground text-background font-bold text-sm"
          >
            <Plus className="w-4 h-4" /> Tambah Kunci
          </button>
        </div>

        {data?.keys.length === 0 && !showForm && (
          <div className="rounded-2xl border border-dashed border-border p-10 text-center">
            <KeyRound className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Belum ada kunci. Tambahkan kunci API dari provider pilihan Anda untuk mulai hemat credit.
            </p>
          </div>
        )}

        {data?.keys.map((k) => (
          <div
            key={k.id}
            className={`rounded-2xl border p-5 ${
              k.active ? "border-foreground/40 bg-foreground/[0.02]" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold">{k.label}</p>
                  {k.active && (
                    <span className="px-2 py-0.5 rounded-full bg-foreground text-background text-[10px] font-black uppercase tracking-wider">
                      Aktif
                    </span>
                  )}
                  <ValidationBadge status={k.validationStatus} />
                </div>
                <div className="text-xs text-muted-foreground mt-1.5 space-y-0.5 font-mono">
                  <p>Provider: {k.provider}</p>
                  <p>Model: {k.model || "(default)"}</p>
                  <p>Base URL: {k.baseURL}</p>
                  <p>Key: {k.keyHint}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {!k.active && (
                  <button
                    onClick={() => handleAction(k.id, "activate")}
                    disabled={busy === `${k.id}:activate`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-foreground text-background text-xs font-bold disabled:opacity-50"
                  >
                    {busy === `${k.id}:activate` ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Power className="w-3.5 h-3.5" />
                    )}
                    Aktifkan
                  </button>
                )}
                {k.active && (
                  <button
                    onClick={() => handleAction(k.id, "deactivate")}
                    disabled={busy === `${k.id}:deactivate`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-bold disabled:opacity-50"
                  >
                    Matikan
                  </button>
                )}
                <button
                  onClick={() => handleAction(k.id, "test")}
                  disabled={busy === `${k.id}:test`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold disabled:opacity-50"
                >
                  {busy === `${k.id}:test` ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3.5 h-3.5" />
                  )}
                  Test
                </button>
                <button
                  onClick={() => handleAction(k.id, "delete")}
                  disabled={busy === `${k.id}:delete`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Add form */}
      {showForm && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-border bg-card p-6 space-y-4"
        >
          <h3 className="font-bold">Tambah Kunci Baru</h3>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Provider
            </label>
            <select
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
            >
              {data?.providers.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                  {p.freeTier ? " (gratis)" : ""}
                </option>
              ))}
            </select>
            {selectedProvider?.note && (
              <p className="text-xs text-muted-foreground mt-1.5">{selectedProvider.note}</p>
            )}
            {selectedProvider?.keyUrl && (
              <a
                href={selectedProvider.keyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold mt-1.5"
              >
                Dapatkan API key <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Label (opsional)
              </label>
              <input
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="mis. OpenAI personal"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Model
              </label>
              {selectedProvider && selectedProvider.models.length > 0 ? (
                <select
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                >
                  {selectedProvider.models.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                  {model && !selectedProvider.models.includes(model) && (
                    <option value={model}>{model}</option>
                  )}
                </select>
              ) : (
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder="nama model"
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm"
                />
              )}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Base URL
            </label>
            <input
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono"
            />
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm font-mono"
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              Disimpan terenkripsi (AES-256-GCM). Tidak pernah ditampilkan lagi.
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={testOnAdd}
              onChange={(e) => setTestOnAdd(e.target.checked)}
              className="rounded"
            />
            Tes koneksi sebelum menyimpan (rekomendasi)
          </label>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background font-bold text-sm disabled:opacity-50"
            >
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {adding ? "Menyimpan..." : "Simpan Kunci"}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2.5 rounded-xl border border-border text-sm font-semibold"
            >
              Batal
            </button>
          </div>
        </motion.div>
      )}

      {/* Help note */}
      <motion.div variants={itemVariants} className="rounded-xl bg-card border border-border p-4 text-sm text-muted-foreground">
        <p className="font-semibold text-foreground mb-1">💡 Tips hemat</p>
        <p>
          Untuk penggunaan harian, provider dengan free tier (Gemini, Groq, Ollama) cukup dan gratis total.
          Simpan credit EduSparq untuk tugas berat (solver, makalah panjang) yang butuh model besar.
        </p>
      </motion.div>
    </motion.div>
  );
}

function ValidationBadge({ status }: { status: "ok" | "invalid" | "unknown" }) {
  if (status === "ok") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-foreground">
        <CheckCircle2 className="w-3 h-3" /> valid
      </span>
    );
  }
  if (status === "invalid") {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
        <XCircle className="w-3 h-3" /> tidak valid
      </span>
    );
  }
  return null;
}
