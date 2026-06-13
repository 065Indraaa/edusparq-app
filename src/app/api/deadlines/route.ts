import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { Deadline } from "@/lib/db/models/Deadline";
import { z } from "zod";

const DeadlineSchema = z.object({
  courseName: z.string().min(1),
  title: z.string().min(1),
  dueDate: z.string().min(1),
  dueTime: z.string().default("23:59"),
  weight: z.string().default(""),
  requirements: z.string().default(""),
  description: z.string().default(""),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const deadlines = await Deadline.find({ userId: session.user.id }).sort({ dueDate: 1 });
  return NextResponse.json(deadlines);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = DeadlineSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  await connectDB();
  const deadline = await Deadline.create({ userId: session.user.id, ...parsed.data });
  return NextResponse.json(deadline, { status: 201 });
}
