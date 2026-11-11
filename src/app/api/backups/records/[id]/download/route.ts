import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth } from "@/lib/backupAuth";
import { buildBackupFileName } from "@/lib/backupVendorProfiles";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const record = await prisma.networkConfigBackup.findUnique({
      where: { id },
      include: {
        device: {
          select: { name: true, vendor: true },
        },
      },
    });

    if (!record || record.status !== "SUCCESS") {
      return NextResponse.json(
        { success: false, error: "File konfigurasi tidak ditemukan." },
        { status: 404 }
      );
    }

    const fileName = buildBackupFileName(record.device.name, record.device.vendor, record.created_at);

    return new NextResponse(record.config_content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/backups/records/[id]/download error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengunduh file konfigurasi." },
      { status: 500 }
    );
  }
}

