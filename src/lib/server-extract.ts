import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const MAX_CHARS = 120_000;

export async function extractTextFromUrl(
  fileUrl: string,
  fileType: string
): Promise<string> {
  try {
    if (fileType === "pdf") {
      const res = await fetch(fileUrl);
      const buf = await res.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const result = Array.isArray(text) ? text.join("\n") : (text as string);
      return (result || "").slice(0, MAX_CHARS);
    }

    if (fileType === "docx") {
      const res = await fetch(fileUrl);
      const buf = await res.arrayBuffer();
      const { value } = await mammoth.extractRawText({ buffer: Buffer.from(buf) });
      return (value || "").slice(0, MAX_CHARS);
    }

    return "";
  } catch (err) {
    console.error("[server-extract] extractTextFromUrl error:", err);
    return "";
  }
}
