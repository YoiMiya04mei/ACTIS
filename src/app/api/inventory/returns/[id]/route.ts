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
    const returnRecord = await prisma.inventoryReturn.findUnique({
      where: { id },
      include: {
        out_transaction: {
          include: {
            details: {
              include: { item: true },
            },
          },
        },
        details: {
          include: {
            item: {
              include: { category: true, stock: true },
            },
            transaction_detail: true,
          },
        },
      },
    });

    if (!returnRecord) {
      return NextResponse.json(
        { success: false, error: "Data pengembalian barang tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: returnRecord,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat detail pengembalian." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  return NextResponse.json(
    {
      success: false,
      error: "Akses ditolak: Histori pengembalian barang bersifat permanen dan tidak dapat dihapus.",
    },
    { status: 403 }
  );
}

