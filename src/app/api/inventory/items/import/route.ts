import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { generateItemCode } from "@/lib/inventoryService";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat mengimpor data barang." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Daftar barang impor tidak boleh kosong." },
        { status: 400 }
      );
    }

    let importedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Preload categories
    const categories = await prisma.inventoryCategory.findMany();
    const categoryMap = new Map<string, string>(); // name lower -> id
    categories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

    for (let i = 0; i < items.length; i++) {
      const row = items[i];
      const rowNum = i + 1;

      const name = String(row.name || row["Nama Barang"] || "").trim().toUpperCase();
      const categoryName = (row.category || row["Kategori"] || "Umum").trim();
      const typeStr = (row.type || row["Jenis"] || "REUSABLE").toUpperCase().includes("CONSUMABLE")
        ? "CONSUMABLE"
        : "REUSABLE";
      const brand = row.brand || row["Merek"] || null;
      const model = row.model || row["Model"] || null;
      const serialNumber = row.serial_number || row["Serial Number"] || null;
      const unit = row.unit || row["Satuan"] || "Unit";
      const minStock = new Prisma.Decimal(row.min_stock || row["Stok Minimum"] || 0);
      const storageLocation = row.storage_location || row["Lokasi Penyimpanan"] || null;
      const initialStock = new Prisma.Decimal(row.initial_stock || row["Stok Awal"] || row["Stok"] || 0);

      if (!name?.trim()) {
        errors.push({ row: rowNum, error: "Nama barang tidak boleh kosong." });
        continue;
      }

      // Check or create category
      let catId = categoryMap.get(categoryName.toLowerCase());
      if (!catId) {
        const newCat = await prisma.inventoryCategory.create({
          data: { name: categoryName },
        });
        catId = newCat.id;
        categoryMap.set(categoryName.toLowerCase(), catId);
      }

      // Check code
      let code = row.code || row["Kode Barang"];
      if (code) {
        const existing = await prisma.inventoryItem.findUnique({
          where: { code: code.trim() },
        });
        if (existing) {
          // If already exists, update basic info
          await prisma.inventoryItem.update({
            where: { id: existing.id },
            data: {
              name: name.trim(),
              brand,
              model,
              storage_location: storageLocation,
              unit,
              min_stock: minStock,
            },
          });
          importedCount++;
          continue;
        }
      } else {
        code = await generateItemCode(name);
      }

      // Create new item + stock
      await prisma.$transaction(async (tx) => {
        const item = await tx.inventoryItem.create({
          data: {
            code: code.trim(),
            name: name.trim(),
            category_id: catId!,
            type: typeStr,
            brand,
            model,
            serial_number: serialNumber,
            unit,
            min_stock: minStock,
            storage_location: storageLocation,
            is_active: true,
          },
        });

        await tx.inventoryStock.create({
          data: {
            item_id: item.id,
            initial_stock: initialStock,
            total_in: initialStock,
            available_stock: initialStock,
          },
        });

        if (initialStock.greaterThan(0)) {
          await tx.inventoryMovement.create({
            data: {
              item_id: item.id,
              movement_type: "IN",
              quantity: initialStock,
              balance_before: new Prisma.Decimal(0),
              balance_after: initialStock,
              reference_type: "ADJUSTMENT",
              reference_id: item.id,
              performed_by: auth.user.nama,
              notes: "Import Stok Awal",
            },
          });
        }
      });

      importedCount++;
    }

    return NextResponse.json({
      success: true,
      imported_count: importedCount,
      errors: errors.length > 0 ? errors : undefined,
      message: `Berhasil mengimpor ${importedCount} barang.`,
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/items/import:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengimpor data barang." },
      { status: 500 }
    );
  }
}

