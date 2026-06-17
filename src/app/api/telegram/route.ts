import { NextRequest, NextResponse } from "next/server";
import { buildSystemPrompt } from "@/lib/ai-prompts";
import { aiComplete } from "@/lib/ai";
import { searchWeb } from "@/lib/web-search";

export async function POST(req: NextRequest) {
  try {
    const update = await req.json();

    // Pastikan ini adalah message dari user
    if (!update.message || !update.message.text) {
      return NextResponse.json({ status: "ok" });
    }

    const chatId = update.message.chat.id;
    const text = update.message.text;

    // Command /start
    if (text === "/start") {
      await sendTelegramMessage(chatId, "Halo! Saya adalah AI Asisten EduSparq. Kirimkan pertanyaan atau tugas kuliah Anda, dan saya akan membantu menyelesaikannya beserta riset web!");
      return NextResponse.json({ status: "ok" });
    }

    // Beri tahu user bahwa bot sedang berpikir
    await sendTelegramMessage(chatId, "⏳ Sedang memproses dan mencari referensi...");

    // 1. Web Search otomatis
    let sourceBlock = "";
    try {
      const webResults = await searchWeb(text, 3);
      sourceBlock += webResults;
    } catch (err) {
      console.warn("Gagal pencarian web via Telegram.");
    }

    // 2. Siapkan prompt
    const systemPrompt = buildSystemPrompt("solver", {
      sourceBlock: sourceBlock,
    });

    // 3. Panggil AI
    const aiResponse = await aiComplete({
      task: "chat",
      system: systemPrompt,
      user: text,
      maxTokens: 3000,
    });

    // 4. Kirim balasan
    await sendTelegramMessage(chatId, aiResponse.text);

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    console.error("Telegram Webhook Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// Fungsi helper untuk mengirim pesan via API Telegram
async function sendTelegramMessage(chatId: number, text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.error("TELEGRAM_BOT_TOKEN belum di-set di .env");
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text,
        parse_mode: "Markdown",
      }),
    });
  } catch (err) {
    console.error("Gagal mengirim pesan ke Telegram:", err);
  }
}
