import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { performStockOpname } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canPerformOpname) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat melakukan stock opname." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const officer = body.warehouse_officer?.trim() || auth.user.nama;
    const notes = body.notes?.trim();
    const items = body.items;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, error: "Daftar barang stock opname tidak boleh kosong." },
        { status: 400 }
      );
    }

    const opnTx = await performStockOpname({
      warehouse_officer: officer,
      notes,
      items,
      user_id: auth.user.id,
      user_name: auth.user.nama,
    });

    return NextResponse.json({
      success: true,
      data: opnTx,
      message: "Stock opname berhasil disimpan dan stok telah diperbarui.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/stock/opname:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses stock opname." },
      { status: 400 }
    );
  }
}

