import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get("event_type") || "ALL";
    const status = searchParams.get("status") || "ALL";
    const search = (searchParams.get("search") || "").trim();
    const format = searchParams.get("format") || "json";
    const limit = Math.min(500, Math.max(10, Number(searchParams.get("limit")) || 100));
    const page = Math.max(1, Number(searchParams.get("page")) || 1);

    const where: any = {};
    if (eventType !== "ALL") {
      where.event_type = eventType;
    }
    if (status !== "ALL") {
      where.status = status;
    }
    if (search) {
      where.OR = [
        { username: { contains: search, mode: "insensitive" } },
        { client_ip: { contains: search, mode: "insensitive" } },
        { client_name: { contains: search, mode: "insensitive" } },
        { remote_addr: { contains: search, mode: "insensitive" } },
        { command: { contains: search, mode: "insensitive" } },
        { detail: { contains: search, mode: "insensitive" } },
      ];
    }

    if (format === "csv") {
      const rows = await prisma.tacacsAuditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        take: 2000,
      });

      const esc = (val: unknown) => {
        const s = String(val ?? "");
        return `"${s.replace(/"/g, '""')}"`;
      };

      const header = [
        "Timestamp",
        "EventType",
        "Status",
        "Username",
        "ClientIP",
        "ClientName",
        "RemoteAddr",
        "Port",
        "AuthType",
        "Service",
        "PrivLvl",
        "Command",
        "Detail",
      ].join(",");

      const lines = rows.map((r) =>
        [
          esc(r.created_at.toISOString()),
          esc(r.event_type),
          esc(r.status),
          esc(r.username),
          esc(r.client_ip),
          esc(r.client_name),
          esc(r.remote_addr),
          esc(r.port),
          esc(r.authen_type),
          esc(r.service),
          esc(r.priv_lvl),
          esc(r.command),
          esc(r.detail),
        ].join(",")
      );

      return new NextResponse([header, ...lines].join("\n"), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="tacacs-audit-logs-${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    const [total, logs] = await Promise.all([
      prisma.tacacsAuditLog.count({ where }),
      prisma.tacacsAuditLog.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: logs,
      pagination: {
        total,
        page,
        limit,
        total_pages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (err: any) {
    console.error("GET /api/tacacs/logs error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memuat log audit TACACS+." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const days = Number(searchParams.get("older_than_days"));

    let deletedCount = 0;
    if (Number.isFinite(days) && days > 0) {
      const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
      const res = await prisma.tacacsAuditLog.deleteMany({
        where: { created_at: { lt: cutoff } },
      });
      deletedCount = res.count;
    } else {
      const res = await prisma.tacacsAuditLog.deleteMany({});
      deletedCount = res.count;
    }

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_CONFIG",
      aktifitas: `Membersihkan ${deletedCount} log audit TACACS+`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${deletedCount} log audit TACACS+ berhasil dihapus.`,
      deleted: deletedCount,
    });
  } catch (err: any) {
    console.error("DELETE /api/tacacs/logs error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menghapus log audit TACACS+." },
      { status: 500 }
    );
  }
}

