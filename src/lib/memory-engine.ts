/**
 * Memory Engine — Per-user knowledge graph system for EduSparq AI.
 *
 * Like Obsidian: each user has their own graph of concepts, facts, and
 * preferences. The AI stores and retrieves from this graph to maintain
 * context across sessions, remember what the student learned, and adapt
 * responses to their knowledge level.
 *
 * Architecture:
 * - MemoryNode: atomic piece of knowledge (concept, fact, preference)
 * - MemoryEdge: relationship between nodes (prerequisite, related, extends)
 * - Extraction: AI analyzes conversations and extracts knowledge automatically
 * - Retrieval: semantic + keyword search over the graph, with edge traversal
 *
 * All functions are best-effort and never throw — memory is enhancement,
 * not a hard dependency.
 */

import { connectDB } from "./db/mongodb";
import { MemoryNode, type MemoryNodeType, type MemorySource } from "./db/models/MemoryNode";
import { MemoryEdge, type MemoryEdgeType } from "./db/models/MemoryEdge";
import { ChatMessage } from "./db/models/ChatMessage";
import { complete } from "./ai-client";
import { getEmbedding } from "./rag";
import { getUserPersonaContext } from "./ai-memory";

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ExtractedMemory {
  type: MemoryNodeType;
  title: string;
  content: string;
  tags: string[];
  relatedTo?: string[];
}

export interface MemoryExtractionResult {
  nodes: ExtractedMemory[];
  edges: { fromTitle: string; toTitle: string; type: MemoryEdgeType }[];
}

export interface RetrievedMemory {
  nodeId: string;
  type: MemoryNodeType;
  title: string;
  content: string;
  tags: string[];
  strength: number;
  score: number;
  relatedNodes?: { title: string; type: MemoryNodeType; edgeType: MemoryEdgeType }[];
}

export interface MemoryContext {
  recentConcepts: RetrievedMemory[];
  userPreferences: RetrievedMemory[];
  activeTasks: RetrievedMemory[];
  relatedConcepts: RetrievedMemory[];
  contextBlock: string;
}

// ─── Memory Extraction (AI-powered) ────────────────────────────────────────

/**
 * Extracts memory nodes from a conversation using a lightweight AI call.
 * Called periodically (every ~5 messages) to build the knowledge graph.
 *
 * Token-efficient: uses a lite model, structured JSON output, max 5 nodes.
 */
export async function extractMemoriesFromChat(
  userId: string,
  chatHistory?: { role: string; content: string }[]
): Promise<MemoryExtractionResult> {
  try {
    await connectDB();

    // Get recent chat if not provided
    let messages = chatHistory;
    if (!messages) {
      const recent = await ChatMessage.find({ userId })
        .sort({ createdAt: -1 })
        .limit(8)
        .lean();
      if (recent.length < 3) return { nodes: [], edges: [] };
      messages = recent.reverse().map((m) => ({
        role: m.role,
        content: m.content,
      }));
    }

    if (messages.length < 3) return { nodes: [], edges: [] };

    const transcript = messages
      .map((m) => `${m.role === "user" ? "Mahasiswa" : "AI"}: ${m.content}`)
      .join("\n");

    const systemPrompt = `Anda adalah mesin ekstraksi memori untuk asisten AI akademik.
Analisis percakapan berikut dan ekstrak PENGETAHUAN yang bisa disimpan untuk user ini.

Hanya ekstrak yang BERGUNA dan SPESIFIK:
- Konsep akademik yang dipelajari/ditanyakan
- Fakta tentang user (jurusan, semester, preferensi belajar)
- Topik yang sedang dikerjakan
- Tugas/proyek yang disebutkan

JANGAN ekstrak:
- Pertanyaan umum yang sudah dijawab (sekali pakai)
- Salam atau basa-basi
- Informasi yang sudah jelas dari profil

Kembalikan HANYA JSON:
{
  "nodes": [
    {"type":"concept|fact|topic|task|preference|event","title":"judul singkat","content":"detail 1-2 kalimat","tags":["tag1"],"relatedTo":["judul node lain"]}
  ],
  "edges": [
    {"fromTitle":"judul node A","toTitle":"judul node B","type":"related|prerequisite|part_of|extends|applied_in"}
  ]
}
Maksimal 5 nodes dan 3 edges. Title harus unik dan deskriptif.`;

    const result = await complete(
      {
        feature: "chat",
        system: systemPrompt,
        user: transcript,
        temperature: 0.1,
        maxTokens: 800,
        json: true,
        taskId: "memory_extract",
      },
      userId
    );

    const text = result.text.trim();
    let parsed: MemoryExtractionResult;

    try {
      // Clean markdown wrapping if present
      const clean = text.replace(/```json/gi, "").replace(/```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      return { nodes: [], edges: [] };
    }

    if (!parsed.nodes || !Array.isArray(parsed.nodes)) {
      return { nodes: [], edges: [] };
    }

    // Validate and cap
    parsed.nodes = parsed.nodes.slice(0, 5).map((n) => ({
      type: (n.type as MemoryNodeType) || "concept",
      title: String(n.title || "").slice(0, 200),
      content: String(n.content || "").slice(0, 500),
      tags: Array.isArray(n.tags) ? n.tags.slice(0, 5).map(String) : [],
      relatedTo: Array.isArray(n.relatedTo) ? n.relatedTo.map(String) : [],
    }));

    parsed.edges = (parsed.edges || []).slice(0, 3).map((e) => ({
      fromTitle: String(e.fromTitle || ""),
      toTitle: String(e.toTitle || ""),
      type: (e.type as MemoryEdgeType) || "related",
    }));

    return parsed;
  } catch (err) {
    console.error("[memory-engine] extractMemoriesFromChat error:", err);
    return { nodes: [], edges: [] };
  }
}

// ─── Memory Storage ────────────────────────────────────────────────────────

/**
 * Stores extracted memory nodes and edges into the user's knowledge graph.
 * Handles deduplication (same title → merge/upgrade) and embedding generation.
 */
export async function storeMemories(
  userId: string,
  extraction: MemoryExtractionResult,
  source: MemorySource = "chat"
): Promise<{ stored: number; edges: number; updated: number }> {
  if (!extraction.nodes || extraction.nodes.length === 0) {
    return { stored: 0, edges: 0, updated: 0 };
  }

  try {
    await connectDB();

    const createdNodes: { title: string; nodeId: string }[] = [];
    let stored = 0;
    let updated = 0;

    // Store/update nodes
    for (const node of extraction.nodes) {
      if (!node.title) continue;

      // Check if node with same title exists
      const existing = await MemoryNode.findOne({
        userId,
        title: { $regex: new RegExp(`^${escapeRegex(node.title)}$`, "i") },
      });

      if (existing) {
        // Update: merge content, increase strength, add new tags
        existing.content = node.content || existing.content;
        existing.strength = Math.min(10, existing.strength + 0.5);
        existing.accessCount += 1;
        existing.lastAccessedAt = new Date();
        const existingTags = new Set(existing.tags.map((t) => t.toLowerCase()));
        for (const tag of node.tags) {
          if (!existingTags.has(tag.toLowerCase())) {
            existing.tags.push(tag);
          }
        }
        existing.tags = existing.tags.slice(0, 15);
        await existing.save();
        createdNodes.push({ title: node.title, nodeId: String(existing._id) });
        updated++;
      } else {
        // Generate embedding for semantic search
        let embedding: number[] = [];
        try {
          embedding = await getEmbedding(`${node.title}. ${node.content}`);
        } catch {
          /* non-fatal */
        }

        const newNode = await MemoryNode.create({
          userId,
          type: node.type,
          title: node.title,
          content: node.content,
          source,
          tags: node.tags,
          embedding,
          strength: 1.0,
          accessCount: 1,
          lastAccessedAt: new Date(),
        });
        createdNodes.push({ title: node.title, nodeId: String(newNode._id) });
        stored++;
      }
    }

    // Store edges
    let edgesStored = 0;
    if (extraction.edges && extraction.edges.length > 0) {
      const titleToId = new Map(createdNodes.map((n) => [n.title.toLowerCase(), n.nodeId]));

      for (const edge of extraction.edges) {
        const sourceNode = titleToId.get(edge.fromTitle.toLowerCase());
        const targetNode = titleToId.get(edge.toTitle.toLowerCase());
        if (!sourceNode || !targetNode) continue;

        try {
          await MemoryEdge.findOneAndUpdate(
            { sourceNodeId: sourceNode, targetNodeId: targetNode },
            {
              $set: {
                userId,
                sourceNodeId: sourceNode,
                targetNodeId: targetNode,
                type: edge.type,
              },
              $inc: { weight: 0.5 },
            },
            { upsert: true }
          );
          edgesStored++;
        } catch {
          /* duplicate edge, ignore */
        }
      }
    }

    return { stored, edges: edgesStored, updated };
  } catch (err) {
    console.error("[memory-engine] storeMemories error:", err);
    return { stored: 0, edges: 0, updated: 0 };
  }
}

// ─── Memory Retrieval ──────────────────────────────────────────────────────

/**
 * Retrieves relevant memories for a given query using:
 * 1. Semantic search (if embedding exists)
 * 2. Full-text search fallback
 * 3. Tag matching
 * 4. Edge traversal (find related concepts)
 */
export async function retrieveMemories(
  userId: string,
  query: string,
  limit = 5
): Promise<RetrievedMemory[]> {
  if (!userId || !query?.trim()) return [];

  try {
    await connectDB();

    // Strategy 1: Embedding-based semantic search
    const queryEmbedding = await getEmbedding(query).catch(() => []);
    if (queryEmbedding.length > 0) {
      try {
        const vectorResults = await MemoryNode.aggregate([
          {
            $vectorSearch: {
              index: "memory_vector_index",
              path: "embedding",
              queryVector: queryEmbedding,
              numCandidates: 50,
              limit: limit * 2,
            },
          },
          { $match: { userId: new (await import("mongoose")).Types.ObjectId(userId) } },
        ]);

        if (vectorResults.length > 0) {
          const nodes = await enrichWithRelations(userId, vectorResults);
          return nodes.slice(0, limit);
        }
      } catch {
        /* vector search not indexed, fall through */
      }
    }

    // Strategy 2: Full-text search
    try {
      const textResults = await MemoryNode.find(
        { userId, $text: { $search: query } },
        { score: { $meta: "textScore" } }
      )
        .sort({ score: { $meta: "textScore" }, strength: -1 })
        .limit(limit * 2)
        .lean();

      if (textResults.length > 0) {
        // Boost access count for retrieved memories
        await MemoryNode.updateMany(
          { _id: { $in: textResults.map((n) => n._id) } },
          { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } }
        );
        return (await enrichWithRelations(userId, textResults)).slice(0, limit);
      }
    } catch {
      /* text index not ready, fall through */
    }

    // Strategy 3: Tag + keyword matching
    const keywords = query
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3)
      .slice(0, 5);

    if (keywords.length === 0) return [];

    const tagResults = await MemoryNode.find({
      userId,
      $or: [
        { tags: { $in: keywords } },
        { title: { $regex: keywords.join("|"), $options: "i" } },
      ],
    })
      .sort({ strength: -1, accessCount: -1 })
      .limit(limit * 2)
      .lean();

    if (tagResults.length > 0) {
      await MemoryNode.updateMany(
        { _id: { $in: tagResults.map((n) => n._id) } },
        { $inc: { accessCount: 1 }, $set: { lastAccessedAt: new Date() } }
      );
    }

    return (await enrichWithRelations(userId, tagResults)).slice(0, limit);
  } catch (err) {
    console.error("[memory-engine] retrieveMemories error:", err);
    return [];
  }
}

/**
 * Enriches memory nodes with their related nodes via edge traversal.
 */
async function enrichWithRelations(
  userId: string,
  nodes: any[]
): Promise<RetrievedMemory[]> {
  if (!nodes || nodes.length === 0) return [];

  const result: RetrievedMemory[] = [];

  for (const node of nodes) {
    // Find edges from this node
    const edges = await MemoryEdge.find({
      userId,
      sourceNodeId: node._id,
    })
      .populate("targetNodeId", "title type")
      .limit(3)
      .lean();

    const relatedNodes = edges
      .filter((e: any) => e.targetNodeId)
      .map((e: any) => ({
        title: e.targetNodeId.title,
        type: e.targetNodeId.type,
        edgeType: e.type,
      }));

    const score = typeof node.score === "number" ? node.score : node.strength || 1;

    result.push({
      nodeId: String(node._id),
      type: node.type,
      title: node.title,
      content: node.content,
      tags: node.tags || [],
      strength: node.strength || 1,
      score,
      relatedNodes,
    });
  }

  return result.sort((a, b) => b.score - a.score);
}

// ─── Full Memory Context Builder ───────────────────────────────────────────

/**
 * Builds a complete memory context for the AI prompt.
 * Combines: recent concepts, user preferences, active tasks, and query-related memories.
 *
 * This replaces/augments the existing getUserPersonaContext() with richer graph data.
 */
export async function buildMemoryContext(
  userId: string,
  query: string
): Promise<MemoryContext> {
  try {
    // Get query-relevant memories
    const relatedConcepts = await retrieveMemories(userId, query, 5);

    // Get user preferences (always include)
    const userPreferences = await MemoryNode.find({
      userId,
      type: { $in: ["preference", "fact"] },
    })
      .sort({ strength: -1 })
      .limit(5)
      .lean();

    // Get active tasks
    const activeTasks = await MemoryNode.find({
      userId,
      type: "task",
      strength: { $gte: 0.5 },
    })
      .sort({ updatedAt: -1 })
      .limit(3)
      .lean();

    // Get recently accessed concepts
    const recentConcepts = await MemoryNode.find({
      userId,
      type: { $in: ["concept", "topic"] },
      lastAccessedAt: { $exists: true },
    })
      .sort({ lastAccessedAt: -1 })
      .limit(5)
      .lean();

    // Format into context block for AI prompt
    const blocks: string[] = [];

    if (userPreferences.length > 0) {
      blocks.push(
        "PROFIL & PREFERENSI USER (dari memori):\n" +
          userPreferences
            .map((p) => `- ${p.title}: ${p.content}`)
            .join("\n")
      );
    }

    if (relatedConcepts.length > 0) {
      blocks.push(
        "KONSEP YANG SUDAH DIKETAHUI USER (sesuai pertanyaan saat ini):\n" +
          relatedConcepts
            .map((c) => {
              let line = `- ${c.title}: ${c.content}`;
              if (c.relatedNodes && c.relatedNodes.length > 0) {
                line += ` (terkait: ${c.relatedNodes.map((r) => r.title).join(", ")})`;
              }
              return line;
            })
            .join("\n")
      );
    }

    if (activeTasks.length > 0) {
      blocks.push(
        "TUGAS/PROYEK AKTIF USER:\n" +
          activeTasks.map((t) => `- ${t.title}: ${t.content}`).join("\n")
      );
    }

    if (recentConcepts.length > 0) {
      blocks.push(
        "TOPIK YANG BARU-SAJA DIBAHAS:\n" +
          recentConcepts.map((c) => `- ${c.title}`).join(", ")
      );
    }

    const contextBlock =
      blocks.length > 0
        ? `\n\n[MEMORI AGENT — basis pengetahuan user]\n${blocks.join("\n\n")}\n[Gunakan memori ini untuk menyesuaikan jawaban. Jangan ulang mentah. Jika user bertanya hal yang sudah diketahui, bangun di atas pengetahuan yang sudah ada.]\n`
        : "";

    return {
      recentConcepts: recentConcepts.map(toRetrievedMemory),
      userPreferences: userPreferences.map(toRetrievedMemory),
      activeTasks: activeTasks.map(toRetrievedMemory),
      relatedConcepts,
      contextBlock,
    };
  } catch (err) {
    console.error("[memory-engine] buildMemoryContext error:", err);
    return {
      recentConcepts: [],
      userPreferences: [],
      activeTasks: [],
      relatedConcepts: [],
      contextBlock: "",
    };
  }
}

function toRetrievedMemory(node: any): RetrievedMemory {
  return {
    nodeId: String(node._id),
    type: node.type,
    title: node.title,
    content: node.content,
    tags: node.tags || [],
    strength: node.strength || 1,
    score: node.strength || 1,
  };
}

// ─── Memory Management (explicit) ─────────────────────────────────────────

/**
 * Explicitly add a memory node (user says "ingat ini" or AI decides).
 */
export async function addMemory(
  userId: string,
  type: MemoryNodeType,
  title: string,
  content: string,
  tags: string[] = [],
  source: MemorySource = "explicit"
): Promise<string | null> {
  try {
    await connectDB();

    let embedding: number[] = [];
    try {
      embedding = await getEmbedding(`${title}. ${content}`);
    } catch {
      /* non-fatal */
    }

    const node = await MemoryNode.findOneAndUpdate(
      { userId, title: { $regex: new RegExp(`^${escapeRegex(title)}$`, "i") } },
      {
        $set: { type, content, source, tags, embedding },
        $inc: { strength: 0.5, accessCount: 1 },
        $setOnInsert: { userId },
      },
      { upsert: true, new: true }
    );

    return String(node._id);
  } catch (err) {
    console.error("[memory-engine] addMemory error:", err);
    return null;
  }
}

/**
 * Connect two memory nodes with an edge.
 */
export async function connectMemories(
  userId: string,
  sourceTitle: string,
  targetTitle: string,
  type: MemoryEdgeType = "related"
): Promise<boolean> {
  try {
    await connectDB();

    const [source, target] = await Promise.all([
      MemoryNode.findOne({ userId, title: { $regex: new RegExp(`^${escapeRegex(sourceTitle)}$`, "i") } }),
      MemoryNode.findOne({ userId, title: { $regex: new RegExp(`^${escapeRegex(targetTitle)}$`, "i") } }),
    ]);

    if (!source || !target) return false;

    await MemoryEdge.findOneAndUpdate(
      { sourceNodeId: source._id, targetNodeId: target._id },
      {
        $set: { userId, sourceNodeId: source._id, targetNodeId: target._id, type },
        $inc: { weight: 0.5 },
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.error("[memory-engine] connectMemories error:", err);
    return false;
  }
}

/**
 * Get the full knowledge graph for visualization (Obsidian-like graph view).
 */
export async function getMemoryGraph(
  userId: string,
  limit = 50
): Promise<{ nodes: any[]; edges: any[] }> {
  try {
    await connectDB();

    const [nodes, edges] = await Promise.all([
      MemoryNode.find({ userId })
        .sort({ strength: -1, updatedAt: -1 })
        .limit(limit)
        .select("type title content tags strength accessCount updatedAt")
        .lean(),
      MemoryEdge.find({ userId })
        .populate("sourceNodeId targetNodeId", "title")
        .limit(limit * 2)
        .lean(),
    ]);

    return {
      nodes: nodes.map((n) => ({
        id: String(n._id),
        type: n.type,
        title: n.title,
        content: n.content,
        tags: n.tags,
        strength: n.strength,
        accessCount: n.accessCount,
      })),
      edges: edges
        .filter((e: any) => e.sourceNodeId && e.targetNodeId)
        .map((e: any) => ({
          source: String(e.sourceNodeId.title),
          target: String(e.targetNodeId.title),
          type: e.type,
          weight: e.weight,
        })),
    };
  } catch (err) {
    console.error("[memory-engine] getMemoryGraph error:", err);
    return { nodes: [], edges: [] };
  }
}

/**
 * Delete a memory node and all its edges.
 */
export async function deleteMemory(
  userId: string,
  nodeId: string
): Promise<boolean> {
  try {
    await connectDB();
    await MemoryEdge.deleteMany({
      $or: [{ sourceNodeId: nodeId }, { targetNodeId: nodeId }],
    });
    await MemoryNode.deleteOne({ _id: nodeId, userId });
    return true;
  } catch (err) {
    console.error("[memory-engine] deleteMemory error:", err);
    return false;
  }
}

/**
 * Search memories by keyword (for memory management UI).
 */
export async function searchMemories(
  userId: string,
  query: string,
  limit = 20
): Promise<RetrievedMemory[]> {
  if (!query?.trim()) {
    // Return recent memories
    return retrieveMemories(userId, "recent", limit);
  }
  return retrieveMemories(userId, query, limit);
}

/**
 * Auto-process: extract memories from recent chat and store them.
 * Called after every N messages (triggered by chat API).
 */
export async function autoProcessMemories(
  userId: string
): Promise<{ stored: number; updated: number; edges: number }> {
  try {
    const extraction = await extractMemoriesFromChat(userId);
    if (extraction.nodes.length === 0) {
      return { stored: 0, updated: 0, edges: 0 };
    }
    const result = await storeMemories(userId, extraction, "chat");
    return result;
  } catch (err) {
    console.error("[memory-engine] autoProcessMemories error:", err);
    return { stored: 0, updated: 0, edges: 0 };
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
