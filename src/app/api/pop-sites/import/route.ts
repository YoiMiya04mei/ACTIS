import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import {
  parseAndValidatePopSiteCsv,
  generatePopSiteCsvTemplate,
  PopSiteImportRow,
} from "@/lib/popSiteImportService";
import { ensureIcmpMonitorForSite } from "@/lib/icmpMonitorService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

/**
 * GET /api/pop-sites/import
 * Mengunduh file template CSV resmi untuk import POP Site.
 */
export async function GET() {
  try {
    const csvContent = generatePopSiteCsvTemplate();

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="template_import_pop_site.csv"',
        "Cache-Control": "no-cache",
      },
    });
  } catch (err: any) {
    console.error("GET /api/pop-sites/import error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal men-generate template CSV" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/pop-sites/import
 * Menerima list data baris POP Site (JSON atau CSV FormData) untuk migrasi massal.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Resolve user actor
    let actorId = "usr-admin-001";
    let actorName = "Admin System";

    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);
    if (sessionUser?.id) {
      actorId = sessionUser.id;
      actorName = sessionUser.nama || sessionUser.email || "User";
    } else {
      const defaultUser = await prisma.user.findFirst({
        where: { role: "admin" },
      });
      if (defaultUser) {
        actorId = defaultUser.id;
        actorName = defaultUser.nama;
      }
    }

    // 2. Parse request payload (JSON or Multipart Form)
    let rawSites: PopSiteImportRow[] = [];
    let duplicateMode: "skip" | "update" = "skip";

    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const body = await request.json();
      rawSites = body.sites || [];
      if (body.mode === "update" || body.mode === "skip") {
        duplicateMode = body.mode;
      }
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      const mode = formData.get("mode") as string | null;
      if (mode === "update" || mode === "skip") {
        duplicateMode = mode;
      }
      if (file) {
        const text = await file.text();
        const parsed = parseAndValidatePopSiteCsv(text);
        rawSites = parsed.rows;
      }
    }

    if (!rawSites || rawSites.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada data POP Site yang dikirimkan untuk diimport." },
        { status: 400 }
      );
    }

    // 3. Persiapkan penomoran otomatis sequential Site ID
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const sitePrefix = `POP-${yyyy}${mm}-`;

    // Cari sequence terakhir yang terpakai untuk bulan ini
    const existingSitesWithPrefix = await prisma.popSite.findMany({
      where: {
        site_id: {
          startsWith: sitePrefix,
        },
      },
      select: { site_id: true },
    });

    let maxSeq = 0;
    for (const s of existingSitesWithPrefix) {
      const numPart = parseInt(s.site_id.replace(sitePrefix, ""), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors: string[] = [];
    const successfulSiteIds: string[] = [];

    // 4. Proses setiap baris import
    for (let i = 0; i < rawSites.length; i++) {
      const row = rawSites[i];
      const rowNum = row._rowNumber || i + 1;

      // Validasi baris
      if (!row.nama_pic || row.nama_pic.trim().length === 0) {
        errors.push(`Baris ${rowNum}: Nama PIC / Pelanggan tidak boleh kosong.`);
        continue;
      }

      try {
        let finalSiteId = row.site_id ? row.site_id.trim().toUpperCase() : "";

        // Cek apakah Site ID sudah ada di database
        let existingSite = null;
        if (finalSiteId) {
          existingSite = await prisma.popSite.findUnique({
            where: { site_id: finalSiteId },
          });
        }

        // Tentukan apakah Skip atau Update atau Create
        if (existingSite) {
          if (duplicateMode === "skip") {
            skippedCount++;
            continue;
          }

          // Mode UPDATE
          const updateData: any = {
            nama_pic: row.nama_pic.trim(),
            status_layanan: row.status_layanan || existingSite.status_layanan,
          };

          if (row.nama_perusahaan !== undefined) updateData.nama_perusahaan = row.nama_perusahaan;
          if (row.email_pic !== undefined) updateData.email_pic = row.email_pic;
          if (row.alamat_instalasi !== undefined) updateData.alamat_instalasi = row.alamat_instalasi;
          if (row.layanan_dedicated !== undefined) updateData.layanan_dedicated = row.layanan_dedicated;
          if (row.vlan !== undefined) updateData.vlan = row.vlan;
          if (row.infrastruktur !== undefined) updateData.infrastruktur = row.infrastruktur;
          if (row.media_koneksi !== undefined) updateData.media_koneksi = row.media_koneksi;
          if (row.server !== undefined) updateData.server = row.server;
          if (row.ip_public !== undefined) updateData.ip_public = row.ip_public;
          if (row.ip_private !== undefined) updateData.ip_private = row.ip_private;
          if (row.sn_ont !== undefined) updateData.sn_ont = row.sn_ont;
          if (row.sid !== undefined) updateData.sid = row.sid;
          if (row.ao !== undefined) updateData.ao = row.ao;
          if (row.nomor_order !== undefined) updateData.nomor_order = row.nomor_order;

          if (row.kontak_pic) {
            const rawPhone = row.kontak_pic.trim();
            updateData.kontak_pic = rawPhone.startsWith("[") ? rawPhone : JSON.stringify([rawPhone]);
          }

          const updatedSite = await prisma.popSite.update({
            where: { id: existingSite.id },
            data: updateData,
          });

          // Catat Riwayat Perubahan Data (SiteDataChangeLog) jika ada parameter yang berubah
          const updateDiffList: Array<{ field: string; label: string; old_value: string; new_value: string }> = [];
          const checkDiff = (field: string, label: string, oldVal: any, newVal: any) => {
            const o = oldVal !== null && oldVal !== undefined ? String(oldVal).trim() : "-";
            const n = newVal !== null && newVal !== undefined ? String(newVal).trim() : "-";
            if (o !== n) {
              updateDiffList.push({ field, label, old_value: o, new_value: n });
            }
          };

          checkDiff("nama_pic", "Nama PIC", existingSite.nama_pic, updateData.nama_pic);
          if (row.kontak_pic) checkDiff("kontak_pic", "Nomor Kontak PIC", existingSite.kontak_pic, updateData.kontak_pic);
          if (row.alamat_instalasi !== undefined) checkDiff("alamat_instalasi", "Alamat Fisik Instalasi", existingSite.alamat_instalasi, updateData.alamat_instalasi);
          if (row.layanan_dedicated !== undefined) checkDiff("layanan_dedicated", "Kapasitas Layanan", existingSite.layanan_dedicated, updateData.layanan_dedicated);
          if (row.vlan !== undefined) checkDiff("vlan", "VLAN ID", existingSite.vlan, updateData.vlan);
          if (row.infrastruktur !== undefined) checkDiff("infrastruktur", "Infrastruktur", existingSite.infrastruktur, updateData.infrastruktur);
          if (row.media_koneksi !== undefined) checkDiff("media_koneksi", "Media Koneksi", existingSite.media_koneksi, updateData.media_koneksi);
          if (row.server !== undefined) checkDiff("server", "Server / BRAS", existingSite.server, updateData.server);
          if (row.ip_public !== undefined) checkDiff("ip_public", "IP Public", existingSite.ip_public, updateData.ip_public);
          if (row.ip_private !== undefined) checkDiff("ip_private", "IP Private", existingSite.ip_private, updateData.ip_private);
          if (row.sn_ont !== undefined) checkDiff("sn_ont", "SN ONT", existingSite.sn_ont, updateData.sn_ont);
          if (row.sid !== undefined) checkDiff("sid", "Circuit ID (SID)", existingSite.sid, updateData.sid);
          if (row.ao !== undefined) checkDiff("ao", "Account Order (AO)", existingSite.ao, updateData.ao);
          if (row.nomor_order !== undefined) checkDiff("nomor_order", "Nomor Order Provider", existingSite.nomor_order, updateData.nomor_order);
          if (row.status_layanan !== undefined) checkDiff("status_layanan", "Status Layanan", existingSite.status_layanan, updateData.status_layanan);

          if (updateDiffList.length > 0) {
            await prisma.siteDataChangeLog.create({
              data: {
                pop_site_id: existingSite.id,
                user_id: actorId,
                changes: JSON.stringify(updateDiffList),
                catatan: row.catatan?.trim() || "Pembaruan Data Administrasi & Sirkuit via Fitur Import Massal.",
              },
            });
          }

          // Sinkronisasi ICMP monitor jika ada IP Public
          if (updatedSite.ip_public) {
            ensureIcmpMonitorForSite(updatedSite.id).catch((err) => {
              console.error("ICMP monitor sync error on import update:", err);
            });
          }

          updatedCount++;
          successfulSiteIds.push(updatedSite.site_id);
          continue;
        }

        // Mode CREATE BARU
        if (!finalSiteId) {
          do {
            maxSeq++;
            finalSiteId = `${sitePrefix}${String(maxSeq).padStart(4, "0")}`;
          } while (
            await prisma.popSite.findUnique({
              where: { site_id: finalSiteId },
              select: { id: true },
            })
          );
        }

        // Format kontak PIC
        let kontakJson = JSON.stringify(["-"]);
        if (row.kontak_pic && row.kontak_pic.trim().length > 0) {
          const rawPhone = row.kontak_pic.trim();
          kontakJson = rawPhone.startsWith("[") ? rawPhone : JSON.stringify([rawPhone]);
        }

        // Format waktu go live
        let goLiveDate = new Date();
        if (row.waktu_go_live) {
          const parsed = new Date(row.waktu_go_live);
          if (!isNaN(parsed.getTime())) {
            goLiveDate = parsed;
          }
        }

        // Format initial ticket & jamin 100% UNIK agar tidak terjadi error unique constraint
        let initialTicket = row.initial_ticket?.trim();
        if (!initialTicket) {
          initialTicket = `MIG-${yyyy}${mm}${dd}-${String(maxSeq).padStart(4, "0")}`;
        }

        let finalTicketNumber = initialTicket;
        const existingOrderCheck = await prisma.popSiteOrder.findUnique({
          where: { ticket_number: finalTicketNumber },
          select: { id: true },
        });

        if (existingOrderCheck) {
          let suffix = 1;
          let candidate = `${initialTicket}-MIG${suffix}`;
          while (
            await prisma.popSiteOrder.findUnique({
              where: { ticket_number: candidate },
              select: { id: true },
            })
          ) {
            suffix++;
            candidate = `${initialTicket}-MIG${suffix}`;
          }
          finalTicketNumber = candidate;
        }

        // Eksekusi pembuatan PopSite, Order History, dan Riwayat Perubahan Data secara ATOMIK
        const createdSite = await prisma.$transaction(async (tx) => {
          const site = await tx.popSite.create({
            data: {
              site_id: finalSiteId,
              initial_ticket: finalTicketNumber,
              kategori_layanan: "POP Site",
              sub_layanan: null,
              nama_pic: row.nama_pic.trim(),
              nama_perusahaan: null,
              kontak_pic: kontakJson,
              email_pic: null,
              alamat_instalasi: row.alamat_instalasi?.trim() || null,
              layanan_dedicated: row.layanan_dedicated?.trim() || "100Mbps",
              vlan: row.vlan ? Number(row.vlan) : null,
              infrastruktur: row.infrastruktur?.trim() || "METRONEXIA",
              media_koneksi: row.media_koneksi?.trim() || "SFP",
              server: row.server?.trim() || "CIANJUR (GEKBRONG)",
              ip_public: row.ip_public?.trim() || null,
              ip_private: row.ip_private?.trim() || null,
              sn_ont: row.sn_ont?.trim() || null,
              sid: row.sid?.trim() || null,
              ao: row.ao?.trim() || null,
              nomor_order: row.nomor_order?.trim() || null,
              status_layanan: row.status_layanan || "Active",
              waktu_go_live: goLiveDate,
            },
          });

          const order = await tx.popSiteOrder.create({
            data: {
              ticket_number: finalTicketNumber,
              kategori_layanan: "POP Site",
              tipe_order: "Aktivasi Baru",
              status: "Completed",
              nama_pic: site.nama_pic,
              kontak_pic: site.kontak_pic,
              nama_perusahaan: null,
              email_pic: null,
              alamat_instalasi: site.alamat_instalasi,
              layanan_dedicated: site.layanan_dedicated,
              vlan: site.vlan,
              infrastruktur: site.infrastruktur,
              media_koneksi: site.media_koneksi,
              server: site.server,
              ip_public: site.ip_public,
              ip_private: site.ip_private,
              sn_ont: site.sn_ont,
              sid: site.sid,
              ao: site.ao,
              nomor_order: site.nomor_order,
              waktu_aktivasi: goLiveDate,
              completed_at: goLiveDate,
              catatan_tambahan: row.catatan?.trim() || "Data dimigrasikan via Fitur Import Massal POP Site.",
              created_by: actorId,
              pop_site_id: site.id,
            },
          });

          await tx.orderProgressLog.create({
            data: {
              order_id: order.id,
              user_id: actorId,
              action_type: "Migrasi Import",
              catatan_progress: `POP Site ${finalSiteId} berhasil dimigrasikan oleh ${actorName}. Data tersimpan ke Master Inventory.`,
            },
          });

          const initialChanges = [
            { field: "site_id", label: "Site ID", old_value: "-", new_value: finalSiteId },
            { field: "nama_pic", label: "Nama PIC", old_value: "-", new_value: site.nama_pic },
            { field: "kontak_pic", label: "Nomor Kontak PIC", old_value: "-", new_value: row.kontak_pic?.trim() || "-" },
            { field: "alamat_instalasi", label: "Alamat Fisik Instalasi", old_value: "-", new_value: site.alamat_instalasi || "-" },
            { field: "layanan_dedicated", label: "Kapasitas Layanan", old_value: "-", new_value: site.layanan_dedicated || "-" },
            { field: "vlan", label: "VLAN ID", old_value: "-", new_value: site.vlan ? String(site.vlan) : "-" },
            { field: "infrastruktur", label: "Infrastruktur", old_value: "-", new_value: site.infrastruktur || "-" },
            { field: "media_koneksi", label: "Media Koneksi", old_value: "-", new_value: site.media_koneksi || "-" },
            { field: "server", label: "Server / BRAS", old_value: "-", new_value: site.server || "-" },
            { field: "ip_public", label: "IP Public", old_value: "-", new_value: site.ip_public || "-" },
            { field: "ip_private", label: "IP Private", old_value: "-", new_value: site.ip_private || "-" },
            { field: "sn_ont", label: "SN ONT", old_value: "-", new_value: site.sn_ont || "-" },
            { field: "sid", label: "Circuit ID (SID)", old_value: "-", new_value: site.sid || "-" },
            { field: "ao", label: "Account Order (AO)", old_value: "-", new_value: site.ao || "-" },
            { field: "nomor_order", label: "Nomor Order Provider", old_value: "-", new_value: site.nomor_order || "-" },
            { field: "status_layanan", label: "Status Layanan", old_value: "-", new_value: site.status_layanan },
          ];

          await tx.siteDataChangeLog.create({
            data: {
              pop_site_id: site.id,
              user_id: actorId,
              changes: JSON.stringify(initialChanges),
              catatan: row.catatan?.trim() || "Inisialisasi Master Data POP Site via Fitur Migrasi Import Massal.",
              created_at: goLiveDate,
            },
          });

          return site;
        });

        // SINKRONISASI OTOMATIS KE ICMP PING MONITORING & IPAM
        if (createdSite.ip_public) {
          ensureIcmpMonitorForSite(createdSite.id).catch((err) => {
            console.error("Auto-create ICMP monitor error on import:", err);
          });
        }

        createdCount++;
        successfulSiteIds.push(finalSiteId);
      } catch (rowErr: any) {
        console.error(`Error importing row ${rowNum}:`, rowErr);
        errors.push(`Baris ${rowNum}: ${rowErr.message || "Gagal memproses baris"}`);
      }
    }

    const totalProcessed = createdCount + updatedCount;
    const message = `Selesai memproses import: ${createdCount} POP Site baru dibuat, ${updatedCount} diperbarui, ${skippedCount} dilewati.`;

    // Record activity log
    recordActivity({
      nama_lengkap: "NOC Administrator",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "IMPORT_DATA",
      aktifitas: `Import massal data POP Site (${createdCount} baru, ${updatedCount} diperbarui)`,
      detail: message,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message,
      data: {
        total_rows: rawSites.length,
        created_count: createdCount,
        updated_count: updatedCount,
        skipped_count: skippedCount,
        errors,
        site_ids: successfulSiteIds,
      },
    });
  } catch (err: any) {
    console.error("POST /api/pop-sites/import error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Terjadi kesalahan internal saat import POP Site." },
      { status: 500 }
    );
  }
}

