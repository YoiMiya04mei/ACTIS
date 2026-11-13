import { NextRequest, NextResponse } from "next/server";
import {
  getTelegramConfig,
  saveTelegramConfig,
  sendTestNotification,
  maskBotToken,
  isMaskedTokenInput,
} from "@/lib/telegramService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

/**
 * GET /api/monitoring/telegram
 * Mendapatkan status konfigurasi Telegram Bot (token disamarkan/masked)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const config = await getTelegramConfig();

    // Mask bot token demi keamanan di frontend
    const maskedToken = maskBotToken(config.bot_token);

    return NextResponse.json({
      success: true,
      data: {
        bot_token: maskedToken,
        has_token: Boolean(config.bot_token),
        chat_id: config.chat_id,
        enabled: config.enabled,
        notif_down: config.notif_down,
        notif_up: config.notif_up,
      },
    });
  } catch (err: any) {
    console.error("GET /api/monitoring/telegram error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to get Telegram config" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/monitoring/telegram
 * Menyimpan konfigurasi Telegram atau mengirim pesan tes
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    // Aksi 1: Kirim Pesan Tes (Hanya butuh authenticated user)
    if (action === "test") {
      const auth = await requireAuth(request);
      if (!auth.ok) return auth.response;

      const testToken = body.bot_token?.trim();
      const testChatId = body.chat_id?.trim();

      const result = await sendTestNotification({
        bot_token: testToken,
        chat_id: testChatId,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              result.error ||
              "Gagal mengirim pesan tes ke Telegram. Periksa kembali Bot Token dan Chat ID Anda.",
          },
          { status: 400 }
        );
      }

      // Catat ke Log Aplikasi
      const actorName = auth.user.nama;
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
      const userAgent = parseUserAgent(request.headers.get("user-agent"));
      recordActivity({
        nama_lengkap: actorName,
        ip_address: clientIp,
        tipe: "MONITORING_ALERT",
        aktifitas: "Menguji pengiriman notifikasi Bot Telegram",
        detail: `Chat ID: ${testChatId || "-"}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Notifikasi tes berhasil terkirim ke Telegram!",
      });
    }

    // Aksi 2: Simpan Konfigurasi (Wajib level Administrator)
    const adminAuth = await requireAuth(request, { requireAdmin: true });
    if (!adminAuth.ok) return adminAuth.response;

    const { bot_token, chat_id, enabled, notif_down, notif_up } = body;

    const payloadToSave: any = {};
    if (bot_token !== undefined) {
      // Hanya simpan jika bukan token yang di-mask
      if (!isMaskedTokenInput(bot_token)) {
        payloadToSave.bot_token = bot_token.trim();
      }
    }
    if (chat_id !== undefined) payloadToSave.chat_id = chat_id.trim();
    if (enabled !== undefined) payloadToSave.enabled = Boolean(enabled);
    if (notif_down !== undefined) payloadToSave.notif_down = Boolean(notif_down);
    if (notif_up !== undefined) payloadToSave.notif_up = Boolean(notif_up);

    const updated = await saveTelegramConfig(payloadToSave);

    // Catat ke Log Aplikasi
    const actorName = adminAuth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: "Memperbarui konfigurasi notifikasi Bot Telegram",
      detail: `Status: ${updated.enabled ? "Aktif" : "Nonaktif"}, Chat ID: ${updated.chat_id || "-"}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Pengaturan integrasi Bot Telegram berhasil disimpan.",
      data: {
        enabled: updated.enabled,
        chat_id: updated.chat_id,
        has_token: Boolean(updated.bot_token),
        notif_down: updated.notif_down,
        notif_up: updated.notif_up,
      },
    });
  } catch (err: any) {
    console.error("POST /api/monitoring/telegram error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to process Telegram request" },
      { status: 500 }
    );
  }
}

