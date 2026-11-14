import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredVlanRanges,
  getConfiguredServerList,
  saveVlanRanges,
} from "@/lib/vlanService";
import { MIN_VLAN_ID, MAX_VLAN_ID, normalizeServerKey } from "@/lib/vlanUtils";
import { prisma } from "@/lib/prisma";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const configs = await getConfiguredVlanRanges();
    return NextResponse.json({ success: true, data: configs });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengambil konfigurasi range VLAN." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const rawServerName = typeof body.serverName === "string" ? body.serverName.trim().replace(/\s+/g, " ") : "";
    const startVlan = parseInt(String(body.startVlan ?? MIN_VLAN_ID), 10);
    const endVlan = parseInt(String(body.endVlan ?? MAX_VLAN_ID), 10);
    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (!rawServerName) {
      return NextResponse.json(
        { success: false, error: "Nama Server wajib diisi." },
        { status: 400 }
      );
    }

    if (
      isNaN(startVlan) ||
      isNaN(endVlan) ||
      startVlan < MIN_VLAN_ID ||
      endVlan > MAX_VLAN_ID ||
      startVlan > endVlan
    ) {
      return NextResponse.json(
        {
          success: false,
          error: `Range VLAN tidak valid. Rentang harus berada di antara ${MIN_VLAN_ID} hingga ${MAX_VLAN_ID} (VLAN Awal <= VLAN Akhir).`,
        },
        { status: 400 }
      );
    }

    // Ensure server also exists in unified server_options if new
    const existingServers = await getConfiguredServerList();
    const key = normalizeServerKey(rawServerName);
    if (!existingServers.some((s) => normalizeServerKey(s) === key)) {
      const updatedServerOptions = [...existingServers, rawServerName];
      await prisma.systemSetting.upsert({
        where: { key: "server_options" },
        update: { value: JSON.stringify(updatedServerOptions) },
        create: { key: "server_options", value: JSON.stringify(updatedServerOptions) },
      });
    }

    const currentConfigs = await getConfiguredVlanRanges();
    const filtered = currentConfigs.filter(
      (c) => normalizeServerKey(c.serverName) !== key
    );
    const updatedConfigs = [
      ...filtered,
      {
        serverName: rawServerName,
        startVlan,
        endVlan,
        description: description || `Range VLAN ${startVlan}-${endVlan}`,
      },
    ];

    await saveVlanRanges(updatedConfigs);

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Mengatur range VLAN Management server ${rawServerName} (${startVlan}-${endVlan})`,
      detail: description || `Range VLAN ${startVlan}-${endVlan}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Konfigurasi VLAN server '${rawServerName}' (${startVlan} - ${endVlan}) berhasil disimpan.`,
      data: updatedConfigs,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menyimpan range VLAN server." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const serverName = searchParams.get("serverName");
    if (!serverName) {
      return NextResponse.json(
        { success: false, error: "Parameter serverName wajib disertakan." },
        { status: 400 }
      );
    }

    const key = normalizeServerKey(serverName);
    const currentConfigs = await getConfiguredVlanRanges();
    const updated = currentConfigs.filter(
      (c) => normalizeServerKey(c.serverName) !== key
    );

    if (updated.length === currentConfigs.length) {
      return NextResponse.json(
        { success: false, error: `Konfigurasi custom server '${serverName}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    await saveVlanRanges(updated);

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Mereset range VLAN custom server ${serverName} ke default (1-4094)`,
      detail: "Reset custom VLAN pool server",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Range VLAN server '${serverName}' dikembalikan ke standar 1 - 4094.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mereset range VLAN server." },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    await saveVlanRanges([]);

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: "Mereset seluruh custom range VLAN server ke standar IEEE 802.1Q (1-4094)",
      detail: "Reset semua vlan_server_configs",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Seluruh range VLAN server dikembalikan ke pool default (1 - 4094).",
      data: [],
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mereset range VLAN." },
      { status: 500 }
    );
  }
}
