import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, verifySessionToken } from "@/lib/auth";

export async function POST(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);

    const body = await request.json();
    const { userId, oldPassword, newPassword } = body;

    const targetId = userId || sessionUser?.id;

    if (!targetId) {
      return NextResponse.json(
        { success: false, error: "Identitas pengguna tidak ditemukan. Silakan login kembali." },
        { status: 401 }
      );
    }

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Password saat ini dan password baru wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword.length < 6) {
      return NextResponse.json(
        { success: false, error: "Password baru minimal harus 6 karakter." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: targetId },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // Verify old password
    const isOldValid = verifyPassword(oldPassword, user.password_hash, user.email);
    if (!isOldValid) {
      return NextResponse.json(
        { success: false, error: "Password saat ini tidak sesuai." },
        { status: 400 }
      );
    }

    // Hash new password and update
    const newHash = hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { password_hash: newHash },
    });

    return NextResponse.json({
      success: true,
      message: "Password Anda berhasil diperbarui. Silakan gunakan password baru pada sesi berikutnya.",
    });
  } catch (err: any) {
    console.error("POST /api/users/change-password error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal mengubah password" },
      { status: 500 }
    );
  }
}

