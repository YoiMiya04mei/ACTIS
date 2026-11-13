import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const categoryId = searchParams.get("category_id");
  const lowStock = searchParams.get("low_stock") === "true";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryItemWhereInput = {
      type: "CONSUMABLE",
      is_active: true,
    };

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { storage_location: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      whereClause.category_id = categoryId;
    }

    const [total, items, recentConsumption] = await Promise.all([
      prisma.inventoryItem.count({ where: whereClause }),
      prisma.inventoryItem.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
          stock: true,
        },
        orderBy: { name: "asc" },
        skip,
        take: limit,
      }),
      prisma.inventoryTransactionDetail.findMany({
        where: {
          status: "CONSUMED",
          item: { type: "CONSUMABLE" },
        },
        include: {
          transaction: {
            select: {
              transaction_number: true,
              transaction_date: true,
              pic_name: true,
              location: true,
              purpose: true,
            },
          },
          item: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
            },
          },
        },
        orderBy: { transaction: { transaction_date: "desc" } },
        take: 10,
      }),
    ]);

    let data = items;
    if (lowStock) {
      data = items.filter((it) => {
        const avail = it.stock ? Number(it.stock.available_stock) : 0;
        const minStk = Number(it.min_stock);
        return minStk > 0 && avail <= minStk;
      });
    }

    return NextResponse.json({
      success: true,
      data,
      recent_consumption: recentConsumption,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/consumables:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar barang habis pakai." },
      { status: 500 }
    );
  }
}

