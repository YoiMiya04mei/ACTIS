import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth } from "@/lib/backupAuth";
import { runBackupForDevice, saveManualOrUploadedBackup } from "@/lib/backupSchedulerService";
import { testDeviceSshConnection } from "@/lib/networkSshService";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = body.action || "pull";

    const device = await prisma.networkDevice.findUnique({ where: { id } });
    if (!device) {
      return NextResponse.json({ success: false, error: "Perangkat tidak ditemukan." }, { status: 404 });
    }

    if (action === "test_ssh") {
      const testRes = await testDeviceSshConnection(device);
      return NextResponse.json({
        success: true,
        message: testRes.message,
        data: testRes,
      });
    }

    if (action === "upload") {
      const content = String(body.content || "");
      if (!content.trim()) {
        return NextResponse.json(
          { success: false, error: "Isi konfigurasi backup tidak boleh kosong." },
          { status: 400 }
        );
      }

      const created = await saveManualOrUploadedBackup({
        deviceId: id,
        content,
        triggeredBy: auth.user.nama,
        backupType: "upload",
        commandUsed: body.command_used || "Manual Upload Snapshot",
      });

      return NextResponse.json({
        success: true,
        message: `Snapshot manual untuk '${device.name}' berhasil disimpan ke database${
          created.gdrive_status === "SYNCED" ? " & disinkronkan ke Google Drive" : ""
        }.`,
        data: created,
      });
    }

    // Default: live SSH pull ("Backup config now")
    const result = await runBackupForDevice(id, {
      backupType: "manual",
      triggeredBy: auth.user.nama,
    });

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error || "Gagal menarik konfigurasi via SSH.",
          data: result,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Backup konfigurasi '${result.deviceName}' berhasil (${result.backup?.line_count || 0} baris).`,
      data: result.backup,
    });
  } catch (err: any) {
    console.error("POST /api/backups/devices/[id]/run error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengeksekusi backup perangkat." },
      { status: 500 }
    );
  }
}

