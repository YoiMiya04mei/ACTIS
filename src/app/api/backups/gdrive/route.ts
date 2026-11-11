import { NextRequest, NextResponse } from "next/server";
import { requireBackupAuth, getClientIp } from "@/lib/backupAuth";
import {
  APPS_SCRIPT_DRIVE_TEMPLATE,
  getGDrivePublicConfig,
  saveGDriveConfig,
  uploadBackupToGDrive,
} from "@/lib/gdriveSyncService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(request: NextRequest) {
  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const config = await getGDrivePublicConfig();
    return NextResponse.json({
      success: true,
      data: config,
      appsScriptTemplate: APPS_SCRIPT_DRIVE_TEMPLATE,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat konfigurasi Google Drive." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const action = body.action || "save";

    // Always persist incoming settings when provided (so test uses latest fields if requested)
    if (action === "save" || action === "test") {
      const saved = await saveGDriveConfig({
        enabled: action === "test" ? true : body.enabled,
        method: body.method,
        folder_id: body.folder_id,
        folder_per_device: body.folder_per_device,
        apps_script_url: body.apps_script_url,
        apps_script_secret: body.apps_script_secret,
        clear_apps_script_secret: body.clear_apps_script_secret,
        oauth_client_id: body.oauth_client_id,
        oauth_client_secret: body.oauth_client_secret,
        oauth_refresh_token: body.oauth_refresh_token,
        sa_client_email: body.sa_client_email,
        sa_private_key: body.sa_private_key,
      });

      if (action === "save") {
        recordActivity({
          nama_lengkap: auth.user.nama,
          email: auth.user.email,
          ip_address: getClientIp(request),
          tipe: "SETTING_UPDATE",
          aktifitas: `Memperbarui konfigurasi Google Drive Sync (${saved.method}, ${saved.enabled ? "Aktif" : "Nonaktif"})`,
          user_agent: parseUserAgent(request.headers.get("user-agent")),
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          message: "Konfigurasi Google Drive berhasil disimpan.",
          data: saved,
        });
      }

      // action === "test"
      const now = new Date();
      const testContent = [
        "# ACTIS Google Drive Sync Connection Test",
        `# Timestamp: ${now.toISOString()}`,
        `# Triggered By: ${auth.user.nama}`,
        `# Method: ${saved.method}`,
        "# Status: OK",
      ].join("\n");

      const uploadRes = await uploadBackupToGDrive({
        deviceName: "ACTIS-TEST-DEVICE",
        vendor: "mikrotik",
        host: "127.0.0.1",
        content: testContent,
        createdAt: now,
        lineCount: 5,
        sizeBytes: Buffer.byteLength(testContent, "utf8"),
        fileName: `ACTIS_GDrive_Test_${now.toISOString().replace(/[:.]/g, "-")}.txt`,
      });

      if (uploadRes.status !== "SYNCED") {
        return NextResponse.json(
          {
            success: false,
            error: uploadRes.error || "Tes unggah ke Google Drive gagal.",
            data: saved,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        message: "Tes upload file ke Google Drive berhasil!",
        data: {
          config: saved,
          fileId: uploadRes.fileId,
          fileUrl: uploadRes.fileUrl,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Action tidak valid." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/backups/gdrive error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses konfigurasi Google Drive." },
      { status: 500 }
    );
  }
}

