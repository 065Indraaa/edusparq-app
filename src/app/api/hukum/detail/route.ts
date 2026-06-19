import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const uri = searchParams.get("uri"); // e.g. "akn/id/act/uu/2003/13"

  if (!uri) {
    return NextResponse.json({ error: "Missing uri parameter" }, { status: 400 });
  }

  const token = process.env.PASAL_ID_TOKEN;
  if (!token) {
    return NextResponse.json({ 
      error: "API Token Pasal.id belum dikonfigurasi. Silakan tambahkan PASAL_ID_TOKEN di .env.local" 
    }, { status: 401 });
  }

  try {
    const targetUrl = new URL(`https://pasal.id/api/v1/laws/${uri}`);

    const res = await fetch(targetUrl.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (error: any) {
    console.error("Pasal.id Detail Error:", error);
    return NextResponse.json({ error: "Gagal terhubung ke server Pasal.id" }, { status: 500 });
  }
}
