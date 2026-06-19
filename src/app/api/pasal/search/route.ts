import { NextRequest, NextResponse } from "next/server";

const BASE = "https://pasal.id/api/v1";

function getToken(): string | null {
  return process.env.PASAL_ID_TOKEN || null;
}

export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json({ error: "PASAL_ID_TOKEN belum dikonfigurasi" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  if (!q) {
    return NextResponse.json({ error: "Parameter q wajib diisi" }, { status: 400 });
  }

  const type = searchParams.get("type") || "";
  const limit = searchParams.get("limit") || "10";

  const params = new URLSearchParams({ q, limit });
  if (type) params.set("type", type);

  try {
    const res = await fetch(`${BASE}/search?${params.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: "Pasal.id error", status: res.status, detail: text }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err) {
    console.error("[pasal/search] error:", err);
    return NextResponse.json({ error: "Gagal menghubungi Pasal.id" }, { status: 502 });
  }
}
