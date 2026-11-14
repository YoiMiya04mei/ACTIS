import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { processCompleteAndLoan } from "@/lib/inventoryService";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canView) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk melihat data inventory." },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const status = searchParams.get("status")?.trim() || ""; // "DIPINJAMKAN", "SUDAH_DITARIK", ""
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryTransactionWhereInput = {
      type: "LOAN",
    };

    if (status) {
      whereClause.status = status;
    }

    if (search) {
      whereClause.OR = [
        { transaction_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { pic_phone: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { notes: { contains: search, mode: "insensitive" } },
        { permit_number: { contains: search, mode: "insensitive" } },
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

    const [total, transactions, allLoansForStats] = await Promise.all([
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
                  category: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
        orderBy: { transaction_date: "desc" },
        skip,
        take: limit,
      }),
      prisma.inventoryTransaction.findMany({
        where: { type: "LOAN" },
        select: {
          id: true,
          status: true,
          pic_name: true,
          details: {
            select: {
              quantity: true,
            },
          },
        },
      }),
    ]);

    // Compute Summary Statistics
    let totalLoanedDevices = 0;
    let activeLoansCount = 0;
    let returnedLoansCount = 0;
    const clientSet = new Set<string>();

    for (const loan of allLoansForStats) {
      if (loan.pic_name) clientSet.add(loan.pic_name.trim().toLowerCase());
      if (loan.status === "DIPINJAMKAN") {
        activeLoansCount++;
        for (const d of loan.details) {
          totalLoanedDevices += Number(d.quantity);
        }
      } else if (loan.status === "SUDAH_DITARIK") {
        returnedLoansCount++;
      }
    }

    return NextResponse.json({
      success: true,
      data: transactions,
      stats: {
        total_loaned_devices: totalLoanedDevices,
        total_clients: clientSet.size,
        active_loans_count: activeLoansCount,
        returned_loans_count: returnedLoansCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/loaned:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat data barang dipinjamkan." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canReturnItems && !permissions.canCreateOutTransaction) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk mengalokasikan barang pinjaman." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await processCompleteAndLoan({
      transaction_id: body.transaction_id,
      client_name: body.client_name,
      client_phone: body.client_phone,
      client_location: body.client_location,
      notes: body.notes,
      completion_date: body.completion_date,
      warehouse_officer: auth.user.nama || body.warehouse_officer || "Admin Gudang",
      user_name: auth.user.nama,
      created_by: auth.user.id,
      items: body.items,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: "Alokasi barang dipinjamkan berhasil dicatat.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/loaned:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses alokasi barang dipinjamkan." },
      { status: 400 }
    );
  }
}
