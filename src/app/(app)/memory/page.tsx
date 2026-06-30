"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Plus, Trash2, Network, List, X, Sparkles } from "lucide-react";

interface GraphNode { id: string; type: string; title: string; content: string; tags: string[]; strength: number; accessCount: number; }
interface GraphEdge { source: string; target: string; type: string; weight: number; }
interface MemoryItem { nodeId: string; type: string; title: string; content: string; tags: string[]; strength: number; score: number; relatedNodes?: { title: string; type: string; edgeType: string }[]; }

const TYPE_COLORS: Record<string, string> = {
  concept: "#3b82f6", fact: "#22c55e", topic: "#a855f7",
  task: "#f97316", preference: "#ec4899", event: "#eab308",
};

export default function MemoryPage() {
  const [view, setView] = useState<"graph" | "list">("graph");
  const [graph, setGraph] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] });
  const [memories, setMemories] = useState<MemoryItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [loading, setLoading] = useState(true);
  const [newMemory, setNewMemory] = useState({ type: "concept", title: "", content: "", tags: "" });

  const fetchGraph = useCallback(async () => {
    try {
      const res = await fetch("/api/memory?action=graph");
      if (res.ok) { const data = await res.json(); setGraph(data); }
    } catch {} finally { setLoading(false); }
  }, []);

  const fetchMemories = useCallback(async () => {
    try {
      const res = await fetch(`/api/memory?action=search&q=${encodeURIComponent(search)}`);
      if (res.ok) { const data = await res.json(); setMemories(data.memories || []); }
    } catch {}
  }, [search]);

  useEffect(() => { fetchGraph(); }, [fetchGraph]);
  useEffect(() => { if (view === "list") fetchMemories(); }, [view, fetchMemories]);

  const handleDelete = async (nodeId: string) => {
    await fetch(`/api/memory?id=${nodeId}`, { method: "DELETE" });
    fetchGraph();
    if (view === "list") fetchMemories();
  };

  const handleAdd = async () => {
    if (!newMemory.title) return;
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: newMemory.type, title: newMemory.title,
        content: newMemory.content, tags: newMemory.tags.split(",").map((t) => t.trim()).filter(Boolean),
      }),
    });
    setNewMemory({ type: "concept", title: "", content: "", tags: "" });
    setShowAdd(false);
    fetchGraph();
  };

  // Simple circular layout for graph nodes
  const nodePositions = new Map<string, { x: number; y: number }>();
  const cx = 200, cy = 200, radius = 140;
  graph.nodes.forEach((n, i) => {
    const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    nodePositions.set(n.id, { x: cx + Math.cos(angle) * radius, y: cy + Math.sin(angle) * radius });
  });

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground mb-1 flex items-center gap-2">
            <Brain className="w-6 h-6" /> Memori Agent
          </h1>
          <p className="text-sm text-muted-foreground">Basis pengetahuan yang dipelajari AI tentang Anda.</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="flex items-center gap-2 px-3 py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      <div className="flex gap-1 p-1 bg-muted rounded-xl w-fit">
        {([["graph", "Graph View", Network], ["list", "List View", List]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setView(id)}
            className={`flex items-center gap-2 py-1.5 px-4 rounded-lg text-xs font-semibold transition-all ${
              view === id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {view === "graph" ? (
        <div className="bg-card border border-border rounded-xl p-4">
          {graph.nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Sparkles className="w-10 h-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground max-w-xs">
                Belum ada memori. Chat dengan AI untuk mulai membangun basis pengetahuan Anda.
              </p>
            </div>
          ) : (
            <div className="flex gap-4">
              <svg viewBox="0 0 400 400" className="w-full max-w-md mx-auto" style={{ minHeight: 400 }}>
                {graph.edges.map((e, i) => {
                  const sNode = graph.nodes.find((n) => n.title === e.source);
                  const tNode = graph.nodes.find((n) => n.title === e.target);
                  if (!sNode || !tNode) return null;
                  const s = nodePositions.get(sNode.id);
                  const t = nodePositions.get(tNode.id);
                  if (!s || !t) return null;
                  return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="currentColor" strokeOpacity={0.15} strokeWidth={e.weight} />;
                })}
                {graph.nodes.map((n) => {
                  const pos = nodePositions.get(n.id);
                  if (!pos) return null;
                  const color = TYPE_COLORS[n.type] || "#6b7280";
                  return (
                    <g key={n.id} onClick={() => setSelectedNode(n)} style={{ cursor: "pointer" }}>
                      <circle cx={pos.x} cy={pos.y} r={8 + n.strength} fill={color} fillOpacity={0.8} stroke={selectedNode?.id === n.id ? "#000" : "none"} strokeWidth={2} />
                      <text x={pos.x} y={pos.y + 25} textAnchor="middle" fontSize="8" fill="currentColor" className="opacity-70">{n.title.slice(0, 15)}</text>
                    </g>
                  );
                })}
              </svg>
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="w-64 bg-muted rounded-xl p-4"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold uppercase" style={{ color: TYPE_COLORS[selectedNode.type] }}>{selectedNode.type}</span>
                      <button onClick={() => setSelectedNode(null)}><X className="w-4 h-4 text-muted-foreground" /></button>
                    </div>
                    <h3 className="text-sm font-bold text-foreground mb-1">{selectedNode.title}</h3>
                    <p className="text-xs text-muted-foreground mb-3">{selectedNode.content}</p>
                    {selectedNode.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mb-3">
                        {selectedNode.tags.map((t) => <span key={t} className="px-2 py-0.5 text-[10px] bg-background rounded-full text-muted-foreground">{t}</span>)}
                      </div>
                    )}
                    <button onClick={() => handleDelete(selectedNode.id)} className="text-xs text-red-500 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Hapus</button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari memori..."
              className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/30 text-foreground placeholder:text-muted-foreground"
            />
          </div>
          {memories.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {search ? "Tidak ada hasil." : "Belum ada memori tersimpan."}
            </div>
          ) : (
            memories.map((m) => (
              <div key={m.nodeId} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: TYPE_COLORS[m.type] || "#6b7280" }} />
                    <span className="text-xs font-bold uppercase text-muted-foreground">{m.type}</span>
                  </div>
                  <button onClick={() => handleDelete(m.nodeId)} className="text-muted-foreground hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
                <h3 className="text-sm font-bold text-foreground mb-1">{m.title}</h3>
                <p className="text-xs text-muted-foreground mb-2">{m.content}</p>
                {m.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">{m.tags.map((t) => <span key={t} className="px-2 py-0.5 text-[10px] bg-muted rounded-full text-muted-foreground">{t}</span>)}</div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowAdd(false)}
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md space-y-3"
            >
              <h3 className="text-lg font-bold text-foreground">Tambah Memori</h3>
              <select value={newMemory.type} onChange={(e) => setNewMemory({ ...newMemory, type: e.target.value })} className="w-full px-3 py-2 bg-muted rounded-lg text-sm text-foreground focus:outline-none">
                {["concept", "fact", "topic", "task", "preference", "event"].map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={newMemory.title} onChange={(e) => setNewMemory({ ...newMemory, title: e.target.value })} placeholder="Judul" className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none text-foreground placeholder:text-muted-foreground" />
              <textarea value={newMemory.content} onChange={(e) => setNewMemory({ ...newMemory, content: e.target.value })} placeholder="Detail..." className="w-full px-3 py-2 bg-muted rounded-lg text-sm h-20 resize-none focus:outline-none text-foreground placeholder:text-muted-foreground" />
              <input value={newMemory.tags} onChange={(e) => setNewMemory({ ...newMemory, tags: e.target.value })} placeholder="Tags (pisahkan koma)" className="w-full px-3 py-2 bg-muted rounded-lg text-sm focus:outline-none text-foreground placeholder:text-muted-foreground" />
              <button onClick={handleAdd} className="w-full py-2 bg-primary text-background text-sm font-semibold rounded-lg hover:opacity-90">Simpan</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
