import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { computeOutTransactionSummary } from "@/lib/inventoryTransactionSummary";

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
                  stock: {
                    select: {
                      total_in: true,
                      available_stock: true,
                    },
                  },
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
              details: {
                select: {
                  id: true,
                  transaction_detail_id: true,
                  quantity: true,
                  condition: true,
                  item_id: true,
                  serial_numbers: true,
                },
              },
            },
          },
          client_usages: {
            orderBy: { created_at: "asc" },
            include: {
              items: {
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
          },
        },
        orderBy: { transaction_date: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const outTxNumbers = transactions
      .filter((t) => t.type === "OUT")
      .map((t) => t.transaction_number);

    const linkedLoans =
      outTxNumbers.length > 0
        ? await prisma.inventoryTransaction.findMany({
            where: {
              type: "LOAN",
              permit_number: { in: outTxNumbers },
            },
            select: {
              id: true,
              permit_number: true,
              details: {
                select: {
                  quantity: true,
                },
              },
            },
          })
        : [];

    const loansByOutNumber = new Map<string, typeof linkedLoans>();
    for (const loan of linkedLoans) {
      if (!loan.permit_number) continue;
      const list = loansByOutNumber.get(loan.permit_number) || [];
      list.push(loan);
      loansByOutNumber.set(loan.permit_number, list);
    }

    const enrichedTransactions = transactions.map((tx) => {
      if (tx.type !== "OUT") return tx;
      return {
        ...tx,
        summary: computeOutTransactionSummary(
          tx,
          loansByOutNumber.get(tx.transaction_number) || []
        ),
      };
    });

    return NextResponse.json(
      {
        success: true,
        data: enrichedTransactions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/inventory/transactions:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar transaksi." },
      { status: 500 }
    );
  }
}

