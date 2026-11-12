import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret } from "@/lib/backupCrypto";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { isValidIpOrCidr, normalizeIpAddress } from "@/lib/tacacs/policy";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

function sanitizeClient(c: any) {
  return {
    id: c.id,
    name: c.name,
    ip_or_cidr: c.ip_or_cidr,
    vendor: c.vendor,
    shared_secret_masked: maskSecret(c.shared_secret_enc),
    has_shared_secret: Boolean(c.shared_secret_enc),
    network_device_id: c.network_device_id,
    pop_site_id: c.pop_site_id,
    is_active: c.is_active,
    description: c.description,
    last_seen_at: c.last_seen_at,
    created_at: c.created_at,
    updated_at: c.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const clients = await prisma.tacacsClient.findMany({
      orderBy: [{ name: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: clients.map(sanitizeClient),
    });
  } catch (err: any) {
    console.error("GET /api/tacacs/clients error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memuat daftar NAS Client." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    // Bulk import from existing ACTIS NetworkDevice inventory
    if (body?.action === "import_from_devices") {
      const sharedSecret = String(body.shared_secret || "").trim();
      if (!sharedSecret || sharedSecret.length < 4) {
        return NextResponse.json(
          { success: false, error: "Shared secret default wajib diisi minimal 4 karakter." },
          { status: 400 }
        );
      }

      const [devices, existingClients] = await Promise.all([
        prisma.networkDevice.findMany(),
        prisma.tacacsClient.findMany(),
      ]);

      const existingIps = new Set(existingClients.map((c) => normalizeIpAddress(c.ip_or_cidr)));
      let imported = 0;

      for (const dev of devices) {
        const hostIp = normalizeIpAddress(dev.host);
        if (!isValidIpOrCidr(hostIp)) continue;
        if (existingIps.has(hostIp)) continue;

        await prisma.tacacsClient.create({
          data: {
            name: dev.name,
            ip_or_cidr: hostIp,
            vendor: dev.vendor || "custom",
            shared_secret_enc: encryptSecret(sharedSecret)!,
            network_device_id: dev.id,
            pop_site_id: dev.pop_site_id,
            is_active: true,
            description: `Diimpor dari Backup Devices (${dev.platform || dev.vendor})`,
          },
        });
        existingIps.add(hostIp);
        imported++;
      }

      recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: getClientIp(request),
        tipe: "TACACS_CLIENT",
        aktifitas: `Mengimpor ${imported} perangkat dari Backup Devices ke TACACS+ NAS Clients`,
        user_agent: parseUserAgent(request.headers.get("user-agent")),
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message:
          imported > 0
            ? `${imported} perangkat jaringan berhasil diimpor sebagai NAS Client.`
            : "Tidak ada perangkat baru yang perlu diimpor (IP valid sudah terdaftar atau kosong).",
        imported,
      });
    }

    const name = String(body.name || "").trim();
    const ipOrCidr = normalizeIpAddress(body.ip_or_cidr);
    const sharedSecret = String(body.shared_secret || "").trim();
    const vendor = String(body.vendor || "cisco").trim().toLowerCase();

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama perangkat/NAS wajib diisi." },
        { status: 400 }
      );
    }

    if (!isValidIpOrCidr(ipOrCidr)) {
      return NextResponse.json(
        {
          success: false,
          error: "Format IP Address atau CIDR tidak valid (contoh: 10.10.1.1 atau 10.10.0.0/24).",
        },
        { status: 400 }
      );
    }

    if (!sharedSecret || sharedSecret.length < 4) {
      return NextResponse.json(
        { success: false, error: "Shared secret wajib diisi minimal 4 karakter." },
        { status: 400 }
      );
    }

    const created = await prisma.tacacsClient.create({
      data: {
        name,
        ip_or_cidr: ipOrCidr,
        vendor,
        shared_secret_enc: encryptSecret(sharedSecret)!,
        network_device_id: body.network_device_id || null,
        pop_site_id: body.pop_site_id || null,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        description: body.description ? String(body.description).trim() : null,
      },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_CLIENT",
      aktifitas: `Menambahkan NAS Client TACACS+ '${created.name}' (${created.ip_or_cidr})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: `NAS Client '${created.name}' berhasil ditambahkan.`,
        data: sanitizeClient(created),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/tacacs/clients error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menambahkan NAS Client." },
      { status: 500 }
    );
  }
}

