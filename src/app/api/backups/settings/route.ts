import { NextRequest, NextResponse } from "next/server";
import { requireBackupAuth, getClientIp } from "@/lib/backupAuth";
import {
  getBackupGlobalSettings,
  saveBackupGlobalSettings,
} from "@/lib/backupSchedulerService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const settings = await getBackupGlobalSettings();
    return NextResponse.json({ success: true, data: settings });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat pengaturan jadwal backup." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const updated = await saveBackupGlobalSettings({
      auto_enabled: body.auto_enabled,
      default_schedule_mode: body.default_schedule_mode,
      default_interval_days: body.default_interval_days,
      window_start: body.window_start,
      window_end: body.window_end,
      default_retention_count: body.default_retention_count,
      only_save_if_changed: body.only_save_if_changed,
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "SETTING_UPDATE",
      aktifitas: `Memperbarui jadwal otomatis Network Backup (${updated.auto_enabled ? "Enabled" : "Disabled"}, setiap ${updated.default_interval_days} hari, ${updated.window_start}-${updated.window_end} WIB)`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Pengaturan jadwal otomatis backup berhasil diperbarui.",
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menyimpan pengaturan jadwal backup." },
      { status: 500 }
    );
  }
}

