import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { buildInventoryMirrorSnapshot } from "@/lib/inventoryMirrorService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (auth.user.role !== "admin" && auth.user.role !== "warehouse_admin") {
    return NextResponse.json(
      {
        success: false,
        error: "Akses ditolak: Hanya Admin dan Warehouse Admin yang dapat mengunduh snapshot database Inventory.",
      },
      { status: 403 }
    );
  }

  try {
    const snapshot = await buildInventoryMirrorSnapshot();
    const dateTag = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `ACTIS_Inventory_Database_Mirror_${dateTag}.json`;

    return new NextResponse(JSON.stringify(snapshot, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal mengekspor snapshot database Inventory." },
      { status: 500 }
    );
  }
}
