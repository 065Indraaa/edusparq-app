import mongoose from "mongoose";
import { connectDB } from "./db/mongodb";

// --- 1. Response Cache Schema & Model ---
const ResponseCacheSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true, index: true },
  response: { type: String, required: true },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }, // MongoDB TTL Index
}, { timestamps: true });

// Avoid Model Compilation Error in Next.js Hot Reload
const ResponseCache = mongoose.models.ResponseCache || mongoose.model("ResponseCache", ResponseCacheSchema);

/**
 * Mendapatkan respon cache dari database berdasarkan key (hash query + context).
 */
export async function getCachedResponse(key: string): Promise<string | null> {
  try {
    await connectDB();
    const doc = await ResponseCache.findOne({ key, expiresAt: { $gt: new Date() } });
    return doc ? doc.response : null;
  } catch (err) {
    console.error("[Cache] Failed to get cached response:", err);
    return null;
  }
}

/**
 * Menyimpan respon AI ke cache database dengan TTL (Time To Live).
 */
export async function setCachedResponse(key: string, response: string, ttlHours = 24): Promise<void> {
  try {
    await connectDB();
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
    await ResponseCache.updateOne(
      { key },
      { $set: { key, response, expiresAt } },
      { upsert: true }
    );
  } catch (err) {
    console.error("[Cache] Failed to set cached response:", err);
  }
}

// --- 2. Google Gemini Context Caching Helper ---
// Explicit Caching: Mengunggah dokumen besar ke Gemini sekali, lalu memakai cacheName untuk chat berikutnya.
// Memotong biaya input token hingga 90% untuk dokumen besar (>32k token).

export interface GeminiCacheConfig {
  apiKey: string;
  model: string; // e.g. "gemini-2.5-flash"
  displayName?: string;
  ttlSeconds?: number; // Default 1 jam
}

/**
 * Membuat Context Cache di Gemini API untuk dokumen besar.
 * Mengembalikan cacheName (nama resource cache yang unik).
 */
export async function createGeminiContextCache(
  contentsText: string,
  config: GeminiCacheConfig
): Promise<string | null> {
  try {
    const apiKey = config.apiKey || process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[Gemini Cache] Bypassing explicit cache creation: GEMINI_API_KEY is not defined.");
      return null;
    }

    const ttl = config.ttlSeconds || 3600; // default 1 hour
    const model = config.model || "models/gemini-2.5-flash";
    const modelName = model.startsWith("models/") ? model : `models/${model}`;

    const url = `https://generativelanguage.googleapis.com/v1beta/cachedContents?key=${apiKey}`;

    const payload = {
      model: modelName,
      displayName: config.displayName || `edusparq_doc_cache_${Date.now()}`,
      ttl: `${ttl}s`,
      contents: [
        {
          role: "user",
          parts: [{ text: contentsText }]
        }
      ]
    };

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("[Gemini Cache] API error creating context cache:", errText);
      return null;
    }

    const data = await res.json();
    console.log(`[Gemini Cache] Successfully created cache: ${data.name} (expires in ${ttl}s)`);
    return data.name; // e.g. "cachedContents/ab12cd34ef56"
  } catch (err) {
    console.error("[Gemini Cache] Exception during context cache creation:", err);
    return null;
  }
}

/**
 * Menghapus Context Cache secara manual jika dokumen dihapus dari sistem.
 */
export async function deleteGeminiContextCache(cacheName: string, apiKey: string): Promise<boolean> {
  try {
    const key = apiKey || process.env.GEMINI_API_KEY;
    if (!key || !cacheName) return false;

    const url = `https://generativelanguage.googleapis.com/v1beta/${cacheName}?key=${key}`;
    const res = await fetch(url, { method: "DELETE" });
    
    if (res.ok) {
      console.log(`[Gemini Cache] Successfully deleted cache: ${cacheName}`);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[Gemini Cache] Failed to delete context cache:", err);
    return false;
  }
}
