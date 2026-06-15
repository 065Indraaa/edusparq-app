"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Sparkles, Plus, CheckCircle2, MessageSquare, Save, LogIn, Hash, Copy, Check, Trash2, FileText, ExternalLink, BarChart3, List } from "lucide-react";
import { useSession } from "next-auth/react";
import PusherClient from "pusher-js";

interface Member {
  userId: string;
  name: string;
  joinedAt: string;
}

interface Group {
  _id: string;
  name: string;
  joinCode: string;
  ownerId: string;
  members: Member[];
}

interface GroupTask {
  _id: string;
  title: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
  assigneeUserId?: string;
  bobotKontribusi?: number;
}

interface Poll {
  _id: string;
  question: string;
  options: { _id: string; label: string; voterIds: string[] }[];
}

interface ContributionItem {
  userId: string;
  nama: string;
  selesai: number;
  totalBobot: number;
  persen: number;
}

interface DocLink {
  _id: string;
  judul: string;
  googleDocUrl: string;
  createdByNama: string;
  createdAt: string;
}

function detectRealtime(): { enabled: boolean; key: string; cluster: string } {
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY || "";
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "";
  const enabled =
    key.trim().length > 0 &&
    cluster.trim().length > 0 &&
    !key.toLowerCase().includes("your");
  return { enabled, key, cluster };
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 26 } },
};

export default function CollabPage() {
  const { data: session } = useSession();
  const myId = session?.user?.id || null;
  const myName = session?.user?.name || "Saya";

  const realtimeRef = useRef(detectRealtime());
  const [realtimeEnabled] = useState(() => realtimeRef.current.enabled);

  // Group state
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeGroup, setActiveGroup] = useState<Group | null>(null);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // Group creation/join UI
  const [showGroupForm, setShowGroupForm] = useState<"create" | "join" | null>(null);
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupError, setGroupError] = useState("");
  const [copied, setCopied] = useState(false);

  // Tasks
  const [tasks, setTasks] = useState<GroupTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");

  // Contributions
  const [contributions, setContributions] = useState<ContributionItem[]>([]);
  // Dokumen Google
  const [docLinks, setDocLinks] = useState<DocLink[]>([]);
  const [newDocJudul, setNewDocJudul] = useState("");
  const [newDocUrl, setNewDocUrl] = useState("");
  const [showDocForm, setShowDocForm] = useState(false);
  const [docLinkError, setDocLinkError] = useState("");
  // Task assignment extension
  const [newTaskBobot, setNewTaskBobot] = useState(1);
  const [newTaskAssigneeUserId, setNewTaskAssigneeUserId] = useState("");

  // Shared doc
  const [docContent, setDocContent] = useState("");
  const [savingDoc, setSavingDoc] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);

  // Poll
  const [poll, setPoll] = useState<Poll | null>(null);
  const [myVotedOptionId, setMyVotedOptionId] = useState<string | null>(null);

  // Realtime
  const docDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load groups on mount
  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    setLoadingGroups(true);
    fetch("/api/collab/groups")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        if (!active) return;
        const gs: Group[] = Array.isArray(data) ? data : [];
        setGroups(gs);
        if (gs.length > 0) setActiveGroup(gs[0]);
      })
      .catch(() => active && setGroups([]))
      .finally(() => active && setLoadingGroups(false));
    return () => { active = false; };
  }, [session]);

  // Load tasks + doc + poll when group changes
  useEffect(() => {
    if (!activeGroup) { setTasks([]); setDocContent(""); setPoll(null); setContributions([]); setDocLinks([]); return; }
    const gid = activeGroup._id;
    let active = true;
    setLoadingTasks(true);

    Promise.all([
      fetch(`/api/collab/tasks?groupId=${gid}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/collab/doc?groupId=${gid}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/collab/poll?groupId=${gid}`).then(r => r.ok ? r.json() : null).catch(() => null),
      fetch(`/api/collab/contributions?groupId=${gid}`).then(r => r.ok ? r.json() : []).catch(() => []),
      fetch(`/api/collab/docs?groupId=${gid}`).then(r => r.ok ? r.json() : []).catch(() => []),
    ]).then(([tasksData, docData, pollData, contribData, docLinksData]) => {
      if (!active) return;
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setDocContent(docData?.content || "");
      setPoll(pollData && pollData._id ? pollData : null);
      setContributions(Array.isArray(contribData) ? contribData : []);
      setDocLinks(Array.isArray(docLinksData) ? docLinksData : []);
      if (pollData?.options && myId) {
        for (const opt of pollData.options) {
          if (opt.voterIds?.includes(myId)) { setMyVotedOptionId(opt._id); break; }
        }
      }
    }).finally(() => active && setLoadingTasks(false));
    return () => { active = false; };
  }, [activeGroup?._id, myId]);

  // Realtime Pusher subscription
  useEffect(() => {
    if (!realtimeEnabled || !activeGroup) return;
    const { key, cluster } = realtimeRef.current;
    const pusher = new PusherClient(key, { cluster });
    const channelName = `collab-${activeGroup._id}`;
    const channel = pusher.subscribe(channelName);
    const fromMe = (p: { senderId?: string }) => !!myId && p?.senderId === myId;

    channel.bind("doc:update", (p: { content?: string; senderId?: string }) => {
      if (fromMe(p)) return;
      if (typeof p?.content === "string") setDocContent(p.content);
    });
    channel.bind("task:update", (p: { tasks?: GroupTask[]; senderId?: string }) => {
      if (fromMe(p)) return;
      if (Array.isArray(p?.tasks)) setTasks(p.tasks);
    });
    channel.bind("typing", (p: { name?: string | null; senderId?: string }) => {
      if (fromMe(p)) return;
      setTypingUser(p?.name ?? null);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2500);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(channelName);
      pusher.disconnect();
    };
  }, [realtimeEnabled, activeGroup?._id, myId]);

  const broadcast = useCallback((event: string, data: unknown) => {
    if (!realtimeEnabled || !activeGroup) return;
    fetch("/api/collab", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channel: `collab-${activeGroup._id}`, event, data }),
    }).catch(() => {});
  }, [realtimeEnabled, activeGroup]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupName.trim()) return;
    setGroupLoading(true);
    setGroupError("");
    try {
      const res = await fetch("/api/collab/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", name: groupName }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupError(data.error || "Gagal membuat grup."); return; }
      setGroups(prev => [data, ...prev]);
      setActiveGroup(data);
      setShowGroupForm(null);
      setGroupName("");
    } catch { setGroupError("Terjadi kesalahan jaringan."); }
    finally { setGroupLoading(false); }
  };

  const handleJoinGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode.trim()) return;
    setGroupLoading(true);
    setGroupError("");
    try {
      const res = await fetch("/api/collab/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "join", joinCode: joinCode.toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) { setGroupError(data.error || "Kode tidak ditemukan."); return; }
      setGroups(prev => prev.find(g => g._id === data._id) ? prev : [data, ...prev]);
      setActiveGroup(data);
      setShowGroupForm(null);
      setJoinCode("");
    } catch { setGroupError("Terjadi kesalahan jaringan."); }
    finally { setGroupLoading(false); }
  };

  const handleDocChange = (value: string) => {
    setDocContent(value);
    if (realtimeEnabled) {
      broadcast("typing", { name: myName, senderId: myId });
      if (docDebounceRef.current) clearTimeout(docDebounceRef.current);
      docDebounceRef.current = setTimeout(() => {
        broadcast("doc:update", { content: value, senderId: myId });
      }, 400);
    }
  };

  const handleSaveDoc = async () => {
    if (!activeGroup) return;
    setSavingDoc(true);
    try {
      await fetch("/api/collab/doc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: activeGroup._id, content: docContent }),
      });
    } finally { setSavingDoc(false); }
  };

  const handleAddTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !activeGroup) return;
    try {
      const res = await fetch("/api/collab/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId: activeGroup._id,
          title: newTaskTitle,
          assignee: newTaskAssigneeUserId
            ? (activeGroup.members.find(m => m.userId === newTaskAssigneeUserId)?.name || newTaskAssignee || "Belum Ditentukan")
            : (newTaskAssignee || "Belum Ditentukan"),
          dueDate: newTaskDate,
          ...(newTaskAssigneeUserId ? { assigneeUserId: newTaskAssigneeUserId } : {}),
          bobotKontribusi: newTaskBobot,
        }),
      });
      if (res.ok) {
        const added = await res.json();
        const next = [...tasks, added];
        setTasks(next);
        broadcast("task:update", { tasks: next, senderId: myId });
        setNewTaskTitle(""); setNewTaskAssignee(""); setNewTaskDate(""); setNewTaskAssigneeUserId(""); setNewTaskBobot(1);
        setShowTaskForm(false);
      }
    } catch {}
  };

  const handleToggleTask = async (task: GroupTask) => {
    if (!activeGroup) return;
    const updated = { ...task, completed: !task.completed };
    const next = tasks.map(t => t._id === task._id ? updated : t);
    setTasks(next);
    try {
      await fetch(`/api/collab/tasks?id=${task._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ completed: updated.completed }),
      });
      broadcast("task:update", { tasks: next, senderId: myId });
    } catch {}
  };

  const handleDeleteTask = async (task: GroupTask) => {
    if (!activeGroup) return;
    const next = tasks.filter(t => t._id !== task._id);
    setTasks(next);
    try {
      await fetch(`/api/collab/tasks?id=${task._id}`, { method: "DELETE" });
      broadcast("task:update", { tasks: next, senderId: myId });
    } catch {}
  };

  const handleVote = async (optionId: string) => {
    if (!poll || !activeGroup || myVotedOptionId) return;
    setMyVotedOptionId(optionId);
    setPoll(prev => prev ? {
      ...prev,
      options: prev.options.map(o => o._id === optionId ? { ...o, voterIds: [...o.voterIds, myId!] } : o)
    } : prev);
    try {
      await fetch(`/api/collab/poll?pollId=${poll._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ optionId }),
      });
    } catch {}
  };

  const copyCode = () => {
    if (!activeGroup) return;
    navigator.clipboard.writeText(activeGroup.joinCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const refreshGroups = () => {
    setActiveGroup(null);
    setLoadingGroups(true);
    fetch("/api/collab/groups")
      .then(r => r.ok ? r.json() : [])
      .then(d => { setGroups(Array.isArray(d) ? d : []); })
      .finally(() => setLoadingGroups(false));
  };

  const handleAddDocLink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocJudul.trim() || !newDocUrl.trim() || !activeGroup) return;
    setDocLinkError("");
    try {
      const res = await fetch("/api/collab/docs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ groupId: activeGroup._id, judul: newDocJudul, googleDocUrl: newDocUrl }),
      });
      if (res.ok) {
        const added = await res.json();
        setDocLinks(prev => [added, ...prev]);
        setNewDocJudul(""); setNewDocUrl(""); setShowDocForm(false); setDocLinkError("");
      } else {
        const d = await res.json();
        setDocLinkError(d.error || "Gagal menambahkan dokumen.");
      }
    } catch { setDocLinkError("Terjadi kesalahan jaringan."); }
  };

  const handleDeleteDocLink = async (id: string) => {
    try {
      await fetch(`/api/collab/docs?id=${id}`, { method: "DELETE" });
      setDocLinks(prev => prev.filter(d => d._id !== id));
    } catch {}
  };

  // ---- No session ----
  if (!session?.user) {
    return (
      <div className="flex items-center justify-center min-h-[400px] text-center">
        <div className="space-y-3">
          <Users size={40} className="mx-auto text-muted-foreground opacity-40" />
          <p className="text-sm font-semibold text-foreground">Masuk untuk menggunakan fitur Kolaborasi.</p>
        </div>
      </div>
    );
  }

  // ---- Loading groups ----
  if (loadingGroups) {
    return (
      <div className="space-y-4">
        {[0, 1, 2].map(i => <div key={i} className="skeleton h-20 w-full rounded-3xl" />)}
      </div>
    );
  }

  // ---- No group — show create/join screen ----
  if (!activeGroup) {
    return (
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6 max-w-xl mx-auto pt-8">
        <motion.div variants={itemVariants} className="text-center space-y-2">
          <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto">
            <Users size={32} className="text-primary" />
          </div>
          <h1 className="font-display tracking-tight text-2xl font-extrabold tracking-tight text-foreground">Kolaborasi Kelompok</h1>
          <p className="text-sm text-muted-foreground">Buat grup baru atau bergabung dengan kode undangan.</p>
        </motion.div>

        {groupError && (
          <motion.p variants={itemVariants} className="text-xs font-semibold text-destructive text-center bg-destructive/10 px-4 py-2 rounded-xl">
            {groupError}
          </motion.p>
        )}

        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-6 mt-12">
          <button
            onClick={() => { setShowGroupForm("create"); setGroupError(""); }}
            className={`p-8 rounded-[2rem] border-2 text-center space-y-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${showGroupForm === "create" ? "border-primary bg-primary/5 shadow-lg shadow-primary/10" : "border-border/50 bg-card/60 backdrop-blur-xl hover:border-primary/40 hover:shadow-md"}`}
          >
            <div className="w-16 h-16 rounded-3xl bg-primary/10 flex items-center justify-center mx-auto shadow-inner">
              <Plus size={32} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Buat Grup</p>
              <p className="text-sm text-muted-foreground mt-1">Mulai ruang kerja baru</p>
            </div>
          </button>
          <button
            onClick={() => { setShowGroupForm("join"); setGroupError(""); }}
            className={`p-8 rounded-[2rem] border-2 text-center space-y-4 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] ${showGroupForm === "join" ? "border-emerald-500 bg-emerald-500/5 shadow-lg shadow-emerald-500/10" : "border-border/50 bg-card/60 backdrop-blur-xl hover:border-emerald-500/40 hover:shadow-md"}`}
          >
            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 flex items-center justify-center mx-auto shadow-inner">
              <LogIn size={32} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-foreground text-lg">Gabung Grup</p>
              <p className="text-sm text-muted-foreground mt-1">Masukkan kode undangan</p>
            </div>
          </button>
        </motion.div>

        {showGroupForm === "create" && (
          <motion.form
            initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onSubmit={handleCreateGroup}
            className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 space-y-5 shadow-xl"
          >
            <h2 className="font-display font-bold text-xl text-foreground">Nama Grup Baru</h2>
            <input
              required value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Misal: Kelompok Skripsi Bab 3"
              className="w-full px-5 py-4 rounded-2xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
            />
            <button
              type="submit" disabled={groupLoading}
              className="w-full py-4 bg-foreground hover:bg-foreground/90 text-background font-bold text-sm rounded-2xl transition-all shadow-md active:scale-[0.98] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {groupLoading && <Sparkles size={16} className="animate-spin" />}
              {groupLoading ? "Membuat Grup..." : "Buat Grup Sekarang"}
            </button>
          </motion.form>
        )}

        {showGroupForm === "join" && (
          <motion.form
            initial={{ opacity: 0, y: 15, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: "spring", stiffness: 300, damping: 25 }}
            onSubmit={handleJoinGroup}
            className="bg-card/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-8 space-y-5 shadow-xl"
          >
            <h2 className="font-display font-bold text-xl text-foreground">Kode Undangan</h2>
            <input
              required value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Misal: ABC123"
              className="w-full px-5 py-4 rounded-2xl bg-muted/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all font-mono tracking-widest uppercase text-center text-xl"
              maxLength={10}
            />
            <button
              type="submit" disabled={groupLoading}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm rounded-2xl transition-all shadow-md shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2"
            >
              {groupLoading && <Sparkles size={16} className="animate-spin" />}
              {groupLoading ? "Memeriksa Kode..." : "Gabung ke Grup"}
            </button>
          </motion.form>
        )}
      </motion.div>
    );
  }

  // ---- Active group view ----
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">

      {/* Header */}
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border/50 bg-gradient-to-br from-primary/10 via-card/80 to-card/80 backdrop-blur-xl p-6 sm:p-8 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1 className="font-display tracking-tight text-3xl font-extrabold text-foreground flex items-center gap-3">
              <Users size={28} className="text-primary" />
              {activeGroup.name}
            </h1>
            <div className="flex items-center gap-3 mt-3">
              <span className="text-sm font-semibold px-3 py-1 bg-muted rounded-lg text-muted-foreground">
                {activeGroup.members.length} Anggota
              </span>
              <button onClick={copyCode} className="group font-mono font-bold text-primary hover:text-primary-foreground hover:bg-primary px-3 py-1 rounded-lg border border-primary/20 hover:border-primary inline-flex items-center gap-2 transition-all active:scale-95 shadow-sm">
                <Hash size={14} />
                {activeGroup.joinCode}
                {copied ? <Check size={14} className="text-emerald-500 group-hover:text-emerald-300" /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {groups.length > 1 && (
              <select
                value={activeGroup._id}
                onChange={e => setActiveGroup(groups.find(g => g._id === e.target.value) || null)}
                className="px-3 py-2 rounded-xl bg-muted border border-border text-xs font-semibold text-foreground focus:outline-none focus:border-primary cursor-pointer"
              >
                {groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}
              </select>
            )}
            <button
              onClick={refreshGroups}
              className="text-xs font-semibold text-muted-foreground hover:text-foreground px-3 py-2 rounded-xl border border-border hover:bg-muted transition-colors"
            >
              + Grup Lain
            </button>
            {realtimeEnabled ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Realtime
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 bg-amber-400/10 text-amber-600 dark:text-amber-400 rounded-lg">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                Lokal
              </span>
            )}
          </div>
        </div>
      </motion.div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Left 2 Cols: Shared Document Editor */}
        <motion.div variants={itemVariants} className="lg:col-span-2 flex flex-col">
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 sm:p-8 shadow-sm flex flex-col flex-1 min-h-[600px] transition-shadow hover:shadow-md">

            {/* Editor Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-5">
              <div className="space-y-1.5">
                <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
                  <FileText size={12} /> Kanvas Utama
                </span>
                <h2 className="font-display font-extrabold text-xl text-foreground">Makalah Kolaborasi</h2>
              </div>

              {/* Member avatars */}
              <div className="flex items-center -space-x-3 hover:space-x-0 transition-all duration-300">
                {activeGroup.members.slice(0, 5).map((m, idx) => {
                  const colors = ["from-primary to-indigo-600", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-pink-400 to-rose-500", "from-purple-400 to-fuchsia-500"];
                  return (
                    <div key={idx} title={m.name} className={`w-10 h-10 rounded-full bg-gradient-to-tr ${colors[idx % colors.length]} border-2 border-card flex items-center justify-center font-bold text-xs text-white cursor-help select-none shadow-sm hover:scale-110 hover:-translate-y-1 transition-transform`}>
                      {(m.name || "?").charAt(0).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Typing indicator */}
            <div className="mt-5 mb-2 h-8 flex items-center">
              {typingUser ? (
                <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 bg-primary/10 text-primary rounded-xl shadow-sm w-fit border border-primary/20">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                  </span>
                  <span>{typingUser} mengetik...</span>
                </motion.div>
              ) : (
                <button onClick={handleSaveDoc} className="flex items-center gap-2 text-xs font-bold px-3.5 py-1.5 bg-muted/50 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-all active:scale-95 border border-border/50">
                  {savingDoc ? <Sparkles size={14} className="animate-spin text-primary" /> : <Save size={14} />}
                  {savingDoc ? "Menyimpan ke Cloud..." : "Penyimpanan Otomatis Aktif"}
                </button>
              )}
            </div>

            {/* Text Editor */}
            <div className="relative flex-1 group">
              <textarea
                value={docContent}
                onChange={(e) => handleDocChange(e.target.value)}
                className="w-full h-full p-6 md:p-8 rounded-[1.5rem] bg-muted/30 border border-border/50 text-[15px] font-serif resize-none leading-[2] text-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all shadow-inner custom-scrollbar selection:bg-primary/20"
                placeholder="Mulai ketik isi makalah bersama di sini..."
              />
            </div>
          </div>
        </motion.div>

        {/* Right 1 Col: Tasks & Poll */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6 flex flex-col">

          {/* Poll (if exists) */}
          {poll && (
            <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-5 hover:shadow-md transition-shadow">
              <div>
                <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                  <MessageSquare size={18} className="text-primary" />
                  Voting Keputusan
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{poll.question}</p>
              </div>

              <div className="space-y-3">
                {poll.options.map((opt) => {
                  const total = poll.options.reduce((a, o) => a + o.voterIds.length, 0);
                  const pct = total > 0 ? (opt.voterIds.length / total) * 100 : 0;
                  const voted = myVotedOptionId === opt._id;
                  return (
                    <button
                      key={opt._id}
                      onClick={() => handleVote(opt._id)}
                      disabled={!!myVotedOptionId}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 space-y-3 relative overflow-hidden ${voted ? "bg-primary/5 border-primary shadow-sm" : "bg-muted/30 border-border/50 hover:border-primary/50 hover:bg-muted/60"} ${myVotedOptionId && !voted ? "opacity-50 scale-[0.98]" : "hover:scale-[1.02] active:scale-[0.98]"}`}
                    >
                      <div className="flex justify-between items-start gap-3 relative z-10">
                        <span className="font-bold text-sm text-foreground leading-snug">{opt.label}</span>
                        <span className="font-black text-primary text-xs px-2 py-1 bg-primary/10 rounded-md shrink-0">{opt.voterIds.length} Suara</span>
                      </div>
                      <div className="h-2.5 w-full bg-background rounded-full overflow-hidden relative z-10 border border-border/50">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                      </div>
                      {voted && <div className="absolute inset-0 bg-primary/[0.02] z-0 pointer-events-none" />}
                    </button>
                  );
                })}
              </div>
              {myVotedOptionId && (
                <motion.p initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-center flex items-center justify-center gap-1.5 p-2 bg-emerald-500/10 rounded-xl">
                  <CheckCircle2 size={14} /> Voting Anda telah direkam.
                </motion.p>
              )}
            </div>
          )}

          {/* Task List */}
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-5 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center">
              <h2 className="font-display font-bold text-lg text-foreground flex items-center gap-2">
                <List size={18} className="text-primary" /> Target Grup
              </h2>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="text-xs font-bold text-foreground bg-foreground/5 hover:bg-foreground/10 px-3 py-1.5 rounded-xl transition-all hover:scale-105 active:scale-95 flex items-center gap-1"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>
            {showTaskForm && (
              <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} onSubmit={handleAddTask} className="p-5 bg-muted/40 border border-border/50 rounded-[1.5rem] space-y-4 shadow-inner overflow-hidden">
                <input
                  required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-card border border-border/50 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all"
                  placeholder="Deskripsi tugas (Misal: Cari Jurnal...)"
                />
                <div className="grid grid-cols-2 gap-3">
                  <select
                    value={newTaskAssigneeUserId}
                    onChange={e => {
                      const uid = e.target.value;
                      setNewTaskAssigneeUserId(uid);
                      if (uid) {
                        const mb = activeGroup.members.find(m => m.userId === uid);
                        setNewTaskAssignee(mb?.name || "");
                      } else {
                        setNewTaskAssignee("");
                      }
                    }}
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/50 text-xs font-semibold text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Delegasi (opsional)</option>
                    {activeGroup.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border/50 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    placeholder="Tenggat (18 Juni)"
                  />
                </div>
                <div className="flex items-center gap-3 bg-card px-4 py-2.5 rounded-xl border border-border/50">
                  <span className="text-xs text-muted-foreground font-bold shrink-0">Bobot Beban:</span>
                  <select
                    value={newTaskBobot}
                    onChange={e => setNewTaskBobot(Number(e.target.value))}
                    className="flex-1 bg-transparent border-none text-xs font-bold text-foreground focus:outline-none focus:ring-0"
                  >
                    <option value={1}>Ringan (1)</option>
                    <option value={2}>Sedang (2)</option>
                    <option value={3}>Berat (3)</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <button type="submit" className="flex-1 py-2.5 bg-foreground text-background font-bold text-xs rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md">Tambahkan</button>
                  <button type="button" onClick={() => { setShowTaskForm(false); setNewTaskAssigneeUserId(""); setNewTaskBobot(1); }} className="px-5 py-2.5 bg-muted font-bold text-muted-foreground hover:text-foreground rounded-xl text-xs hover:bg-muted/80 transition-all">Batal</button>
                </div>
              </motion.form>
            )}

            {loadingTasks ? (
              <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-20 w-full rounded-[1.5rem]" />)}</div>
            ) : tasks.length === 0 ? (
              <div className="py-10 text-center flex flex-col items-center justify-center">
                <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-3"><List size={24} className="text-muted-foreground/50" /></div>
                <p className="text-muted-foreground text-sm font-semibold max-w-[200px]">Belum ada target misi. Tambahkan tugas pertama!</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} key={task._id} className={`flex items-start gap-4 p-4 rounded-[1.5rem] border transition-all duration-300 group ${task.completed ? "bg-muted/30 border-border/30" : "bg-card border-border/60 hover:border-primary/50 shadow-sm hover:shadow-md"}`}>
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 mt-0.5 transition-all duration-300 hover:scale-110 active:scale-90 ${task.completed ? "bg-emerald-500 border-emerald-500 text-white shadow-md shadow-emerald-500/20" : "border-muted-foreground/30 hover:border-primary/60 bg-background"}`}
                    >
                      {task.completed && <CheckCircle2 size={16} />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-2">
                      <span className={`text-sm block font-bold leading-snug transition-all ${task.completed ? "line-through text-muted-foreground/60" : "text-foreground"}`}>
                        {task.title}
                      </span>
                      <div className="flex justify-between items-center text-[11px] font-semibold">
                        <span className="text-muted-foreground px-2 py-1 bg-muted rounded-md">{task.assignee}</span>
                        {task.dueDate && <span className="text-primary px-2 py-1 bg-primary/10 rounded-md border border-primary/20">{task.dueDate}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-white hover:bg-destructive transition-all p-2 rounded-xl"
                      title="Hapus tugas"
                    >
                      <Trash2 size={14} />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Kontribusi Anggota */}
          <div className="bg-card/60 backdrop-blur-xl border border-border/50 rounded-[2rem] p-6 shadow-sm space-y-6 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 border-b border-border/50 pb-4">
              <BarChart3 size={20} className="text-primary" />
              <h2 className="font-display font-bold text-lg text-foreground">Kinerja Tim</h2>
            </div>
            {loadingTasks ? (
              <div className="space-y-4">{[0,1,2].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}</div>
            ) : contributions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6 leading-relaxed font-semibold">Tuntaskan setidaknya satu tugas berbobot untuk melihat statistik kontribusi secara *real-time*.</p>
            ) : (
              <div className="space-y-5">
                {contributions.map((c) => (
                  <div key={c.userId} className="space-y-2">
                    <div className="flex justify-between items-end">
                      <span className="text-sm font-bold text-foreground">{c.nama}</span>
                      <div className="text-right">
                        <span className="text-sm font-black text-primary">{c.persen}%</span>
                        <span className="text-[10px] text-muted-foreground font-semibold ml-2">({c.selesai} tugas)</span>
                      </div>
                    </div>
                    <div className="h-3 w-full bg-background rounded-full overflow-hidden border border-border/50 shadow-inner">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-indigo-500 rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${c.persen}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Dokumen Google */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <FileText size={18} className="text-primary" />
                Dokumen Bersama
              </h2>
              <button
                onClick={() => { setShowDocForm(!showDocForm); setDocLinkError(""); }}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Tambah
              </button>
            </div>

            {docLinkError && (
              <p className="text-xs text-destructive font-semibold bg-destructive/10 px-3 py-2 rounded-xl">{docLinkError}</p>
            )}

            {showDocForm && (
              <form onSubmit={handleAddDocLink} className="p-4 bg-muted/50 border border-border rounded-2xl space-y-3">
                <input
                  required value={newDocJudul} onChange={e => setNewDocJudul(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Judul dokumen"
                />
                <input
                  required value={newDocUrl} onChange={e => setNewDocUrl(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Tempel link Google Docs / Sheets / Slides"
                />
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl">Simpan</button>
                  <button type="button" onClick={() => { setShowDocForm(false); setDocLinkError(""); }} className="px-4 py-2 border border-border font-bold text-muted-foreground hover:text-foreground rounded-xl text-xs">Batal</button>
                </div>
              </form>
            )}

            {loadingTasks ? (
              <div className="space-y-2">{[0,1].map(i => <div key={i} className="skeleton h-12 w-full rounded-xl" />)}</div>
            ) : docLinks.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada dokumen. Tempel link Google Docs, Spreadsheet, atau Slides di atas untuk dikerjakan bareng.</p>
            ) : (
              <div className="space-y-2">
                {docLinks.map((d) => (
                  <div key={d._id} className="flex items-center gap-3 p-3 rounded-2xl border border-border hover:border-primary/30 transition-colors group">
                    <FileText size={16} className="text-primary shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{d.judul}</p>
                      <p className="text-xs text-muted-foreground truncate">{(d.googleDocUrl?.includes("spreadsheets") ? "Spreadsheet" : d.googleDocUrl?.includes("presentation") ? "Slides" : d.googleDocUrl?.includes("document") ? "Docs" : "Tautan")} · {d.createdByNama}</p>
                    </div>
                    <a
                      href={d.googleDocUrl} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-bold text-primary hover:text-primary/80 px-2 py-1 bg-primary/10 rounded-lg transition-colors shrink-0"
                    >
                      <ExternalLink size={12} /> Buka
                    </a>
                    <button
                      onClick={() => handleDeleteDocLink(d._id)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-lg hover:bg-destructive/10"
                      title="Hapus dokumen"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

        </motion.div>
      </div>
    </motion.div>
  );
}
