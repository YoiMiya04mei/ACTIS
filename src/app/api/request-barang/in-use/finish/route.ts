import { NextRequest, NextResponse } from "next/server";
import {
  assertPortalAccountOwnsOutTransaction,
  processFinishInUse,
} from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";
import { getAuthenticatedPortalAccount } from "@/lib/requestBarangPortalGuard";
import { checkRateLimit, getRequestClientIp } from "@/lib/security";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  const rate = checkRateLimit(`finish:rb:${dbAccount.id}`, 30, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak permintaan. Coba lagi dalam ${rate.retryAfter} detik.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const transactionId = String(body?.transaction_id || "").trim();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "ID transaksi barang keluar wajib disertakan." },
        { status: 400 }
      );
    }

    const ownsTransaction = await assertPortalAccountOwnsOutTransaction(
      { id: dbAccount.id, nama: dbAccount.nama },
      transactionId
    );
    if (!ownsTransaction) {
      return NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          error:
            "Akses ditolak: Transaksi barang keluar ini bukan milik akun Anda atau belum di-ACC oleh admin.",
        },
        { status: 403 }
      );
    }

    const actorDisplayName = `${dbAccount.nama} (@${dbAccount.username})`;
    const result = await processFinishInUse({
      transaction_id: transactionId,
      completion_date: body.completion_date,
      notes: body.notes,
      user_name: actorDisplayName,
      created_by: dbAccount.id,
      clients: body.clients,
    });

    triggerInventoryMirrorSync({
      event: "FINISH_IN_USE",
      triggeredBy: actorDisplayName,
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: dbAccount.nama,
      email: dbAccount.email,
      ip_address: clientIp,
      tipe: "UPDATE_DATA",
      aktifitas: `Menyelesaikan penggunaan barang ${result.transaction_number} melalui portal /request-barang (@${dbAccount.username}): ${result.used_count} terpakai, ${result.pending_return_count} sisa ke pengembalian`,
      user_agent: userAgent,
    }).catch(() => {});

    const msg =
      result.pending_return_count > 0
        ? `${result.transaction_number} diselesaikan: ${result.used_count} unit terpakai (Stok Inventory), ${result.pending_return_count} unit sisa masuk antrean Pengembalian Barang.`
        : `${result.transaction_number} selesai: ${result.used_count} unit terpakai oleh client, status menjadi SUDAH_KEMBALI.`;

    return NextResponse.json({
      success: true,
      data: result,
      message: msg,
    });
  } catch (error: any) {
    console.error("POST /api/request-barang/in-use/finish error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memproses penyelesaian penggunaan barang." },
      { status: 400 }
    );
  }
}
