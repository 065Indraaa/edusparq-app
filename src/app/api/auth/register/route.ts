import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/db/mongodb";
import { User } from "@/lib/db/models/User";
import bcrypt from "bcryptjs";

// MongoDB + bcrypt require the full Node.js runtime (raw TCP/TLS, crypto).
// Pin it explicitly so the host never runs this on an edge runtime.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Semua field wajib diisi" }, { status: 400 });
    }
    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json({ error: "Kata sandi minimal 8 karakter" }, { status: 400 });
    }

    await connectDB();
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "Email sudah terdaftar" }, { status: 409 });
    }

    const hashed = await bcrypt.hash(password, 12);
    const user = await User.create({ name, email, password: hashed });
    return NextResponse.json(
      { id: user._id, name: user.name, email: user.email },
      { status: 201 }
    );
  } catch (err) {
    console.error("[register] failed:", err);
    return NextResponse.json(
      { error: "Pendaftaran gagal. Coba lagi sebentar — server tidak dapat terhubung ke database." },
      { status: 503 }
    );
  }
}
