import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { releaseDcimForOrder } from "@/lib/dcimService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { alasan } = body;

    if (!alasan || !alasan.trim()) {
      return NextResponse.json(
        { success: false, error: "Alasan pembatalan tiket wajib diisi." },
        { status: 400 }
      );
    }

    const order = await prisma.popSiteOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    if (order.status === "Completed") {
      return NextResponse.json(
        { success: false, error: "Tiket yang sudah selesai (Completed) tidak dapat dibatalkan." },
        { status: 400 }
      );
    }

    if (order.status === "Cancelled") {
      return NextResponse.json(
        { success: false, error: "Tiket ini sudah berstatus Dibatalkan (Cancelled)." },
        { status: 400 }
      );
    }

    const authorId = auth.user.id;
    const userName = auth.user.nama;

    const previousStatus = order.status;
    const cleanAlasan = alasan.trim();

    // Update order status to Cancelled
    const updatedOrder = await prisma.popSiteOrder.update({
      where: { id: orderId },
      data: {
        status: "Cancelled",
      },
    });

    // Release reserved 3D Rack / 3D OTB slots belonging to this cancelled ticket
    releaseDcimForOrder(orderId, order.pop_site_id, true).catch((err) => {
      console.error("Failed to release DCIM reservation on ticket cancel:", err);
    });

    // Record immutable audit progress log
    const progressNote = `Tiket dibatalkan oleh ${userName} (${auth.user.role}). Alasan: "${cleanAlasan}"`;
    await prisma.orderProgressLog.create({
      data: {
        order_id: orderId,
        user_id: authorId,
        action_type: "Cancel Ticket",
        status_sebelum: previousStatus,
        status_sesudah: "Cancelled",
        catatan_progress: progressNote,
      },
    });

    // Record application-wide activity log
    recordActivity({
      nama_lengkap: userName,
      email: auth.user.email || null,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_ORDER",
      aktifitas: `Membatalkan tiket ${order.ticket_number} — Alasan: "${cleanAlasan}"`,
      detail: progressNote,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    // Trigger async sync to Google Sheets
    buildPayloadForOrder(orderId, "STATUS_CHANGE", {
      updatedBy: userName,
      progressNote,
      statusSebelum: previousStatus,
      statusSesudah: "Cancelled",
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, orderId);
    });

    return NextResponse.json({
      success: true,
      message: `Tiket ${order.ticket_number} berhasil dibatalkan.`,
      data: updatedOrder,
    });
  } catch (err: any) {
    console.error("POST /api/orders/[id]/cancel error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membatalkan tiket" },
      { status: 500 }
    );
  }
}

