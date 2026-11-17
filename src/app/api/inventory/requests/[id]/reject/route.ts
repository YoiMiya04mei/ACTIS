import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { rejectInventoryRequest } from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canCreateOutTransaction) {
    return NextResponse.json(
      {
        success: false,
        error: "Akses ditolak: Hanya Admin atau Warehouse Admin yang dapat menolak/meng-ACC request.",
      },
      { status: 403 }
    );
  }

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const updated = await rejectInventoryRequest({
      request_id: id,
      reason: typeof body?.reason === "string" ? body.reason : undefined,
      rejected_by: auth.user.id,
      user_name: auth.user.nama,
    });

    triggerInventoryMirrorSync({ event: "REQUEST_REJECT", triggeredBy: auth.user.nama });

    return NextResponse.json({
      success: true,
      data: updated,
      message: `Request ${updated?.request_number || ""} telah ditolak.`,
    });
  } catch (error: any) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : 400;
    console.error("Error in POST /api/inventory/requests/[id]/reject:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal menolak request barang.",
      },
      { status }
    );
  }
}
