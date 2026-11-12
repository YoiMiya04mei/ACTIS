import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { encryptSecret } from "@/lib/backupCrypto";
import { requireTacacsAuth } from "@/lib/tacacs/auth";
import { getClientIp } from "@/lib/backupAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

function sanitizeUser(u: any) {
  return {
    id: u.id,
    username: u.username,
    full_name: u.full_name,
    privilege_level: u.privilege_level,
    effective_privilege: u.privilege_level ?? u.group?.privilege_level ?? 1,
    group_id: u.group_id,
    group: u.group
      ? { id: u.group.id, name: u.group.name, privilege_level: u.group.privilege_level }
      : null,
    has_enable_password: Boolean(u.enable_password_hash),
    has_chap_secret: Boolean(u.chap_secret_enc),
    is_active: u.is_active,
    expires_at: u.expires_at,
    last_login_at: u.last_login_at,
    last_login_ip: u.last_login_ip,
    notes: u.notes,
    created_by: u.created_by,
    created_at: u.created_at,
    updated_at: u.updated_at,
  };
}

export async function GET(request: NextRequest) {
  const auth = await requireTacacsAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const users = await prisma.tacacsUser.findMany({
      include: { group: true },
      orderBy: [{ username: "asc" }],
    });

    return NextResponse.json({
      success: true,
      data: users.map(sanitizeUser),
    });
  } catch (err: any) {
    console.error("GET /api/tacacs/users error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal mengambil daftar user TACACS+." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireTacacsAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    if (!username || !/^[a-zA-Z0-9._@-]{2,64}$/.test(username)) {
      return NextResponse.json(
        {
          success: false,
          error: "Username wajib 2-64 karakter (huruf, angka, titik, underscore, strip, atau @).",
        },
        { status: 400 }
      );
    }

    if (!password || password.length < 4) {
      return NextResponse.json(
        { success: false, error: "Password TACACS+ minimal 4 karakter." },
        { status: 400 }
      );
    }

    const existing = await prisma.tacacsUser.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Username '${username}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    let privLevel: number | null = null;
    if (body.privilege_level !== undefined && body.privilege_level !== null && body.privilege_level !== "") {
      const p = Number(body.privilege_level);
      if (!Number.isInteger(p) || p < 0 || p > 15) {
        return NextResponse.json(
          { success: false, error: "Privilege level harus antara 0 hingga 15." },
          { status: 400 }
        );
      }
      privLevel = p;
    }

    const expiresAt =
      body.expires_at && String(body.expires_at).trim() !== ""
        ? new Date(String(body.expires_at))
        : null;
    if (expiresAt && Number.isNaN(expiresAt.getTime())) {
      return NextResponse.json(
        { success: false, error: "Format tanggal kedaluwarsa tidak valid." },
        { status: 400 }
      );
    }

    const enablePassword =
      typeof body.enable_password === "string" && body.enable_password.length > 0
        ? hashPassword(body.enable_password)
        : null;

    const created = await prisma.tacacsUser.create({
      data: {
        username,
        full_name: body.full_name ? String(body.full_name).trim() : null,
        password_hash: hashPassword(password),
        chap_secret_enc: encryptSecret(password),
        enable_password_hash: enablePassword,
        privilege_level: privLevel,
        group_id: body.group_id || null,
        is_active: body.is_active !== undefined ? Boolean(body.is_active) : true,
        expires_at: expiresAt,
        notes: body.notes ? String(body.notes).trim() : null,
        created_by: auth.user.nama,
      },
      include: { group: true },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: getClientIp(request),
      tipe: "TACACS_USER",
      aktifitas: `Menambahkan user TACACS+ '${created.username}'`,
      detail: `Group: ${created.group?.name || "-"}, Privilege: ${created.privilege_level ?? created.group?.privilege_level ?? 1}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: `User TACACS+ '${created.username}' berhasil dibuat.`,
        data: sanitizeUser(created),
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/tacacs/users error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal membuat user TACACS+." },
      { status: 500 }
    );
  }
}

