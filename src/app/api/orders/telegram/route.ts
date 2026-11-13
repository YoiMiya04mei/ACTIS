import { NextRequest, NextResponse } from "next/server";
import {
  getTicketTelegramConfig,
  saveTicketTelegramConfig,
  sendTicketTestNotification,
  maskBotToken,
  isMaskedTokenInput,
} from "@/lib/telegramService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

/**
 * GET /api/orders/telegram
 * Mendapatkan konfigurasi Bot Telegram khusus notifikasi tiket selesai (token disamarkan)
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const config = await getTicketTelegramConfig();

    return NextResponse.json({
      success: true,
      data: {
        bot_token: maskBotToken(config.bot_token),
        has_token: Boolean(config.bot_token),
        chat_id: config.chat_id,
        enabled: config.enabled,
        include_specs: config.include_specs,
        include_notes: config.include_notes,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to load ticket Telegram config";
    console.error("GET /api/orders/telegram error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/orders/telegram
 * Menguji pengiriman pesan atau menyimpan konfigurasi Bot Telegram notifikasi tiket selesai
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      action,
      bot_token,
      chat_id,
      enabled,
      include_specs,
      include_notes,
    } = body as {
      action?: string;
      bot_token?: string;
      chat_id?: string;
      enabled?: boolean;
      include_specs?: boolean;
      include_notes?: boolean;
    };

    if (action === "test") {
      const auth = await requireAuth(request);
      if (!auth.ok) return auth.response;

      const actorName = auth.user.nama;
      const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
      const userAgent = parseUserAgent(request.headers.get("user-agent"));

      const testToken = typeof bot_token === "string" ? bot_token.trim() : undefined;
      const testChatId = typeof chat_id === "string" ? chat_id.trim() : undefined;

      const result = await sendTicketTestNotification({
        bot_token: testToken,
        chat_id: testChatId,
      });

      if (!result.success) {
        return NextResponse.json(
          {
            success: false,
            error:
              result.error ||
              "Gagal mengirim pesan tes ke Telegram Tiket. Periksa kembali Bot Token dan Chat ID Anda.",
          },
          { status: 400 }
        );
      }

      recordActivity({
        nama_lengkap: actorName,
        ip_address: clientIp,
        tipe: "SETTING_UPDATE",
        aktifitas: "Menguji pengiriman notifikasi Bot Telegram Tiket Selesai",
        detail: `Chat ID: ${testChatId || "-"}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: "Pesan tes notifikasi tiket selesai berhasil terkirim ke Telegram!",
      });
    }

    // Saving settings requires admin role
    const adminAuth = await requireAuth(request, { requireAdmin: true });
    if (!adminAuth.ok) return adminAuth.response;

    const actorName = adminAuth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    const updated = await saveTicketTelegramConfig({
      ...(typeof bot_token === "string" && !isMaskedTokenInput(bot_token)
        ? { bot_token: bot_token.trim() }
        : {}),
      ...(typeof chat_id === "string" ? { chat_id: chat_id.trim() } : {}),
      ...(enabled !== undefined ? { enabled: Boolean(enabled) } : {}),
      ...(include_specs !== undefined ? { include_specs: Boolean(include_specs) } : {}),
      ...(include_notes !== undefined ? { include_notes: Boolean(include_notes) } : {}),
    });

    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: "Memperbarui konfigurasi Bot Telegram Notifikasi Tiket Selesai",
      detail: `Status: ${updated.enabled ? "Aktif" : "Nonaktif"}, Chat ID: ${updated.chat_id || "-"}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Pengaturan Bot Telegram Notifikasi Tiket berhasil disimpan.",
      data: {
        bot_token: maskBotToken(updated.bot_token),
        has_token: Boolean(updated.bot_token),
        chat_id: updated.chat_id,
        enabled: updated.enabled,
        include_specs: updated.include_specs,
        include_notes: updated.include_notes,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to process ticket Telegram request";
    console.error("POST /api/orders/telegram error:", err);
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}
