import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { generateItemCode } from "@/lib/inventoryService";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const search = searchParams.get("search")?.trim() || "";
  const categoryId = searchParams.get("category_id") || "";
  const type = searchParams.get("type") || "";
  const lowStock = searchParams.get("low_stock") === "true";
  const statusParam = searchParams.get("is_active");
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
  const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "20", 10)));
  const skip = (page - 1) * limit;

  try {
    const whereClause: Prisma.InventoryItemWhereInput = {};

    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { code: { contains: search, mode: "insensitive" } },
        { brand: { contains: search, mode: "insensitive" } },
        { model: { contains: search, mode: "insensitive" } },
        { serial_number: { contains: search, mode: "insensitive" } },
        { storage_location: { contains: search, mode: "insensitive" } },
      ];
    }

    if (categoryId) {
      whereClause.category_id = categoryId;
    }

    if (type && (type === "REUSABLE" || type === "CONSUMABLE")) {
      whereClause.type = type;
    }

    if (statusParam !== null && statusParam !== "") {
      whereClause.is_active = statusParam === "true";
    }

    const [total, items] = await Promise.all([
      prisma.inventoryItem.count({ where: whereClause }),
      prisma.inventoryItem.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, name: true } },
          stock: true,
          _count: {
            select: { units: true, transaction_details: true },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
    ]);

    // Optional post-filter for lowStock if requested
    let results = items;
    if (lowStock) {
      results = items.filter((item) => {
        const avail = item.stock ? Number(item.stock.available_stock) : 0;
        const minStk = Number(item.min_stock);
        return minStk > 0 && avail <= minStk;
      });
    }

    return NextResponse.json({
      success: true,
      data: results,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat daftar barang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat menambah barang." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const name = body.name?.trim();
    const categoryId = body.category_id?.trim();
    const type = body.type === "CONSUMABLE" ? "CONSUMABLE" : "REUSABLE";
    const brand = body.brand?.trim() || null;
    const model = body.model?.trim() || null;
    const serialNumber = body.serial_number?.trim() || null;
    const unit = body.unit?.trim() || "Unit";
    const minStock = new Prisma.Decimal(body.min_stock || 0);
    const storageLocation = body.storage_location?.trim() || null;
    const description = body.description?.trim() || null;
    const imageUrl = body.image_url?.trim() || null;
    const initialStockNum = new Prisma.Decimal(body.initial_stock || 0);

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama barang wajib diisi." },
        { status: 400 }
      );
    }

    if (!categoryId) {
      return NextResponse.json(
        { success: false, error: "Kategori barang wajib dipilih." },
        { status: 400 }
      );
    }

    const category = await prisma.inventoryCategory.findUnique({
      where: { id: categoryId },
    });
    if (!category) {
      return NextResponse.json(
        { success: false, error: "Kategori yang dipilih tidak valid." },
        { status: 400 }
      );
    }

    // Determine or generate unique item code
    let itemCode = body.code?.trim();
    if (!itemCode) {
      const catCode = category.name.replace(/[^A-Za-z]/g, "").slice(0, 3).toUpperCase() || "ITM";
      itemCode = await generateItemCode(catCode);
    } else {
      const existing = await prisma.inventoryItem.findUnique({
        where: { code: itemCode },
      });
      if (existing) {
        return NextResponse.json(
          { success: false, error: `Kode barang '${itemCode}' sudah digunakan.` },
          { status: 400 }
        );
      }
    }

    // Transactional creation of Item + Initial Stock
    const newItem = await prisma.$transaction(async (tx) => {
      const item = await tx.inventoryItem.create({
        data: {
          code: itemCode,
          name,
          category_id: categoryId,
          type,
          brand,
          model,
          serial_number: serialNumber,
          unit,
          min_stock: minStock,
          storage_location: storageLocation,
          description,
          image_url: imageUrl,
          is_active: true,
        },
      });

      // Create Stock record
      const stock = await tx.inventoryStock.create({
        data: {
          item_id: item.id,
          initial_stock: initialStockNum,
          total_in: initialStockNum,
          total_out: new Prisma.Decimal(0),
          total_in_use: new Prisma.Decimal(0),
          total_returned: new Prisma.Decimal(0),
          total_consumed: new Prisma.Decimal(0),
          total_damaged: new Prisma.Decimal(0),
          total_lost: new Prisma.Decimal(0),
          available_stock: initialStockNum,
        },
      });

      // If initial stock > 0, log initial movement
      if (initialStockNum.greaterThan(0)) {
        await tx.inventoryMovement.create({
          data: {
            item_id: item.id,
            movement_type: "IN",
            quantity: initialStockNum,
            balance_before: new Prisma.Decimal(0),
            balance_after: initialStockNum,
            reference_type: "ADJUSTMENT",
            reference_id: item.id,
            performed_by: auth.user.nama,
            notes: "Stok Awal Barang Baru",
          },
        });
      }

      // If serial numbers array passed for units
      if (type === "REUSABLE" && Array.isArray(body.unit_serial_numbers) && body.unit_serial_numbers.length > 0) {
        for (const sn of body.unit_serial_numbers) {
          const trimmedSn = String(sn).trim();
          if (trimmedSn) {
            await tx.inventoryItemUnit.create({
              data: {
                item_id: item.id,
                serial_number: trimmedSn,
                status: "AVAILABLE",
                condition: "BAIK",
                current_location: storageLocation || "Gudang",
              },
            });
          }
        }
      }

      // Audit Log
      await tx.inventoryAuditLog.create({
        data: {
          entity_type: "ITEM",
          entity_id: item.id,
          action: "CREATE",
          user_id: auth.user.id,
          user_name: auth.user.nama,
          data_after: JSON.stringify(item),
          reason: `Pendaftaran Master Barang Baru: ${item.name} (${item.code})`,
        },
      });

      return { ...item, stock };
    });

    return NextResponse.json({
      success: true,
      data: newItem,
      message: "Barang berhasil ditambahkan.",
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/items:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menambahkan barang." },
      { status: 500 }
    );
  }
}

