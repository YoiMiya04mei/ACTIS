import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { processStockOut } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canCreateOutTransaction) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat membuat transaksi barang keluar." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const transaction = await processStockOut({
      transaction_date: body.transaction_date,
      pic_name: body.pic_name,
      pic_phone: body.pic_phone,
      department: body.department,
      location: body.location,
      purpose: body.purpose,
      warehouse_officer: body.warehouse_officer || auth.user.nama,
      notes: body.notes,
      permit_id: body.permit_id,
      permit_number: body.permit_number,
      items: body.items,
      created_by: auth.user.id,
      user_name: auth.user.nama,
    });

    return NextResponse.json({
      success: true,
      data: transaction,
      message: `Barang keluar ${transaction.transaction_number} berhasil diproses.`,
    }, { status: 201 });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/transactions/out:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses transaksi barang keluar." },
      { status: 400 }
    );
  }
}

