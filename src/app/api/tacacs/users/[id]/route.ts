import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { encryptSecret } from "@/lib/backupCrypto";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
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
    const existing = await prisma.tacacsUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "User TACACS+ tidak ditemukan." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const updateData: any = {};

    if (body.username !== undefined) {
      const username = String(body.username).trim();
      if (!username || !/^[a-zA-Z0-9._@-]{2,64}$/.test(username)) {
        return NextResponse.json(
          { success: false, error: "Format username tidak valid." },
          { status: 400 }
        );
      }
      if (username !== existing.username) {
        const dup = await prisma.tacacsUser.findUnique({ where: { username } });
        if (dup) {
          return NextResponse.json(
            { success: false, error: `Username '${username}' sudah digunakan.` },
            { status: 409 }
          );
        }
      }
      updateData.username = username;
    }

    if (body.full_name !== undefined) {
      updateData.full_name = body.full_name ? String(body.full_name).trim() : null;
    }

    if (typeof body.password === "string" && body.password.length > 0) {
      if (body.password.length < 4) {
        return NextResponse.json(
          { success: false, error: "Password baru minimal 4 karakter." },
          { status: 400 }
        );
      }
      updateData.password_hash = hashPassword(body.password);
      updateData.chap_secret_enc = encryptSecret(body.password);
    }

    if (body.clear_enable_password) {
      updateData.enable_password_hash = null;
    } else if (typeof body.enable_password === "string" && body.enable_password.length > 0) {
      updateData.enable_password_hash = hashPassword(body.enable_password);
    }

    if (body.privilege_level !== undefined) {
      if (body.privilege_level === null || body.privilege_level === "") {
        updateData.privilege_level = null;
      } else {
        const p = Number(body.privilege_level);
        if (!Number.isInteger(p) || p < 0 || p > 15) {
          return NextResponse.json(
            { success: false, error: "Privilege level harus antara 0 hingga 15." },
            { status: 400 }
          );
        }
        updateData.privilege_level = p;
      }
    }

    if (body.group_id !== undefined) {
      updateData.group_id = body.group_id || null;
    }

    if (body.is_active !== undefined) {
      updateData.is_active = Boolean(body.is_active);
    }

    if (body.expires_at !== undefined) {
      if (!body.expires_at || String(body.expires_at).trim() === "") {
        updateData.expires_at = null;
      } else {
        const d = new Date(String(body.expires_at));
        if (Number.isNaN(d.getTime())) {
          return NextResponse.json(
            { success: false, error: "Format tanggal kedaluwarsa tidak valid." },
            { status: 400 }
          );
        }
        updateData.expires_at = d;
      }
    }

    if (body.notes !== undefined) {
      updateData.notes = body.notes ? String(body.notes).trim() : null;
    }

    const updated = await prisma.tacacsUser.update({
      where: { id },
      data: updateData,
      include: { group: true },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_USER",
      aktifitas: `Memperbarui user TACACS+ '${updated.username}'`,
      detail: `Active=${updated.is_active}, Group=${updated.group?.name || "-"}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `User '${updated.username}' berhasil diperbarui.`,
      data: {
        id: updated.id,
        username: updated.username,
        full_name: updated.full_name,
        privilege_level: updated.privilege_level,
        effective_privilege: updated.privilege_level ?? updated.group?.privilege_level ?? 1,
        group_id: updated.group_id,
        group: updated.group
          ? {
              id: updated.group.id,
              name: updated.group.name,
              privilege_level: updated.group.privilege_level,
            }
          : null,
        has_enable_password: Boolean(updated.enable_password_hash),
        has_chap_secret: Boolean(updated.chap_secret_enc),
        is_active: updated.is_active,
        expires_at: updated.expires_at,
        last_login_at: updated.last_login_at,
        last_login_ip: updated.last_login_ip,
        notes: updated.notes,
        created_at: updated.created_at,
        updated_at: updated.updated_at,
      },
    });
  } catch (err: any) {
    console.error("PUT /api/tacacs/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memperbarui user TACACS+." },
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
    const existing = await prisma.tacacsUser.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "User TACACS+ tidak ditemukan." },
        { status: 404 }
      );
    }

    await prisma.tacacsUser.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_USER",
      aktifitas: `Menghapus user TACACS+ '${existing.username}'`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `User '${existing.username}' berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/tacacs/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal menghapus user TACACS+." },
      { status: 500 }
    );
  }
}

