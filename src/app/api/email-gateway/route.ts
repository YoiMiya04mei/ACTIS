import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { getAllowedMenusForRole, getStoredAccessLevels } from "@/lib/accessLevelsStore";
import {
  getAdminEmailGatewayConfig,
  getDocumentUserEmailGatewayStatus,
  saveEmailGatewayConfig,
  type UpdateEmailGatewayInput,
} from "@/lib/emailGatewayService";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const isAdmin = auth.user.role === "admin";
    if (isAdmin) {
      const config = await getAdminEmailGatewayConfig();
      return NextResponse.json(
        {
          success: true,
          canManage: true,
          config,
          status: {
            enabled: config.enabled,
            isConfigured: config.isConfigured,
            fromName: config.fromName,
            fromEmail: config.fromEmail,
            defaultCc: config.defaultCc,
            signatureText: config.signatureText,
            categoryTemplates: config.categoryTemplates,
          },
        },
        { headers: NO_CACHE_HEADERS }
      );
    }

    const accessStore = await getStoredAccessLevels();
    const allowedMenus = getAllowedMenusForRole(accessStore.roles, auth.user.role);
    const hasDocAccess =
      allowedMenus.includes("tools_documents") ||
      allowedMenus.includes("tools_history") ||
      allowedMenus.includes("settings_email_gateway");

    if (!hasDocAccess) {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Anda tidak memiliki izin modul Dokumen atau Email Gateway.",
        },
        { status: 403, headers: NO_CACHE_HEADERS }
      );
    }

    const status = await getDocumentUserEmailGatewayStatus();
    return NextResponse.json(
      {
        success: true,
        canManage: false,
        status,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    console.error("GET /api/email-gateway error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat konfigurasi Email Gateway." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => null)) as UpdateEmailGatewayInput | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Payload konfigurasi SMTP tidak valid." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const updated = await saveEmailGatewayConfig(body, auth.user.nama);

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Memperbarui konfigurasi Email Gateway SMTP (${updated.smtpHost || "belum diisi"}:${updated.smtpPort})`,
      detail: `Status=${updated.enabled ? "Aktif" : "Nonaktif"} | Pengirim=${updated.fromEmail || "-"}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: "Konfigurasi Email Gateway berhasil disimpan.",
        config: updated,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal menyimpan konfigurasi Email Gateway.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
