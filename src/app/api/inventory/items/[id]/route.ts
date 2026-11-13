import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { Prisma } from "@prisma/client";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        category: true,
        stock: true,
        units: {
          orderBy: { created_at: "desc" },
          take: 50,
        },
        movements: {
          orderBy: { created_at: "desc" },
          take: 20,
        },
        transaction_details: {
          orderBy: { transaction: { transaction_date: "desc" } },
          take: 10,
          include: {
            transaction: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan." },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat detail barang." },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat mengubah data barang." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const existing = await prisma.inventoryItem.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan." },
        { status: 404 }
      );
    }

    const name = body.name?.trim() || existing.name;
    const categoryId = body.category_id || existing.category_id;
    const brand = body.brand !== undefined ? body.brand?.trim() || null : existing.brand;
    const model = body.model !== undefined ? body.model?.trim() || null : existing.model;
    const serialNumber = body.serial_number !== undefined ? body.serial_number?.trim() || null : existing.serial_number;
    const unit = body.unit?.trim() || existing.unit;
    const minStock = body.min_stock !== undefined ? new Prisma.Decimal(body.min_stock) : existing.min_stock;
    const storageLocation = body.storage_location !== undefined ? body.storage_location?.trim() || null : existing.storage_location;
    const description = body.description !== undefined ? body.description?.trim() || null : existing.description;
    const imageUrl = body.image_url !== undefined ? body.image_url?.trim() || null : existing.image_url;
    const isActive = body.is_active !== undefined ? Boolean(body.is_active) : existing.is_active;

    const updated = await prisma.$transaction(async (tx) => {
      const itm = await tx.inventoryItem.update({
        where: { id },
        data: {
          name,
          category_id: categoryId,
          brand,
          model,
          serial_number: serialNumber,
          unit,
          min_stock: minStock,
          storage_location: storageLocation,
          description,
          image_url: imageUrl,
          is_active: isActive,
        },
        include: { stock: true, category: true },
      });

      await tx.inventoryAuditLog.create({
        data: {
          entity_type: "ITEM",
          entity_id: id,
          action: "UPDATE",
          user_id: auth.user.id,
          user_name: auth.user.nama,
          data_before: JSON.stringify(existing),
          data_after: JSON.stringify(itm),
          reason: body.reason || "Pembaruan informasi master barang",
        },
      });

      return itm;
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Data barang berhasil diperbarui.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data barang." },
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
      { success: false, error: "Akses ditolak: Hanya Admin yang dapat menghapus barang." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const item = await prisma.inventoryItem.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transaction_details: true,
            movements: true,
          },
        },
      },
    });

    if (!item) {
      return NextResponse.json(
        { success: false, error: "Barang tidak ditemukan." },
        { status: 404 }
      );
    }

    // RULE 5: Barang yang sudah memiliki histori transaksi tidak boleh dihapus permanen. Gunakan soft delete!
    if (item._count.transaction_details > 0 || item._count.movements > 0) {
      // Perform soft delete
      await prisma.inventoryItem.update({
        where: { id },
        data: { is_active: false },
      });

      await prisma.inventoryAuditLog.create({
        data: {
          entity_type: "ITEM",
          entity_id: id,
          action: "UPDATE",
          user_id: auth.user.id,
          user_name: auth.user.nama,
          reason: "Soft delete barang (status diubah ke nonaktif karena memiliki histori transaksi)",
        },
      });

      return NextResponse.json({
        success: true,
        message: "Barang dinonaktifkan (soft delete) untuk mempertahankan riwayat transaksi.",
        is_soft_delete: true,
      });
    }

    // If completely new with 0 transactions, hard delete is permitted
    await prisma.$transaction(async (tx) => {
      await tx.inventoryStock.deleteMany({ where: { item_id: id } });
      await tx.inventoryItemUnit.deleteMany({ where: { item_id: id } });
      await tx.inventoryItem.delete({ where: { id } });
      await tx.inventoryAuditLog.create({
        data: {
          entity_type: "ITEM",
          entity_id: id,
          action: "CORRECTION",
          user_id: auth.user.id,
          user_name: auth.user.nama,
          reason: `Penghapusan master barang baru tanpa riwayat: ${item.name} (${item.code})`,
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: "Barang berhasil dihapus permanen.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menghapus barang." },
      { status: 500 }
    );
  }
}

