import { NextRequest, NextResponse } from "next/server";
import { auth } from "../../../../lib/auth";
import { connectDB } from "../../../../lib/db/mongodb";
import { ApiKey } from "../../../../lib/db/models/ApiKey";
import { User } from "../../../../lib/db/models/User";
import { decryptSecret } from "../../../../lib/crypto";
import { testByokConnection } from "../../../../lib/ai-client";

/**
 * PATCH /api/byok/[id] — aktifkan/nonaktifkan/validasi ulang/hapus kunci.
 *   { action: "activate" }    → jadikan kunci aktif (yang lain nonaktif), enable BYOK
 *   { action: "deactivate" }  → nonaktifkan BYOK sepenuhnya
 *   { action: "test" }        → test koneksi ulang
 *   { action: "delete" }      → hapus kunci
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const { action } = await req.json();
    const key = await ApiKey.findById(params.id);
    if (!key || key.userId.toString() !== session.user.id) {
      return NextResponse.json({ error: "Kunci tidak ditemukan" }, { status: 404 });
    }

    if (action === "delete") {
      // Bila yang dihapus kunci aktif, matikan BYOK.
      if (key.active) {
        await User.updateOne({ _id: session.user.id }, { $set: { byokEnabled: false } });
      }
      await ApiKey.deleteOne({ _id: params.id });
      return NextResponse.json({ ok: true });
    }

    if (action === "activate") {
      // Nonaktifkan semua kunci lain milik user, aktifkan yang ini.
      await ApiKey.updateMany(
        { userId: session.user.id, _id: { $ne: params.id } },
        { $set: { active: false } }
      );
      key.active = true;
      await key.save();
      await User.updateOne(
        { _id: session.user.id },
        { $set: { byokEnabled: true } }
      );
      return NextResponse.json({ ok: true, active: true, byokEnabled: true });
    }

    if (action === "deactivate") {
      key.active = false;
      await key.save();
      await User.updateOne(
        { _id: session.user.id },
        { $set: { byokEnabled: false } }
      );
      return NextResponse.json({ ok: true, active: false, byokEnabled: false });
    }

    if (action === "test") {
      const apiKeyPlain = decryptSecret(key.encryptedKey);
      const t = await testByokConnection(key.baseURL, apiKeyPlain, key.model);
      key.validationStatus = t.ok ? "ok" : "invalid";
      key.lastValidated = new Date();
      await key.save();
      return NextResponse.json({
        ok: t.ok,
        validationStatus: key.validationStatus,
        error: t.error,
      });
    }

    return NextResponse.json({ error: "Action tidak dikenal" }, { status: 400 });
  } catch (error) {
    console.error("[byok PATCH] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
