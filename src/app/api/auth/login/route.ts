import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, createSessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.password_hash, user.email);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Auto-hash initial default password if it was null
    if (!user.password_hash) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { password_hash: hashPassword(password) },
        });
      } catch (err) {
        console.error("Failed to auto-hash password:", err);
      }
    }

    const sessionPayload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
    };

    const token = createSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      user: sessionPayload,
    });

    // Set session cookie
    response.cookies.set("actis_session", token, {
      httpOnly: false, // accessible to client for fast state recovery if needed
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal melakukan login" },
      { status: 500 }
    );
  }
}

