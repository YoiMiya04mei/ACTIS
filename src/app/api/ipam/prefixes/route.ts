import { NextRequest, NextResponse } from "next/server";
import {
  getConfiguredPublicPrefixes,
  savePublicPrefixes,
  resetPublicPrefixesToDefault,
} from "@/lib/ipamService";
import { parseCidr } from "@/lib/ipamUtils";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const prefixes = await getConfiguredPublicPrefixes();
    return NextResponse.json({ success: true, data: prefixes });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch prefixes" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { cidr, description } = body;

    if (!cidr || typeof cidr !== "string") {
      return NextResponse.json(
        { success: false, error: "CIDR Prefix wajib diisi (contoh: 103.155.196.0/23)" },
        { status: 400 }
      );
    }

    const parsed = parseCidr(cidr);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: "Format CIDR tidak valid. Pastikan format IP dan subnet benar (contoh: 103.155.196.0/23)",
        },
        { status: 400 }
      );
    }

    const current = await getConfiguredPublicPrefixes();
    const normalizedCidr = parsed.cidr;

    if (current.some((p) => p.cidr.toLowerCase() === normalizedCidr.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Prefix ${normalizedCidr} sudah terdaftar dalam sistem.` },
        { status: 409 }
      );
    }

    const newPrefix = {
      id: `pfx-custom-${Date.now()}`,
      cidr: normalizedCidr,
      description: description?.trim() || `Prefix ${normalizedCidr}`,
      is_default: false,
      created_at: new Date().toISOString(),
    };

    const updated = [...current, newPrefix];
    await savePublicPrefixes(updated);

    // Catat ke Log Aplikasi
    const actorName = auth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Menambahkan alokasi Prefix IP Public ${normalizedCidr}`,
      detail: description?.trim() || `Prefix ${normalizedCidr}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Prefix ${normalizedCidr} berhasil ditambahkan ke manajemen IPAM.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add prefix" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const cidr = searchParams.get("cidr");

    if (!cidr) {
      return NextResponse.json(
        { success: false, error: "Parameter CIDR wajib disertakan." },
        { status: 400 }
      );
    }

    const current = await getConfiguredPublicPrefixes();
    const updated = current.filter((p) => p.cidr.toLowerCase() !== cidr.toLowerCase());

    if (updated.length === current.length) {
      return NextResponse.json(
        { success: false, error: `Prefix '${cidr}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    await savePublicPrefixes(updated);

    // Catat ke Log Aplikasi
    const actorName = auth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Menghapus alokasi Prefix IP Public ${cidr}`,
      detail: "Penghapusan subnet dari manajemen IPAM",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Prefix ${cidr} berhasil dihapus dari manajemen IPAM.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete prefix" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    await resetPublicPrefixesToDefault();
    const defaults = await getConfiguredPublicPrefixes();

    // Catat ke Log Aplikasi
    const actorName = auth.user.nama;
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: "Mereset daftar alokasi Prefix IP Public ke konfigurasi awal",
      detail: "Reset ke 5 default prefixes",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: "Seluruh Prefix IP Public berhasil direset ke daftar default 5 prefix utama.",
      data: defaults,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reset prefixes" },
      { status: 500 }
    );
  }
}
