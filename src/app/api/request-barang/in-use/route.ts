import { NextRequest, NextResponse } from "next/server";
import { listPortalInUseTransactions } from "@/lib/inventoryService";
import { getAuthenticatedPortalAccount } from "@/lib/requestBarangPortalGuard";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const dbAccount = await getAuthenticatedPortalAccount(request);
  if (!dbAccount) {
    return NextResponse.json(
      {
        success: false,
        code: "AUTH_REQUIRED",
        error: "Silakan login ke portal Web Request Barang terlebih dahulu.",
      },
      { status: 401 }
    );
  }

  if (!dbAccount.is_active) {
    return NextResponse.json(
      {
        success: false,
        code: "NO_PERMISSION",
        error:
          "Akun Web /request-barang ini sedang dinonaktifkan oleh Administrator di menu Pengaturan User Akses.",
      },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status") || undefined;
    const search = searchParams.get("search") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get("limit") || "10", 10)));

    const result = await listPortalInUseTransactions({
      account: { id: dbAccount.id, nama: dbAccount.nama },
      status,
      search,
      page,
      limit,
    });

    return NextResponse.json(
      {
        success: true,
        data: result.transactions,
        pagination: result.pagination,
        activeNeedFinishCount: result.activeNeedFinishCount,
        pendingRequests: result.pendingRequests,
        rejectedRequests: result.rejectedRequests,
      },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: any) {
    console.error("GET /api/request-barang/in-use error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memuat daftar barang yang sedang digunakan." },
      { status: 500 }
    );
  }
}
