import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;
    const body = await request.json();

    const {
      catatan_progress,
      action_type = "Progress Note",
      user_id,
      new_status,
    } = body;

    if (!catatan_progress || catatan_progress.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: "Catatan progress tidak boleh kosong." },
        { status: 400 }
      );
    }

    const order = await prisma.popSiteOrder.findUnique({
      where: { id: orderId },
      include: {
        test_results: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    // Default user fallback
    let authorId = user_id;
    if (!authorId) {
      const defaultNoc = await prisma.user.findFirst({
        where: { role: "noc_engineer" },
      });
      authorId = defaultNoc?.id || "usr-noc-001";
    }

    const statusSebelum = order.status;
    let statusSesudah = statusSebelum;
    let completedAt = order.completed_at;

    // Check completion barrier if new_status is Completed
    if (new_status && new_status !== order.status) {
      if (new_status === "Completed") {
        if (order.test_results.length === 0) {
          return NextResponse.json(
            {
              success: false,
              error:
                "Completion Barrier: Status order HANYA bisa diubah menjadi 'Completed' jika sudah memiliki minimal 1 (satu) record file hasil test yang valid.",
            },
            { status: 422 }
          );
        }
        completedAt = new Date();
      }

      statusSesudah = new_status;

      // Update order status
      await prisma.popSiteOrder.update({
        where: { id: orderId },
        data: {
          status: statusSesudah,
          completed_at: completedAt,
        },
      });
    }

    // Immutable Append-Only progress log entry
    const newLog = await prisma.orderProgressLog.create({
      data: {
        order_id: orderId,
        user_id: authorId,
        action_type: action_type,
        status_sebelum: statusSebelum,
        status_sesudah: statusSesudah,
        catatan_progress: catatan_progress.trim(),
      },
      include: {
        user: { select: { id: true, nama: true, role: true } },
      },
    });

    // Trigger async sync to Google Spreadsheet (non-blocking)
    const eventType =
      action_type === "Config Pushed"
        ? "CONFIG_PUSHED"
        : new_status
        ? "STATUS_CHANGE"
        : "PROGRESS_UPDATE";

    buildPayloadForOrder(orderId, eventType, {
      updatedBy: newLog.user?.nama,
      progressNote: newLog.catatan_progress,
      statusSebelum,
      statusSesudah,
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, orderId);
    });

    return NextResponse.json({
      success: true,
      message: "Log progress berhasil ditambahkan ke riwayat audit NOC.",
      data: newLog,
      order_status: statusSesudah,
    });
  } catch (err: any) {
    console.error("POST /api/orders/[id]/progress error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add progress log" },
      { status: 500 }
    );
  }
}

