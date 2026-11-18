import { NextRequest, NextResponse } from "next/server";
import {
  parseInUseQueryParams,
  queryInventoryInUseTransactions,
} from "@/lib/inventoryService";
import { guardRequestBarangApiAccess } from "@/lib/requestBarangPortalGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const access = await guardRequestBarangApiAccess(request);
  if (!access.ok) return access.response;

  try {
    const query = parseInUseQueryParams(request.url);
    const result = await queryInventoryInUseTransactions(query);

    return NextResponse.json(
      {
        success: true,
        data: result.data,
        pagination: result.pagination,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/public/inventory-in-use:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat monitoring barang sedang digunakan." },
      { status: 500 }
    );
  }
}
