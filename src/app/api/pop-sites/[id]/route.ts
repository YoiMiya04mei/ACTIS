import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { updateIcmpMonitorIp } from "@/lib/icmpMonitorService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;

    const site = await prisma.popSite.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { created_at: "desc" },
          include: {
            creator: { select: { id: true, nama: true, role: true } },
            test_results: true,
            progress_logs: {
              orderBy: { created_at: "asc" },
              include: { user: { select: { id: true, nama: true, role: true } } },
            },
          },
        },
        data_change_logs: {
          orderBy: { created_at: "desc" },
          include: {
            user: { select: { id: true, nama: true, role: true, email: true } },
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: "Site tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: site });
  } catch (err: any) {
    console.error("GET /api/pop-sites/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load site" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();

    const currentSite = await prisma.popSite.findUnique({
      where: { id },
    });

    if (!currentSite) {
      return NextResponse.json(
        { success: false, error: "Site tidak ditemukan." },
        { status: 404 }
      );
    }

    // Resolve user strictly from verified session
    const actorId = auth.user.id;

    // List of editable fields (EXCLUDING layanan_dedicated!)
    const fieldDefinitions: Array<{
      key: keyof typeof currentSite;
      label: string;
      format?: (val: any) => any;
      display?: (val: any) => string;
    }> = [
        { key: "nama_pic", label: "Nama PIC" },
        { key: "nama_perusahaan", label: "Perusahaan / Entitas" },
        { key: "email_pic", label: "Email PIC" },
        {
          key: "kontak_pic",
          label: "Kontak PIC / WhatsApp",
          format: (val) => {
            if (Array.isArray(val)) return JSON.stringify(val);
            if (typeof val === "string") {
              try {
                const parsed = JSON.parse(val);
                if (Array.isArray(parsed)) return JSON.stringify(parsed);
              } catch {
                return JSON.stringify([val]);
              }
            }
            return JSON.stringify([]);
          },
          display: (val) => {
            try {
              const arr = JSON.parse(val);
              return Array.isArray(arr) ? arr.join(", ") : String(val);
            } catch {
              return String(val || "-");
            }
          },
        },
        { key: "alamat_instalasi", label: "Alamat Fisik Instalasi" },
        {
          key: "vlan",
          label: "VLAN ID",
          format: (val) => (val !== "" && val !== null && val !== undefined ? parseInt(val, 10) : null),
          display: (val) => (val !== null && val !== undefined ? String(val) : "-"),
        },
        { key: "infrastruktur", label: "Infrastruktur" },
        { key: "media_koneksi", label: "Media Koneksi Transmisi" },
        { key: "ip_public", label: "IP Public" },
        { key: "ip_private", label: "IP Private" },
        { key: "server", label: "Server / BRAS Aggregator" },
        { key: "sn_ont", label: "SN ONT / Modem" },
        { key: "sid", label: "Circuit ID (SID)" },
        { key: "ao", label: "Account Order (AO)" },
        { key: "nomor_order", label: "Nomor Order Provider" },
        // Enterprise fields
        { key: "kapasitas_layanan", label: "Kapasitas Layanan" },
        { key: "interkoneksi", label: "Interkoneksi" },
        { key: "port_media", label: "Port Interkoneksi" },
        { key: "tipe_layanan_collo", label: "Tipe Layanan Collocation" },
        { key: "nama_perangkat", label: "Nama Perangkat" },
        { key: "sn_perangkat", label: "Serial Number Perangkat" },
        {
          key: "prefix_advertise",
          label: "Prefix Advertise",
          format: (val) => {
            if (Array.isArray(val)) return JSON.stringify(val);
            if (typeof val === "string") return val;
            return null;
          },
        },
        { key: "as_number", label: "AS Number" },
      ];

    const updatedData: Record<string, any> = {};
    const diffList: Array<{
      field: string;
      label: string;
      old_value: string;
      new_value: string;
    }> = [];

    for (const def of fieldDefinitions) {
      if (body[def.key] !== undefined) {
        let newVal = body[def.key];
        if (def.format) {
          newVal = def.format(newVal);
        } else if (typeof newVal === "string") {
          newVal = newVal.trim() || null;
        }

        const oldVal = (currentSite as any)[def.key];

        const oldStr = def.display ? def.display(oldVal) : String(oldVal ?? "-");
        const newStr = def.display ? def.display(newVal) : String(newVal ?? "-");

        if (oldStr !== newStr) {
          updatedData[def.key] = newVal;
          diffList.push({
            field: String(def.key),
            label: def.label,
            old_value: oldStr,
            new_value: newStr,
          });
        }
      }
    }

    if (updatedData.vlan !== undefined && updatedData.vlan !== null) {
      if (isNaN(updatedData.vlan) || updatedData.vlan < 1 || updatedData.vlan > 4094) {
        return NextResponse.json(
          { success: false, error: "VLAN ID harus berupa angka valid antara 1 hingga 4094." },
          { status: 400 }
        );
      }
    }

    if (diffList.length === 0) {
      return NextResponse.json({
        success: true,
        message: "Tidak ada data yang mengalami perubahan.",
        data: currentSite,
        diff: [],
      });
    }

    // Apply updates to PopSite
    await prisma.popSite.update({
      where: { id },
      data: updatedData,
    });

    // AUTO-UPDATE ICMP MONITOR IP IF IP_PUBLIC CHANGED
    if (updatedData.ip_public !== undefined) {
      updateIcmpMonitorIp(currentSite.id, updatedData.ip_public).catch((err) => {
        console.error("Auto-update ICMP monitor IP error:", err);
      });
    }

    // Create Audit Log
    await prisma.siteDataChangeLog.create({
      data: {
        pop_site_id: currentSite.id,
        user_id: actorId,
        changes: JSON.stringify(diffList),
        catatan: body.catatan?.trim() || "Perubahan Data Administrasi & Sirkuit",
      },
    });

    // Record application-wide activity log
    prisma.user.findUnique({ where: { id: actorId } }).then((actorUser) => {
      recordActivity({
        nama_lengkap: actorUser?.nama || "NOC Engineer",
        email: actorUser?.email || null,
        ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
        tipe: "UPDATE_SITE",
        aktifitas: `Mengubah data layanan ${currentSite.site_id} (${currentSite.nama_perusahaan || currentSite.nama_pic})`,
        detail: JSON.stringify(diffList),
        user_agent: parseUserAgent(request.headers.get("user-agent")),
      }).catch(() => {});
    }).catch(() => {});

    // Re-fetch site with the new change log
    const finalSite = await prisma.popSite.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { created_at: "desc" },
          include: {
            creator: { select: { id: true, nama: true, role: true } },
            test_results: true,
            progress_logs: {
              orderBy: { created_at: "asc" },
              include: { user: { select: { id: true, nama: true, role: true } } },
            },
          },
        },
        data_change_logs: {
          orderBy: { created_at: "desc" },
          include: {
            user: { select: { id: true, nama: true, role: true, email: true } },
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      message: `Berhasil mengubah ${diffList.length} parameter data administrasi.`,
      data: finalSite,
      diff: diffList,
    });
  } catch (err: any) {
    console.error("PATCH /api/pop-sites/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memperbarui data site." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const actorUser = auth.user;

    const site = await prisma.popSite.findUnique({
      where: { id },
      include: { orders: { select: { id: true } } },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: "POP Site tidak ditemukan." },
        { status: 404 }
      );
    }

    // STRICT CHECK: Must be in "Terminated" status
    if (site.status_layanan !== "Terminated") {
      return NextResponse.json(
        {
          success: false,
          error: `Penghapusan gagal. POP Site [${site.site_id}] masih berstatus ${site.status_layanan}. Hanya sirkuit dengan status Terminated yang dapat dihapus.`,
        },
        { status: 400 }
      );
    }

    // Delete linked orders (which cascades test_results and progress_logs)
    await prisma.popSiteOrder.deleteMany({
      where: { pop_site_id: site.id },
    });

    // Delete the site (which cascades icmp_monitor and site_data_change_logs)
    await prisma.popSite.delete({
      where: { id: site.id },
    });

    // Record Activity Log
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorUser.nama,
      email: actorUser.email,
      ip_address: clientIp,
      tipe: "DELETE_SITE",
      aktifitas: `Menghapus permanen POP Site ${site.site_id} (${site.nama_pic}) - Status Terminated`,
      detail: `ID: ${site.id}, Initial Ticket: ${site.initial_ticket}, Layanan: ${site.layanan_dedicated || "-"}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `POP Site ${site.site_id} (${site.nama_pic}) berhasil dihapus permanen oleh Super Admin.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/pop-sites/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menghapus POP Site." },
      { status: 500 }
    );
  }
}
