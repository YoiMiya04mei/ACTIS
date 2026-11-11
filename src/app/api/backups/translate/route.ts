import { NextRequest, NextResponse } from "next/server";
import JSZip from "jszip";
import { prisma } from "@/lib/prisma";
import { requireBackupAuth } from "@/lib/backupAuth";
import { saveManualOrUploadedBackup } from "@/lib/backupSchedulerService";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";
import {
  TARGET_VENDOR_META,
  SourceVendorFormat,
  TargetVendorFormat,
  translateNetworkConfig,
} from "@/lib/configTranslator";

export const runtime = "nodejs";

const ALLOWED_SOURCE_VENDORS = new Set<SourceVendorFormat>([
  "auto",
  "juniper_hier",
  "juniper_set",
  "mikrotik",
  "cisco_ios",
  "huawei_vrp",
  "vyos",
]);

function safeSlug(value: string): string {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || "router"
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireBackupAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json()) as {
      backupRecordId?: string;
      rawConfig?: string;
      sourceVendor?: SourceVendorFormat;
      targetVendor?: TargetVendorFormat;
      mode?: "single" | "zip_all";
      customHostname?: string;
      interfaceMap?: Record<string, string>;
      saveToDeviceId?: string;
      saveCommandNote?: string;
    };

    const mode = body.mode === "zip_all" ? "zip_all" : "single";
    const sourceVendor: SourceVendorFormat =
      body.sourceVendor && ALLOWED_SOURCE_VENDORS.has(body.sourceVendor)
        ? body.sourceVendor
        : "auto";

    const targetVendor = body.targetVendor || "mikrotik_v7";
    if (mode === "single" && !(targetVendor in TARGET_VENDOR_META)) {
      return NextResponse.json(
        { success: false, error: `Target vendor '${targetVendor}' tidak didukung.` },
        { status: 400 }
      );
    }

    const customHostname =
      typeof body.customHostname === "string" && body.customHostname.trim()
        ? body.customHostname.trim()
        : undefined;

    const interfaceMap =
      body.interfaceMap && typeof body.interfaceMap === "object"
        ? body.interfaceMap
        : undefined;

    let rawConfig = typeof body.rawConfig === "string" ? body.rawConfig : "";
    let sourceDeviceName = "";

    if (body.backupRecordId) {
      const record = await prisma.networkConfigBackup.findUnique({
        where: { id: body.backupRecordId },
        include: {
          device: {
            select: {
              id: true,
              name: true,
              vendor: true,
            },
          },
        },
      });

      if (!record) {
        return NextResponse.json(
          { success: false, error: "Snapshot backup sumber tidak ditemukan di database." },
          { status: 404 }
        );
      }

      sourceDeviceName = record.device?.name || "";
      if (!rawConfig.trim()) {
        rawConfig = record.config_content || "";
      }
    }

    if (!rawConfig.trim()) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Konfigurasi sumber kosong. Pilih snapshot backup atau unggah/tempel konfigurasi terlebih dahulu.",
        },
        { status: 400 }
      );
    }

    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "127.0.0.1";
    const ua = parseUserAgent(request.headers.get("user-agent"));

    if (mode === "zip_all") {
      const zip = new JSZip();
      const targetKeys = Object.keys(TARGET_VENDOR_META) as TargetVendorFormat[];
      const reportLines: string[] = [
        "====================================================================",
        "ACTIS MULTI-VENDOR BACKUP CONFIG TRANSLATOR REPORT",
        "====================================================================",
        `Generated At : ${new Date().toISOString()}`,
        `Operator     : ${auth.user.nama} (${auth.user.email})`,
        sourceDeviceName ? `Source Device: ${sourceDeviceName}` : "",
        "",
      ].filter(Boolean);

      let firstResult = null as ReturnType<typeof translateNetworkConfig> | null;

      for (const tv of targetKeys) {
        const res = translateNetworkConfig(rawConfig, {
          sourceVendor,
          targetVendor: tv,
          customHostname,
          interfaceMap,
        });
        if (!firstResult) {
          firstResult = res;
          reportLines.push(
            `Detected Source Vendor : ${res.sourceLabel}`,
            `Hostname               : ${res.ir.hostname}`,
            `Parsed Stats           : ${res.stats.interfaces} interface, ${res.stats.ipAddresses} IPv4, ${res.stats.vlans} VLAN, ${res.stats.staticRoutes} Static Route, ${res.stats.bgpNeighbors} BGP Peer, ${res.stats.ospfEntries} OSPF Interface`,
            "",
            "--- Catatan / Peringatan Parsing ---"
          );
          if (res.ir.warnings.length === 0) {
            reportLines.push("- Tidak ada warning parser.");
          } else {
            for (const w of res.ir.warnings) {
              reportLines.push(`- ${w}`);
            }
          }
          reportLines.push("", "--- File yang Dihasilkan di Bundle ZIP ---");
        }

        const entryPath = `${res.targetMeta.id}/${res.suggestedFileName}`;
        zip.file(entryPath, res.generatedConfig);
        reportLines.push(`- ${entryPath} (${res.targetMeta.label}, ${res.stats.outputLines} baris)`);
      }

      zip.file("CONVERSION_REPORT.txt", reportLines.join("\n"));

      const buffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const hostSlug = safeSlug(firstResult?.ir.hostname || sourceDeviceName || "config");
      const zipFileName = `${hostSlug}_multi_vendor_${new Date().toISOString().slice(0, 10)}.zip`;

      await recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: ipAddress,
        tipe: "BACKUP_MANUAL",
        aktifitas: `Generate bundle konfigurasi multi-vendor (${firstResult?.sourceLabel || "Auto"} -> ${targetKeys.length} vendor) untuk ${firstResult?.ir.hostname || hostSlug} — ${ua}`,
        user_agent: request.headers.get("user-agent"),
      });

      return new NextResponse(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/zip",
          "Content-Disposition": `attachment; filename="${zipFileName}"`,
        },
      });
    }

    const result = translateNetworkConfig(rawConfig, {
      sourceVendor,
      targetVendor,
      customHostname,
      interfaceMap,
    });

    let savedBackup: unknown = null;

    if (body.saveToDeviceId) {
      const targetDevice = await prisma.networkDevice.findUnique({
        where: { id: body.saveToDeviceId },
        select: { id: true, name: true, vendor: true },
      });

      if (!targetDevice) {
        return NextResponse.json(
          { success: false, error: "Perangkat tujuan tidak ditemukan di database." },
          { status: 404 }
        );
      }

      const commandUsed =
        body.saveCommandNote?.trim() ||
        `Auto-Generate Config (${result.sourceLabel} -> ${result.targetMeta.label})`;

      savedBackup = await saveManualOrUploadedBackup({
        deviceId: targetDevice.id,
        content: result.generatedConfig,
        triggeredBy: `${auth.user.nama} (Config Generator)`,
        backupType: "upload",
        commandUsed,
      });

      await recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: ipAddress,
        tipe: "BACKUP_MANUAL",
        aktifitas: `Generate & simpan config ${result.sourceLabel} -> ${result.targetMeta.label} ke perangkat ${targetDevice.name} — ${ua}`,
        user_agent: request.headers.get("user-agent"),
      });
    }

    return NextResponse.json({
      success: true,
      data: result,
      sourceDeviceName,
      savedBackup,
    });
  } catch (error) {
    console.error("POST /api/backups/translate error:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Gagal melakukan konversi konfigurasi antar vendor.",
      },
      { status: 500 }
    );
  }
}

