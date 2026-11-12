import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { parseCommandRules, parseServiceAttrs } from "@/lib/tacacs/policy";
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
    const existing = await prisma.tacacsGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Grup TACACS+ tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.name !== undefined) {
      const name = String(body.name).trim();
      if (!name || !/^[a-zA-Z0-9._-]{2,64}$/.test(name)) {
        return NextResponse.json(
          { success: false, error: "Format nama grup tidak valid." },
          { status: 400 }
        );
      }
      if (name !== existing.name) {
        const dup = await prisma.tacacsGroup.findUnique({ where: { name } });
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Nama grup '${name}' sudah digunakan.` },
            { status: 409 }
          );
        }
      }
      updateData.name = name;
    }

    if (body.description !== undefined) {
      updateData.description = body.description ? String(body.description).trim() : null;
    }

    if (body.privilege_level !== undefined) {
      const priv = Number(body.privilege_level);
      if (!Number.isInteger(priv) || priv < 0 || priv > 15) {
        return NextResponse.json(
          { success: false, error: "Privilege level harus antara 0 hingga 15." },
          { status: 400 }
        );
      }
      updateData.privilege_level = priv;
    }

    if (body.default_policy !== undefined) {
      updateData.default_policy = body.default_policy === "permit" ? "permit" : "deny";
    }

    if (Array.isArray(body.command_rules)) {
      updateData.command_rules = JSON.stringify(body.command_rules);
    }

    if (Array.isArray(body.service_attrs)) {
      updateData.service_attrs = JSON.stringify(body.service_attrs);
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    const updated = await prisma.tacacsGroup.update({
      where: { id },
      data: updateData,
      include: { _count: { select: { users: true } } },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_GROUP",
      aktifitas: `Memperbarui grup TACACS+ '${updated.name}'`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Grup '${updated.name}' berhasil diperbarui.`,
      data: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        privilege_level: updated.privilege_level,
        default_policy: updated.default_policy,
        command_rules: parseCommandRules(updated.command_rules),
        service_attrs: parseServiceAttrs(updated.service_attrs),
        is_active: updated.is_active,
        user_count: updated._count?.users ?? 0,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (err: any) {
    console.error("PUT /api/tacacs/groups/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memperbarui grup TACACS+." },
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
    const existing = await prisma.tacacsGroup.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Grup TACACS+ tidak ditemukan." },
        { status: 404 }
      );
    }

    await prisma.tacacsGroup.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_GROUP",
      aktifitas: `Menghapus grup TACACS+ '${existing.name}'`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Grup '${existing.name}' berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/tacacs/groups/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menghapus grup TACACS+." },
      { status: 500 }
    );
  }
}

