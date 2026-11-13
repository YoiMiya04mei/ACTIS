import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { updateInUseAssignment } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const pic = searchParams.get("pic")?.trim();
  const location = searchParams.get("location")?.trim();
  const status = searchParams.get("status"); // "SEDANG_DIGUNAKAN", "SEBAGIAN_KEMBALI", "SUDAH_KEMBALI"
  const search = searchParams.get("search")?.trim();
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryTransactionWhereInput = {
      type: "OUT",
    };

    if (status) {
      whereClause.status = status;
    } else {
      // Default: show items currently deployed outside warehouse
      whereClause.status = {
        in: ["SEDANG_DIGUNAKAN", "SEBAGIAN_KEMBALI"],
      };
    }

    if (pic) {
      whereClause.pic_name = { contains: pic, mode: "insensitive" };
    }

    if (location) {
      whereClause.location = { contains: location, mode: "insensitive" };
    }

    if (search) {
      whereClause.OR = [
        { transaction_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        {
          details: {
            some: {
              item: {
                OR: [
                  { name: { contains: search, mode: "insensitive" } },
                  { code: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        },
      ];
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
                  brand: true,
                  model: true,
                  storage_location: true,
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
    console.error("Error in GET /api/inventory/in-use:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat monitoring barang digunakan." },
      { status: 500 }
    );
  }
}

/**
 * Edit PIC, Location, or Notes for an in-use transaction.
 * Strictly does NOT modify stock numbers. Audit log is recorded.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canEditPicLocation) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin mengubah PIC/Lokasi penggunaan." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const transactionId = body.transaction_id;
    const picName = body.pic_name;
    const picPhone = body.pic_phone;
    const location = body.location;
    const notes = body.notes;
    const reason = body.reason?.trim();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID wajib diisi." },
        { status: 400 }
      );
    }

    if (!picName?.trim()) {
      return NextResponse.json(
        { success: false, error: "Nama PIC baru wajib diisi." },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Alasan perubahan PIC / lokasi wajib dicantumkan untuk keperluan audit trail." },
        { status: 400 }
      );
    }

    const updated = await updateInUseAssignment({
      transaction_id: transactionId,
      pic_name: picName,
      pic_phone: picPhone,
      location,
      notes,
      reason,
      user_id: auth.user.id,
      user_name: auth.user.nama,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Data PIC dan lokasi penggunaan berhasil diperbarui dengan catatan audit.",
    });
  } catch (error: any) {
    console.error("Error in PUT /api/inventory/in-use:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data PIC/lokasi." },
      { status: 400 }
    );
  }
}

