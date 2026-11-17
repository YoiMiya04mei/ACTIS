import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { getClientIp } from "@/lib/backupAuth";
import {
  copyBackupGDriveCredentialsToMirror,
  getInventoryMirrorLiveCounts,
  getInventoryMirrorPublicConfig,
  getInventoryMirrorSyncState,
  INVENTORY_MIRROR_APPS_SCRIPT_TEMPLATE,
  saveInventoryMirrorConfig,
  syncInventoryMirrorNow,
} from "@/lib/inventoryMirrorService";

function isInventoryMirrorOperator(role: string): boolean {
  return role === "admin" || role === "warehouse_admin";
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (!isInventoryMirrorOperator(auth.user.role)) {
    return NextResponse.json(
      {
        success: false,
        error: "Akses ditolak: Hanya Admin dan Warehouse Admin yang dapat mengakses Inventory Mirror.",
      },
      { status: 403 }
    );
  }

  try {
    const [config, state, counts] = await Promise.all([
      getInventoryMirrorPublicConfig(),
      getInventoryMirrorSyncState(),
      getInventoryMirrorLiveCounts(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        config,
        state,
        counts,
        appsScriptTemplate: INVENTORY_MIRROR_APPS_SCRIPT_TEMPLATE,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memuat konfigurasi Inventory Mirror." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  if (!isInventoryMirrorOperator(auth.user.role)) {
    return NextResponse.json(
      {
        success: false,
        error: "Akses ditolak: Anda tidak memiliki izin menjalankan Inventory Mirror.",
      },
      { status: 403 }
    );
  }

  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action || "sync_now";

    if (action === "sync_now") {
      const result = await syncInventoryMirrorNow({
        event: "FORCE_SYNC",
        triggeredBy: `${auth.user.nama} (Force Sync)`,
        forceEvenIfDisabled: true,
      });

      const status = result.status === "SUCCESS" ? 200 : 400;
      if (result.status === "SUCCESS") {
        recordActivity({
          nama_lengkap: auth.user.nama,
          email: auth.user.email,
          ip_address: getClientIp(request),
          tipe: "SHEETS_SYNC",
          aktifitas: "Melakukan Force Mirror database Inventory ke Google Drive / Sheets",
          detail: `${result.summary?.total_items || 0} SKU, ${result.summary?.total_transactions || 0} transaksi`,
          user_agent: parseUserAgent(request.headers.get("user-agent")),
        }).catch(() => {});
      }

      const [config, state] = await Promise.all([
        getInventoryMirrorPublicConfig(),
        getInventoryMirrorSyncState(),
      ]);

      return NextResponse.json(
        {
          success: result.status === "SUCCESS",
          message: result.message,
          error: result.status !== "SUCCESS" ? result.message : undefined,
          data: {
            result,
            config,
            state,
          },
        },
        { status }
      );
    }

    // All configuration mutations strictly require Super Administrator role
    if (auth.user.role !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Hanya Administrator yang dapat mengubah kredensial atau pengaturan Mirror.",
        },
        { status: 403 }
      );
    }

    if (action === "copy_backup_credentials") {
      const copied = await copyBackupGDriveCredentialsToMirror();
      recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: getClientIp(request),
        tipe: "SETTING_UPDATE",
        aktifitas: "Menyalin kredensial Google Drive dari Backup Config ke Inventory Mirror",
        detail: copied.copiedFields.join(", "),
        user_agent: parseUserAgent(request.headers.get("user-agent")),
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Berhasil menyalin: ${copied.copiedFields.join(", ")}.`,
        data: { config: copied.config },
      });
    }

    if (action === "save" || action === "test") {
      const saved = await saveInventoryMirrorConfig({
        enabled: action === "test" ? true : body.enabled,
        auto_sync: body.auto_sync,
        save_drive_backup: body.save_drive_backup,
        method: body.method,
        spreadsheet_id: body.spreadsheet_id,
        folder_id: body.folder_id,
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
          aktifitas: `Memperbarui konfigurasi Inventory Google Mirror (${saved.method}, ${saved.enabled ? "Aktif" : "Nonaktif"})`,
          user_agent: parseUserAgent(request.headers.get("user-agent")),
        }).catch(() => {});

        return NextResponse.json({
          success: true,
          message: "Pengaturan Mirror Google Drive / Sheets berhasil disimpan.",
          data: { config: saved },
        });
      }

      // action === "test"
      const syncRes = await syncInventoryMirrorNow({
        event: "SYNC_TEST",
        triggeredBy: `${auth.user.nama} (Tes Koneksi)`,
        forceEvenIfDisabled: true,
      });

      const [latestConfig, state] = await Promise.all([
        getInventoryMirrorPublicConfig(),
        getInventoryMirrorSyncState(),
      ]);

      if (syncRes.status !== "SUCCESS") {
        return NextResponse.json(
          {
            success: false,
            error: syncRes.message,
            data: { config: latestConfig, state },
          },
          { status: 400 }
        );
      }

      return NextResponse.json({
        success: true,
        message: syncRes.message,
        data: {
          result: syncRes,
          config: latestConfig,
          state,
        },
      });
    }

    return NextResponse.json({ success: false, error: "Action tidak valid." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memproses permintaan Inventory Mirror." },
      { status: 400 }
    );
  }
}
