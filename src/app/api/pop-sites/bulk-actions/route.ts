import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseBandwidthToMbps } from "@/lib/ticketUtils";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      site_ids,
      action_type,
      layanan_dedicated,
      alasan,
      catatan,
    } = body;

    const validActions = ["Upgrade", "Downgrade", "Isolir", "Unisolir", "Terminate", "Unterminate", "Unterminated"];
    if (!action_type || !validActions.includes(action_type)) {
      return NextResponse.json(
        { success: false, error: `Tipe aksi tidak valid. Pilihan: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    if (!Array.isArray(site_ids) || site_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Silakan pilih minimal 1 POP Site." },
        { status: 400 }
      );
    }

    if (!alasan || !alasan.trim()) {
      return NextResponse.json(
        { success: false, error: `Alasan pengajuan ${action_type} wajib diisi.` },
        { status: 400 }
      );
    }

    const creatorId = auth.user.id;

    // Fetch all targeted sites
    const sites = await prisma.popSite.findMany({
      where: { id: { in: site_ids } },
    });

    if (sites.length === 0) {
      return NextResponse.json(
        { success: false, error: "POP Site terpilih tidak ditemukan." },
        { status: 404 }
      );
    }

    // Validasi aturan: Upgrade dan Downgrade massal otomatis ditolak jika ada sirkuit Isolir atau Terminated
    if (action_type === "Upgrade" || action_type === "Downgrade") {
      const nonActiveSite = sites.find(
        (s) => s.status_layanan === "Isolir" || s.status_layanan === "Terminated"
      );
      if (nonActiveSite) {
        return NextResponse.json(
          {
            success: false,
            error: `Upgrade dan Downgrade massal tidak dapat diproses karena sirkuit [${nonActiveSite.site_id}] berstatus ${nonActiveSite.status_layanan}. Seluruh sirkuit yang dipilih harus berstatus Active.`,
          },
          { status: 400 }
        );
      }
    }

    // Prepare date prefix for ticket numbers
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const datePrefix = `ACT-${yyyy}${mm}${dd}-`;

    const existingOrdersCount = await prisma.popSiteOrder.count({
      where: { ticket_number: { startsWith: datePrefix } },
    });

    let seqCounter = existingOrdersCount + 1;

    const createdTickets: Array<{
      id: string;
      ticket_number: string;
      site_id: string;
      nama_pic: string;
      action_type: string;
    }> = [];

    const skippedSites: Array<{
      site_id: string;
      nama_pic: string;
      reason: string;
    }> = [];

    for (const site of sites) {
      // Eligibility Checks
      if (action_type === "Upgrade") {
        if (site.status_layanan === "Terminated") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sudah diterminasi." });
          continue;
        }
        if (site.status_layanan === "Isolir") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sedang di-isolir (unisolir terlebih dahulu)." });
          continue;
        }
        const currentMbps = parseBandwidthToMbps(site.layanan_dedicated || site.kapasitas_layanan);
        const targetMbps = parseBandwidthToMbps(layanan_dedicated);
        if (currentMbps > 0 && targetMbps > 0 && targetMbps <= currentMbps) {
          skippedSites.push({
            site_id: site.site_id,
            nama_pic: site.nama_pic,
            reason: `Target layanan (${layanan_dedicated}) tidak lebih tinggi dari layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan || "-"}).`,
          });
          continue;
        }
      } else if (action_type === "Downgrade") {
        if (site.status_layanan === "Terminated") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sudah diterminasi." });
          continue;
        }
        if (site.status_layanan === "Isolir") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sedang di-isolir." });
          continue;
        }
        const currentMbps = parseBandwidthToMbps(site.layanan_dedicated || site.kapasitas_layanan);
        const targetMbps = parseBandwidthToMbps(layanan_dedicated);
        if (currentMbps > 0 && targetMbps > 0 && targetMbps >= currentMbps) {
          skippedSites.push({
            site_id: site.site_id,
            nama_pic: site.nama_pic,
            reason: `Target layanan (${layanan_dedicated}) tidak lebih rendah dari layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan || "-"}).`,
          });
          continue;
        }
      } else if (action_type === "Isolir") {
        if (site.status_layanan === "Isolir") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sudah dalam status Isolir." });
          continue;
        }
        if (site.status_layanan === "Terminated") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sudah diterminasi." });
          continue;
        }
      } else if (action_type === "Unisolir") {
        if (site.status_layanan !== "Isolir") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit tidak sedang dalam status Isolir." });
          continue;
        }
      } else if (action_type === "Terminate") {
        if (site.status_layanan === "Terminated") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit sudah dalam status Terminated." });
          continue;
        }
      } else if (action_type === "Unterminated" || action_type === "Unterminate") {
        if (site.status_layanan !== "Terminated") {
          skippedSites.push({ site_id: site.site_id, nama_pic: site.nama_pic, reason: "Sirkuit tidak dalam status Terminated." });
          continue;
        }
      }

      // Generate guaranteed unique ticket number
      let ticketNumber = `${datePrefix}${String(seqCounter++).padStart(4, "0")}`;
      while (await prisma.popSiteOrder.findUnique({ where: { ticket_number: ticketNumber } })) {
        ticketNumber = `${datePrefix}${String(seqCounter++).padStart(4, "0")}`;
      }

      const targetLayanan =
        (action_type === "Upgrade" || action_type === "Downgrade") && layanan_dedicated
          ? layanan_dedicated
          : site.layanan_dedicated || site.kapasitas_layanan;

      const fullNotes = `[LIFECYCLE MASSAL ${action_type.toUpperCase()}] ${alasan ? `Alasan: ${alasan}. ` : ""}${catatan ? `Catatan: ${catatan}` : ""}`.trim();

      const newOrder = await prisma.popSiteOrder.create({
        data: {
          ticket_number: ticketNumber,
          tipe_order: action_type,
          pop_site_id: site.id,
          kategori_layanan: site.kategori_layanan || "POP Site",
          sub_layanan: site.sub_layanan,
          nama_perusahaan: site.nama_perusahaan,
          email_pic: site.email_pic,
          nama_pic: site.nama_pic,
          kontak_pic: site.kontak_pic,
          alamat_instalasi: site.alamat_instalasi,
          ip_public: site.ip_public,
          ip_private: site.ip_private,
          vlan: site.vlan,
          layanan_dedicated: targetLayanan,
          kapasitas_layanan: site.kapasitas_layanan,
          interkoneksi: site.interkoneksi,
          port_media: site.port_media,
          tipe_layanan_collo: site.tipe_layanan_collo,
          nama_perangkat: site.nama_perangkat,
          sn_perangkat: site.sn_perangkat,
          prefix_advertise: site.prefix_advertise,
          as_number: site.as_number,
          server: site.server,
          infrastruktur: site.infrastruktur,
          media_koneksi: site.media_koneksi,
          sn_ont: site.sn_ont,
          sid: site.sid,
          ao: site.ao,
          nomor_order: site.nomor_order,
          waktu_aktivasi: null,
          catatan_tambahan: fullNotes,
          status: "Antrian Aktivasi",
          created_by: creatorId,
        },
      });

      // Progress log
      await prisma.orderProgressLog.create({
        data: {
          order_id: newOrder.id,
          user_id: creatorId,
          action_type: "Status Change",
          status_sebelum: null,
          status_sesudah: "Antrian Aktivasi",
          catatan_progress: `Pengajuan massal tiket ${action_type} untuk POP Site [${site.site_id}]. Alasan: ${alasan || "-"}`,
        },
      });

      // Async sheets sync
      buildPayloadForOrder(newOrder.id, "CREATE_ORDER", {
        statusSebelum: null,
        statusSesudah: "Antrian Aktivasi",
        progressNote: `Pengajuan massal tiket ${action_type} untuk POP Site [${site.site_id}] masuk ke antrian.`,
      }).then((payload) => {
        if (payload) dispatchSheetsSync(payload, newOrder.id);
      }).catch(() => {});

      createdTickets.push({
        id: newOrder.id,
        ticket_number: newOrder.ticket_number,
        site_id: site.site_id,
        nama_pic: site.nama_pic,
        action_type,
      });
    }

    if (createdTickets.length === 0) {
      const skipReasons = skippedSites.map((s) => `${s.site_id}: ${s.reason}`).join("; ");
      return NextResponse.json(
        {
          success: false,
          error: `Tidak ada tiket yang dapat dibuat. Seluruh (${skippedSites.length}) sirkuit dilewati karena kondisi tidak memenuhi syarat: ${skipReasons}`,
          skipped: skippedSites,
        },
        { status: 400 }
      );
    }

    // Record Activity Log
    const actorUser = await prisma.user.findUnique({ where: { id: creatorId } }).catch(() => null);
    const namaPelaku = actorUser?.nama || "Admin";
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: namaPelaku,
      ip_address: clientIp,
      tipe: "CREATE_TICKET",
      aktifitas: `Membuat ${createdTickets.length} tiket ${action_type} sekaligus untuk POP Site terpilih`,
      detail: `Total: ${createdTickets.length} tiket dibuat (${createdTickets.map((t) => t.ticket_number).join(", ")}). Dilewati: ${skippedSites.length}. Alasan: ${alasan}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Berhasil membuat ${createdTickets.length} tiket ${action_type} secara massal!${
        skippedSites.length > 0 ? ` (${skippedSites.length} sirkuit dilewati)` : ""
      }`,
      data: {
        created_count: createdTickets.length,
        skipped_count: skippedSites.length,
        created: createdTickets,
        skipped: skippedSites,
      },
    });
  } catch (err: any) {
    console.error("POST /api/pop-sites/bulk-actions error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses aksi massal POP Site" },
      { status: 500 }
    );
  }
}
