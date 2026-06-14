import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import { Course } from "@/lib/db/models/Course";
import { Document } from "@/lib/db/models/Document";

export const runtime = "nodejs";

// GET /api/user/onboarding — derive setup progress from REAL data (not a stale
// flag) so the checklist is always accurate.
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();

  const [userDoc, courseCount, documentCount] = await Promise.all([
    User.findById(session.user.id).lean(),
    Course.countDocuments({ userId: session.user.id }),
    Document.countDocuments({ userId: session.user.id }),
  ]);
  const user = userDoc as {
    universitas?: string;
    prodi?: string;
    onboardingDismissed?: boolean;
  } | null;

  const profilDone = Boolean(user?.universitas && user?.prodi);
  const adaMatkul = courseCount > 0;
  const adaMateri = documentCount > 0;
  const selesai = profilDone && adaMatkul && adaMateri;

  return NextResponse.json({
    steps: { profilDone, adaMatkul, adaMateri },
    selesai,
    dismissed: Boolean(user?.onboardingDismissed),
  });
}

// PATCH /api/user/onboarding — mark the welcome flow as dismissed.
export async function PATCH() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await connectDB();
  await User.findByIdAndUpdate(session.user.id, {
    $set: { onboardingDismissed: true },
  });

  return NextResponse.json({ success: true });
}
