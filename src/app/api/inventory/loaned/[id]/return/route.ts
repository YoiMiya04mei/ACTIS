import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { processReturnLoaned } from "@/lib/inventoryService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canReturnItems) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin untuk menarik barang kembali ke gudang." },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => ({}));
    const result = await processReturnLoaned({
      loan_transaction_id: id,
      recipient_officer: auth.user.nama || body.recipient_officer || "Admin Gudang",
      condition: body.condition || "BAIK",
      notes: body.notes,
      user_name: auth.user.nama,
      created_by: auth.user.id,
    });

    return NextResponse.json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error("Error in POST /api/inventory/loaned/[id]/return:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menarik barang kembali ke gudang." },
      { status: 400 }
    );
  }
}
