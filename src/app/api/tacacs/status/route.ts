import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import {
  getTacacsRuntimeStatus,
  startTacacsServer,
  stopTacacsServer,
} from "@/lib/tacacs/server";
import {
  getTacacsSettings,
  saveTacacsSettings,
  seedDefaultTacacsGroupsIfEmpty,
  toPublicTacacsSettings,
} from "@/lib/tacacs/settings";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    await seedDefaultTacacsGroupsIfEmpty().catch(() => {});

    const [
      settings,
      totalUsers,
      activeUsers,
      totalGroups,
      totalClients,
      activeClients,
      recent24hLogs,
      recent24hFails,
    ] = await Promise.all([
      getTacacsSettings(),
      prisma.tacacsUser.count(),
      prisma.tacacsUser.count({ where: { is_active: true } }),
      prisma.tacacsGroup.count(),
      prisma.tacacsClient.count(),
      prisma.tacacsClient.count({ where: { is_active: true } }),
      prisma.tacacsAuditLog.count({
        where: { created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.tacacsAuditLog.count({
        where: {
          created_at: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          status: { in: ["FAIL", "ERROR"] },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        runtime: getTacacsRuntimeStatus(),
        settings: toPublicTacacsSettings(settings),
        summary: {
          total_users: totalUsers,
          active_users: activeUsers,
          total_groups: totalGroups,
          total_clients: totalClients,
          active_clients: activeClients,
          logs_24h: recent24hLogs,
          fails_24h: recent24hFails,
        },
      },
    });
  } catch (err: any) {
    console.error("GET /api/tacacs/status error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memuat status TACACS+ server." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "").toLowerCase();

    let runtime;
    if (action === "start") {
      const updated = await saveTacacsSettings({ enabled: true });
      runtime = await startTacacsServer(updated);
    } else if (action === "stop") {
      await saveTacacsSettings({ enabled: false });
      runtime = await stopTacacsServer();
    } else if (action === "restart") {
      const updated = await saveTacacsSettings({ enabled: true });
      runtime = await startTacacsServer(updated);
    } else {
      return NextResponse.json(
        { success: false, error: "Action tidak valid. Gunakan 'start', 'stop', atau 'restart'." },
        { status: 400 }
      );
    }

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_SERVER",
      aktifitas: `TACACS+ Server ${action.toUpperCase()} (${runtime.state})`,
      detail: `Port ${runtime.port} | Status: ${runtime.state}${runtime.last_error ? ` | ${runtime.last_error}` : ""}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message:
        runtime.state === "ERROR"
          ? runtime.last_error || "TACACS+ server gagal berjalan."
          : `TACACS+ server ${runtime.state === "RUNNING" ? "aktif" : "dihentikan"}.`,
      data: { runtime },
    });
  } catch (err: any) {
    console.error("POST /api/tacacs/status error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal mengontrol TACACS+ server." },
      { status: 500 }
    );
  }
}

