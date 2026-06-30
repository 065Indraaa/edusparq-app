import { extractText, getDocumentProxy } from "unpdf";
import mammoth from "mammoth";

const MAX_CHARS = 120_000;

function isSafeUrl(urlStr: string): boolean {
  try {
    const url = new URL(urlStr);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return false;
    }
    const host = url.hostname.toLowerCase();
    
    // Block localhost and common local/loopback IPs
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "[::1]"
    ) {
      return false;
    }

    // Check for private IPv4 IP ranges
    // 10.x.x.x, 172.16.x.x-172.31.x.x, 192.168.x.x, 169.254.x.x
    const parts = host.split(".");
    if (parts.length === 4) {
      const p0 = parseInt(parts[0], 10);
      const p1 = parseInt(parts[1], 10);
      if (
        p0 === 10 ||
        (p0 === 172 && p1 >= 16 && p1 <= 31) ||
        (p0 === 192 && p1 === 168) ||
        (p0 === 169 && p1 === 254)
      ) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

export async function extractTextFromUrl(
  fileUrl: string,
  fileType: string
): Promise<string> {
  if (!isSafeUrl(fileUrl)) {
    console.error("[server-extract] Rejected unsafe URL to prevent SSRF:", fileUrl);
    return "";
  }

  try {
    if (fileType === "pdf") {
      const res = await fetch(fileUrl);
      const buf = await res.arrayBuffer();
      const pdf = await getDocumentProxy(new Uint8Array(buf));
      const { text } = await extractText(pdf, { mergePages: true });
      const result = Array.isArray(text) ? text.join("") : (text as string);
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
