import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { deleteBulkInventoryTransactions } from "@/lib/inventoryService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

/**
 * Bulk/complete deletion of IN or OUT transactions.
 * Strictly restricted to accounts with role === "admin" (Administrator).
 */
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const type = body?.type;
    const mode = body?.mode;
    const ids = body?.ids;

    if (type !== "IN" && type !== "OUT") {
      return NextResponse.json(
        { success: false, error: "Parameter type wajib berupa 'IN' atau 'OUT'." },
        { status: 400 }
      );
    }

    if (mode !== "selected" && mode !== "all") {
      return NextResponse.json(
        { success: false, error: "Parameter mode wajib berupa 'selected' atau 'all'." },
        { status: 400 }
      );
    }

    const result = await deleteBulkInventoryTransactions({
      type,
      mode,
      ids,
      deleted_by: auth.user.id,
      user_name: auth.user.nama,
    });

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DELETE_DATA",
      aktifitas:
        mode === "all"
          ? `Menghapus seluruh riwayat transaksi ${type} (${result.count} transaksi)`
          : `Menghapus ${result.count} transaksi ${type} terpilih`,
      detail: result.deleted_numbers.slice(0, 10).join(", "),
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: result,
      message:
        mode === "all"
          ? `Seluruh ${result.count} riwayat transaksi ${type === "IN" ? "Barang Masuk" : "Barang Keluar"} berhasil dihapus dan stok telah disinkronkan.`
          : `${result.count} transaksi ${type === "IN" ? "Barang Masuk" : "Barang Keluar"} terpilih berhasil dihapus dan stok telah disinkronkan.`,
    });
  } catch (error: any) {
    const status = error?.statusCode === 404 ? 404 : 400;
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal menghapus riwayat transaksi secara massal.",
      },
      { status }
    );
  }
}
