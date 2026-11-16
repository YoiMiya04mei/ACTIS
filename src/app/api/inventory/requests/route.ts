import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { listInventoryRequests } from "@/lib/inventoryService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canView) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Number(limitParam) : undefined;

    const result = await listInventoryRequests({ status, search, limit });

    return NextResponse.json(
      {
        success: true,
        data: result.requests,
        pendingCount: result.pendingCount,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/inventory/requests:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal mengambil daftar request barang." },
      { status: 500 }
    );
  }
}
