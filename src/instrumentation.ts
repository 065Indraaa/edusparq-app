/**
 * Next.js Instrumentation — dijalankan sekali saat server start.
 * Dipakai untuk validasi environment variable sebelum menerima request.
 */

export async function register() {
  if (process.env.NODE_ENV === "development") {
    // Dev: skip verbose output
    return;
  }

  try {
    const { printEnvReport } = await import("./lib/env-check");
    printEnvReport();
  } catch {
    // Non-fatal
  }
}
