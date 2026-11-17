import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { deleteInventoryTransaction } from "@/lib/inventoryService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const transaction = await prisma.inventoryTransaction.findUnique({
      where: { id },
      include: {
        details: {
          include: {
            item: {
              include: {
                category: true,
                stock: true,
              },
            },
            returns: true,
          },
        },
        returns: {
          include: {
            details: {
              include: {
                item: true,
              },
            },
          },
        },
        client_usages: {
          include: {
            items: {
              include: {
                item: true,
              },
            },
          },
        },
        movements: {
          orderBy: { created_at: "desc" },
        },
      },
    });

    if (!transaction) {
      return NextResponse.json(
        { success: false, error: "Transaksi tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: transaction,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat detail transaksi." },
      { status: 500 }
    );
  }
}

/**
 * Deletes an IN (history-only, preserving stock balances & SNs) or OUT transaction
 * (reversing stock/SN/return state). Strictly restricted to Administrator role (`role === "admin"`).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const result = await deleteInventoryTransaction({
      transaction_id: id,
      deleted_by: auth.user.id,
      user_name: auth.user.nama,
    });

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DELETE_DATA",
      aktifitas: `Menghapus riwayat transaksi ${result.type} (${result.transaction_number})`,
      detail:
        result.type === "IN"
          ? `ID: ${result.id} (tanpa mengubah saldo Stok Inventory & Serial Number)`
          : `ID: ${result.id}`,
      user_agent: userAgent,
    }).catch(() => {});

    const message =
      result.type === "IN"
        ? `Riwayat transaksi Barang Masuk ${result.transaction_number} berhasil dihapus tanpa mengubah saldo Stok Inventory dan Serial Number.`
        : `Transaksi ${result.transaction_number} berhasil dihapus dan stok telah disinkronkan.`;

    return NextResponse.json({
      success: true,
      data: result,
      message,
    });
  } catch (error: any) {
    const status = error?.statusCode === 404 ? 404 : 400;
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal menghapus transaksi.",
      },
      { status }
    );
  }
}

