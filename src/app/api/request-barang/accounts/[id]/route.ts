import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { getRequestClientIp, requireAuth } from "@/lib/security";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";
import { isValidUsername, normalizeUsername } from "@/lib/requestBarangAuth";

export const dynamic = "force-dynamic";

const ACCOUNT_SELECT = {
  id: true,
  nama: true,
  username: true,
  is_active: true,
  created_at: true,
  updated_at: true,
} as const;

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { nama, username, password, is_active } = body;

    const existing = await prisma.requestBarangAccount.findUnique({
      where: { id },
      select: ACCOUNT_SELECT,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Akun /request-barang tidak ditemukan." },
        { status: 404 }
      );
    }

    const cleanNama = String(nama ?? "").trim();
    const cleanUsername =
      username !== undefined ? normalizeUsername(username) : existing.username;

    if (!cleanNama || !cleanUsername) {
      return NextResponse.json(
        { success: false, error: "Nama lengkap dan username wajib diisi." },
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

    if (cleanUsername !== existing.username) {
      const duplicate = await prisma.requestBarangAccount.findFirst({
        where: {
          username: cleanUsername,
          id: { not: id },
        },
        select: { id: true },
      });
      if (duplicate) {
        return NextResponse.json(
          {
            success: false,
            error: `Username '@${cleanUsername}' sudah digunakan oleh akun lain.`,
          },
          { status: 400 }
        );
      }
    }

    const updateData: {
      nama: string;
      username: string;
      is_active: boolean;
      password_hash?: string;
    } = {
      nama: cleanNama,
      username: cleanUsername,
      is_active: typeof is_active === "boolean" ? is_active : existing.is_active,
    };

    const rawPass = typeof password === "string" ? password.trim() : "";
    if (rawPass.length > 0) {
      if (rawPass.length < 8) {
        return NextResponse.json(
          { success: false, error: "Password baru minimal harus 8 karakter." },
          { status: 400 }
        );
      }
      updateData.password_hash = hashPassword(rawPass);
    }

    const updated = await prisma.requestBarangAccount.update({
      where: { id },
      data: updateData,
      select: ACCOUNT_SELECT,
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "UPDATE_USER",
      aktifitas: `Memperbarui akun Web /request-barang: ${updated.nama} (@${updated.username})`,
      detail: rawPass
        ? "Data profil & kata sandi portal /request-barang diperbarui"
        : "Data profil akun portal /request-barang diperbarui",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Akun '@${updated.username}' berhasil diperbarui.`,
      data: updated,
    });
  } catch (err: any) {
    console.error("PUT /api/request-barang/accounts/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memperbarui akun Web /request-barang." },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { is_active } = body;

    if (typeof is_active !== "boolean") {
      return NextResponse.json(
        { success: false, error: "Nilai is_active harus berupa boolean." },
        { status: 400 }
      );
    }

    const existing = await prisma.requestBarangAccount.findUnique({
      where: { id },
      select: ACCOUNT_SELECT,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Akun /request-barang tidak ditemukan." },
        { status: 404 }
      );
    }

    const updated = await prisma.requestBarangAccount.update({
      where: { id },
      data: { is_active },
      select: ACCOUNT_SELECT,
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "UPDATE_USER",
      aktifitas: `${is_active ? "Mengaktifkan" : "Menonaktifkan"} akun login Web /request-barang: ${updated.nama} (@${updated.username})`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Akun '@${updated.username}' ${is_active ? "diaktifkan" : "dinonaktifkan"}.`,
      data: updated,
    });
  } catch (err: any) {
    console.error("PATCH /api/request-barang/accounts/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengubah status akun Web /request-barang." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const existing = await prisma.requestBarangAccount.findUnique({
      where: { id },
      select: ACCOUNT_SELECT,
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Akun /request-barang tidak ditemukan." },
        { status: 404 }
      );
    }

    await prisma.requestBarangAccount.delete({
      where: { id },
    });

    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DELETE_USER",
      aktifitas: `Menghapus akun Web /request-barang: ${existing.nama} (@${existing.username})`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Akun '@${existing.username}' berhasil dihapus dari portal /request-barang.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/request-barang/accounts/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus akun Web /request-barang." },
      { status: 500 }
    );
  }
}
