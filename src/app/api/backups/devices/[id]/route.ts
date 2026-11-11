import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth, getClientIp } from "@/lib/backupAuth";
import { encryptSecret } from "@/lib/backupCrypto";
import { resolveIntervalDays } from "@/lib/backupVendorProfiles";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { serializeDeviceSafe } from "@/lib/backupSerializer";
import { getBackupGlobalSettings } from "@/lib/backupSchedulerService";

function resolveSecretUpdate(incoming: unknown, existing: string | null): string | null {
  if (incoming === undefined) return existing;
  if (incoming === null) return existing;
  const text = String(incoming);
  if (!text.trim()) return existing;
  if (text.includes("••••")) return existing;
  return encryptSecret(text);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.networkDevice.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Perangkat tidak ditemukan." }, { status: 404 });
    }

    const body = await request.json();
    const scheduleMode =
      body.schedule_mode !== undefined ? String(body.schedule_mode) : existing.schedule_mode;
    const scheduleDays =
      scheduleMode === "global"
        ? null
        : resolveIntervalDays(
            scheduleMode,
            body.schedule_days !== undefined ? body.schedule_days : existing.schedule_days
          );

    const protocol = body.protocol !== undefined ? (body.protocol === "manual" ? "manual" : "ssh") : existing.protocol;

    const updated = await prisma.networkDevice.update({
      where: { id },
      data: {
        name: body.name !== undefined ? String(body.name).trim() : existing.name,
        host: body.host !== undefined ? String(body.host).trim() : existing.host,
        port:
          body.port !== undefined
            ? Math.min(65535, Math.max(1, parseInt(String(body.port), 10) || 22))
            : existing.port,
        vendor: body.vendor !== undefined ? String(body.vendor).toLowerCase() : existing.vendor,
        platform: body.platform !== undefined ? (body.platform ? String(body.platform).trim() : null) : existing.platform,
        protocol,
        username: body.username !== undefined ? (body.username ? String(body.username).trim() : null) : existing.username,
        password_enc: body.clear_password
          ? null
          : resolveSecretUpdate(body.password, existing.password_enc),
        enable_password_enc: body.clear_enable_password
          ? null
          : resolveSecretUpdate(body.enable_password, existing.enable_password_enc),
        ssh_private_key_enc: body.clear_ssh_private_key
          ? null
          : resolveSecretUpdate(body.ssh_private_key, existing.ssh_private_key_enc),
        custom_command:
          body.custom_command !== undefined
            ? body.custom_command
              ? String(body.custom_command).trim()
              : null
            : existing.custom_command,
        pre_command:
          body.pre_command !== undefined
            ? body.pre_command
              ? String(body.pre_command).trim()
              : null
            : existing.pre_command,
        pop_site_id:
          body.pop_site_id !== undefined ? (body.pop_site_id ? String(body.pop_site_id) : null) : existing.pop_site_id,
        auto_backup_enabled:
          protocol === "manual"
            ? false
            : body.auto_backup_enabled !== undefined
              ? Boolean(body.auto_backup_enabled)
              : existing.auto_backup_enabled,
        schedule_mode: scheduleMode,
        schedule_days: scheduleDays,
        schedule_time:
          body.schedule_time !== undefined
            ? body.schedule_time
              ? String(body.schedule_time).trim()
              : null
            : existing.schedule_time,
        retention_count:
          body.retention_count !== undefined
            ? Math.max(0, Math.min(365, parseInt(String(body.retention_count), 10) || 0))
            : existing.retention_count,
        gdrive_sync_enabled:
          body.gdrive_sync_enabled !== undefined
            ? Boolean(body.gdrive_sync_enabled)
            : existing.gdrive_sync_enabled,
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
      tipe: "UPDATE_DATA",
      aktifitas: `Memperbarui pengaturan perangkat backup: ${updated.name} (${updated.host})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    const globalSettings = await getBackupGlobalSettings();
    return NextResponse.json({
      success: true,
      message: `Konfigurasi perangkat '${updated.name}' berhasil diperbarui.`,
      data: serializeDeviceSafe(updated, globalSettings),
    });
  } catch (err: any) {
    console.error("PATCH /api/backups/devices/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memperbarui perangkat." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.networkDevice.findUnique({
      where: { id },
      select: { id: true, name: true, host: true },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Perangkat tidak ditemukan." }, { status: 404 });
    }

    await prisma.networkDevice.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "DELETE_DATA",
      aktifitas: `Menghapus perangkat backup beserta riwayatnya: ${existing.name} (${existing.host})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Perangkat '${existing.name}' dan seluruh riwayat backup-nya berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/backups/devices/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menghapus perangkat." },
      { status: 500 }
    );
  }
}
