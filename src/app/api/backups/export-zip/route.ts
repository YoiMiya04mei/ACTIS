import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth } from "@/lib/backupAuth";
import { buildBackupFileName } from "@/lib/backupVendorProfiles";

export async function GET(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const deviceId = searchParams.get("deviceId");

    const devices = await prisma.networkDevice.findMany({
      where: deviceId && deviceId !== "ALL" ? { id: deviceId } : undefined,
      orderBy: { name: "asc" },
      include: {
        backups: {
          where: { status: "SUCCESS" },
          orderBy: { created_at: "desc" },
          take: 1,
        },
      },
    });

    const zip = new JSZip();
    let count = 0;

    for (const dev of devices) {
      const latest = dev.backups[0];
      if (!latest || !latest.config_content) continue;
      const folderName = `${dev.vendor.toUpperCase()}_${dev.name.replace(/[^a-zA-Z0-9._-]+/g, "-")}`;
      const fileName = buildBackupFileName(dev.name, dev.vendor, latest.created_at);
      zip.file(`${folderName}/${fileName}`, latest.config_content);
      count++;
    }

    if (count === 0) {
      return NextResponse.json(
        { success: false, error: "Belum ada backup konfigurasi sukses yang dapat diekspor." },
        { status: 404 }
      );
    }

    const buffer = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
    const stamp = new Date().toISOString().slice(0, 10);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="ACTIS_Network_Configs_${stamp}.zip"`,
      },
    });
  } catch (err: any) {
    console.error("GET /api/backups/export-zip error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal membuat arsip ZIP konfigurasi." },
      { status: 500 }
    );
  }
}

