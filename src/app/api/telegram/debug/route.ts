import { NextResponse } from "next/server";
import { connectDB } from "../../../../lib/db/mongodb";
import { TelegramOtp } from "../../../../lib/db/models/TelegramOtp";
import { TelegramLink } from "../../../../lib/db/models/TelegramLink";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    const otps = await TelegramOtp.find().lean();
    const links = await TelegramLink.find().lean();
    
    return NextResponse.json({
      timestamp: new Date().toISOString(),
      currentTimeMs: Date.now(),
      active_otps: otps,
      active_links: links,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
