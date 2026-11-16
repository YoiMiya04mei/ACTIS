import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab") || "movements"; // "movements" | "audits"
  const itemId = searchParams.get("item_id");
  const movementType = searchParams.get("movement_type");
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "25", 10)));
  const skip = (page - 1) * limit;

  try {
    if (tab === "audits") {
      const whereClause: Prisma.InventoryAuditLogWhereInput = {};
      if (search) {
        whereClause.OR = [
          { user_name: { contains: search, mode: "insensitive" } },
          { reason: { contains: search, mode: "insensitive" } },
          { entity_type: { contains: search, mode: "insensitive" } },
          { action: { contains: search, mode: "insensitive" } },
        ];
      }

      const [total, logs] = await Promise.all([
        prisma.inventoryAuditLog.count({ where: whereClause }),
        prisma.inventoryAuditLog.findMany({
          where: whereClause,
          orderBy: { created_at: "desc" },
          skip,
          take: limit,
        }),
      ]);

      return NextResponse.json({
        success: true,
        data: logs,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      });
    }

    // Default: movements
    const whereClause: Prisma.InventoryMovementWhereInput = {};
    if (itemId) {
      whereClause.item_id = itemId;
    }
    if (movementType) {
      whereClause.movement_type = movementType;
    }
    if (search) {
      whereClause.OR = [
        { performed_by: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { reference_id: { contains: search, mode: "insensitive" } },
        {
          item: {
            OR: [
              { name: { contains: search, mode: "insensitive" } },
              { code: { contains: search, mode: "insensitive" } },
            ],
          },
        },
      ];
    }

    const [total, movements] = await Promise.all([
      prisma.inventoryMovement.count({ where: whereClause }),
      prisma.inventoryMovement.findMany({
        where: whereClause,
        include: {
          item: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
              type: true,
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: movements,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/history:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat histori transaksi." },
      { status: 500 }
    );
  }
}

/**
 * Deletes selected or all InventoryMovement / InventoryAuditLog entries.
 * Strictly restricted to Administrator role (`role === "admin"`).
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const target = body?.target || "movements"; // "movements" | "audits" | "both"
    const mode = body?.mode || "all"; // "selected" | "all"
    const cleanIds = Array.isArray(body?.ids)
      ? Array.from(new Set(body.ids.map((s: unknown) => String(s).trim()).filter(Boolean)))
      : [];

    if (target !== "movements" && target !== "audits" && target !== "both") {
      return NextResponse.json(
        { success: false, error: "Target penghapusan tidak valid." },
        { status: 400 }
      );
    }

    if (mode !== "selected" && mode !== "all") {
      return NextResponse.json(
        { success: false, error: "Mode penghapusan wajib 'selected' atau 'all'." },
        { status: 400 }
      );
    }

    if (mode === "selected" && (cleanIds.length === 0 || target === "both")) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal 1 baris data untuk dihapus." },
        { status: 400 }
      );
    }

    let deletedMovements = 0;
    let deletedAudits = 0;

    await prisma.$transaction(async (tx) => {
      if (target === "movements" || target === "both") {
        const res = await tx.inventoryMovement.deleteMany({
          where: mode === "selected" ? { id: { in: cleanIds as string[] } } : {},
        });
        deletedMovements = res.count;
      }

      if (target === "audits" || target === "both") {
        const res = await tx.inventoryAuditLog.deleteMany({
          where: mode === "selected" ? { id: { in: cleanIds as string[] } } : {},
        });
        deletedAudits = res.count;
      }
    });

    const totalDeleted = deletedMovements + deletedAudits;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DELETE_DATA",
      aktifitas:
        mode === "all"
          ? `Menghapus seluruh Riwayat Transaksi & Audit Log (${target})`
          : `Menghapus ${totalDeleted} entri terpilih pada ${target}`,
      detail: `Movements: ${deletedMovements}, Audits: ${deletedAudits}`,
      user_agent: userAgent,
    }).catch(() => {});

    const message =
      mode === "all"
        ? target === "both"
          ? `Seluruh Riwayat Transaksi & Audit Log (${deletedMovements} mutasi stok dan ${deletedAudits} audit log) berhasil dihapus.`
          : target === "audits"
            ? `Seluruh Log Audit (${deletedAudits} entri) berhasil dihapus.`
            : `Seluruh Pergerakan Fisik Stok (${deletedMovements} entri) berhasil dihapus.`
        : `${totalDeleted} entri riwayat terpilih berhasil dihapus.`;

    return NextResponse.json({
      success: true,
      data: {
        target,
        mode,
        deletedMovements,
        deletedAudits,
        totalDeleted,
      },
      message,
    });
  } catch (error: any) {
    console.error("Error in DELETE /api/inventory/history:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal menghapus riwayat transaksi & audit log.",
      },
      { status: 500 }
    );
  }
}

