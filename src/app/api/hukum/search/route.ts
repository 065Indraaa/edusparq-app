import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");
  const type = searchParams.get("type");
  const limit = searchParams.get("limit") || "10";

  if (!q && !type) {
    return NextResponse.json({ error: "Missing query or type parameter" }, { status: 400 });
  }

  const token = process.env.PASAL_ID_TOKEN;
  if (!token) {
    return NextResponse.json({ 
      error: "API Token Pasal.id belum dikonfigurasi. Silakan tambahkan PASAL_ID_TOKEN di .env.local" 
    }, { status: 401 });
  }

  try {
    const targetUrl = new URL("https://pasal.id/api/v1/search");
    if (q) targetUrl.searchParams.set("q", q);
    if (type) targetUrl.searchParams.set("type", type);
    targetUrl.searchParams.set("limit", limit);

    const res = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Pasal.id Search Error:", error);
    return NextResponse.json({ error: "Gagal terhubung ke server Pasal.id" }, { status: 500 });
  }
}
