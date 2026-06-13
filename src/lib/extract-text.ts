// Dependency-free, client-side text extraction.
//
// This module deliberately works ONLY with formats whose bytes are already
// plain text (.txt, .md, .csv, .json, and any `text/*` MIME type). For those
// the raw file contents are read in the browser via `File.text()` and returned
// so the caller can feed them to the RAG indexer (`POST /api/documents` with a
// `textContent` field).
//
// TODO: Real PDF / DOCX / image / audio / video extraction is NOT possible in
// the browser without additional dependencies (e.g. pdfjs-dist for PDF,
// mammoth for DOCX, Tesseract for OCR, Whisper for audio). Those require either
// a parser dependency or a server-side extraction pipeline. Until then these
// formats are uploaded and stored, but return "" here (no chunks indexed).

const MAX_CHARS = 100_000;

const TEXT_EXTENSIONS = [".txt", ".md", ".markdown", ".csv", ".tsv", ".json", ".log"];

/**
 * Returns true when the file's bytes are plain text and can be read directly
 * in the browser (no parser dependency required).
 */
export function isExtractable(file: File): boolean {
  if (!file) return false;

  const mime = (file.type || "").toLowerCase();
  if (mime.startsWith("text/")) return true;
  // A few text-bearing application/* MIME types.
  if (mime === "application/json" || mime === "application/csv") return true;

  const name = (file.name || "").toLowerCase();
  return TEXT_EXTENSIONS.some((ext) => name.endsWith(ext));
}

/**
 * Extracts plain-text content from a file in the browser.
 *
 * - Text-based files (.txt, .md, .csv, .json, any `text/*`) are read via
 *   `File.text()` (FileReader fallback), trimmed and capped at ~100k chars.
 * - Everything else (pdf, docx, images, audio, video) returns "" — see the
 *   module-level TODO; in-browser extraction needs a parser/server pipeline.
 *
 * Never throws: any failure resolves to "".
 */
export async function extractText(file: File): Promise<string> {
  try {
    if (!file || !isExtractable(file)) return "";

    let raw = "";
    if (typeof file.text === "function") {
      raw = await file.text();
    } else {
      raw = await readViaFileReader(file);
    }

    const trimmed = (raw || "").trim();
    if (!trimmed) return "";
    return trimmed.length > MAX_CHARS ? trimmed.slice(0, MAX_CHARS) : trimmed;
  } catch {
    return "";
  }
}

/** FileReader fallback for environments without `File.text()`. */
function readViaFileReader(file: File): Promise<string> {
  return new Promise((resolve) => {
    try {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
      reader.onerror = () => resolve("");
      reader.readAsText(file);
    } catch {
      resolve("");
    }
  });
}
