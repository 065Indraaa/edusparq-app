/**
 * Smoke test — verifikasi API kritis EduSparq secara real via HTTP.
 * Jalankan: node scripts/smoke-test.mjs
 *
 * Test: health, jurusan catalog, jurusan match, telegram setup status,
 *       env validation, login page render.
 */

const BASE = process.env.SMOKE_BASE_URL || "http://localhost:3000";
const TIMEOUT = 20000;

function log(ok, name, detail = "") {
  const icon = ok ? "✅" : "❌";
  console.log(`${icon} ${name}${detail ? " — " + detail : ""}`);
}

async function fetchJSON(path, opts = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      signal: ctrl.signal,
      ...opts,
    });
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = null; }
    return { status: res.status, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function main() {
  console.log(`\n🔍 EduSparq Smoke Test — ${BASE}\n${"=".repeat(50)}\n`);

  let passed = 0;
  let failed = 0;

  // 1. Health check
  try {
    const r = await fetchJSON("/api/health");
    if (r.status === 200) {
      log(true, "GET /api/health");
      passed++;
    } else {
      log(false, "GET /api/health", `status ${r.status}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /api/health", e.message);
    failed++;
  }

  // 2. Jurusan catalog — should return fakultas + jurusan arrays
  try {
    const r = await fetchJSON("/api/jurusan");
    if (r.status === 200 && r.json?.jurusan?.length > 0 && r.json?.fakultas?.length > 0) {
      log(true, "GET /api/jurusan", `${r.json.jurusan.length} jurusan, ${r.json.fakultas.length} fakultas`);
      passed++;
    } else {
      log(false, "GET /api/jurusan", `status ${r.status}, jurusan: ${r.json?.jurusan?.length || 0}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /api/jurusan", e.message);
    failed++;
  }

  // 3. Jurusan match — prodi "Teknik Informatika" should match
  try {
    const r = await fetchJSON("/api/jurusan?prodi=Teknik%20Informatika");
    if (r.status === 200 && r.json?.matched?.name === "Teknik Informatika") {
      log(true, "GET /api/jurusan?prodi=Teknik Informatika", `matched: ${r.json.matched.name}`);
      passed++;
    } else {
      log(false, "GET /api/jurusan?prodi=...", `matched: ${r.json?.matched?.name || "null"}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /api/jurusan?prodi=...", e.message);
    failed++;
  }

  // 4. Jurusan match — fuzzy "informatika"
  try {
    const r = await fetchJSON("/api/jurusan?prodi=informatika");
    if (r.status === 200 && r.json?.matched) {
      log(true, "GET /api/jurusan?prodi=informatika (fuzzy)", `matched: ${r.json.matched.name}`);
      passed++;
    } else {
      log(false, "GET /api/jurusan?prodi=informatika", "no match");
      failed++;
    }
  } catch (e) {
    log(false, "GET /api/jurusan?prodi=informatika", e.message);
    failed++;
  }

  // 5. Telegram setup status — should detect invalid token (placeholder)
  try {
    const r = await fetchJSON("/api/telegram/setup?action=status");
    // Expect 401 (unauthorized, since no session) OR 400 (invalid token) — both prove route works
    if (r.status === 401) {
      log(true, "GET /api/telegram/setup (auth guard)", "401 — auth required ✓");
      passed++;
    } else if (r.status === 400 && r.json?.error?.includes("TIDAK VALID")) {
      log(true, "GET /api/telegram/setup (token check)", "detects invalid token ✓");
      passed++;
    } else {
      log(false, "GET /api/telegram/setup", `status ${r.status}: ${r.json?.error || r.text?.slice(0, 80)}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /api/telegram/setup", e.message);
    failed++;
  }

  // 6. Landing page renders
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(`${BASE}/`, { signal: ctrl.signal });
    clearTimeout(timer);
    const html = await res.text();
    if (res.status === 200 && html.includes("EduSparq")) {
      log(true, "GET / (landing)", `${html.length} bytes, contains "EduSparq"`);
      passed++;
    } else {
      log(false, "GET / (landing)", `status ${res.status}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET / (landing)", e.message);
    failed++;
  }

  // 7. Login page renders
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(`${BASE}/login`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (res.status === 200) {
      log(true, "GET /login");
      passed++;
    } else {
      log(false, "GET /login", `status ${res.status}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /login", e.message);
    failed++;
  }

  // 8. Pricing page renders
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT);
    const res = await fetch(`${BASE}/pricing`, { signal: ctrl.signal, redirect: "manual" });
    clearTimeout(timer);
    // /pricing is under (app) route group — requires auth, will redirect to login (307)
    if (res.status === 200 || res.status === 307) {
      log(true, "GET /pricing", `status ${res.status} ${res.status === 307 ? "(auth redirect — expected)" : ""}`);
      passed++;
    } else {
      log(false, "GET /pricing", `status ${res.status}`);
      failed++;
    }
  } catch (e) {
    log(false, "GET /pricing", e.message);
    failed++;
  }

  console.log(`\n${"=".repeat(50)}\n📊 Hasil: ${passed} passed, ${failed} failed (${Math.round(passed/(passed+failed)*100)}%)\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
