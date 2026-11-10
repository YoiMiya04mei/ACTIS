/**
 * ACTIS Database Migration Script: SQLite (prisma/dev.db) -> PostgreSQL
 *
 * Usage:
 *   node scripts/migrate-sqlite-to-postgres.js
 *
 * Pre-requisite:
 *   DATABASE_URL must point to your PostgreSQL instance (e.g. from .env or Docker)
 */

const { DatabaseSync } = require("node:sqlite");
const { PrismaClient } = require("@prisma/client");
const path = require("path");
const fs = require("fs");

const sqlitePath = path.resolve(__dirname, "../prisma/dev.db");

async function migrate() {
  console.log("=================================================");
  console.log("ACTIS: MIGRASI DATABASE DARI SQLITE KE POSTGRESQL");
  console.log("=================================================");

  if (!fs.existsSync(sqlitePath)) {
    console.error(`[ERROR] File database SQLite tidak ditemukan di: ${sqlitePath}`);
    process.exit(1);
  }

  const pgClient = new PrismaClient();
  const sqlite = new DatabaseSync(sqlitePath);

  try {
    console.log(`[1/10] Membaca database SQLite: ${sqlitePath}`);

    // Helper to query all rows from SQLite
    const getAll = (table) => {
      try {
        return sqlite.prepare(`SELECT * FROM ${table}`).all();
      } catch (e) {
        return [];
      }
    };

    // 1. Users
    const users = getAll("users");
    console.log(`[2/10] Migrasi Users (${users.length} data)...`);
    for (const u of users) {
      await pgClient.user.upsert({
        where: { id: u.id },
        update: {
          nama: u.nama,
          email: u.email,
          password_hash: u.password_hash,
          role: u.role,
        },
        create: {
          id: u.id,
          nama: u.nama,
          email: u.email,
          password_hash: u.password_hash,
          role: u.role,
          created_at: new Date(u.created_at || Date.now()),
        },
      });
    }

    // 2. Pop Sites
    const popSites = getAll("pop_sites");
    console.log(`[3/10] Migrasi Pop Sites (${popSites.length} data)...`);
    for (const s of popSites) {
      await pgClient.popSite.upsert({
        where: { id: s.id },
        update: {
          site_id: s.site_id,
          initial_ticket: s.initial_ticket,
          kategori_layanan: s.kategori_layanan || "POP Site",
          sub_layanan: s.sub_layanan,
          nama_pic: s.nama_pic,
          kontak_pic: s.kontak_pic,
          nama_perusahaan: s.nama_perusahaan,
          email_pic: s.email_pic,
          alamat_instalasi: s.alamat_instalasi,
          ip_public: s.ip_public,
          ip_private: s.ip_private,
          vlan: s.vlan ? Number(s.vlan) : null,
          layanan_dedicated: s.layanan_dedicated,
          server: s.server,
          infrastruktur: s.infrastruktur,
          media_koneksi: s.media_koneksi,
          sn_ont: s.sn_ont,
          kapasitas_layanan: s.kapasitas_layanan,
          interkoneksi: s.interkoneksi,
          port_media: s.port_media,
          tipe_layanan_collo: s.tipe_layanan_collo,
          nama_perangkat: s.nama_perangkat,
          sn_perangkat: s.sn_perangkat,
          prefix_advertise: s.prefix_advertise,
          as_number: s.as_number,
          sid: s.sid,
          ao: s.ao,
          nomor_order: s.nomor_order,
          status_layanan: s.status_layanan || "Active",
        },
        create: {
          id: s.id,
          site_id: s.site_id,
          initial_ticket: s.initial_ticket,
          kategori_layanan: s.kategori_layanan || "POP Site",
          sub_layanan: s.sub_layanan,
          nama_pic: s.nama_pic,
          kontak_pic: s.kontak_pic,
          nama_perusahaan: s.nama_perusahaan,
          email_pic: s.email_pic,
          alamat_instalasi: s.alamat_instalasi,
          ip_public: s.ip_public,
          ip_private: s.ip_private,
          vlan: s.vlan ? Number(s.vlan) : null,
          layanan_dedicated: s.layanan_dedicated,
          server: s.server,
          infrastruktur: s.infrastruktur,
          media_koneksi: s.media_koneksi,
          sn_ont: s.sn_ont,
          kapasitas_layanan: s.kapasitas_layanan,
          interkoneksi: s.interkoneksi,
          port_media: s.port_media,
          tipe_layanan_collo: s.tipe_layanan_collo,
          nama_perangkat: s.nama_perangkat,
          sn_perangkat: s.sn_perangkat,
          prefix_advertise: s.prefix_advertise,
          as_number: s.as_number,
          sid: s.sid,
          ao: s.ao,
          nomor_order: s.nomor_order,
          status_layanan: s.status_layanan || "Active",
          waktu_go_live: new Date(s.waktu_go_live || Date.now()),
          created_at: new Date(s.created_at || Date.now()),
          updated_at: new Date(s.updated_at || Date.now()),
        },
      });
    }

    // 3. Pop Site Orders
    const orders = getAll("pop_site_orders");
    console.log(`[4/10] Migrasi Orders (${orders.length} data)...`);
    for (const o of orders) {
      await pgClient.popSiteOrder.upsert({
        where: { id: o.id },
        update: {
          ticket_number: o.ticket_number,
          kategori_layanan: o.kategori_layanan || "POP Site",
          sub_layanan: o.sub_layanan,
          nama_pic: o.nama_pic,
          kontak_pic: o.kontak_pic,
          nama_perusahaan: o.nama_perusahaan,
          email_pic: o.email_pic,
          alamat_instalasi: o.alamat_instalasi,
          ip_public: o.ip_public,
          ip_private: o.ip_private,
          vlan: o.vlan ? Number(o.vlan) : null,
          layanan_dedicated: o.layanan_dedicated,
          server: o.server,
          infrastruktur: o.infrastruktur,
          media_koneksi: o.media_koneksi,
          sn_ont: o.sn_ont,
          kapasitas_layanan: o.kapasitas_layanan,
          interkoneksi: o.interkoneksi,
          port_media: o.port_media,
          tipe_layanan_collo: o.tipe_layanan_collo,
          nama_perangkat: o.nama_perangkat,
          sn_perangkat: o.sn_perangkat,
          prefix_advertise: o.prefix_advertise,
          as_number: o.as_number,
          sid: o.sid,
          ao: o.ao,
          nomor_order: o.nomor_order,
          waktu_aktivasi: o.waktu_aktivasi ? new Date(o.waktu_aktivasi) : null,
          catatan_tambahan: o.catatan_tambahan,
          status: o.status || "Antrian Aktivasi",
          tipe_order: o.tipe_order || "Aktivasi Baru",
          pop_site_id: o.pop_site_id || null,
          created_by: o.created_by,
          completed_at: o.completed_at ? new Date(o.completed_at) : null,
        },
        create: {
          id: o.id,
          ticket_number: o.ticket_number,
          kategori_layanan: o.kategori_layanan || "POP Site",
          sub_layanan: o.sub_layanan,
          nama_pic: o.nama_pic,
          kontak_pic: o.kontak_pic,
          nama_perusahaan: o.nama_perusahaan,
          email_pic: o.email_pic,
          alamat_instalasi: o.alamat_instalasi,
          ip_public: o.ip_public,
          ip_private: o.ip_private,
          vlan: o.vlan ? Number(o.vlan) : null,
          layanan_dedicated: o.layanan_dedicated,
          server: o.server,
          infrastruktur: o.infrastruktur,
          media_koneksi: o.media_koneksi,
          sn_ont: o.sn_ont,
          kapasitas_layanan: o.kapasitas_layanan,
          interkoneksi: o.interkoneksi,
          port_media: o.port_media,
          tipe_layanan_collo: o.tipe_layanan_collo,
          nama_perangkat: o.nama_perangkat,
          sn_perangkat: o.sn_perangkat,
          prefix_advertise: o.prefix_advertise,
          as_number: o.as_number,
          sid: o.sid,
          ao: o.ao,
          nomor_order: o.nomor_order,
          waktu_aktivasi: o.waktu_aktivasi ? new Date(o.waktu_aktivasi) : null,
          catatan_tambahan: o.catatan_tambahan,
          status: o.status || "Antrian Aktivasi",
          tipe_order: o.tipe_order || "Aktivasi Baru",
          pop_site_id: o.pop_site_id || null,
          created_by: o.created_by,
          created_at: new Date(o.created_at || Date.now()),
          completed_at: o.completed_at ? new Date(o.completed_at) : null,
        },
      });
    }

    // 4. Order Progress Logs
    const progressLogs = getAll("order_progress_logs");
    console.log(`[5/10] Migrasi Progress Logs (${progressLogs.length} data)...`);
    for (const log of progressLogs) {
      await pgClient.orderProgressLog.upsert({
        where: { id: log.id },
        update: {
          action_type: log.action_type,
          status_sebelum: log.status_sebelum,
          status_sesudah: log.status_sesudah,
          catatan_progress: log.catatan_progress,
        },
        create: {
          id: log.id,
          order_id: log.order_id,
          user_id: log.user_id,
          action_type: log.action_type,
          status_sebelum: log.status_sebelum,
          status_sesudah: log.status_sesudah,
          catatan_progress: log.catatan_progress,
          created_at: new Date(log.created_at || Date.now()),
        },
      });
    }

    // 5. Test Results
    const testResults = getAll("test_results");
    console.log(`[6/10] Migrasi Test Results (${testResults.length} data)...`);
    for (const t of testResults) {
      await pgClient.testResult.upsert({
        where: { id: t.id },
        update: {
          file_url: t.file_url,
          file_name: t.file_name,
          file_type: t.file_type,
        },
        create: {
          id: t.id,
          order_id: t.order_id,
          file_url: t.file_url,
          file_name: t.file_name,
          file_type: t.file_type,
          uploaded_by: t.uploaded_by,
          uploaded_at: new Date(t.uploaded_at || Date.now()),
        },
      });
    }

    // 6. Site Data Change Logs
    const changeLogs = getAll("site_data_change_logs");
    console.log(`[7/10] Migrasi Site Data Change Logs (${changeLogs.length} data)...`);
    for (const c of changeLogs) {
      await pgClient.siteDataChangeLog.upsert({
        where: { id: c.id },
        update: {
          changes: c.changes,
          catatan: c.catatan,
        },
        create: {
          id: c.id,
          pop_site_id: c.pop_site_id,
          user_id: c.user_id,
          changes: c.changes,
          catatan: c.catatan,
          created_at: new Date(c.created_at || Date.now()),
        },
      });
    }

    // 7. System Settings
    const settings = getAll("system_settings");
    console.log(`[8/10] Migrasi System Settings (${settings.length} data)...`);
    for (const s of settings) {
      await pgClient.systemSetting.upsert({
        where: { key: s.key },
        update: {
          value: s.value,
          updated_at: new Date(s.updated_at || Date.now()),
        },
        create: {
          key: s.key,
          value: s.value,
          updated_at: new Date(s.updated_at || Date.now()),
        },
      });
    }

    // 8. ICMP Monitors & Heartbeats
    const monitors = getAll("icmp_monitors");
    console.log(`[9/10] Migrasi ICMP Monitors (${monitors.length} data)...`);
    for (const m of monitors) {
      await pgClient.$executeRawUnsafe(
        `INSERT INTO icmp_monitors (id, pop_site_id, name, ip_address, kategori, status, latency_ms, uptime_pct, last_checked_at, interval_sec, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET 
           name = EXCLUDED.name,
           ip_address = EXCLUDED.ip_address,
           status = EXCLUDED.status,
           latency_ms = EXCLUDED.latency_ms,
           uptime_pct = EXCLUDED.uptime_pct,
           last_checked_at = EXCLUDED.last_checked_at,
           updated_at = EXCLUDED.updated_at`,
        m.id,
        m.pop_site_id,
        m.name,
        m.ip_address,
        m.kategori,
        m.status,
        m.latency_ms,
        m.uptime_pct,
        m.last_checked_at ? new Date(m.last_checked_at) : null,
        m.interval_sec || 60,
        Boolean(m.is_active),
        new Date(m.created_at || Date.now()),
        new Date(m.updated_at || Date.now())
      );
    }

    const heartbeats = getAll("icmp_heartbeats");
    console.log(`[10/10] Migrasi ICMP Heartbeats (${heartbeats.length} data)...`);
    for (const h of heartbeats) {
      await pgClient.$executeRawUnsafe(
        `INSERT INTO icmp_heartbeats (id, monitor_id, status, latency_ms, msg, created_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO NOTHING`,
        h.id,
        h.monitor_id,
        h.status,
        h.latency_ms,
        h.msg,
        new Date(h.created_at || Date.now())
      );
    }

    console.log("\n=================================================");
    console.log("MIGRASI KE POSTGRESQL SELESAI DENGAN SUKSES! 🚀");
    console.log("=================================================");
    console.log(`- Users: ${users.length}`);
    console.log(`- POP Sites & Enterprise: ${popSites.length}`);
    console.log(`- Orders Queue: ${orders.length}`);
    console.log(`- Progress Logs: ${progressLogs.length}`);
    console.log(`- Test Results: ${testResults.length}`);
    console.log(`- Data Change Logs: ${changeLogs.length}`);
    console.log(`- System Settings: ${settings.length}`);
    console.log(`- ICMP Monitors: ${monitors.length}`);
    console.log(`- ICMP Heartbeats: ${heartbeats.length}`);
  } catch (err) {
    console.error("\n[ERROR] Migrasi gagal:", err);
    process.exit(1);
  } finally {
    await pgClient.$disconnect();
  }
}

migrate();

