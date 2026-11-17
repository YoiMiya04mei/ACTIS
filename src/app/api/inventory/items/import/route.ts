import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { generateItemCode } from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";
import {
  generateInventoryItemCsvTemplate,
  normalizeInventoryImportRecord,
  parseAndValidateInventoryItemsCsv,
  type NormalizedInventoryImportRow,
} from "@/lib/inventoryItemImport";
import { Prisma } from "@prisma/client";

/**
 * GET /api/inventory/items/import
 * Download official CSV import template for Master Barang.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const csvContent = generateInventoryItemCsvTemplate();
  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="template_import_barang.csv"',
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      {
        success: false,
        error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat mengimpor data barang.",
      },
      { status: 403 }
    );
  }

  try {
    let normalizedRows: NormalizedInventoryImportRow[] = [];
    const contentType = request.headers.get("content-type") || "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      if (!file) {
        return NextResponse.json(
          { success: false, error: "File CSV wajib dipilih sebelum melakukan impor." },
          { status: 400 }
        );
      }
      const csvText = await file.text();
      const parsed = parseAndValidateInventoryItemsCsv(csvText);
      if (parsed.headerError) {
        return NextResponse.json(
          { success: false, error: parsed.headerError },
          { status: 400 }
        );
      }
      normalizedRows = parsed.rows;
    } else {
      const body = await request.json();
      const rawItems = body?.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return NextResponse.json(
          { success: false, error: "Daftar barang impor tidak boleh kosong." },
          { status: 400 }
        );
      }
      normalizedRows = rawItems.map((raw: any, index: number) =>
        normalizeInventoryImportRecord(
          raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {},
          typeof raw?._rowNumber === "number" ? raw._rowNumber : index + 2
        )
      );
    }

    if (normalizedRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada baris data barang yang dapat diimpor." },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: Array<{ row: number; error: string }> = [];

    // Preload categories (case-insensitive map)
    const categories = await prisma.inventoryCategory.findMany();
    const categoryMap = new Map<string, string>();
    categories.forEach((c) => categoryMap.set(c.name.toLowerCase().trim(), c.id));

    for (const row of normalizedRows) {
      const rowNum = row._rowNumber;

      if (!row._isValid) {
        errors.push({
          row: rowNum,
          error: row._errors.join("; ") || "Baris data tidak valid.",
        });
        continue;
      }

      try {
        // Resolve or create category cleanly
        const catKey = row.category.toLowerCase().trim();
        let catId = categoryMap.get(catKey);
        if (!catId) {
          const newCat = await prisma.inventoryCategory.create({
            data: { name: row.category },
          });
          catId = newCat.id;
          categoryMap.set(catKey, catId);
        }

        const minStockDec = new Prisma.Decimal(row.min_stock);
        const initialStockDec = new Prisma.Decimal(row.initial_stock);

        if (row.code) {
          const existing = await prisma.inventoryItem.findFirst({
            where: { code: { equals: row.code, mode: "insensitive" } },
            include: { stock: true },
          });

          if (existing) {
            await prisma.$transaction(async (tx) => {
              await tx.inventoryItem.update({
                where: { id: existing.id },
                data: {
                  name: row.name,
                  category_id: catId!,
                  type: row.type,
                  brand: row.brand,
                  model: row.model,
                  serial_number: row.serial_number,
                  unit: row.unit,
                  min_stock: minStockDec,
                  storage_location: row.storage_location,
                  description: row.description ?? existing.description,
                  is_active: row.is_active,
                },
              });

              if (!existing.stock) {
                await tx.inventoryStock.create({
                  data: {
                    item_id: existing.id,
                    initial_stock: initialStockDec,
                    total_in: initialStockDec,
                    available_stock: initialStockDec,
                  },
                });
              }
            });
            updatedCount++;
            continue;
          }
        }

        const finalCode = row.code || (await generateItemCode(row.name));

        await prisma.$transaction(async (tx) => {
          const created = await tx.inventoryItem.create({
            data: {
              code: finalCode,
              name: row.name,
              category_id: catId!,
              type: row.type,
              brand: row.brand,
              model: row.model,
              serial_number: row.serial_number,
              unit: row.unit,
              min_stock: minStockDec,
              storage_location: row.storage_location,
              description: row.description,
              is_active: row.is_active,
            },
          });

          await tx.inventoryStock.create({
            data: {
              item_id: created.id,
              initial_stock: initialStockDec,
              total_in: initialStockDec,
              available_stock: initialStockDec,
            },
          });

          if (initialStockDec.greaterThan(0)) {
            await tx.inventoryMovement.create({
              data: {
                item_id: created.id,
                movement_type: "IN",
                quantity: initialStockDec,
                balance_before: new Prisma.Decimal(0),
                balance_after: initialStockDec,
                reference_type: "ADJUSTMENT",
                reference_id: created.id,
                performed_by: auth.user.nama,
                notes: "Import CSV Stok Awal",
              },
            });
          }
        });

        createdCount++;
      } catch (rowErr: any) {
        errors.push({
          row: rowNum,
          error: rowErr?.message || "Gagal menyimpan baris data ke database.",
        });
      }
    }

    const importedCount = createdCount + updatedCount;

    if (importedCount === 0 && errors.length > 0) {
      return NextResponse.json(
        {
          success: false,
          imported_count: 0,
          errors,
          error: `Gagal mengimpor CSV (${errors.length} baris bermasalah). Baris ${errors[0].row}: ${errors[0].error}`,
        },
        { status: 400 }
      );
    }

    await prisma.inventoryAuditLog.create({
      data: {
        entity_type: "ITEM",
        entity_id: "BULK_IMPORT",
        action: "IMPORT",
        user_id: auth.user.id,
        user_name: auth.user.nama,
        data_after: JSON.stringify({
          imported_count: importedCount,
          created_count: createdCount,
          updated_count: updatedCount,
          skipped_count: errors.length,
        }),
        reason: `Import CSV Master Barang: ${createdCount} baru, ${updatedCount} diperbarui, ${errors.length} dilewati`,
      },
    });

    const summaryParts = [`Berhasil mengimpor ${importedCount} barang`];
    if (createdCount > 0 || updatedCount > 0) {
      summaryParts.push(`(${createdCount} baru, ${updatedCount} diperbarui)`);
    }
    if (errors.length > 0) {
      summaryParts.push(`• ${errors.length} baris dilewati karena tidak valid`);
    }

    if (importedCount > 0) {
      triggerInventoryMirrorSync({ event: "ITEM_IMPORT", triggeredBy: auth.user.nama });
    }

    return NextResponse.json({
      success: true,
      imported_count: importedCount,
      created_count: createdCount,
      updated_count: updatedCount,
      skipped_count: errors.length,
      errors: errors.length > 0 ? errors : undefined,
      message: summaryParts.join(" "),
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/items/import:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengimpor data barang." },
      { status: 500 }
    );
  }
}
