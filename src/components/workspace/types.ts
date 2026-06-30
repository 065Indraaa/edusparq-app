// Shared types for the unified 3-panel workspace.
// Kept in one module so the FileExplorer, ChatInterface and SourcesPanel
// all agree on the shape of documents, messages and citations.

export type FileType = "pdf" | "docx" | "audio" | "video" | "image";

/** A document as returned by GET /api/documents, normalised for the UI. */
export interface WorkspaceDocument {
  id: string;
  name: string;
  type: FileType;
  size: string;
  courseName: string;
  fileUrl?: string;
  uploadedAt: string;
  status: "indexed" | "processing" | "failed";
}

/** A source the AI used to ground an answer (RAG chunk / web / Crossref). */
export interface CitationSource {
  index: number;
  title: string;
  type: "document" | "web" | "crossref" | "research";
  snippet: string;
  relevance: number; // 0..1
  url?: string;
  documentId?: string;
}

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Unknown";

export interface ChatAnswerMeta {
  sources: CitationSource[];
  confidence: ConfidenceLevel;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  mode: string;
  courseName?: string;
  createdAt?: string;
  isStreaming?: boolean;
  meta?: ChatAnswerMeta;
}

/** Normalises a raw document payload from /api/documents into the UI shape. */
export function normalizeType(t: string): FileType {
  if (t === "docx" || t === "audio" || t === "video" || t === "image") return t;
  return "pdf";
}

export function mapApiDoc(doc: Record<string, unknown>): WorkspaceDocument {
  const statusMap: Record<string, WorkspaceDocument["status"]> = {
    indexed: "indexed",
    processing: "processing",
    failed: "failed",
  };
  const status = statusMap[String(doc.status ?? "indexed")] ?? "indexed";
  return {
    id: String(doc._id ?? doc.id ?? ""),
    name: String(doc.originalName ?? doc.filename ?? "Dokumen"),
    type: normalizeType(String(doc.fileType ?? "pdf")),
    size: String(doc.fileSize ?? "-"),
    courseName: String(doc.courseName ?? ""),
    fileUrl: doc.fileUrl ? String(doc.fileUrl) : undefined,
    uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt as string).toLocaleDateString("id-ID") : "Hari ini",
    status,
  };
}
