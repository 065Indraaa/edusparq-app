import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../lib/auth";
import {
  getMemoryGraph, searchMemories, addMemory, deleteMemory,
  connectMemories, autoProcessMemories,
} from "../../../lib/memory-engine";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action") || "search";
  const query = searchParams.get("q") || "";
  const limit = parseInt(searchParams.get("limit") || "20", 10);
  try {
    if (action === "graph") {
      const graph = await getMemoryGraph(session.user.id, 50);
      return NextResponse.json(graph);
    }
    if (action === "search") {
      const memories = await searchMemories(session.user.id, query, limit);
      return NextResponse.json({ memories });
    }
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  try {
    if (body.action === "auto-process") {
      const result = await autoProcessMemories(session.user.id);
      return NextResponse.json(result);
    }
    if (body.action === "connect") {
      const { sourceTitle, targetTitle, edgeType } = body;
      if (!sourceTitle || !targetTitle) return NextResponse.json({ error: "sourceTitle and targetTitle required" }, { status: 400 });
      const ok = await connectMemories(session.user.id, sourceTitle, targetTitle, edgeType || "related");
      return NextResponse.json({ ok });
    }
    const { type, title, content, tags, source } = body;
    if (!title) return NextResponse.json({ error: "title required" }, { status: 400 });
    const nodeId = await addMemory(session.user.id, type || "fact", title, content || "", Array.isArray(tags) ? tags : [], source || "explicit");
    if (!nodeId) return NextResponse.json({ error: "Failed to store memory" }, { status: 500 });
    return NextResponse.json({ nodeId, ok: true }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const nodeId = searchParams.get("id");
  if (!nodeId) return NextResponse.json({ error: "id required" }, { status: 400 });
  const ok = await deleteMemory(session.user.id, nodeId);
  return NextResponse.json({ ok });
}
