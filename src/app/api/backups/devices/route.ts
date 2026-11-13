import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth, getClientIp } from "@/lib/backupAuth";
import { encryptSecret } from "@/lib/backupCrypto";
import { resolveIntervalDays } from "@/lib/backupVendorProfiles";
import { testDeviceSshConnection } from "@/lib/networkSshService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { serializeDeviceSafe } from "@/lib/backupSerializer";
import { getBackupGlobalSettings } from "@/lib/backupSchedulerService";
import { isRestrictedNetworkTarget } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Unsaved SSH connection test straight from modal
    if (body.action === "test_unsaved") {
      if (!body.host || !body.username || (!body.password && !body.ssh_private_key)) {
        return NextResponse.json(
          { success: false, error: "Host/IP, Username, dan Password/SSH Key wajib diisi untuk tes koneksi." },
          { status: 400 }
        );
      }

      const targetHost = String(body.host).trim();
      if (isRestrictedNetworkTarget(targetHost)) {
        return NextResponse.json(
          { success: false, error: "Akses host ditolak: Alamat IP link-local, cloud metadata, atau loopback diblokir demi keamanan." },
          { status: 400 }
        );
      }

      const res = await testDeviceSshConnection({
        id: "unsaved-test",
        name: body.name || body.host,
        host: targetHost,
        port: parseInt(String(body.port || 22), 10) || 22,
        vendor: String(body.vendor || "mikrotik"),
        platform: body.platform || null,
        username: String(body.username).trim(),
        password_enc: body.password ? encryptSecret(String(body.password)) : null,
        enable_password_enc: body.enable_password ? encryptSecret(String(body.enable_password)) : null,
        ssh_private_key_enc: body.ssh_private_key ? encryptSecret(String(body.ssh_private_key)) : null,
        custom_command: body.custom_command || null,
        pre_command: body.pre_command || null,
      });

      return NextResponse.json({ success: true, data: res, message: res.message });
    }

    const name = String(body.name || "").trim();
    const host = String(body.host || "").trim();
    const vendor = String(body.vendor || "mikrotik").toLowerCase();
    const protocol = body.protocol === "manual" ? "manual" : "ssh";
    const port = Math.min(65535, Math.max(1, parseInt(String(body.port || 22), 10) || 22));

    if (!name || !host) {
      return NextResponse.json(
        { success: false, error: "Nama perangkat dan IP / Hostname wajib diisi." },
        { status: 400 }
      );
    }

    if (isRestrictedNetworkTarget(host)) {
      return NextResponse.json(
        { success: false, error: "Akses host ditolak: Alamat IP link-local, cloud metadata, atau loopback diblokir demi keamanan." },
        { status: 400 }
      );
    }

    if (protocol === "ssh" && (!body.username || (!body.password && !body.ssh_private_key))) {
      return NextResponse.json(
        {
          success: false,
          error: "Untuk koneksi SSH otomatis, Username serta Password atau SSH Key wajib diisi.",
        },
        { status: 400 }
      );
    }

    const scheduleMode = String(body.schedule_mode || "global");
    const scheduleDays =
      scheduleMode === "global"
        ? null
        : resolveIntervalDays(scheduleMode, body.schedule_days);

    const retentionCount = Math.max(
      0,
      Math.min(365, parseInt(String(body.retention_count ?? 30), 10) || 0)
    );

    const created = await prisma.networkDevice.create({
      data: {
        name,
        host,
        port,
        vendor,
        platform: body.platform ? String(body.platform).trim() : null,
        protocol,
        username: body.username ? String(body.username).trim() : null,
        password_enc: body.password ? encryptSecret(String(body.password)) : null,
        enable_password_enc: body.enable_password
          ? encryptSecret(String(body.enable_password))
          : null,
        ssh_private_key_enc: body.ssh_private_key
          ? encryptSecret(String(body.ssh_private_key))
          : null,
        custom_command: body.custom_command ? String(body.custom_command).trim() : null,
        pre_command: body.pre_command ? String(body.pre_command).trim() : null,
        pop_site_id: body.pop_site_id ? String(body.pop_site_id) : null,
        auto_backup_enabled:
          protocol === "ssh" && body.auto_backup_enabled !== undefined
            ? Boolean(body.auto_backup_enabled)
            : protocol === "ssh",
        schedule_mode: scheduleMode,
        schedule_days: scheduleDays,
        schedule_time: body.schedule_time ? String(body.schedule_time).trim() : null,
        retention_count: retentionCount,
        gdrive_sync_enabled:
          body.gdrive_sync_enabled !== undefined ? Boolean(body.gdrive_sync_enabled) : true,
        created_by: auth.user.nama,
      },
      include: {
        pop_site: {
          select: { id: true, site_id: true, nama_perusahaan: true, nama_pic: true, ip_public: true },
        },
        _count: { select: { backups: true } },
      },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "CREATE_DEVICE",
      aktifitas: `Menambahkan perangkat backup config: ${created.name} (${created.vendor.toUpperCase()} - ${created.host})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    const globalSettings = await getBackupGlobalSettings();
    return NextResponse.json({
      success: true,
      message: `Perangkat '${created.name}' berhasil ditambahkan.`,
      data: serializeDeviceSafe(created, globalSettings),
    });
  } catch (err: any) {
    console.error("POST /api/backups/devices error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menambahkan perangkat backup." },
      { status: 500 }
    );
  }
}
