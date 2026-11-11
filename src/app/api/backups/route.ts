import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth } from "@/lib/backupAuth";
import { serializeDeviceSafe } from "@/lib/backupSerializer";
import {
  ensureBackupSchedulerStarted,
  getBackupGlobalSettings,
  runScheduledBackupsTick,
} from "@/lib/backupSchedulerService";
import { getGDrivePublicConfig, syncBackupRecordToGDrive } from "@/lib/gdriveSyncService";

export async function GET(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    ensureBackupSchedulerStarted(60);

    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId") || "";
    const vendor = searchParams.get("vendor") || "";
    const backupType = searchParams.get("backupType") || "";
    const status = searchParams.get("status") || "";
    const gdriveStatus = searchParams.get("gdriveStatus") || "";
    const search = (searchParams.get("search") || "").trim();
    const limit = Math.min(200, Math.max(10, parseInt(searchParams.get("limit") || "100", 10) || 100));

    const [globalSettings, gdriveConfig, devicesRaw] = await Promise.all([
      getBackupGlobalSettings(),
      getGDrivePublicConfig(),
      prisma.networkDevice.findMany({
        orderBy: [{ name: "asc" }],
        include: {
          pop_site: {
            select: { id: true, site_id: true, nama_perusahaan: true, nama_pic: true, ip_public: true },
          },
          _count: { select: { backups: true } },
        },
      }),
    ]);

    const backupWhere: any = {};
    if (deviceId && deviceId !== "ALL") backupWhere.device_id = deviceId;
    if (backupType && backupType !== "ALL") backupWhere.backup_type = backupType;
    if (status && status !== "ALL") backupWhere.status = status;
    if (gdriveStatus && gdriveStatus !== "ALL") backupWhere.gdrive_status = gdriveStatus;
    if (vendor && vendor !== "ALL") {
      backupWhere.device = { vendor };
    }
    if (search) {
      backupWhere.OR = [
        { command_used: { contains: search, mode: "insensitive" } },
        { triggered_by: { contains: search, mode: "insensitive" } },
        { device: { name: { contains: search, mode: "insensitive" } } },
        { device: { host: { contains: search, mode: "insensitive" } } },
      ];
    }

    const [backups, totalBackupsCount, syncedCount, failedGDriveCount, pendingGDriveCount, popSites] =
      await Promise.all([
        prisma.networkConfigBackup.findMany({
          where: backupWhere,
          orderBy: { created_at: "desc" },
          take: limit,
          select: {
            id: true,
            device_id: true,
            backup_type: true,
            status: true,
            config_hash: true,
            line_count: true,
            size_bytes: true,
            changed_from_prev: true,
            diff_added: true,
            diff_removed: true,
            command_used: true,
            error_message: true,
            triggered_by: true,
            gdrive_status: true,
            gdrive_file_id: true,
            gdrive_file_url: true,
            gdrive_synced_at: true,
            gdrive_error: true,
            created_at: true,
            device: {
              select: {
                id: true,
                name: true,
                host: true,
                vendor: true,
                platform: true,
              },
            },
          },
        }),
        prisma.networkConfigBackup.count(),
        prisma.networkConfigBackup.count({ where: { gdrive_status: "SYNCED" } }),
        prisma.networkConfigBackup.count({ where: { gdrive_status: "FAILED" } }),
        prisma.networkConfigBackup.count({ where: { gdrive_status: "PENDING", status: "SUCCESS" } }),
        prisma.popSite.findMany({
          orderBy: { site_id: "asc" },
          select: { id: true, site_id: true, nama_perusahaan: true, nama_pic: true, ip_public: true },
          take: 250,
        }),
      ]);

    const devices = devicesRaw.map((d) => serializeDeviceSafe(d, globalSettings));

    return NextResponse.json({
      success: true,
      data: {
        summary: {
          total_devices: devices.length,
          active_auto_devices: devices.filter((d) => d.auto_backup_enabled && d.protocol === "ssh").length,
          success_devices: devices.filter((d) => d.last_status === "SUCCESS").length,
          failed_devices: devices.filter((d) => d.last_status === "FAILED").length,
          total_backups: totalBackupsCount,
          synced_gdrive: syncedCount,
          failed_gdrive: failedGDriveCount,
          pending_gdrive: pendingGDriveCount,
        },
        globalSettings,
        gdriveSummary: {
          enabled: gdriveConfig.enabled,
          method: gdriveConfig.method,
          is_configured: gdriveConfig.is_configured,
          folder_per_device: gdriveConfig.folder_per_device,
        },
        devices,
        backups,
        popSites,
      },
    });
  } catch (err: any) {
    console.error("GET /api/backups error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat data Network Config Backup." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === "backup_all") {
      const summary = await runScheduledBackupsTick(true, auth.user.nama);
      return NextResponse.json({
        success: true,
        message: `Backup batch selesai: ${summary.succeeded} berhasil, ${summary.failed} gagal dari ${summary.executed} perangkat SSH.`,
        data: summary,
      });
    }

    if (action === "sync_pending_gdrive") {
      const pending = await prisma.networkConfigBackup.findMany({
        where: {
          status: "SUCCESS",
          gdrive_status: { in: ["PENDING", "FAILED"] },
        },
        orderBy: { created_at: "desc" },
        take: 25,
        select: { id: true },
      });

      let synced = 0;
      let failed = 0;
      for (const item of pending) {
        try {
          const res = await syncBackupRecordToGDrive(item.id);
          if (res.result.status === "SYNCED") synced++;
          else if (res.result.status === "FAILED") failed++;
        } catch {
          failed++;
        }
      }

      return NextResponse.json({
        success: true,
        message: `Sinkronisasi Google Drive selesai: ${synced} sukses, ${failed} gagal.`,
        data: { attempted: pending.length, synced, failed },
      });
    }

    if (action === "run_scheduler_check") {
      const summary = await runScheduledBackupsTick(false, `Manual Trigger (${auth.user.nama})`);
      return NextResponse.json({
        success: true,
        message: `Pengecekan jadwal selesai: ${summary.executed} perangkat jatuh tempo dijalankan.`,
        data: summary,
      });
    }

    return NextResponse.json({ success: false, error: "Action tidak valid." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/backups error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses aksi backup." },
      { status: 500 }
    );
  }
}
