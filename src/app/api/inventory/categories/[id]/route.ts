import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat mengubah kategori." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama kategori wajib diisi." },
        { status: 400 }
      );
    }

    const category = await prisma.inventoryCategory.update({
      where: { id },
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
      message: "Kategori berhasil diperbarui.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui kategori barang." },
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

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat menghapus kategori." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const itemsCount = await prisma.inventoryItem.count({
      where: { category_id: id },
    });

    if (itemsCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Kategori tidak dapat dihapus karena masih digunakan oleh ${itemsCount} barang.`,
        },
        { status: 400 }
      );
    }

    await prisma.inventoryCategory.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "Kategori berhasil dihapus.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus kategori barang." },
      { status: 500 }
    );
  }
}

