import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const users = await prisma.user.findMany({
      where: {
        email: { not: "system.archived@actis.internal" },
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
      { success: false, error: "Gagal memuat daftar pengguna." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Strict authorization: ONLY Administrator can create users
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { nama, email, password, role } = body;

    // Validate inputs
    if (!nama || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Nama, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (String(password).length < 8) {
      return NextResponse.json(
        { success: false, error: "Password minimal harus 8 karakter." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
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
        { success: false, error: `Email '${cleanEmail}' sudah terdaftar dalam sistem.` },
        { status: 400 }
      );
    }

    const allowedRoles = ["admin", "noc_engineer", "field_engineer", "sales_corporate"];
    const targetRole = allowedRoles.includes(role) ? role : "noc_engineer";

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

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "CREATE_USER",
      aktifitas: `Menambahkan pengguna baru: ${newUser.nama} (${newUser.email}) - Role: ${newUser.role}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pengguna '${newUser.nama}' berhasil ditambahkan.`,
      data: newUser,
    });
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menambahkan pengguna baru." },
      { status: 500 }
    );
  }
}
