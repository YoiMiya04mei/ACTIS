import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { forceSyncAllOrdersToSheets, getWebhookUrl } from "@/lib/sheetsSync";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const webhookUrl = await getWebhookUrl();
    const isConfigured =
      webhookUrl &&
      !webhookUrl.includes("SAMPLE_ACTIS_WEBHOOK") &&
      webhookUrl.startsWith("http");

    const logs = await prisma.sheetsSyncLog.findMany({
      orderBy: { created_at: "desc" },
      take: 50,
    });

    const totalSynced = await prisma.sheetsSyncLog.count({
      where: { status: "SUCCESS" },
    });
    const totalFailed = await prisma.sheetsSyncLog.count({
      where: { status: "FAILED" },
    });

    return NextResponse.json({
      success: true,
      webhook_url: webhookUrl,
      is_configured: isConfigured,
      total_success: totalSynced,
      total_failed: totalFailed,
      logs,
    });
  } catch (err: any) {
    console.error("GET /api/sync/sheets error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch sync status" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const triggeredBy = auth.user.nama;
    const result = await forceSyncAllOrdersToSheets(triggeredBy);

    // Catat ke Log Aplikasi
    const actorName = auth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    const failedCount = result.total - result.synced;
    recordActivity({
      nama_lengkap: actorName,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SHEETS_SYNC",
      aktifitas: `Melakukan sinkronisasi manual Google Sheets (${result.synced}/${result.total} order)`,
      detail: `Berhasil: ${result.synced}, Gagal: ${failedCount}, Total: ${result.total}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Force Sync to Sheets selesai. ${result.synced}/${result.total} tiket berhasil disinkronkan ke Google Spreadsheet.`,
      summary: result,
    });
  } catch (err: any) {
    console.error("POST /api/sync/sheets error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Force Sync failed" },
      { status: 500 }
    );
  }
}

