import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { processStockOut } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { Prisma } from "@prisma/client";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action || "check_stock"; // "check_stock" | "dispatch"

    if (action === "check_stock") {
      const devices = body.devices as Array<{ name: string; quantity?: string }>;
      if (!Array.isArray(devices) || devices.length === 0) {
        return NextResponse.json({
          success: true,
          items: [],
        });
      }

      const results = [];
      for (const dev of devices) {
        const cleanName = dev.name.trim();
        // Look up by partial or exact name
        const match = await prisma.inventoryItem.findFirst({
          where: {
            OR: [
              { name: { contains: cleanName, mode: "insensitive" } },
              { model: { contains: cleanName, mode: "insensitive" } },
            ],
            is_active: true,
          },
          include: { stock: true },
        });

        // Parse quantity e.g. "2 Unit" -> 2
        const qtyMatch = dev.quantity ? dev.quantity.match(/\d+/) : null;
        const requestedQty = qtyMatch ? parseInt(qtyMatch[0], 10) : 1;

        if (match && match.stock) {
          const avail = Number(match.stock.available_stock);
          results.push({
            device_name: dev.name,
            matched_item_id: match.id,
            matched_item_name: match.name,
            matched_item_code: match.code,
            item_type: match.type,
            requested_qty: requestedQty,
            available_stock: avail,
            is_sufficient: avail >= requestedQty,
          });
        } else {
          results.push({
            device_name: dev.name,
            matched_item_id: null,
            requested_qty: requestedQty,
            available_stock: 0,
            is_sufficient: false,
            message: "Barang belum terdaftar di Master Inventory",
          });
        }
      }

      return NextResponse.json({
        success: true,
        data: results,
      });
    }

    if (action === "dispatch") {
      const permissions = getInventoryPermissions(auth.user);
      if (!permissions.canCreateOutTransaction) {
        return NextResponse.json(
          { success: false, error: "Akses ditolak: Hanya Admin/Warehouse yang dapat menyerahkan barang." },
          { status: 403 }
        );
      }

      const {
        permit_id,
        permit_number,
        pic_name,
        pic_phone,
        location,
        purpose,
        warehouse_officer,
        items,
        notes,
      } = body;

      if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
          { success: false, error: "Daftar barang yang diserahkan tidak boleh kosong." },
          { status: 400 }
        );
      }

      // Check if this permit has already been dispatched into an OUT transaction
      if (permit_id) {
        const existingOut = await prisma.inventoryTransaction.findFirst({
          where: { permit_id, type: "OUT" },
        });
        if (existingOut) {
          return NextResponse.json(
            {
              success: false,
              error: `Permit Barang ini telah diserahkan sebelumnya dengan nomor transaksi ${existingOut.transaction_number}.`,
            },
            { status: 400 }
          );
        }
      }

      const outTx = await processStockOut({
        transaction_date: new Date(),
        pic_name: pic_name || "PIC Permit",
        pic_phone,
        location,
        purpose: purpose || `Permit Keluar Barang ${permit_number || ""}`.trim(),
        warehouse_officer: warehouse_officer || auth.user.nama,
        permit_id,
        permit_number,
        notes: notes || `Diserahkan berdasarkan Surat Permit Barang No. ${permit_number || "-"}`,
        items: items.map((it: any) => ({
          item_id: it.item_id,
          quantity: it.quantity,
          unit: it.unit,
          serial_numbers: it.serial_numbers,
          notes: it.notes,
        })),
        created_by: auth.user.id,
        user_name: auth.user.nama,
      });

      return NextResponse.json({
        success: true,
        data: outTx,
        message: `Barang berhasil diserahkan dan tercatat pada transaksi ${outTx.transaction_number}.`,
      }, { status: 201 });
    }

    return NextResponse.json(
      { success: false, error: `Action '${action}' tidak dikenal.` },
      { status: 400 }
    );
  } catch (error: any) {
    console.error("Error in POST /api/inventory/permit-sync:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses sinkronisasi Permit Barang." },
      { status: 400 }
    );
  }
}

