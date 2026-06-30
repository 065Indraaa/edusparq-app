import crypto from "crypto";

/**
 * Enkripsi simetris untuk menyimpan kunci API user (BYOK) di database.
 *
 * Pakai AES-256-GCM: authenticated encryption → kunci tidak bisa diubah tanpa
 * terdeteksi. Format ciphertext: `iv:tag:data` dalam base64url.
 *
 * Kunci master diambil dari env CREDIT_ENCRYPTION_KEY. Bila env kosong
 * (mis. dev lokal), di-fallback ke derivasi dari NEXTAUTH_SECRET supaya tidak
 * crash — tapi dicatat warning. Untuk produksi, WAJIB set CREDIT_ENCRYPTION_KEY.
 */

const ALGO = "aes-256-gcm";
const IV_LEN = 12; // 96-bit IV (rekomendasi GCM)

function getMasterKey(): Buffer {
  const isProd = process.env.NODE_ENV === "production";
  const raw = process.env.CREDIT_ENCRYPTION_KEY;

  if (!raw) {
    if (isProd) {
      throw new Error(
        "[crypto] CRITICAL SECURITY ERROR: CREDIT_ENCRYPTION_KEY wajib di-set di environment produksi!"
      );
    }
    
    // Fallback untuk development lokal
    const fallbackSrc = process.env.NEXTAUTH_SECRET || "edusparq-dev-fallback-key";
    console.warn(
      `[crypto] WARNING: CREDIT_ENCRYPTION_KEY kosong. Menggunakan fallback dari NEXTAUTH_SECRET/dev-key. TIDAK AMAN UNTUK PRODUKSI!`
    );
    return crypto.createHash("sha256").update(fallbackSrc).digest();
  }

  // Hash ke 32 byte agar panjang selalu konsisten untuk AES-256.
  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptSecret(plaintext: string): string {
  const key = getMasterKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(":");
}

export function decryptSecret(payload: string): string {
  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) throw new Error("format ciphertext rusak");
    const key = getMasterKey();
    const iv = Buffer.from(ivB64, "base64url");
    const tag = Buffer.from(tagB64, "base64url");
    const data = Buffer.from(dataB64, "base64url");
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(data), decipher.final()]);
    return dec.toString("utf8");
  } catch (err) {
    console.error("[crypto] decrypt gagal:", err);
    throw new Error("Tidak bisa mendekripsi kunci. Data korup atau env berubah.");
  }
}

/** Ambil 4 karakter terakhir kunci untuk ditampilkan (hint, bukan kunci penuh). */
export function keyHint(plaintext: string): string {
  const trimmed = (plaintext || "").trim();
  if (trimmed.length <= 4) return "••••";
  return "••••" + trimmed.slice(-4);
}

/** Hasilkan OTP numerik untuk Telegram linking. */
export function generateOtp(length = 6): string {
  const digits = "0123456789";
  let out = "";
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    out += digits[bytes[i] % 10];
  }
  return out;
}
