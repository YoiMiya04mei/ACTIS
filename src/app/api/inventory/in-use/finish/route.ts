import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { processFinishInUse } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canReturnItems && !permissions.canCreateOutTransaction) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin menyelesaikan penggunaan barang." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const result = await processFinishInUse({
      transaction_id: body.transaction_id,
      completion_date: body.completion_date,
      notes: body.notes,
      user_name: auth.user.nama,
      created_by: auth.user.id,
      clients: body.clients,
    });

    const msg =
      result.pending_return_count > 0
        ? `${result.transaction_number} diselesaikan: ${result.used_count} unit masuk Terpakai di Stok Inventory, ${result.pending_return_count} unit sisa masuk antrean Pengembalian Barang.`
        : `${result.transaction_number} selesai: ${result.used_count} unit terpakai oleh client, status menjadi SUDAH_KEMBALI.`;

    return NextResponse.json({
      success: true,
      data: result,
      message: msg,
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/in-use/finish:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memproses penyelesaian penggunaan barang." },
      { status: 400 }
    );
  }
}
