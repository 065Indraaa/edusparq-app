"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Sparkles, Plus, CheckCircle2, MessageSquare, Save, LogIn, Hash, Copy, Check, Trash2, FileText, ExternalLink, BarChart3 } from "lucide-react";
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
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">Kolaborasi Kelompok</h1>
          <p className="text-sm text-muted-foreground">Buat grup baru atau bergabung dengan kode undangan.</p>
        </motion.div>

        {groupError && (
          <motion.p variants={itemVariants} className="text-xs font-semibold text-destructive text-center bg-destructive/10 px-4 py-2 rounded-xl">
            {groupError}
          </motion.p>
        )}

        <motion.div variants={itemVariants} className="grid grid-cols-2 gap-4">
          <button
            onClick={() => { setShowGroupForm("create"); setGroupError(""); }}
            className={`p-6 rounded-3xl border-2 text-center space-y-3 transition-all hover-lift ${showGroupForm === "create" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
              <Plus size={24} className="text-primary" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Buat Grup</p>
              <p className="text-xs text-muted-foreground mt-1">Mulai ruang kerja baru</p>
            </div>
          </button>
          <button
            onClick={() => { setShowGroupForm("join"); setGroupError(""); }}
            className={`p-6 rounded-3xl border-2 text-center space-y-3 transition-all hover-lift ${showGroupForm === "join" ? "border-primary bg-primary/5" : "border-border bg-card hover:border-primary/40"}`}
          >
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto">
              <LogIn size={24} className="text-emerald-500" />
            </div>
            <div>
              <p className="font-bold text-foreground text-sm">Gabung Grup</p>
              <p className="text-xs text-muted-foreground mt-1">Masukkan kode undangan</p>
            </div>
          </button>
        </motion.div>

        {showGroupForm === "create" && (
          <motion.form
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleCreateGroup}
            className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-bold text-foreground">Nama Grup Baru</h2>
            <input
              required value={groupName} onChange={e => setGroupName(e.target.value)}
              placeholder="Misal: Kelompok Skripsi Bab 3"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors"
            />
            <button
              type="submit" disabled={groupLoading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              {groupLoading ? "Membuat..." : "Buat Grup"}
            </button>
          </motion.form>
        )}

        {showGroupForm === "join" && (
          <motion.form
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleJoinGroup}
            className="bg-card border border-border rounded-3xl p-6 space-y-4 shadow-sm"
          >
            <h2 className="font-bold text-foreground">Kode Undangan</h2>
            <input
              required value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
              placeholder="Misal: ABC123"
              className="w-full px-4 py-3 rounded-xl bg-muted border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary transition-colors font-mono tracking-widest uppercase"
              maxLength={10}
            />
            <button
              type="submit" disabled={groupLoading}
              className="w-full py-3 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-sm rounded-xl transition-colors disabled:opacity-60"
            >
              {groupLoading ? "Bergabung..." : "Gabung Grup"}
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
      <motion.div variants={itemVariants} className="relative overflow-hidden rounded-[2rem] border border-border bg-gradient-to-br from-primary/10 via-card to-card p-5 sm:p-7 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
              <Users size={24} className="text-primary" />
              {activeGroup.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {activeGroup.members.length} anggota · Kode:{" "}
              <button onClick={copyCode} className="font-mono font-bold text-primary hover:text-primary/80 inline-flex items-center gap-1 transition-colors">
                <Hash size={12} />
                {activeGroup.joinCode}
                {copied ? <Check size={12} /> : <Copy size={12} />}
              </button>
            </p>
          </div>
          <div className="flex items-center gap-2">
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
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">

            {/* Editor Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Dokumen Bersama</span>
                <h2 className="font-extrabold text-foreground">Dokumen Kelompok — {activeGroup.name}</h2>
              </div>

              {/* Member avatars */}
              <div className="flex items-center -space-x-2">
                {activeGroup.members.slice(0, 4).map((m, idx) => {
                  const colors = ["from-primary to-indigo-600", "from-emerald-400 to-teal-500", "from-amber-400 to-orange-500", "from-pink-400 to-rose-500"];
                  return (
                    <div key={idx} title={m.name} className={`w-9 h-9 rounded-full bg-gradient-to-tr ${colors[idx % colors.length]} border-2 border-card flex items-center justify-center font-bold text-xs text-white cursor-pointer select-none`}>
                      {(m.name || "?").charAt(0).toUpperCase()}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Typing indicator */}
            <div className="mt-4 h-8 flex items-center">
              {typingUser ? (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary rounded-lg w-fit">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>{typingUser} sedang mengetik...</span>
                </motion.div>
              ) : (
                <button onClick={handleSaveDoc} className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  {savingDoc ? <Sparkles size={14} className="animate-spin" /> : <Save size={14} />}
                  {savingDoc ? "Menyimpan..." : "Simpan dokumen"}
                </button>
              )}
            </div>

            {/* Text Editor */}
            <div className="relative flex-1 mt-2">
              <textarea
                value={docContent}
                onChange={(e) => handleDocChange(e.target.value)}
                className="w-full h-full p-5 rounded-2xl bg-muted/40 border border-border text-sm font-mono resize-none leading-relaxed text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Mulai ketik isi makalah bersama di sini..."
              />
            </div>
          </div>
        </motion.div>

        {/* Right 1 Col: Tasks & Poll */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6">

          {/* Poll (if exists) */}
          {poll && (
            <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
              <div>
                <h2 className="font-bold text-foreground flex items-center gap-2">
                  <MessageSquare size={18} className="text-primary" />
                  Voting
                </h2>
                <p className="text-xs text-muted-foreground mt-1">{poll.question}</p>
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
                      className={`w-full text-left p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden ${voted ? "bg-primary/10 border-primary shadow-sm" : "bg-muted/40 border-border hover:border-primary/50"} ${myVotedOptionId && !voted ? "opacity-60" : ""}`}
                    >
                      <div className="flex justify-between items-start gap-3">
                        <span className="font-bold text-sm text-foreground leading-snug">{opt.label}</span>
                        <span className="font-black text-primary text-sm shrink-0">{opt.voterIds.length} Suara</span>
                      </div>
                      <div className="h-2 w-full bg-muted-foreground/20 rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${pct}%` }} />
                      </div>
                    </button>
                  );
                })}
              </div>
              {myVotedOptionId && (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-center flex items-center justify-center gap-1.5">
                  <CheckCircle2 size={14} /> Pilihan tersimpan.
                </p>
              )}
            </div>
          )}

          {/* Task List */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-foreground">Pembagian Tugas</h2>
              <button
                onClick={() => setShowTaskForm(!showTaskForm)}
                className="text-xs font-bold text-primary hover:text-primary/80 flex items-center gap-1 bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Plus size={14} /> Tugas
              </button>
            </div>

            {showTaskForm && (
              <form onSubmit={handleAddTask} className="p-4 bg-muted/50 border border-border rounded-2xl space-y-3">
                <input
                  required value={newTaskTitle} onChange={e => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Misal: Bikin PPT..."
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
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value="">Pilih PIC (opsional)</option>
                    {activeGroup.members.map(m => (
                      <option key={m.userId} value={m.userId}>{m.name}</option>
                    ))}
                  </select>
                  <input
                    value={newTaskDate} onChange={e => setNewTaskDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    placeholder="Tenggat (18 Juni)"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium shrink-0">Bobot:</span>
                  <select
                    value={newTaskBobot}
                    onChange={e => setNewTaskBobot(Number(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-card border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  >
                    <option value={1}>1 – Ringan</option>
                    <option value={2}>2 – Sedang</option>
                    <option value={3}>3 – Berat</option>
                  </select>
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl">Simpan</button>
                  <button type="button" onClick={() => { setShowTaskForm(false); setNewTaskAssigneeUserId(""); setNewTaskBobot(1); }} className="px-4 py-2 border border-border font-bold text-muted-foreground hover:text-foreground rounded-xl text-xs">Batal</button>
                </div>
              </form>
            )}

            {loadingTasks ? (
              <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-16 w-full rounded-2xl" />)}</div>
            ) : tasks.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground text-xs font-medium">
                Belum ada tugas. Tambahkan tugas pertama untuk kelompok ini.
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div key={task._id} className="flex items-start gap-3 p-3 rounded-2xl border border-border hover:border-primary/30 transition-colors group">
                    <button
                      onClick={() => handleToggleTask(task)}
                      className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${task.completed ? "bg-emerald-500 border-emerald-500 text-white" : "border-muted-foreground/30 hover:border-primary"}`}
                    >
                      {task.completed && <CheckCircle2 size={14} />}
                    </button>
                    <div className="flex-1 min-w-0 space-y-1">
                      <span className={`text-sm block font-bold leading-snug ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                        {task.title}
                      </span>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-muted-foreground font-medium">{task.assignee}</span>
                        {task.dueDate && <span className="font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">{task.dueDate}</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteTask(task)}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1 rounded-lg hover:bg-destructive/10"
                      title="Hapus tugas"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Kontribusi Anggota */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            <div className="flex items-center gap-2">
              <BarChart3 size={18} className="text-primary" />
              <h2 className="font-bold text-foreground">Kontribusi Anggota</h2>
            </div>
            {loadingTasks ? (
              <div className="space-y-3">{[0,1,2].map(i => <div key={i} className="skeleton h-10 w-full rounded-xl" />)}</div>
            ) : contributions.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Belum ada data kontribusi. Selesaikan tugas yang sudah ditugaskan untuk melihat statistik.</p>
            ) : (
              <div className="space-y-4">
                {contributions.map((c) => (
                  <div key={c.userId} className="space-y-1.5">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-bold text-foreground">{c.nama}</span>
                      <span className="text-xs text-muted-foreground font-medium">{c.persen}% · {c.selesai} selesai</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
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
