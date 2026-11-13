import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
 * Strict Security Rule:
 * Attempt to delete transaction history MUST be rejected (Test 13).
 */
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      success: false,
      error: "Akses ditolak: Histori dan log pergerakan stok bersifat append-only dan tidak boleh dihapus demi kepatuhan audit trail.",
    },
    { status: 403 }
  );
}

