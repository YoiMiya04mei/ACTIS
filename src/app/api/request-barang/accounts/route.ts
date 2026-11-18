import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getRequestClientIp, requireAuth } from "@/lib/security";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";
import {
  buildPortalSyntheticEmail,
  isValidUsername,
  normalizeUsername,
  syncLegacyRequestBarangUsersIfAny,
} from "@/lib/requestBarangAuth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    await syncLegacyRequestBarangUsersIfAny();

    const accounts = await prisma.requestBarangAccount.findMany({
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        username: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    return NextResponse.json({ success: true, data: accounts });
  } catch (err: any) {
    console.error("GET /api/request-barang/accounts error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat daftar akun Web /request-barang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { nama, username, password, is_active } = body;

    const cleanNama = String(nama ?? "").trim();
    const cleanUsername = normalizeUsername(username);
    const cleanPassword = String(password ?? "");

    if (!cleanNama || !cleanUsername || !cleanPassword) {
      return NextResponse.json(
        { success: false, error: "Nama lengkap, username, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (!isValidUsername(cleanUsername)) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Username harus 3–50 karakter (huruf, angka, titik, underscore _, atau strip -, tanpa @).",
        },
        { status: 400 }
      );
    }

    if (cleanPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal harus 8 karakter." },
        { status: 400 }
      );
    }

    const existing = await prisma.requestBarangAccount.findUnique({
      where: { username: cleanUsername },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        {
          success: false,
          error: `Username '@${cleanUsername}' sudah digunakan di portal /request-barang.`,
        },
        { status: 400 }
      );
    }

    const created = await prisma.requestBarangAccount.create({
      data: {
        nama: cleanNama,
        username: cleanUsername,
        password_hash: hashPassword(cleanPassword),
        is_active: typeof is_active === "boolean" ? is_active : true,
      },
      select: {
        id: true,
        nama: true,
        username: true,
        is_active: true,
        created_at: true,
        updated_at: true,
      },
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "CREATE_USER",
      aktifitas: `Menambahkan akun Web /request-barang: ${created.nama} (@${created.username})`,
      detail: `Portal terpisah /request-barang • Akun internal: ${buildPortalSyntheticEmail(created.username)}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Akun portal /request-barang '@${created.username}' berhasil dibuat.`,
      data: created,
    });
  } catch (err: any) {
    console.error("POST /api/request-barang/accounts error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan akun Web /request-barang." },
      { status: 500 }
    );
  }
}
