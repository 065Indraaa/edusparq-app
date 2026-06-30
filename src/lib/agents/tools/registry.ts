import { retrieveChunks } from "../../rag";
import { searchWeb } from "../../web-search";
import { fetchCrossrefWorks } from "../../rag-grounding";
import { connectDB } from "../../db/mongodb";
import { Course } from "../../db/models/Course";
import { Deadline } from "../../db/models/Deadline";
import { Grade } from "../../db/models/Grade";
import { getMemoryGraph, retrieveMemories } from "../../memory-engine";
import OpenAI from "openai";

export interface ToolResult {
  success: boolean;
  data: string;
  sources?: Array<{ type: string; title: string; content: string; url?: string; doi?: string }>;
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>, userId: string) => Promise<ToolResult>;
}

// Tool: search user's uploaded documents (RAG)
const searchMaterialTool: ToolDef = {
  name: "search_material",
  description: "Cari di materi kuliah yang sudah diupload user. Gunakan untuk menjawab pertanyaan berdasarkan dokumen spesifik mahasiswa.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Kata kunci pencarian" },
      courseName: { type: "string", description: "Filter per mata kuliah (opsional)" },
    },
    required: ["query"],
  },
  async execute(args, userId) {
    const query = String(args.query || "");
    const courseName = args.courseName ? String(args.courseName) : undefined;
    const chunks = await retrieveChunks(userId, query, 4, courseName);
    if (chunks.length === 0) return { success: false, data: "Tidak ada materi yang cocok ditemukan." };
    return {
      success: true,
      data: chunks.map((c, i) => `[Sumber ${i + 1}: ${c.courseName}]\n${c.content}`).join("\n\n"),
      sources: chunks.map((c) => ({ type: "document", title: c.courseName, content: c.content, url: undefined, doi: undefined })),
    };
  },
};

// Tool: web search
const webSearchTool: ToolDef = {
  name: "web_search",
  description: "Cari informasi di internet. Gunakan untuk topik yang tidak ada di materi user atau butuh info terkini.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Kueri pencarian" } },
    required: ["query"],
  },
  async execute(args) {
    const query = String(args.query || "");
    const result = await searchWeb(query, 4);
    return { success: !result.includes("tidak mengembalikan"), data: result };
  },
};

// Tool: search Crossref journals
const searchJournalsTool: ToolDef = {
  name: "search_journals",
  description: "Cari jurnal akademik asli dari database Crossref. Gunakan untuk menemukan referensi penelitian yang valid.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Topik/judul penelitian" } },
    required: ["query"],
  },
  async execute(args) {
    const query = String(args.query || "");
    const works = await fetchCrossrefWorks(query, 4);
    if (works.length === 0) return { success: false, data: "Tidak ada jurnal ditemukan." };
    return {
      success: true,
      data: works.map((w, i) => `Jurnal ${i + 1}: ${w.title}\nPenulis: ${w.authors}\nTahun: ${w.year}\nDOI: ${w.doi || w.url}\nAbstrak: ${w.abstract}`).join("\n\n"),
      sources: works.map((w) => ({ type: "journal", title: w.title, content: w.abstract, url: w.url, doi: w.doi })),
    };
  },
};

// Tool: get user's courses
const getCoursesTool: ToolDef = {
  name: "get_courses",
  description: "Ambil daftar mata kuliah user semester ini.",
  parameters: { type: "object", properties: {} },
  async execute(_args, userId) {
    await connectDB();
    const courses = await Course.find({ userId }).sort({ createdAt: -1 }).lean();
    if (courses.length === 0) return { success: false, data: "User belum punya mata kuliah." };
    return { success: true, data: courses.map((c) => `- ${c.name} (${c.sks || 0} SKS)`).join("\n") };
  },
};

// Tool: get upcoming deadlines
const getDeadlinesTool: ToolDef = {
  name: "get_deadlines",
  description: "Ambil daftar tugas/deadline terdekat user.",
  parameters: { type: "object", properties: {} },
  async execute(_args, userId) {
    await connectDB();
    const deadlines = await Deadline.find({ userId, dueDate: { $gte: new Date() } }).sort({ dueDate: 1 }).limit(5).lean();
    if (deadlines.length === 0) return { success: false, data: "Tidak ada deadline terdekat." };
    return { success: true, data: deadlines.map((d) => `- ${d.title} (due: ${new Date(d.dueDate).toLocaleDateString("id-ID")}) [${d.priority || "normal"}]`).join("\n") };
  },
};

// Tool: retrieve user memories
const getMemoriesTool: ToolDef = {
  name: "get_memories",
  description: "Ambil memori/pengetahuan yang sudah dipelajari user sebelumnya. Gunakan untuk membangun di atas pengetahuan yang sudah ada.",
  parameters: {
    type: "object",
    properties: { query: { type: "string", description: "Topik yang dicari di memori" } },
    required: ["query"],
  },
  async execute(args, userId) {
    const query = String(args.query || "");
    const memories = await retrieveMemories(userId, query, 5);
    if (memories.length === 0) return { success: false, data: "Belum ada memori untuk topik ini." };
    return { success: true, data: memories.map((m) => `- ${m.title}: ${m.content}`).join("\n") };
  },
};

export const TOOLS: ToolDef[] = [
  searchMaterialTool,
  webSearchTool,
  searchJournalsTool,
  getCoursesTool,
  getDeadlinesTool,
  getMemoriesTool,
];

export function getToolDefinitions(): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return TOOLS.map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }));
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  userId: string
): Promise<ToolResult> {
  const tool = TOOLS.find((t) => t.name === name);
  if (!tool) return { success: false, data: `Tool ${name} tidak ditemukan.` };
  try {
    return await tool.execute(args || {}, userId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[tools] ${name} failed:`, msg);
    return { success: false, data: `Tool gagal: ${msg.slice(0, 100)}` };
  }
}
