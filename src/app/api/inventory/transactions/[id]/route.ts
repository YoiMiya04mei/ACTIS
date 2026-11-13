import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";

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
 * Strict Security & Integrity Rule:
 * Audit log and transactions are APPEND-ONLY.
 * Direct deletion is strictly blocked.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      success: false,
      error: "Akses ditolak: Histori transaksi bersifat permanen (append-only) dan tidak dapat dihapus demi integritas audit.",
    },
    { status: 403 }
  );
}

