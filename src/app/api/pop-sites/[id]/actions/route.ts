import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateTicketNumber, parseBandwidthToMbps } from "@/lib/ticketUtils";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: siteId } = await params;
    const body = await request.json();

    const {
      action_type,
      layanan_dedicated,
      vlan,
      alasan,
      catatan,
      user_id,
    } = body;

    const validActions = ["Upgrade", "Downgrade", "Isolir", "Unisolir", "Terminate"];
    if (!action_type || !validActions.includes(action_type)) {
      return NextResponse.json(
        { success: false, error: `Tipe aksi tidak valid. Pilihan: ${validActions.join(", ")}` },
        { status: 400 }
      );
    }

    const site = await prisma.popSite.findUnique({
      where: { id: siteId },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: "POP Site tidak ditemukan." },
        { status: 404 }
      );
    }

    // Default user fallback
    let creatorId = user_id;
    if (!creatorId) {
      const defaultUser = await prisma.user.findFirst({
        where: { role: "sales_corporate" },
      });
      creatorId = defaultUser?.id || "usr-sales-001";
    }

    const ticketNumber = await generateTicketNumber();

    const targetLayanan = layanan_dedicated || site.layanan_dedicated;
    const currentMbps = parseBandwidthToMbps(site.layanan_dedicated || site.kapasitas_layanan);
    const targetMbps = parseBandwidthToMbps(targetLayanan);

    if (action_type === "Upgrade") {
      if (currentMbps > 0 && targetMbps <= currentMbps) {
        return NextResponse.json(
          {
            success: false,
            error: `Untuk Upgrade, layanan baru (${targetLayanan}) harus bernilai lebih tinggi dari layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan || "-"}).`,
          },
          { status: 400 }
        );
      }
    } else if (action_type === "Downgrade") {
      if (currentMbps > 0 && targetMbps >= currentMbps) {
        return NextResponse.json(
          {
            success: false,
            error: `Untuk Downgrade, layanan baru (${targetLayanan}) harus bernilai lebih rendah dari layanan saat ini (${site.layanan_dedicated || site.kapasitas_layanan || "-"}).`,
          },
          { status: 400 }
        );
      }
    }
    const targetVlan = vlan !== undefined ? parseInt(String(vlan), 10) : site.vlan;

    const fullNotes = `[LIFECYCLE ${action_type.toUpperCase()}] ${alasan ? `Alasan: ${alasan}. ` : ""}${catatan ? `Catatan: ${catatan}` : ""}`.trim();

    // Create the lifecycle ticket in pop_site_orders
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
        vlan: targetVlan,
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

    // Create initial audit log
    await prisma.orderProgressLog.create({
      data: {
        order_id: newOrder.id,
        user_id: creatorId,
        action_type: "Status Change",
        status_sebelum: null,
        status_sesudah: "Antrian Aktivasi",
        catatan_progress: `Pengajuan tiket ${action_type} untuk POP Site [${site.site_id}]. Alasan: ${alasan || "-"}`,
      },
    });

    // Dispatch Sheets sync asynchronously
    buildPayloadForOrder(newOrder.id, "CREATE_ORDER", {
      statusSebelum: null,
      statusSesudah: "Antrian Aktivasi",
      progressNote: `Pengajuan tiket ${action_type} untuk POP Site [${site.site_id}] masuk ke antrian.`,
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, newOrder.id);
    });

    return NextResponse.json({
      success: true,
      message: `Tiket ${action_type} (${ticketNumber}) untuk POP Site ${site.site_id} berhasil didaftarkan ke antrian aktivasi!`,
      data: newOrder,
    });
  } catch (err: any) {
    console.error("POST /api/pop-sites/[id]/actions error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses aksi lifecycle POP Site" },
      { status: 500 }
    );
  }
}

