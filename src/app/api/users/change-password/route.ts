import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  hashPassword,
  createSessionToken,
  invalidateSessionToken,
} from "@/lib/auth";
import { requireAuth, getSessionCookieOptions } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { oldPassword, newPassword } = body;

    // Strict identity from verified session only
    const targetId = auth.user.id;

    if (!oldPassword || !newPassword) {
      return NextResponse.json(
        { success: false, error: "Password saat ini dan password baru wajib diisi." },
        { status: 400 }
      );
    }

    if (newPassword.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password baru minimal harus 8 karakter demi keamanan." },
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

    // Invalidate old session token for session rotation
    const oldCookie = request.cookies.get("actis_session")?.value;
    invalidateSessionToken(oldCookie);

    // Issue new rotated session token
    const newToken = createSessionToken({
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
    });

    // Catat ke Log Aplikasi
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: user.nama,
      email: user.email,
      ip_address: clientIp,
      tipe: "PASSWORD_CHANGE",
      aktifitas: `Memperbarui kata sandi akun ${user.nama} (${user.email})`,
      detail: "Perubahan kata sandi akun mandiri berhasil dengan rotasi sesi",
      user_agent: userAgent,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "Password Anda berhasil diperbarui dan sesi baru telah dibuat.",
    });

    response.cookies.set("actis_session", newToken, getSessionCookieOptions(60 * 60 * 24 * 7));

    return response;
  } catch (err: any) {
    console.error("POST /api/users/change-password error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengubah password" },
      { status: 500 }
    );
  }
}
