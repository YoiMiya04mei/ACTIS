import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security";
import { processFinishInUse } from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";
import {
  extractPortalRequestIp,
  guardRequestBarangApiAccess,
} from "@/lib/requestBarangPortalGuard";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const access = await guardRequestBarangApiAccess(request);
  if (!access.ok) return access.response;

  const ip = extractPortalRequestIp(request);
  const rate = checkRateLimit(`public-in-use-finish:${ip}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak permintaan penyelesaian. Silakan tunggu ${rate.retryAfter || 60} detik.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const actorLabel = access.user
      ? `${access.user.nama} (@${access.user.username})`
      : "Portal Request Barang";

    const result = await processFinishInUse({
      transaction_id: body.transaction_id,
      completion_date: body.completion_date,
      notes: body.notes,
      user_name: actorLabel,
      created_by: access.user?.id,
      clients: body.clients,
    });

    if (access.user) {
      recordActivity({
        nama_lengkap: access.user.nama,
        email: access.user.email,
        ip_address: ip === "unknown" ? "103.155.196.63" : ip,
        tipe: "UPDATE_DATA",
        aktifitas: `Menyelesaikan penggunaan ${result.transaction_number} melalui portal /request-barang (${result.used_count} terpakai, ${result.pending_return_count} sisa kembali)`,
        user_agent: parseUserAgent(request.headers.get("user-agent")),
      }).catch(() => {});
    }

    triggerInventoryMirrorSync({
      event: "FINISH_IN_USE",
      triggeredBy: actorLabel,
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
    console.error("Error in POST /api/public/inventory-in-use/finish:", error);
    return NextResponse.json(
      {
        success: false,
        error: error?.message || "Gagal memproses penyelesaian penggunaan barang.",
      },
      { status: 400 }
    );
  }
}
