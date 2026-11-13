import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { adjustStock } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canAdjustStock) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat melakukan penyesuaian stok." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const itemId = body.item_id;
    const newStock = body.new_available_stock;
    const reason = body.reason?.trim();

    if (!itemId) {
      return NextResponse.json(
        { success: false, error: "Item ID wajib disertakan." },
        { status: 400 }
      );
    }

    if (newStock === undefined || newStock === null || isNaN(Number(newStock))) {
      return NextResponse.json(
        { success: false, error: "Nilai stok penyesuaian baru tidak valid." },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Alasan penyesuaian stok wajib diisi." },
        { status: 400 }
      );
    }

    const updated = await adjustStock({
      item_id: itemId,
      new_available_stock: newStock,
      reason,
      user_id: auth.user.id,
      user_name: auth.user.nama,
    });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Penyesuaian stok berhasil disimpan.",
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/stock/adjust:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal melakukan penyesuaian stok." },
      { status: 400 }
    );
  }
}

