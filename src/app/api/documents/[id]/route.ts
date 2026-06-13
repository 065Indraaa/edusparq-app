import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Document } from "@/lib/db/models/Document";
import { DocumentChunk } from "@/lib/db/models/DocumentChunk";
import { destroyAsset, isCloudinaryConfigured } from "@/lib/cloudinary";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const doc = await Document.findOne({
    _id: params.id,
    userId: session.user.id,
  });

  if (!doc) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Best-effort: remove the underlying Cloudinary asset.
  if (doc.publicId && isCloudinaryConfigured()) {
    await destroyAsset(doc.publicId);
  }

  await DocumentChunk.deleteMany({ documentId: doc._id, userId: session.user.id });
  await Document.deleteOne({ _id: doc._id, userId: session.user.id });

  return NextResponse.json({ success: true });
}
