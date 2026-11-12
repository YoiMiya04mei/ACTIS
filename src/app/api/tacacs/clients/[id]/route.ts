import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encryptSecret, maskSecret } from "@/lib/backupCrypto";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { isValidIpOrCidr, normalizeIpAddress } from "@/lib/tacacs/policy";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.tacacsClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NAS Client tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name) {
        return NextResponse.json(
          { success: false, error: "Nama NAS Client tidak boleh kosong." },
          { status: 400 }
        );
      }
      updateData.name = name;
    }

    if (body.ip_or_cidr !== undefined) {
      const ip = normalizeIpAddress(body.ip_or_cidr);
      if (!isValidIpOrCidr(ip)) {
        return NextResponse.json(
          { success: false, error: "Format IP Address atau CIDR tidak valid." },
          { status: 400 }
        );
      }
      updateData.ip_or_cidr = ip;
    }

    if (body.vendor !== undefined) {
      updateData.vendor = String(body.vendor).trim().toLowerCase() || "custom";
    }

    if (typeof body.shared_secret === "string" && body.shared_secret.trim().length > 0) {
      if (body.shared_secret.trim().length < 4) {
        return NextResponse.json(
          { success: false, error: "Shared secret baru minimal 4 karakter." },
          { status: 400 }
        );
      }
      updateData.shared_secret_enc = encryptSecret(body.shared_secret.trim());
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? String(body.description).trim() : null;
    }

    const updated = await prisma.tacacsClient.update({
      where: { id },
      data: updateData,
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_CLIENT",
      aktifitas: `Memperbarui NAS Client TACACS+ '${updated.name}' (${updated.ip_or_cidr})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `NAS Client '${updated.name}' berhasil diperbarui.`,
      data: {
        id: updated.id,
        name: updated.name,
        ip_or_cidr: updated.ip_or_cidr,
        vendor: updated.vendor,
        shared_secret_masked: maskSecret(updated.shared_secret_enc),
        has_shared_secret: Boolean(updated.shared_secret_enc),
        network_device_id: updated.network_device_id,
        pop_site_id: updated.pop_site_id,
        is_active: updated.is_active,
        description: updated.description,
        last_seen_at: updated.last_seen_at,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (err: any) {
    console.error("PUT /api/tacacs/clients/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memperbarui NAS Client." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.tacacsClient.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "NAS Client tidak ditemukan." },
        { status: 404 }
      );
    }

    await prisma.tacacsClient.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_CLIENT",
      aktifitas: `Menghapus NAS Client TACACS+ '${existing.name}' (${existing.ip_or_cidr})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `NAS Client '${existing.name}' berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/tacacs/clients/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menghapus NAS Client." },
      { status: 500 }
    );
  }
}

