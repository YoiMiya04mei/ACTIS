import { NextRequest, NextResponse } from "next/server";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import {
  getTacacsSettings,
  saveTacacsSettings,
  toPublicTacacsSettings,
} from "@/lib/tacacs/settings";
import {
  getTacacsRuntimeStatus,
  startTacacsServer,
  stopTacacsServer,
} from "@/lib/tacacs/server";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getTacacsSettings();
    return NextResponse.json({
      success: true,
      data: toPublicTacacsSettings(settings),
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal mengambil pengaturan TACACS+." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const prev = await getTacacsSettings();

    const portNum = body.port !== undefined ? Number(body.port) : prev.port;
    if (!Number.isInteger(portNum) || portNum < 1 || portNum > 65535) {
      return NextResponse.json(
        { success: false, error: "Port TCP harus berupa bilangan bulat antara 1 hingga 65535." },
        { status: 400 }
      );
    }

    const updated = await saveTacacsSettings({
      enabled: typeof body.enabled === "boolean" ? body.enabled : prev.enabled,
      bind_host: typeof body.bind_host === "string" ? body.bind_host : prev.bind_host,
      port: portNum,
      allow_unencrypted:
        typeof body.allow_unencrypted === "boolean"
          ? body.allow_unencrypted
          : prev.allow_unencrypted,
      require_registered_client:
        typeof body.require_registered_client === "boolean"
          ? body.require_registered_client
          : prev.require_registered_client,
      default_secret:
        typeof body.default_secret === "string" ? body.default_secret : undefined,
      clear_default_secret: Boolean(body.clear_default_secret),
      default_enable_password:
        typeof body.default_enable_password === "string"
          ? body.default_enable_password
          : undefined,
      clear_default_enable_password: Boolean(body.clear_default_enable_password),
      allow_actis_users_fallback:
        typeof body.allow_actis_users_fallback === "boolean"
          ? body.allow_actis_users_fallback
          : prev.allow_actis_users_fallback,
      log_retention_days:
        body.log_retention_days !== undefined ? Number(body.log_retention_days) : prev.log_retention_days,
      socket_timeout_ms:
        body.socket_timeout_ms !== undefined ? Number(body.socket_timeout_ms) : prev.socket_timeout_ms,
    });

    const runtime = updated.enabled
      ? await startTacacsServer(updated)
      : await stopTacacsServer();

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_CONFIG",
      aktifitas: `Memperbarui konfigurasi TACACS+ Server (${updated.bind_host}:${updated.port})`,
      detail: `Enabled=${updated.enabled}, StrictClient=${updated.require_registered_client}, FallbackACTIS=${updated.allow_actis_users_fallback}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Konfigurasi TACACS+ Server berhasil disimpan.",
      data: {
        settings: toPublicTacacsSettings(updated),
        runtime: runtime ?? getTacacsRuntimeStatus(),
      },
    });
  } catch (err: any) {
    console.error("PUT /api/tacacs/settings error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menyimpan konfigurasi TACACS+." },
      { status: 500 }
    );
  }
}

