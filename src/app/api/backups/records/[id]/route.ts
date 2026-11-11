import { NextRequest, NextResponse } from "next/server";
import { diffLines } from "diff";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth, getClientIp } from "@/lib/backupAuth";
import { syncBackupRecordToGDrive } from "@/lib/gdriveSyncService";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const { searchParams } = new URL(request.url);
    const compareWith = searchParams.get("compareWith");

    const record = await prisma.networkConfigBackup.findUnique({
      where: { id },
      include: {
        device: {
          select: { id: true, name: true, host: true, vendor: true, platform: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json({ success: false, error: "Data backup tidak ditemukan." }, { status: 404 });
    }

    let comparison: any = null;
    if (compareWith) {
      const targetRecord =
        compareWith === "prev"
          ? await prisma.networkConfigBackup.findFirst({
              where: {
                device_id: record.device_id,
                status: "SUCCESS",
                created_at: { lt: record.created_at },
              },
              orderBy: { created_at: "desc" },
              select: {
                id: true,
                created_at: true,
                line_count: true,
                size_bytes: true,
                backup_type: true,
                config_content: true,
              },
            })
          : await prisma.networkConfigBackup.findUnique({
              where: { id: compareWith },
              select: {
                id: true,
                created_at: true,
                line_count: true,
                size_bytes: true,
                backup_type: true,
                config_content: true,
              },
            });

      if (targetRecord && record.status === "SUCCESS") {
        const parts = diffLines(targetRecord.config_content || "", record.config_content || "");
        let added = 0;
        let removed = 0;
        const hunks = parts.map((p) => {
          const count = p.count || 0;
          if (p.added) added += count;
          else if (p.removed) removed += count;
          return {
            value: p.value,
            added: Boolean(p.added),
            removed: Boolean(p.removed),
            count,
          };
        });

        comparison = {
          baseBackup: {
            id: targetRecord.id,
            created_at: targetRecord.created_at,
            line_count: targetRecord.line_count,
            size_bytes: targetRecord.size_bytes,
            backup_type: targetRecord.backup_type,
          },
          added,
          removed,
          identical: added === 0 && removed === 0,
          hunks,
        };
      }
    }

    const siblingBackups = await prisma.networkConfigBackup.findMany({
      where: { device_id: record.device_id, status: "SUCCESS" },
      orderBy: { created_at: "desc" },
      take: 40,
      select: {
        id: true,
        created_at: true,
        line_count: true,
        size_bytes: true,
        backup_type: true,
        changed_from_prev: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: { backup: record, comparison, siblingBackups },
    });
  } catch (err: any) {
    console.error("GET /api/backups/records/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat detail backup." },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    if (body.action === "sync_gdrive") {
      const syncRes = await syncBackupRecordToGDrive(id);
      if (syncRes.result.status === "FAILED") {
        return NextResponse.json(
          { success: false, error: syncRes.result.error || "Sinkronisasi Google Drive gagal.", data: syncRes.backup },
          { status: 500 }
        );
      }
      if (syncRes.result.status === "SKIPPED") {
        return NextResponse.json(
          { success: false, error: "Sinkronisasi Google Drive sedang dinonaktifkan pada pengaturan GDrive." },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        message: "File konfigurasi berhasil disinkronkan ke Google Drive.",
        data: syncRes.backup,
      });
    }

    return NextResponse.json({ success: false, error: "Action tidak dikenal." }, { status: 400 });
  } catch (err: any) {
    console.error("POST /api/backups/records/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memproses aksi record backup." },
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
    const existing = await prisma.networkConfigBackup.findUnique({
      where: { id },
      include: { device: { select: { name: true } } },
    });

    if (!existing) {
      return NextResponse.json({ success: false, error: "Data backup tidak ditemukan." }, { status: 404 });
    }

    await prisma.networkConfigBackup.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "DELETE_DATA",
      aktifitas: `Menghapus snapshot backup config: ${existing.device.name}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Snapshot backup berhasil dihapus dari database.",
    });
  } catch (err: any) {
    console.error("DELETE /api/backups/records/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menghapus data backup." },
      { status: 500 }
    );
  }
}

