import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type"); // "IN", "OUT", "ADJUSTMENT", "OPNAME"
  const status = searchParams.get("status");
  const pic = searchParams.get("pic")?.trim();
  const search = searchParams.get("search")?.trim();
  const startDate = searchParams.get("start_date");
  const endDate = searchParams.get("end_date");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryTransactionWhereInput = {};

    if (type) {
      whereClause.type = type;
    }

    if (status) {
      whereClause.status = status;
    }

    if (pic) {
      whereClause.pic_name = { contains: pic, mode: "insensitive" };
    }

    if (search) {
      whereClause.OR = [
        { transaction_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { permit_number: { contains: search, mode: "insensitive" } },
      ];
    }

    if (startDate || endDate) {
      whereClause.transaction_date = {};
      if (startDate) {
        whereClause.transaction_date.gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        whereClause.transaction_date.lte = end;
      }
    }

    const [total, transactions] = await Promise.all([
      prisma.inventoryTransaction.count({ where: whereClause }),
      prisma.inventoryTransaction.findMany({
        where: whereClause,
        include: {
          details: {
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
          },
          returns: {
            select: {
              id: true,
              return_number: true,
              return_date: true,
              pic_name: true,
            },
          },
        },
        orderBy: { transaction_date: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: transactions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/transactions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar transaksi." },
      { status: 500 }
    );
  }
}

