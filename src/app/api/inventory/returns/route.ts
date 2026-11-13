import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { processReturn } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim();
  const pic = searchParams.get("pic")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryReturnWhereInput = {};

    if (pic) {
      whereClause.pic_name = { contains: pic, mode: "insensitive" };
    }

    if (search) {
      whereClause.OR = [
        { return_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { recipient_officer: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        {
          out_transaction: {
            transaction_number: { contains: search, mode: "insensitive" },
          },
        },
      ];
    }

    const [total, returns] = await Promise.all([
      prisma.inventoryReturn.count({ where: whereClause }),
      prisma.inventoryReturn.findMany({
        where: whereClause,
        include: {
          out_transaction: {
            select: {
              id: true,
              transaction_number: true,
              transaction_date: true,
              pic_name: true,
              location: true,
            },
          },
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
        },
        orderBy: { return_date: "desc" },
        skip,
        take: limit,
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: returns,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/returns:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar pengembalian barang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canReturnItems) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin memproses pengembalian barang." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await processReturn({
      out_transaction_id: body.out_transaction_id,
      return_date: body.return_date,
      pic_name: body.pic_name,
      recipient_officer: body.recipient_officer || auth.user.nama,
      notes: body.notes,
      details: body.details,
      created_by: auth.user.id,
      user_name: auth.user.nama,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Pengembalian barang ${result.return_number} berhasil dicatat.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/returns:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses pengembalian barang." },
      { status: 400 }
    );
  }
}

