import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAuth, getRequestClientIp } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  REQUEST_BARANG_ROLE,
} from "@/lib/requestBarangAuth";
import { isValidDashboardRole } from "@/lib/accessLevelsStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const users = await prisma.user.findMany({
      where: {
        AND: [
          { email: { not: "system.archived@actis.internal" } },
          { role: { not: REQUEST_BARANG_ROLE } },
        ],
      },
      orderBy: { nama: "asc" },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    return NextResponse.json({ success: true, data: users });
  } catch (err: any) {
    console.error("GET /api/users error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat daftar pengguna ACTIS." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Strict authorization: ONLY Administrator can create ACTIS dashboard users
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { nama, email, password, role } = body;

    if (role === REQUEST_BARANG_ROLE) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Pembuatan akun portal /request-barang dipisahkan. Gunakan panel Akun Login Web Request Barang.",
        },
        { status: 400 }
      );
    }

    const cleanRole = String(role || "noc_engineer").trim().toLowerCase();
    const roleAllowed = await isValidDashboardRole(cleanRole);
    if (!roleAllowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Level akses '${role}' tidak valid atau tidak terdaftar di Level Akses.`,
        },
        { status: 400 }
      );
    }
    const targetRole = cleanRole;
    const cleanEmail = String(email || "").trim().toLowerCase();

    if (!nama || !cleanEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Nama lengkap, email kantor, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal harus 8 karakter." },
        { status: 400 }
      );
    }

    if (cleanEmail === "system.archived@actis.internal") {
      return NextResponse.json(
        { success: false, error: "Email ini dicadangkan untuk keperluan arsip sistem internal." },
        { status: 400 }
      );
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(cleanEmail)) {
      return NextResponse.json(
        { success: false, error: "Format email tidak valid." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Email '${cleanEmail}' sudah terdaftar di ACTIS.` },
        { status: 400 }
      );
    }

    const hashedPassword = hashPassword(String(password));
    const newUser = await prisma.user.create({
      data: {
        nama: String(nama).trim(),
        email: cleanEmail,
        password_hash: hashedPassword,
        role: targetRole,
      },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "CREATE_USER",
      aktifitas: `Menambahkan pengguna ACTIS: ${newUser.nama} (${newUser.email}) - Role: ${newUser.role}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pengguna ACTIS '${newUser.nama}' berhasil ditambahkan.`,
      data: newUser,
    });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan pengguna ACTIS baru." },
      { status: 500 }
    );
  }
}
