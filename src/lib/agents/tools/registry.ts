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

// Tool: KBBI lookup — cek kata ke Kamus Besar Bahasa Indonesia
const kbbiLookupTool: ToolDef = {
  name: "kbbi_lookup",
  description: "Cari lema/arti kata di Kamus Besar Bahasa Indonesia (KBBI). Gunakan untuk memastikan bahasa baku Indonesia. Hanya relevan jika output dalam Bahasa Indonesia.",
  parameters: {
    type: "object",
    properties: {
      kata: { type: "string", description: "Kata yang ingin dicek" },
    },
    required: ["kata"],
  },
  async execute(args) {
    const kata = encodeURIComponent(String(args.kata || "").trim().toLowerCase());
    if (!kata) return { success: false, data: "Kata kosong." };
    try {
      // KBBI API publik (wibi offline backup atau kbbi-api)
      const res = await fetch(`https://kbbi-api-zhirrr.vercel.app/api/v1/kbbi?kata=${kata}`, {
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) return { success: false, data: `KBBI lookup gagal (status ${res.status}).` };
      const data = await res.json() as any;
      const results = data?.data || data?.results || [];
      if (!Array.isArray(results) || results.length === 0) {
        return { success: false, data: `Kata "${decodeURIComponent(kata)}" tidak ditemukan di KBBI. Mungkin bukan bahasa baku.` };
      }
      const formatted = results.slice(0, 3).map((r: any, i: number) => {
        const lema = r.lema || r.kata || "?";
        const arti = Array.isArray(r.arti) ? r.arti.join("; ") : (r.arti || r.definisi || "");
        return `${i + 1}. ${lema} — ${arti}`;
      }).join("\n");
      return { success: true, data: `KBBI "${decodeURIComponent(kata)}":\n${formatted}` };
    } catch (err) {
      return { success: false, data: `KBBI lookup error: ${err instanceof Error ? err.message.slice(0, 80) : "timeout"}` };
    }
  },
};

// Tool: Legal search via Pasal.id — cari UU/pasal Indonesia
const searchLawTool: ToolDef = {
  name: "search_law",
  description: "Cari pasal/undang-undang di database hukum Indonesia (Pasal.id). Gunakan untuk pertanyaan hukum, mencari pasal spesifik, atau referensi UU.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Topik/nomor UU/kata kunci hukum" },
    },
    required: ["query"],
  },
  async execute(args) {
    const query = String(args.query || "").trim();
    if (!query) return { success: false, data: "Query kosong." };
    const token = process.env.PASAL_ID_TOKEN;
    if (!token) {
      return { success: false, data: "Tool hukum tidak tersedia (PASAL_ID_TOKEN belum dikonfigurasi)." };
    }
    try {
      const res = await fetch("https://pasal.id/api/v1/search", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ query, limit: 5 }),
        signal: AbortSignal.timeout(12000),
      });
      if (!res.ok) return { success: false, data: `Pasal.id error: ${res.status}` };
      const data = await res.json() as any;
      const results = data?.data || data?.results || [];
      if (!Array.isArray(results) || results.length === 0) {
        return { success: false, data: `Tidak ada pasal untuk "${query}".` };
      }
      const formatted = results.slice(0, 5).map((r: any, i: number) => {
        const judul = r.judul || r.title || r.nama || "?";
        const pasal = r.pasal || r.nomor || "";
        const isi = (r.isi || r.teks || "").slice(0, 300);
        return `${i + 1}. ${judul} — ${pasal}\n${isi}`;
      }).join("\n\n");
      return {
        success: true,
        data: `Hasil pencarian hukum "${query}":\n${formatted}`,
        sources: results.slice(0, 5).map((r: any) => ({
          type: "law",
          title: r.judul || r.title || "Pasal",
          content: (r.isi || r.teks || "").slice(0, 200),
        })),
      };
    } catch (err) {
      return { success: false, data: `Legal search error: ${err instanceof Error ? err.message.slice(0, 80) : "timeout"}` };
    }
  },
};

export const TOOLS: ToolDef[] = [
  searchMaterialTool,
  webSearchTool,
  searchJournalsTool,
  getCoursesTool,
  getDeadlinesTool,
  getMemoriesTool,
  kbbiLookupTool,
  searchLawTool,
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
