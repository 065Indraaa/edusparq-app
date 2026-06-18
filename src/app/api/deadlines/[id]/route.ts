import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Deadline } from "../../../../lib/db/models/Deadline";

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const deadline = await Deadline.findOneAndDelete({
    _id: params.id,
    userId: session.user.id,
  });

  if (!deadline) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  await connectDB();
  const deadline = await Deadline.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: body },
    { new: true }
  );

  if (!deadline) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(deadline);
}
