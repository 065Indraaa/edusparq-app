import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "../../../lib/db/mongodb";
import { TelegramLink } from "../../../lib/db/models/TelegramLink";
import { User } from "../../../lib/db/models/User";
import { Deadline } from "../../../lib/db/models/Deadline";
import { ClassSchedule } from "../../../lib/db/models/ClassSchedule";
import { Course } from "../../../lib/db/models/Course";
import { Document as DocModel } from "../../../lib/db/models/Document";
import { DocumentChunk } from "../../../lib/db/models/DocumentChunk";
import { TelegramUploadSession } from "../../../lib/db/models/TelegramUploadSession";
import {
  sendTelegram,
  sendLongMessage,
  getBot,
  verifyOtp,
  cleanupOtpStore,
  buildMainMenu,
  buildOnboardingMenu,
  buildAkademikMenu,
  buildTugasMenu,
  buildJadwalMenu,
  buildAkunMenu,
  buildModeKeyboard,
  formatCreditBalance,
  formatTrace,
  downloadTelegramFile,
  uploadToCloudinary,
  buildCoursePickerMenu,
  buildUploadConfirmMenu,
  buildDeadlineActionMenu,
} from "../../../lib/telegram";
import { chunkText } from "../../../lib/rag";
import { extractTextFromUrl } from "../../../lib/server-extract";
import { getBalance } from "../../../lib/credit-billing";
import { InsufficientCreditsError } from "../../../lib/ai-client";
import { analyzeDocument } from "../../../lib/hybrid-ai";
import { updateUploadPreferences } from "../../../lib/ai-memory";

/**
 * POST /api/telegram — Webhook handler untuk Telegram Bot.
 *
 * Flow:
 *   1. Terima update dari Telegram webhook.
 *   2. Identifikasi user via TelegramLink (telegramId → userId).
 *   3. Route ke command handler, file handler, atau orchestrator.
 */

interface TelegramFrom {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

interface TelegramDocument {
  file_id: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

interface TelegramPhoto {
  file_id: string;
  file_size?: number;
}

interface TelegramMessage {
  message_id: number;
  chat: { id: number; type?: string };
  from?: TelegramFrom;
  text?: string;
  document?: TelegramDocument;
  photo?: TelegramPhoto[];
  reply_to_message?: { text?: string };
}

interface TelegramCallbackQuery {
  id: string;
  from: { id: number };
  message: { message_id: number; chat: { id: number }; text?: string };
  data: string;
}

interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

// In-memory rate limit: telegramId → last message timestamp.
const chatCooldown = new Map<string, number>();
const COOLDOWN_MS = 3000;

function isOnCooldown(telegramId: string): boolean {
  const last = chatCooldown.get(telegramId) || 0;
  if (Date.now() - last < COOLDOWN_MS) return true;
  chatCooldown.set(telegramId, Date.now());
  return false;
}

function detectFileType(mime?: string): "pdf" | "docx" | "image" | "other" {
  if (!mime) return "other";
  if (mime.includes("pdf")) return "pdf";
  if (mime.includes("word") || mime.includes("officedocument")) return "docx";
  if (mime.startsWith("image/")) return "image";
  return "other";
}

export async function POST(req: NextRequest) {
  try {
    const update: TelegramUpdate = await req.json();
    cleanupOtpStore().catch(console.error);

    // Handle callback queries (inline keyboard buttons).
    if (update.callback_query) {
      await handleCallback(update.callback_query);
      return NextResponse.json({ status: "ok" });
    }

    const chatId = update.message?.chat.id;
    const from = update.message?.from;
    if (!chatId) return NextResponse.json({ status: "ok" });

    // Handle file upload.
    if (update.message?.document) {
      await handleDocumentUpload(update.message, chatId, from);
      return NextResponse.json({ status: "ok" });
    }

    // Must be a text message.
    if (!update.message?.text) {
      return NextResponse.json({ status: "ok" });
    }

    const text = update.message.text.trim();

    // Route commands.
    if (text.startsWith("/")) {
      await handleCommand(text, chatId, from);
    } else {
      // Check wizard state first.
      const handled = await handleWizardText(text, chatId, from);
      if (!handled) {
        await handleMessage(text, chatId, from);
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (err) {
    console.error("[telegram webhook] error:", err);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ─── Document Upload Handler ────────────────────────────────────────────────

async function handleDocumentUpload(
  msg: TelegramMessage,
  chatId: number,
  from?: TelegramFrom
) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(
      chatId,
      "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan."
    );
    return;
  }

  const doc = msg.document!;
  const fileType = detectFileType(doc.mime_type);
  if (fileType === "other") {
    await sendTelegram(chatId, "❌ Format file tidak didukung. Kirim PDF atau DOCX.");
    return;
  }

  await connectDB();

  // Check credit.
  const balance = await getBalance(userId);
  if (balance < 5) {
    await sendTelegram(
      chatId,
      "⚠️ Credit Anda sangat rendah. Upload & analisis membutuhkan credit. Isi ulang di Billing."
    );
    return;
  }

  // Check courses.
  const courses = await Course.find({ userId }).lean();
  if (courses.length === 0) {
    await sendTelegram(
      chatId,
      "📚 Anda belum punya mata kuliah. Tambahkan di web EduSparq → Materi, atau ketik nama matkul di sini:"
    );
    // Save partial session.
    await TelegramUploadSession.deleteMany({ telegramId: String(from?.id) });
    await TelegramUploadSession.create({
      telegramId: String(from?.id),
      userId: new (await import("mongoose")).Types.ObjectId(userId),
      step: "awaiting_course",
      tempFileName: doc.file_name || "dokumen",
      tempFileType: fileType,
    });
    return;
  }

  if (courses.length === 1) {
    // Auto-select the only course.
    await startUploadWizard(chatId, from, doc, courses[0]);
    return;
  }

  // Multiple courses — ask user to pick.
  await TelegramUploadSession.deleteMany({ telegramId: String(from?.id) });
  await TelegramUploadSession.create({
    telegramId: String(from?.id),
    userId: new (await import("mongoose")).Types.ObjectId(userId),
    step: "awaiting_course",
    tempFileName: doc.file_name || "dokumen",
    tempFileType: fileType,
  });

  await sendTelegram(
    chatId,
    `📄 *${doc.file_name || "Dokumen"}*\n\nPilih mata kuliah tujuan upload:`,
    {
      replyMarkup: buildCoursePickerMenu(
        courses.map((c) => ({ _id: String(c._id), name: c.name })),
        String(from?.id)
      ),
    }
  );
}

async function startUploadWizard(
  chatId: number,
  from: TelegramFrom | undefined,
  doc: TelegramDocument,
  course: any
) {
  const userId = await resolveUserId(from);
  if (!userId) return;

  await sendTelegram(chatId, `⏳ Mengupload *${doc.file_name || "dokumen"}* ke *${course.name}*...`);

  // Download from Telegram.
  const buffer = await downloadTelegramFile(doc.file_id);
  if (!buffer) {
    await sendTelegram(chatId, "❌ Gagal mengunduh file dari Telegram. Coba lagi.");
    return;
  }

  // Upload to Cloudinary.
  const folder = `edusparq/${userId}`;
  const cloudResult = await uploadToCloudinary(buffer, doc.file_name || "dokumen", folder);
  if (!cloudResult) {
    await sendTelegram(chatId, "❌ Gagal upload ke cloud storage. Coba lagi nanti.");
    return;
  }

  // Save or update session.
  await connectDB();
  await TelegramUploadSession.updateOne(
    { telegramId: String(from?.id) },
    {
      $set: {
        step: "processing",
        tempFileUrl: cloudResult.secure_url,
        selectedCourseId: course._id,
        selectedCourseName: course.name,
      },
    },
    { upsert: true }
  );

  await sendTelegram(
    chatId,
    `✅ File tersimpan.\n⏳ Sedang membaca & menganalisis...`,
    { replyMarkup: { inline_keyboard: [] } }
  );

  // Extract text.
  const fileType = detectFileType(doc.mime_type);
  let extracted = "";
  try {
    extracted = await extractTextFromUrl(cloudResult.secure_url, fileType);
  } catch (err) {
    console.error("[telegram upload] extract error:", err);
  }

  if (!extracted || extracted.trim().length < 50) {
    await sendTelegram(
      chatId,
      "⚠️ File berhasil diupload, tapi teks tidak bisa diekstrak (mungkin scan/gambar).\nFile tersimpan di Materi & Analitik."
    );
    await finalizeDocument(userId, course, doc, cloudResult, extracted, "indexed");
    await TelegramUploadSession.deleteMany({ telegramId: String(from?.id) });
    return;
  }

  // Update session with extracted text.
  await TelegramUploadSession.updateOne(
    { telegramId: String(from?.id) },
    { $set: { extractedText: extracted } }
  );

  // Run hybrid AI.
  try {
    const { analysis, response, creditCost } = await analyzeDocument(
      extracted,
      userId,
      course.name
    );

    // Update session.
    await TelegramUploadSession.updateOne(
      { telegramId: String(from?.id) },
      {
        $set: {
          step: analysis.tasksDetected.length > 0 ? "awaiting_deadline_decision" : "done",
          analysisResult: analysis as any,
          detectedTasks: analysis.tasksDetected as any,
        },
      }
    );

    // Save Document with analysis.
    const savedDoc = await finalizeDocument(userId, course, doc, cloudResult, extracted, "indexed", analysis);

    // Send response.
    let msg = `📄 *Analisis Materi*\n\n${response}\n\n💰 *Biaya analisis*: ${creditCost.toFixed(1)} credit`;
    if (analysis.tasksDetected.length > 0) {
      msg += "\n\n⏰ *Tugas terdeteksi!* Mau saya buat pengingat?";
      await sendTelegram(chatId, msg, {
        replyMarkup: buildDeadlineActionMenu(String(from?.id)),
      });
    } else {
      await sendTelegram(chatId, msg);
      await TelegramUploadSession.deleteMany({ telegramId: String(from?.id) });
    }
  } catch (err) {
    console.error("[telegram upload] hybrid AI error:", err);
    await sendTelegram(
      chatId,
      "✅ File berhasil diupload!\n⚠️ Analisis AI gagal, tapi file sudah tersimpan di Materi & Analitik."
    );
    await finalizeDocument(userId, course, doc, cloudResult, extracted, "indexed");
    await TelegramUploadSession.deleteMany({ telegramId: String(from?.id) });
  }
}

async function finalizeDocument(
  userId: string,
  course: any,
  doc: TelegramDocument,
  cloudResult: { secure_url: string; public_id: string },
  extracted: string,
  status: string,
  analysis?: any
) {
  await connectDB();

  const mongoose = await import("mongoose");
  const documentRecord = await DocModel.create({
    userId: new mongoose.Types.ObjectId(userId),
    courseId: course._id,
    courseName: course.name,
    filename: doc.file_name || "dokumen",
    originalName: doc.file_name || "dokumen",
    fileUrl: cloudResult.secure_url,
    publicId: cloudResult.public_id,
    fileType: detectFileType(doc.mime_type),
    fileSize: doc.file_size ? String(doc.file_size) : "",
    source: "telegram",
    status,
    analysisStatus: analysis ? "analyzed" : "pending",
    analysisResult: analysis || null,
    uploadedAt: new Date(),
  });

  // Chunking.
  if (extracted && extracted.trim().length > 0) {
    const chunks = chunkText(extracted);
    if (chunks.length > 0) {
      await DocumentChunk.insertMany(
        chunks.map((content, chunkIndex) => ({
          userId: new mongoose.Types.ObjectId(userId),
          documentId: documentRecord._id,
          courseName: course.name,
          content,
          chunkIndex,
        }))
      );
    }
  }

  return documentRecord;
}

// ─── Wizard Text Handler ────────────────────────────────────────────────────

async function handleWizardText(
  text: string,
  chatId: number,
  from?: TelegramFrom
): Promise<boolean> {
  const telegramId = String(from?.id);
  if (!telegramId) return false;

  await connectDB();
  const session = await TelegramUploadSession.findOne({ telegramId }).lean();
  if (!session) return false;

  if (session.step === "awaiting_course") {
    // User typed a course name manually.
    const userId = await resolveUserId(from);
    if (!userId) return false;

    // Try to match or create course.
    const courses = await Course.find({ userId }).lean();
    const match = courses.find((c) =>
      c.name.toLowerCase().includes(text.toLowerCase())
    );

    if (match) {
      // Fake a document object from session.
      const fakeDoc: TelegramDocument = {
        file_id: "",
        file_name: session.tempFileName,
        mime_type: session.tempFileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      };
      await startUploadWizard(chatId, from, fakeDoc, match);
    } else {
      await sendTelegram(
        chatId,
        `❌ Mata kuliah "${text}" tidak ditemukan.\nPilih dari daftar atau tambahkan di web.`
      );
    }
    return true;
  }

  return false;
}

// ─── Command Handlers ────────────────────────────────────────────────────────

async function handleCommand(
  text: string,
  chatId: number,
  from?: TelegramFrom
) {
  const parts = text.trim().split(/\s+/);
  const cmd = parts[0].toLowerCase();
  const arg = parts.slice(1).join(" ").trim();

  switch (cmd) {
    case "/start": {
      const linked = await resolveUserId(from);
      if (!linked) {
        await sendTelegram(
          chatId,
          "👋 *Selamat datang di EduSparq AI!*\n\n" +
            "Saya asisten akademik AI untuk mahasiswa Indonesia. Untuk mulai mengobrol \\& menggunakan semua fitur, Anda perlu *menghubungkan akun EduSparq* Anda dulu.\n\n" +
            "💡 *Belum punya akun?* Daftar gratis — dapat 1.000 credit percobaan!\n\n" +
            "Setelah login di web, buka *Pengaturan → Telegram* untuk dapatkan kode OTP, lalu kirim:\n" +
            "`/link <kode-otp>`",
          { replyMarkup: buildOnboardingMenu() }
        );
      } else {
        await connectDB();
        const user = await User.findById(linked).lean();
        const name = user?.name || "Pengguna";
        await sendTelegram(
          chatId,
          "👋 Halo *" + name + "*! 👋\n\n" +
            "Pilih kategori menu di bawah ini, atau langsung *ketik pertanyaan* apapun untuk chat dengan AI.\n\n" +
            "🤖 Orchestrator otomatis pilih jalur terbaik (Simple/Medium/Complex).",
          { replyMarkup: buildMainMenu(from?.id ? String(from.id) : "unknown") }
        );
      }
      break;
    }

    case "/help":
      await sendTelegram(
        chatId,
        "📋 *Daftar Command*\n\n" +
          "/start — Pesan pembuka\n" +
          "/link `<otp>` — Hubungkan akun web\n" +
          "/unlink — Putuskan hubungan akun\n" +
          "/saldo — Cek saldo credit\n" +
          "/mode — Ubah mode agent (auto/simple)\n" +
          "/tugas — Deadline \\& tugas terdekat\n" +
          "/jadwal — Jadwal kuliah hari ini\n\n" +
          "💡 *Kirim file PDF/DOCX* untuk upload & analisis otomatis.\n" +
          "💡 *Ketik pertanyaan apapun* untuk chat dengan AI."
      );
      break;

    case "/link":
      if (!arg) {
        await sendTelegram(chatId, "⚠️ Kode OTP diperlukan.\n\nBuka EduSparq web → Pengaturan → Telegram → Dapatkan OTP.\nLalu kirim: `/link <kode>`");
        return;
      }
      await handleLink(arg, chatId, from);
      break;

    case "/unlink":
      await handleUnlink(chatId, from);
      break;

    case "/saldo":
      await handleSaldo(chatId, from);
      break;

    case "/mode":
      await sendTelegram(chatId, "⚙️ Pilih mode agent:", {
        replyMarkup: buildModeKeyboard(from?.id ? String(from.id) : "unknown"),
      });
      break;

    case "/tugas":
      await handleTugas(chatId, from);
      break;

    case "/jadwal":
      await handleJadwal(chatId, from);
      break;

    default:
      await sendTelegram(chatId, "❓ Command tidak dikenali. Ketik `/help` untuk bantuan.");
  }
}

// ─── Link Handler ───────────────────────────────────────────────────────────

async function handleLink(otp: string, chatId: number, from?: TelegramFrom) {
  const userId = await verifyOtp(otp);
  if (!userId) {
    await sendTelegram(chatId, "❌ Kode OTP tidak valid atau sudah kadaluarsa.\nCoba generate ulang di web.");
    return;
  }

  await connectDB();
  await TelegramLink.updateMany({ telegramId: String(from?.id), active: true }, { active: false });
  await TelegramLink.create({
    userId,
    telegramId: String(from?.id),
    telegramUsername: from?.username || "",
    chatId: String(chatId),
    active: true,
  });

  const user = await User.findById(userId).lean();
  const name = user?.name || "Pengguna";

  await sendTelegram(
    chatId,
    "✅ Akun berhasil terhubung!\n\n" +
      `👤 *${name}*\n` +
      `🔗 Telegram ID: ${from?.id}\n` +
      `${from?.username ? `@${from.username}` : ""}\n\n` +
      "Sekarang Anda bisa upload file PDF/DOCX untuk dianalisis AI, atau chat langsung."
  );
}

// ─── Unlink Handler ─────────────────────────────────────────────────────────

async function handleUnlink(chatId: number, from?: TelegramFrom) {
  if (!from?.id) return;
  await connectDB();
  const result = await TelegramLink.updateMany(
    { telegramId: String(from.id), active: true },
    { active: false }
  );
  if (result.modifiedCount > 0) {
    await sendTelegram(chatId, "🔓 Akun berhasil diputuskan dari EduSparq.\nKirim `/link <otp>` untuk menghubungkan kembali.");
  } else {
    await sendTelegram(chatId, "ℹ️ Tidak ada akun yang terhubung dengan Telegram ini.");
  }
}

// ─── Saldo Handler ──────────────────────────────────────────────────────────

async function handleSaldo(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const balance = await getBalance(userId);
  const user = await User.findById(userId).lean();
  const plan = (user?.plan || "free").toUpperCase();
  await sendTelegram(
    chatId,
    formatCreditBalance(balance) + "\n📋 Plan: *" + plan + "*\n" + "\nTop up credit di: web EduSparq → Billing"
  );
}

// ─── Tugas Handler ──────────────────────────────────────────────────────────

async function handleTugas(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const deadlines = await Deadline.find({ userId }).sort({ dueDate: 1 }).limit(5).lean();

  if (deadlines.length === 0) {
    await sendTelegram(chatId, "📋 Belum ada tugas terdaftar.\nTambahkan di web EduSparq → Tugas \\& Tenggat.");
    return;
  }

  const now = Date.now();
  const lines = ["📋 *Tugas \\& Tenggat Terdekat*\n"];
  for (const d of deadlines) {
    const due = new Date(d.dueDate);
    const daysLeft = Math.ceil((due.getTime() - now) / (1000 * 60 * 60 * 24));
    const urgency = daysLeft <= 1 ? "🔴" : daysLeft <= 3 ? "🟡" : "🟢";
    const dateStr = due.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
    lines.push(urgency + " *" + (d.title || "Tugas") + "* — " + dateStr + " (" + daysLeft + " hari lagi)");
    if (d.courseName) lines.push("   📚 " + d.courseName);
  }
  await sendTelegram(chatId, lines.join("\n"));
}

// ─── Jadwal Handler ─────────────────────────────────────────────────────────

async function handleJadwal(chatId: number, from?: TelegramFrom) {
  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>` untuk menghubungkan.");
    return;
  }
  await connectDB();
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" }).toLowerCase();
  const schedules = await ClassSchedule.find({ userId, day: today }).sort({ startTime: 1 }).limit(10).lean();

  if (schedules.length === 0) {
    await sendTelegram(chatId, "🗓️ Tidak ada jadwal hari ini (" + today + ").\nKelola jadwal di web EduSparq → Jadwal.");
    return;
  }

  const lines = ["🗓️ *Jadwal Hari Ini (" + today + ")*\n"];
  for (const s of schedules) {
    lines.push("⏰ " + (s.startTime || "") + "–" + (s.endTime || "") + " — *" + (s.courseName || "Mata Kuliah") + "*");
    if (s.room) lines.push("   📍 " + s.room);
  }
  await sendTelegram(chatId, lines.join("\n"));
}

// ─── Natural Message Handler → Orchestrator ─────────────────────────────────

async function handleMessage(text: string, chatId: number, from?: TelegramFrom) {
  const tid = String(from?.id || chatId);
  if (isOnCooldown(tid)) {
    await sendTelegram(chatId, "⏳ Tunggu sebentar ya, pesan terlalu cepat.");
    return;
  }

  const userId = await resolveUserId(from);
  if (!userId) {
    await sendTelegram(
      chatId,
      "👋 Bot EduSparq bisa membantu tugas kuliah Anda!\n\nHubungkan akun dulu dengan:\n`/link <kode OTP>`\n\nDapatkan OTP di: web EduSparq → Pengaturan → Telegram."
    );
    return;
  }

  await connectDB();
  const balance = await getBalance(userId);
  if (balance <= 0) {
    await sendTelegram(
      chatId,
      "⚠️ Credit Anda habis.\nIsi ulang di web EduSparq → Billing, atau aktifkan BYOK di Pengaturan AI."
    );
    return;
  }

  const bot = getBot();
  if (bot) {
    try { await bot.sendChatAction(chatId, "typing"); } catch {}
  }

  try {
    const { runOrchestrator } = await import("../../../lib/agents/orchestrator");
    const result = await runOrchestrator({ userId, request: text });

    let response = result.output;
    if (result.pendingClarification?.length) {
      response += "\n\n❓ *Pertanyaan Klarifikasi:*\n" +
        result.pendingClarification.map((q, i) => (i + 1) + ". " + q).join("\n") +
        "\n\n_Balas dengan jawaban, atau ketik lanjut untuk pakai asumsi._";
    }

    if (result.trace.length > 1) {
      response += formatTrace(result.trace);
      response += "\n💰 *Total*: " + result.totalCreditCost.toFixed(1) + " credit";
    }

    await sendLongMessage(chatId, response);
  } catch (err) {
    console.error("[telegram] orchestrator error:", err);
    let msg = "❌ Gagal memproses permintaan. Coba lagi.";
    if (err instanceof InsufficientCreditsError) {
      msg = "⚠️ Credit tidak cukup untuk operasi ini. Isi ulang di Billing.";
    }
    await sendTelegram(chatId, msg);
  }
}

// ─── Callback Query Handler (Inline Keyboard) ────────────────────────────────

async function handleCallback(callback: TelegramCallbackQuery) {
  const chatId = callback.message.chat.id;
  const data = callback.data;

  const bot = getBot();
  if (bot) {
    try { bot.answerCallbackQuery(callback.id); } catch {}
  }

  const segments = data.split("_");
  const callbackType = segments[0];
  const cbUserId = segments[segments.length - 1];

  // Upload wizard callbacks.
  if (callbackType === "upcourse") {
    await handleUploadCoursePick(chatId, segments, cbUserId);
    return;
  }
  if (callbackType === "upconfirm") {
    await handleUploadConfirm(chatId);
    return;
  }
  if (callbackType === "upcancel") {
    await handleUploadCancel(chatId, cbUserId);
    return;
  }
  if (callbackType === "deadline") {
    await handleDeadlineDecision(chatId, segments, cbUserId);
    return;
  }

  // Existing menu callbacks.
  if (callbackType === "chat" || callbackType === "saldo" || callbackType === "deadline" || callbackType === "schedule" || callbackType === "help" || callbackType === "menu") {
    const userId = await resolveUserIdById(cbUserId);
    if (!userId) {
      await sendTelegram(chatId, "⚠️ Akun belum terhubung. Kirim `/link <otp>`.");
      return;
    }
    await connectDB();
  }

  if (callbackType === "menu") {
    await sendTelegram(chatId, "🏠 *Menu Utama* — pilih aksi:", {
      replyMarkup: buildMainMenu(cbUserId),
    });
  } else if (callbackType === "cat") {
    const sub = segments[1];
    if (sub === "akademik") {
      await sendTelegram(chatId, "📚 *Akademik* — pilih fitur:", { replyMarkup: buildAkademikMenu(cbUserId) });
    } else if (sub === "tugas") {
      await sendTelegram(chatId, "📋 *Tugas & Tenggat* — pilih aksi:", { replyMarkup: buildTugasMenu(cbUserId) });
    } else if (sub === "jadwal") {
      await sendTelegram(chatId, "🗓️ *Jadwal* — pilih aksi:", { replyMarkup: buildJadwalMenu(cbUserId) });
    } else if (sub === "akun") {
      await sendTelegram(chatId, "💰 *Akun* — pilih aksi:", { replyMarkup: buildAkunMenu(cbUserId) });
    }
  } else if (callbackType === "saldo") {
    await handleSaldo(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "deadline") {
    await handleTugas(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "schedule") {
    await handleJadwal(chatId, { id: Number(cbUserId) });
  } else if (callbackType === "help") {
    await sendTelegram(chatId, "📋 Ketik `/help` untuk daftar lengkap command.");
  } else if (callbackType === "setmode") {
    const mode = segments[1];
    const telegramId = segments[segments.length - 1];
    await connectDB();
    const link = await TelegramLink.findOne({ telegramId, active: true }).lean();
    if (link) {
      await User.findByIdAndUpdate(link.userId, { agentMode: mode }).catch(() => {});
    }
    const modeLabel = mode === "auto" ? "*Auto (Orchestrator)*" : "*Simple (Langsung)*";
    const modeDesc = mode === "auto"
      ? "Bot akan memilih jalur agent terbaik otomatis."
      : "Bot akan menjawab langsung tanpa multi-agent pipeline.";
    await sendTelegram(chatId, "✅ Mode diubah ke " + modeLabel + ".\n" + modeDesc, {
      replyMarkup: buildMainMenu(telegramId),
    });
  }
}

// ─── Upload Wizard Callbacks ────────────────────────────────────────────────

async function handleUploadCoursePick(chatId: number, segments: string[], telegramId: string) {
  const courseId = segments[1];
  if (!courseId) return;

  await connectDB();
  const session = await TelegramUploadSession.findOne({ telegramId }).lean();
  if (!session) {
    await sendTelegram(chatId, "⚠️ Sesi upload tidak ditemukan. Kirim file lagi.");
    return;
  }

  const course = await Course.findById(courseId).lean();
  if (!course) {
    await sendTelegram(chatId, "❌ Mata kuliah tidak ditemukan.");
    return;
  }

  const fakeDoc: TelegramDocument = {
    file_id: "",
    file_name: session.tempFileName,
    mime_type: session.tempFileType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };

  await startUploadWizard(chatId, { id: Number(telegramId) }, fakeDoc, course);
}

async function handleUploadConfirm(chatId: number) {
  await sendTelegram(chatId, "⏳ Memproses upload...");
}

async function handleUploadCancel(chatId: number, telegramId: string) {
  await connectDB();
  await TelegramUploadSession.deleteMany({ telegramId });
  await sendTelegram(chatId, "❌ Upload dibatalkan. Kirim file lagi kalau mau.");
}

async function handleDeadlineDecision(chatId: number, segments: string[], telegramId: string) {
  const decision = segments[1]; // "yes" or "no"

  await connectDB();
  const session = await TelegramUploadSession.findOne({ telegramId }).lean();
  if (!session) {
    await sendTelegram(chatId, "⚠️ Sesi tidak ditemukan.");
    return;
  }

  if (decision === "no") {
    await sendTelegram(chatId, "✅ Oke, file sudah tersimpan. Cek di web → Materi & Analitik.");
    await TelegramUploadSession.deleteMany({ telegramId });
    return;
  }

  // Create deadlines for detected tasks.
  const userId = String(session.userId);
  const tasks = (session.detectedTasks || []) as any[];

  if (tasks.length === 0) {
    await sendTelegram(chatId, "ℹ️ Tidak ada tugas yang perlu dibuat.");
    await TelegramUploadSession.deleteMany({ telegramId });
    return;
  }

  const mongoose = await import("mongoose");
  const created: string[] = [];
  for (const t of tasks) {
    try {
      await Deadline.create({
        userId: new mongoose.Types.ObjectId(userId),
        courseId: session.selectedCourseId || null,
        courseName: session.selectedCourseName || "Umum",
        title: t.title || "Tugas",
        description: t.description || "",
        dueDate: t.dueDateGuess || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
        dueTime: "23:59",
        status: "pending",
      });
      created.push(t.title || "Tugas");
    } catch (err) {
      console.error("[telegram] create deadline error:", err);
    }
  }

  if (created.length > 0) {
    await sendTelegram(
      chatId,
      `✅ *${created.length} deadline berhasil dibuat!*\n\n${created.map((c) => "• " + c).join("\n")}\n\nCek di web → Tugas & Tenggat.`
    );
  } else {
    await sendTelegram(chatId, "⚠️ Gagal membuat deadline. Coba buat manual di web.");
  }

  // Update user upload preferences (memory).
  if (session.selectedCourseId) {
    await updateUploadPreferences(
      String(session.userId),
      String(session.selectedCourseId),
      decision === "yes"
    );
  }

  await TelegramUploadSession.deleteMany({ telegramId });
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function resolveUserId(from?: TelegramFrom): Promise<string | null> {
  if (!from?.id) return null;
  await connectDB();
  const link = await TelegramLink.findOne({ telegramId: String(from.id), active: true }).lean();
  return link ? String(link.userId) : null;
}

async function resolveUserIdById(id?: string): Promise<string | null> {
  if (!id) return null;
  await connectDB();
  const link = await TelegramLink.findOne({ telegramId: id, active: true }).lean();
  return link ? String(link.userId) : null;
}
