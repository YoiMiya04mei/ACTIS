import { NextRequest, NextResponse } from "next/server";
import {
  IpamScope,
  getIpamScopeMeta,
  getConfiguredPrefixes,
  saveConfiguredPrefixes,
  resetPrefixesToDefault,
} from "@/lib/ipamService";
import { parseCidr } from "@/lib/ipamUtils";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function handleGetPrefixes(request: NextRequest, scope: IpamScope) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const prefixes = await getConfiguredPrefixes(scope);
    return NextResponse.json({ success: true, data: prefixes });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch prefixes" },
      { status: 500 }
    );
  }
}

export async function handleCreatePrefix(request: NextRequest, scope: IpamScope) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const meta = getIpamScopeMeta(scope);

  try {
    const body = await request.json();
    const { cidr, description } = body;
    const example = scope === "private" ? "10.254.0.0/24 atau 1.1.1.0/24" : "103.155.196.0/23";

    if (!cidr || typeof cidr !== "string") {
      return NextResponse.json(
        { success: false, error: `CIDR ${meta.label} wajib diisi (contoh: ${example})` },
        { status: 400 }
      );
    }

    const parsed = parseCidr(cidr);
    if (!parsed) {
      return NextResponse.json(
        {
          success: false,
          error: `Format CIDR tidak valid. Pastikan format IP dan subnet benar (contoh: ${example})`,
        },
        { status: 400 }
      );
    }

    const current = await getConfiguredPrefixes(scope);
    const normalizedCidr = parsed.cidr;

    if (current.some((p) => p.cidr.toLowerCase() === normalizedCidr.toLowerCase())) {
      return NextResponse.json(
        { success: false, error: `Prefix ${normalizedCidr} sudah terdaftar dalam sistem.` },
        { status: 409 }
      );
    }

    const newPrefix = {
      id: `pfx-${scope}-${Date.now()}`,
      cidr: normalizedCidr,
      description: description?.trim() || `Prefix ${normalizedCidr}`,
      is_default: false,
      created_at: new Date().toISOString(),
    };

    const updated = [...current, newPrefix];
    await saveConfiguredPrefixes(scope, updated);

    const actorName = auth.user.nama;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Menambahkan alokasi ${meta.label} ${normalizedCidr}`,
      detail: description?.trim() || `Prefix ${normalizedCidr}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${meta.label} ${normalizedCidr} berhasil ditambahkan ke manajemen IPAM.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to add prefix" },
      { status: 500 }
    );
  }
}

export async function handleDeletePrefixRoute(request: NextRequest, scope: IpamScope) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const meta = getIpamScopeMeta(scope);

  try {
    const { searchParams } = new URL(request.url);
    const cidr = searchParams.get("cidr");

    if (!cidr) {
      return NextResponse.json(
        { success: false, error: "Parameter CIDR wajib disertakan." },
        { status: 400 }
      );
    }

    const current = await getConfiguredPrefixes(scope);
    const parsedTarget = parseCidr(cidr)?.cidr || cidr;
    const updated = current.filter(
      (p) =>
        p.cidr.toLowerCase() !== cidr.toLowerCase() &&
        p.cidr.toLowerCase() !== parsedTarget.toLowerCase()
    );

    if (updated.length === current.length) {
      return NextResponse.json(
        { success: false, error: `Prefix '${cidr}' tidak ditemukan.` },
        { status: 404 }
      );
    }

    await saveConfiguredPrefixes(scope, updated);

    const actorName = auth.user.nama;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Menghapus alokasi ${meta.label} ${cidr}`,
      detail: `Penghapusan subnet dari ${meta.label}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `${meta.label} ${cidr} berhasil dihapus dari manajemen IPAM.`,
      data: updated,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to delete prefix" },
      { status: 500 }
    );
  }
}

export async function handleResetPrefixesRoute(request: NextRequest, scope: IpamScope) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const meta = getIpamScopeMeta(scope);

  try {
    await resetPrefixesToDefault(scope);
    const defaults = await getConfiguredPrefixes(scope);

    const actorName = auth.user.nama;
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Mereset daftar alokasi ${meta.label} ke konfigurasi awal`,
      detail: meta.resetDetail,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: meta.resetMessage,
      data: defaults,
    });
  } catch (err: any) {
    return NextResponse.json(
      { success: false, error: err.message || "Failed to reset prefixes" },
      { status: 500 }
    );
  }
}
