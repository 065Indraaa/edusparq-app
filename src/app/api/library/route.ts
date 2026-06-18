import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import { connectDB } from "../../../lib/db/mongodb";
import { SavedReference } from "../../../lib/db/models/SavedReference";

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const { title, content, type = "AI Synthesis", query = "" } = await req.json();

    if (!content) {
      return NextResponse.json({ error: "Content required" }, { status: 400 });
    }

    // Menggunakan query/title sebagai ID semu, dipadukan timestamp jika diperlukan, 
    // tapi karena ini sintesis panjang, kita buat unique hash dari title+time
    const refId = `ref-${Date.now()}`;
    const generatedTitle = title || (query ? `Sintesis AI: ${query}` : "Hasil Riset Tersimpan");

    const newRef = await SavedReference.create({
      userId: session.user.id,
      refId: refId,
      title: generatedTitle,
      typeLabel: type,
      content: content,
      year: new Date().getFullYear().toString(),
    });

    return NextResponse.json({ success: true, data: newRef });
  } catch (error: any) {
    console.error("[library] POST Error:", error);
    // Handle unique index error
    if (error.code === 11000) {
      return NextResponse.json({ error: "Sudah tersimpan di Pustaka." }, { status: 409 });
    }
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectDB();
    const references = await SavedReference.find({ userId: session.user.id }).sort({ savedAt: -1 });

    return NextResponse.json(references);
  } catch (error: any) {
    console.error("[library] GET Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "ID required" }, { status: 400 });
    }

    await connectDB();
    await SavedReference.findOneAndDelete({ _id: id, userId: session.user.id });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[library] DELETE Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
