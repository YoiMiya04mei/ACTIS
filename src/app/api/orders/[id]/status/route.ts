import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import { generateSiteCode } from "@/lib/ticketUtils";
import { ensureIcmpMonitorForSite } from "@/lib/icmpMonitorService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { notifyOrderCompleted } from "@/lib/telegramService";
import { syncDcimOnOrderCompletion } from "@/lib/dcimService";
import { requireAuth } from "@/lib/security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: orderId } = await params;
    const body = await request.json();
    const { status, note } = body;

    const validStatuses = [
      "Antrian Aktivasi",
      "In Progress",
      "Pending Issue",
      "Completed",
      "Terminated",
      "Cancelled",
    ];

    if (!status || !validStatuses.includes(status)) {
      return NextResponse.json(
        { success: false, error: `Status tidak valid. Pilihan: ${validStatuses.join(", ")}` },
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

    // COMPLETION BARRIER ENFORCEMENT
    if (status === "Completed") {
      if (order.test_results.length === 0) {
        return NextResponse.json(
          {
            success: false,
            barrier_violated: true,
            error:
              "BARRIER PERINGATAN: Status tidak dapat diubah ke 'Completed'! Tim NOC wajib mengunggah minimal 1 (satu) bukti hasil test jaringan (Speedtest, OPM, atau Ping Latency).",
          },
          { status: 422 }
        );
      }
    }

    const previousStatus = order.status;
    const authorId = auth.user.id;
    const userName = auth.user.nama;

    const completedAt = status === "Completed" ? new Date() : order.completed_at;
    const waktuAktivasi = status === "Completed" ? (order.waktu_aktivasi || new Date()) : order.waktu_aktivasi;

    let targetPopSiteId = order.pop_site_id;
    let completedSiteCode: string | null = null;

    // POP SITE INVENTORY LIFECYCLE MANAGEMENT
    if (status === "Completed") {
      if (!targetPopSiteId) {
        // First-time completion of activation: create POP Site / Enterprise inventory asset
        const sitePrefix = order.kategori_layanan === "Enterprise" ? "ENT" : "POP";
        const siteId = await generateSiteCode(sitePrefix);
        const createdSite = await prisma.popSite.create({
          data: {
            site_id: siteId,
            initial_ticket: order.ticket_number,
            kategori_layanan: order.kategori_layanan,
            sub_layanan: order.sub_layanan,
            nama_pic: order.nama_pic,
            kontak_pic: order.kontak_pic,
            nama_perusahaan: order.nama_perusahaan,
            email_pic: order.email_pic,
            alamat_instalasi: order.alamat_instalasi,
            ip_public: order.ip_public,
            ip_private: order.ip_private,
            vlan: order.vlan,
            layanan_dedicated: order.layanan_dedicated,
            server: order.server,
            infrastruktur: order.infrastruktur,
            media_koneksi: order.media_koneksi,
            sn_ont: order.sn_ont,
            kapasitas_layanan: order.kapasitas_layanan,
            interkoneksi: order.interkoneksi,
            port_media: order.port_media,
            tipe_layanan_collo: order.tipe_layanan_collo,
            nama_perangkat: order.nama_perangkat,
            sn_perangkat: order.sn_perangkat,
            prefix_advertise: order.prefix_advertise,
            as_number: order.as_number,
            sid: order.sid,
            ao: order.ao,
            nomor_order: order.nomor_order,
            rack_id: order.rack_id,
            rack_code: order.rack_code,
            rack_unit_start: order.rack_unit_start,
            rack_unit_end: order.rack_unit_end,
            otb_id: order.otb_id,
            otb_code: order.otb_code,
            otb_core_numbers: order.otb_core_numbers,
            status_layanan: "Active",
            waktu_go_live: completedAt || new Date(),
          },
        });
        targetPopSiteId = createdSite.id;
        completedSiteCode = createdSite.site_id;
      } else {
        // Lifecycle ticket completion (Upgrade, Downgrade, Isolir, Terminate)
        if (order.tipe_order === "Upgrade" || order.tipe_order === "Downgrade") {
          await prisma.popSite.update({
            where: { id: targetPopSiteId },
            data: {
              layanan_dedicated: order.layanan_dedicated,
              vlan: order.vlan,
              ip_public: order.ip_public,
              ip_private: order.ip_private,
              sn_ont: order.sn_ont,
              status_layanan: "Active",
            },
          });
        } else if (order.tipe_order === "Isolir") {
          await prisma.popSite.update({
            where: { id: targetPopSiteId },
            data: { status_layanan: "Isolir" },
          });
        } else if (order.tipe_order === "Unisolir" || order.tipe_order === "Unterminate" || order.tipe_order === "Unterminated") {
          await prisma.popSite.update({
            where: { id: targetPopSiteId },
            data: { status_layanan: "Active" },
          });
        } else if (order.tipe_order === "Terminate") {
          await prisma.popSite.update({
            where: { id: targetPopSiteId },
            data: { status_layanan: "Terminated" },
          });
        }
      }
    }

    // Update order
    const updatedOrder = await prisma.popSiteOrder.update({
      where: { id: orderId },
      data: {
        status,
        completed_at: completedAt,
        waktu_aktivasi: waktuAktivasi,
        pop_site_id: targetPopSiteId,
      },
    });

    // AUTO-CREATE / SYNC ICMP MONITOR UPON ACTIVATION COMPLETION (POP Site & Enterprise Dedicated)
    if (status === "Completed" && targetPopSiteId) {
      ensureIcmpMonitorForSite(targetPopSiteId).catch((err) => {
        console.error("Auto-create ICMP monitor error upon completion:", err);
      });
    }

    // SYNC DCIM 3D RACK / 3D OTB UPON COMPLETION OR TERMINATE
    if (status === "Completed") {
      syncDcimOnOrderCompletion({
        orderId,
        tipeOrder: order.tipe_order,
        popSiteId: targetPopSiteId,
        siteCode: completedSiteCode,
      }).catch((err) => {
        console.error("DCIM sync error upon completion:", err);
      });
    }

    // Formulate default note
    let progressNote = note;
    if (!progressNote) {
      if (status === "In Progress" && previousStatus === "Antrian Aktivasi") {
        progressNote = `Tiket ${order.tipe_order} diambil oleh ${userName}. Status dialihkan ke In Progress. Memulai konfigurasi provisioning.`;
      } else if (status === "Completed") {
        progressNote = `Aktivasi/eksekusi tiket ${order.tipe_order} selesai dan diverifikasi oleh ${userName}. Status berhasil diubah ke Completed. Data tersimpan di List POP Site.`;
      } else {
        progressNote = `Status diubah dari '${previousStatus}' menjadi '${status}' oleh ${userName}.`;
      }
    }

    // Append to immutable progress log
    await prisma.orderProgressLog.create({
      data: {
        order_id: orderId,
        user_id: authorId,
        action_type: "Status Change",
        status_sebelum: previousStatus,
        status_sesudah: status,
        catatan_progress: progressNote,
      },
    });

    // Record application-wide activity log
    recordActivity({
      nama_lengkap: userName,
      email: auth.user.email || null,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_ORDER",
      aktifitas: `Mengubah status tiket ${order.ticket_number} menjadi ${status}`,
      detail: progressNote,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    // Trigger async sync to Google Sheets
    buildPayloadForOrder(orderId, "STATUS_CHANGE", {
      updatedBy: userName,
      progressNote,
      statusSebelum: previousStatus,
      statusSesudah: status,
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, orderId);
    });

    // Trigger non-blocking Ticket Completed Telegram notification (separate bot from ICMP Ping)
    if (status === "Completed" && previousStatus !== "Completed") {
      notifyOrderCompleted({
        order: updatedOrder,
        siteCode: completedSiteCode,
        popSiteId: targetPopSiteId,
        completedBy: userName,
        completionNote: progressNote,
        testCount: order.test_results.length,
        completedAt: updatedOrder.completed_at,
      }).catch((err) => {
        console.error("Ticket completed Telegram notification error:", err);
      });
    }

    return NextResponse.json({
      success: true,
      message: `Status tiket berhasil diubah menjadi '${status}'.`,
      data: updatedOrder,
    });
  } catch (err: any) {
    console.error("POST /api/orders/[id]/status error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update status" },
      { status: 500 }
    );
  }
}

