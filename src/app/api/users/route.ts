import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, hashPassword } from "@/lib/auth";

export async function GET() {
  try {
    const users = await prisma.user.findMany({
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
      { success: false, error: err.message || "Failed to fetch users" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // 1. Authorization check: ONLY Administrator can add users
    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);

    const body = await request.json();
    const { nama, email, password, role, actorRole } = body;

    // Check caller role either from session or header/payload
    const callerRole = sessionUser?.role || actorRole;
    if (callerRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Hanya akun dengan level Administrator yang memiliki hak akses untuk menambah pengguna baru.",
        },
        { status: 403 }
      );
    }

    // 2. Validate input fields
    if (!nama || !email || !password) {
      return NextResponse.json(
        { success: false, error: "Nama, email, dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password minimal harus 6 karakter." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 3. Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Email '${cleanEmail}' sudah terdaftar dalam sistem.` },
        { status: 400 }
      );
    }

    // Valid role values
    const allowedRoles = ["admin", "noc_engineer", "field_engineer", "sales_corporate"];
    const targetRole = allowedRoles.includes(role) ? role : "noc_engineer";

    // 4. Hash password and insert into database
    const hashedPassword = hashPassword(password);
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

    return NextResponse.json(
      {
        success: true,
        message: `Pengguna '${newUser.nama}' berhasil ditambahkan.`,
        data: newUser,
      },
      { status: 201 }
    );
  } catch (err: any) {
    console.error("POST /api/users error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menambahkan pengguna" },
      { status: 500 }
    );
  }
}
