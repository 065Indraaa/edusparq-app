"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, Sparkles, Plus, CheckCircle2, ChevronRight, MessageSquare, Save } from "lucide-react";
import { useSession } from "next-auth/react";
import PusherClient from "pusher-js";

interface GroupTask {
  id: string;
  title: string;
  assignee: string;
  dueDate: string;
  completed: boolean;
}

// Fixed demo room + events shared across collaborators.
const COLLAB_CHANNEL = "collab-demo";

// Detect realtime support purely from the public client key. If it's missing or
// still a placeholder ("your-..."), we stay in local-only prototype mode.
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

  // Realtime is decided once at mount from public env. Default = local-only.
  const realtimeRef = useRef(detectRealtime());
  const [realtimeEnabled] = useState(() => realtimeRef.current.enabled);

  const [tasks, setTasks] = useState<GroupTask[]>([
    { id: "1", title: "Ekstraksi data kuesioner primer", assignee: "Ahmad Zaelani", dueDate: "14 Juni", completed: true },
    { id: "2", title: "Menulis Kajian Teori Bab 2", assignee: "Siti Rahmawati", dueDate: "16 Juni", completed: false },
    { id: "3", title: "Analisis Output Regresi Bab 3", assignee: session?.user?.name || "Saya", dueDate: "18 Juni", completed: false },
    { id: "4", title: "Membuat PPT Slide Presentasi", assignee: "Budi Santoso", dueDate: "21 Juni", completed: false },
  ]);

  const [docContent, setDocContent] = useState(
    "BAB 3 - METODOLOGI PENELITIAN\n\n3.1 Desain Penelitian\nPenelitian ini menggunakan pendekatan kuantitatif dengan analisis regresi berganda. Data dikumpulkan melalui kuesioner online yang disebarkan kepada 150 mahasiswa tingkat akhir...\n\n3.2 Pengolahan Data\n[Ahmad sedang menyunting di sini]\nCatatan Ahmad: Sedang memvalidasi 120 baris responden SPSS, sebagian data outlier akan di-drop..."
  );

  const [typingUser, setTypingUser] = useState<string | null>(realtimeRef.current.enabled ? null : "Ahmad Zaelani");
  const [votes, setVotes] = useState({ topic1: 3, topic2: 1 });
  const [myVote, setMyVote] = useState<"topic1" | "topic2" | null>(null);

  // Form State
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskAssignee, setNewTaskAssignee] = useState("");
  const [newTaskDate, setNewTaskDate] = useState("");

  // ----- Realtime plumbing -----
  // Fire-and-forget broadcast helper. Errors (incl. 503 unconfigured) are
  // swallowed so the UI always stays usable in local-only mode.
  const broadcast = useCallback(
    (event: string, data: unknown) => {
      if (!realtimeEnabled) return;
      fetch("/api/collab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channel: COLLAB_CHANNEL, event, data }),
      }).catch(() => {
        /* stay local on any error */
      });
    },
    [realtimeEnabled]
  );

  // Debounced document broadcast (~400ms) to avoid spamming on every keystroke.
  const docDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to the demo channel when realtime is enabled.
  useEffect(() => {
    if (!realtimeEnabled) {
      // Local-only: keep the subtle placeholder typing indicator from cycling.
      const users = ["Siti Rahmawati", "Ahmad Zaelani", null];
      let userIndex = 0;
      const interval = setInterval(() => {
        setTypingUser(users[userIndex]);
        userIndex = (userIndex + 1) % users.length;
      }, 4000);
      return () => clearInterval(interval);
    }

    const { key, cluster } = realtimeRef.current;
    const pusher = new PusherClient(key, { cluster });
    const channel = pusher.subscribe(COLLAB_CHANNEL);

    const fromMe = (payload: { senderId?: string }) =>
      !!myId && payload?.senderId === myId;

    channel.bind("doc:update", (payload: { content?: string; senderId?: string }) => {
      if (fromMe(payload)) return;
      if (typeof payload?.content === "string") setDocContent(payload.content);
    });

    channel.bind("vote:update", (payload: { votes?: { topic1: number; topic2: number }; senderId?: string }) => {
      if (fromMe(payload)) return;
      if (payload?.votes) setVotes(payload.votes);
    });

    channel.bind("task:update", (payload: { tasks?: GroupTask[]; senderId?: string }) => {
      if (fromMe(payload)) return;
      if (Array.isArray(payload?.tasks)) setTasks(payload.tasks);
    });

    channel.bind("typing", (payload: { name?: string | null; senderId?: string }) => {
      if (fromMe(payload)) return;
      setTypingUser(payload?.name ?? null);
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => setTypingUser(null), 2500);
    });

    return () => {
      channel.unbind_all();
      pusher.unsubscribe(COLLAB_CHANNEL);
      pusher.disconnect();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (docDebounceRef.current) clearTimeout(docDebounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [realtimeEnabled, myId]);

  const handleDocChange = (value: string) => {
    setDocContent(value);
    if (!realtimeEnabled) return;
    // Signal "I'm typing" immediately, then debounce the heavier content sync.
    broadcast("typing", { name: session?.user?.name || "Saya" });
    if (docDebounceRef.current) clearTimeout(docDebounceRef.current);
    docDebounceRef.current = setTimeout(() => {
      broadcast("doc:update", { content: value });
    }, 400);
  };

  const handleVote = (topic: "topic1" | "topic2") => {
    if (myVote) return;
    const next = { ...votes, [topic]: votes[topic] + 1 };
    setVotes(next);
    setMyVote(topic);
    broadcast("vote:update", { votes: next });
  };

  const handleAddTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTaskTitle.trim() || !newTaskDate) return;
    const added: GroupTask = {
      id: Math.random().toString(),
      title: newTaskTitle,
      assignee: newTaskAssignee || "Belum Ditentukan",
      dueDate: newTaskDate,
      completed: false
    };
    const next = [...tasks, added];
    setTasks(next);
    broadcast("task:update", { tasks: next });
    setNewTaskTitle("");
    setNewTaskAssignee("");
    setNewTaskDate("");
    setShowTaskForm(false);
  };

  const toggleTask = (id: string) => {
    const next = tasks.map(t => t.id === id ? { ...t, completed: !t.completed } : t);
    setTasks(next);
    broadcast("task:update", { tasks: next });
  };

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-6">
      
      {/* Header */}
      <motion.div variants={itemVariants}>
        <h1 className="text-2xl font-extrabold tracking-tight text-foreground flex items-center gap-2">
          <Users size={24} className="text-primary" />
          Kolaborasi Kelompok
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Kerjakan tugas kelompok bersama secara real-time. Bagikan tugas, kerjakan bareng, dan voting keputusan.
        </p>
        {realtimeEnabled ? (
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-bold px-3 py-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Realtime aktif
          </span>
        ) : (
          <span className="mt-3 inline-flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-amber-400/10 text-amber-600 dark:text-amber-400 rounded-lg">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            Mode lokal — realtime nonaktif (Pusher belum dikonfigurasi)
          </span>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left 2 Cols: Shared Document Editor */}
        <motion.div variants={itemVariants} className="lg:col-span-2 space-y-6">
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm flex flex-col min-h-[500px]">
            
            {/* Editor Top Bar */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-4">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider block">Dokumen Bersama</span>
                <h2 className="font-extrabold text-foreground">Makalah_Metodologi_Kelompok_3.docx</h2>
              </div>
              
              {/* Online indicator list */}
              <div className="flex items-center -space-x-2">
                {[
                  { name: session?.user?.name || "Saya", color: "from-primary to-indigo-600" },
                  { name: "Ahmad Zaelani", color: "from-emerald-400 to-teal-500" },
                  { name: "Siti Rahmawati", color: "from-amber-400 to-orange-500" },
                ].map((member, idx) => (
                  <div 
                    key={idx} 
                    title={member.name}
                    className={`w-9 h-9 rounded-full bg-gradient-to-tr ${member.color} border-2 border-card flex items-center justify-center font-bold text-xs text-white cursor-pointer select-none ring-2 ring-transparent hover:ring-primary/50 hover:z-10 transition-all`}
                  >
                    {member.name.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>

            {/* Multiplayer Alert */}
            <div className="mt-4 h-8 flex items-center">
              {typingUser ? (
                <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary rounded-lg w-fit">
                  <Sparkles size={14} className="animate-pulse" />
                  <span>{typingUser} sedang mengetik...</span>
                </motion.div>
              ) : (
                <div className="flex items-center gap-2 text-xs font-medium px-3 py-1.5 text-muted-foreground">
                  <Save size={14} /> Tersimpan otomatis
                </div>
              )}
            </div>

            {/* Text Editor TextArea */}
            <div className="relative flex-1 mt-2">
              <textarea
                value={docContent}
                onChange={(e) => handleDocChange(e.target.value)}
                className="w-full h-full p-5 rounded-2xl bg-muted/40 border border-border text-sm font-mono resize-none leading-relaxed text-foreground focus:outline-none focus:border-primary/50 transition-colors"
                placeholder="Mulai ketik isi makalah di sini..."
              />
            </div>
          </div>
        </motion.div>

        {/* Right 1 Col: Team Task List & Voting */}
        <motion.div variants={itemVariants} className="lg:col-span-1 space-y-6">
          
          {/* Voting Box */}
          <div className="bg-card border border-border rounded-3xl p-6 shadow-sm space-y-5">
            <div>
              <h2 className="font-bold text-foreground flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                Voting Judul Kelompok
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Voting ditutup besok jam 12:00 siang.</p>
            </div>

            <div className="space-y-3">
              {[
                { id: "topic1" as const, label: "Analisis Inklusi Keuangan & Dampak Inflasi", count: votes.topic1 },
                { id: "topic2" as const, label: "Peran BI dalam Stabilisasi Nilai Tukar", count: votes.topic2 }
              ].map((topic) => {
                const total = votes.topic1 + votes.topic2;
                const percent = total > 0 ? (topic.count / total) * 100 : 0;
                const isSelected = myVote === topic.id;
                
                return (
                  <button 
                    key={topic.id}
                    onClick={() => handleVote(topic.id)}
                    disabled={myVote !== null}
                    className={`w-full text-left p-4 rounded-2xl border transition-all space-y-3 relative overflow-hidden group ${
                      isSelected 
                        ? "bg-primary/10 border-primary shadow-sm" 
                        : "bg-muted/40 border-border hover:border-primary/50"
                    } ${myVote && !isSelected ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between items-start gap-3 relative z-10">
                      <span className="font-bold text-sm text-foreground leading-snug">{topic.label}</span>
                      <span className="font-black text-primary text-sm shrink-0">{topic.count} Suara</span>
                    </div>
                    {/* Visual percentage meter */}
                    <div className="h-2 w-full bg-muted-foreground/20 rounded-full overflow-hidden relative z-10">
                      <div className="h-full bg-primary rounded-full transition-all duration-1000 ease-out" style={{ width: `${percent}%` }} />
                    </div>
                  </button>
                );
              })}
            </div>
            
            {myVote && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 font-bold text-center flex items-center justify-center gap-1.5">
                <CheckCircle2 size={14} /> Pilihan tersimpan.
              </p>
            )}
          </div>

          {/* Group Task Delegation Board */}
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

            {/* Task Form */}
            {showTaskForm && (
              <form onSubmit={handleAddTask} className="p-4 bg-muted/50 border border-border rounded-2xl space-y-3">
                <input
                  required
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                  placeholder="Misal: Bikin PPT..."
                />
                <div className="grid grid-cols-2 gap-3">
                  <input
                    value={newTaskAssignee}
                    onChange={(e) => setNewTaskAssignee(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    placeholder="Nama PIC"
                  />
                  <input
                    required
                    value={newTaskDate}
                    onChange={(e) => setNewTaskDate(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
                    placeholder="Tenggat (18 Juni)"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button type="submit" className="flex-1 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs rounded-xl">Simpan</button>
                  <button type="button" onClick={() => setShowTaskForm(false)} className="px-4 py-2 border border-border font-bold text-muted-foreground hover:text-foreground rounded-xl text-xs">Batal</button>
                </div>
              </form>
            )}

            {/* Task list render */}
            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="flex items-start gap-3 p-3 rounded-2xl border border-border hover:border-primary/30 transition-colors">
                  <button 
                    onClick={() => toggleTask(task.id)}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                      task.completed 
                        ? "bg-emerald-500 border-emerald-500 text-white" 
                        : "border-muted-foreground/30 hover:border-primary"
                    }`}
                  >
                    {task.completed && <CheckCircle2 size={14} className="text-white absolute" />}
                  </button>

                  <div className="flex-1 min-w-0 space-y-1">
                    <span className={`text-sm block font-bold leading-snug ${
                      task.completed ? "line-through text-muted-foreground" : "text-foreground"
                    }`}>
                      {task.title}
                    </span>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">{task.assignee}</span>
                      <span className="font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">
                        {task.dueDate}
                      </span>
                    </div>
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
