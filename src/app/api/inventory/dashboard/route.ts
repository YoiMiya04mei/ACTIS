import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getInventoryDashboardStats } from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canView) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin melihat inventory." },
      { status: 403 }
    );
  }

  try {
    const stats = await getInventoryDashboardStats();
    return NextResponse.json({
      success: true,
      data: stats,
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/dashboard:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat statistik dashboard inventory." },
      { status: 500 }
    );
  }
}

