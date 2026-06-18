import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { Course } from "../../../../lib/db/models/Course";
import { courseSchema } from "../../../../lib/validations";

// PATCH /api/courses/[id] - update a course owned by the current user.
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  // Partial update: validate against the same shape but allow any subset.
  const parsed = courseSchema.partial().safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Drop undefined keys so we never overwrite stored values with undefined.
  const update = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined)
  );

  await connectDB();
  const course = await Course.findOneAndUpdate(
    { _id: params.id, userId: session.user.id },
    { $set: update },
    { new: true }
  );

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(course);
}

// DELETE /api/courses/[id] - delete a course owned by the current user.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const course = await Course.findOneAndDelete({
    _id: params.id,
    userId: session.user.id,
  });

  if (!course) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true });
}
