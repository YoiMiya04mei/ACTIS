import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import {
  parseInUseQueryParams,
  queryInventoryInUseTransactions,
  updateInUseAssignment,
} from "@/lib/inventoryService";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const query = parseInUseQueryParams(request.url);
    const result = await queryInventoryInUseTransactions(query);

    return NextResponse.json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error: any) {
    console.error("Error in GET /api/inventory/in-use:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat monitoring barang digunakan." },
      { status: 500 }
    );
  }
}

/**
 * Edit PIC, Location, or Notes for an in-use transaction.
 * Strictly does NOT modify stock numbers. Audit log is recorded.
 */
export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canEditPicLocation) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Anda tidak memiliki izin mengubah PIC/Lokasi penggunaan." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const transactionId = body.transaction_id;
    const picName = body.pic_name;
    const picPhone = body.pic_phone;
    const location = body.location;
    const notes = body.notes;
    const reason = body.reason?.trim();

    if (!transactionId) {
      return NextResponse.json(
        { success: false, error: "Transaction ID wajib diisi." },
        { status: 400 }
      );
    }

    if (!picName?.trim()) {
      return NextResponse.json(
        { success: false, error: "Nama PIC baru wajib diisi." },
        { status: 400 }
      );
    }

    if (!reason) {
      return NextResponse.json(
        { success: false, error: "Alasan perubahan PIC / lokasi wajib dicantumkan untuk keperluan audit trail." },
        { status: 400 }
      );
    }

    const updated = await updateInUseAssignment({
      transaction_id: transactionId,
      pic_name: picName,
      pic_phone: picPhone,
      location,
      notes,
      reason,
      user_id: auth.user.id,
      user_name: auth.user.nama,
    });

    triggerInventoryMirrorSync({ event: "IN_USE_UPDATE", triggeredBy: auth.user.nama });

    return NextResponse.json({
      success: true,
      data: updated,
      message: "Data PIC dan lokasi penggunaan berhasil diperbarui dengan catatan audit.",
    });
  } catch (error: any) {
    console.error("Error in PUT /api/inventory/in-use:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui data PIC/lokasi." },
      { status: 400 }
    );
  }
}

