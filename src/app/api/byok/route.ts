import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db/mongodb";
import { ApiKey } from "@/lib/db/models/ApiKey";
import { User } from "@/lib/db/models/User";
import { encryptSecret, keyHint } from "@/lib/crypto";
import { BYOK_PROVIDERS, getProvider } from "@/lib/byok-providers";
import { testByokConnection } from "@/lib/ai-client";

/** GET /api/byok — daftar provider preset + kunci milik user. */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    await connectDB();

    const [keys, user] = await Promise.all([
      ApiKey.find({ userId: session.user.id }).sort({ createdAt: -1 }).lean(),
      User.findById(session.user.id).lean(),
    ]);

    return NextResponse.json({
      providers: BYOK_PROVIDERS,
      keys: keys.map((k) => ({
        id: String(k._id),
        label: k.label,
        provider: k.provider,
        baseURL: k.baseURL,
        model: k.model,
        keyHint: k.keyHint,
        active: k.active,
        validationStatus: k.validationStatus,
        lastValidated: k.lastValidated,
      })),
      byokEnabled: user?.byokEnabled || false,
    });
  } catch (error) {
    console.error("[byok GET] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

/** POST /api/byok — tambah kunci baru (dengan test connection opsional). */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { providerId, label, baseURL, model, apiKey, test } = await req.json();
    if (!apiKey?.trim() || !baseURL?.trim()) {
      return NextResponse.json(
        { error: "API key dan Base URL wajib diisi" },
        { status: 400 }
      );
    }

    const provider = getProvider(providerId) || getProvider("custom")!;
    const finalModel = model || provider.defaultModel;
    const finalLabel = label || provider.name;

    // Test koneksi bila diminta.
    let validationStatus: "ok" | "invalid" | "unknown" = "unknown";
    let validationError = "";
    if (test) {
      const t = await testByokConnection(baseURL, apiKey, finalModel);
      validationStatus = t.ok ? "ok" : "invalid";
      if (!t.ok) validationError = t.error || "Koneksi gagal";
    }

    await connectDB();
    const key = await ApiKey.create({
      userId: session.user.id,
      label: finalLabel,
      provider: provider.id,
      baseURL,
      model: finalModel,
      encryptedKey: encryptSecret(apiKey),
      keyHint: keyHint(apiKey),
      active: false, // tidak auto-aktif; user pilih manual
      lastValidated: test ? new Date() : null,
      validationStatus,
    });

    return NextResponse.json({
      ok: true,
      key: {
        id: String(key._id),
        label: key.label,
        provider: key.provider,
        model: key.model,
        keyHint: key.keyHint,
        validationStatus,
        validationError,
      },
    });
  } catch (error) {
    console.error("[byok POST] error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
