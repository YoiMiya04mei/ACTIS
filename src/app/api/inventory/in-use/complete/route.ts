import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { processCompleteAndLoan } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canReturnItems && !permissions.canCreateOutTransaction) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk menyelesaikan alokasi barang." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await processCompleteAndLoan({
      transaction_id: body.transaction_id,
      client_name: body.client_name,
      client_phone: body.client_phone,
      client_location: body.client_location,
      notes: body.notes,
      completion_date: body.completion_date,
      warehouse_officer: auth.user.nama || body.warehouse_officer || "Admin Gudang",
      user_name: auth.user.nama,
      created_by: auth.user.id,
      items: body.items,
    });

    return NextResponse.json({
      success: true,
      data: result,
      message: `Penyelesaian berhasil: ${result.loaned_count} unit dipinjamkan ke ${body.client_name || '-'}, ${result.returned_count} unit dikembalikan ke gudang.`,
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/in-use/complete:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses penyelesaian penggunaan barang." },
      { status: 400 }
    );
  }
}
