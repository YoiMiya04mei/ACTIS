import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Strict authorization: ONLY Administrator can edit users
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const { nama, email, role, password } = body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    if (!nama || !email) {
      return NextResponse.json(
        { success: false, error: "Nama dan email wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Check email uniqueness if email changed
    if (cleanEmail !== existingUser.email) {
      const duplicate = await prisma.user.findFirst({
        where: {
          email: cleanEmail,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          { success: false, error: `Email '${cleanEmail}' sudah digunakan oleh pengguna lain.` },
          { status: 400 }
        );
      }
    }

    // Role validation
    const allowedRoles = ["admin", "noc_engineer", "field_engineer", "sales_corporate"];
    const targetRole = allowedRoles.includes(role) ? role : existingUser.role;

    const updateData: {
      nama: string;
      email: string;
      role: string;
      password_hash?: string;
    } = {
      nama: String(nama).trim(),
      email: cleanEmail,
      role: targetRole,
    };

    if (password && String(password).trim().length > 0) {
      const cleanPass = String(password).trim();
      if (cleanPass.length < 8) {
        return NextResponse.json(
          { success: false, error: "Password baru minimal 8 karakter." },
          { status: 400 }
        );
      }
      updateData.password_hash = hashPassword(cleanPass);
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
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
      tipe: "UPDATE_USER",
      aktifitas: `Memperbarui data pengguna: ${updatedUser.nama} (${updatedUser.email}) - Role: ${updatedUser.role}`,
      detail: password ? "Data profil & kata sandi diperbarui oleh Administrator" : "Data profil diperbarui",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Data pengguna '${updatedUser.nama}' berhasil diperbarui.`,
      data: updatedUser,
    });
  } catch (err: any) {
    console.error("PUT /api/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengedit pengguna" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  // Strict authorization: ONLY Administrator can delete users
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await context.params;

    // Prevent deleting own account
    if (auth.user.id === id) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.",
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    const orderCount = await prisma.popSiteOrder.count({ where: { created_by: id } });
    const logCount = await prisma.orderProgressLog.count({ where: { user_id: id } });
    const testCount = await prisma.testResult.count({ where: { uploaded_by: id } });

    if (orderCount > 0 || logCount > 0 || testCount > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Pengguna '${targetUser.nama}' tidak dapat dihapus karena memiliki riwayat tiket/aktivitas (${orderCount} tiket, ${logCount} log aktivitas) untuk menjaga audit trail.`,
        },
        { status: 400 }
      );
    }

    await prisma.user.delete({
      where: { id },
    });

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DELETE_USER",
      aktifitas: `Menghapus akun pengguna: ${targetUser.nama} (${targetUser.email})`,
      detail: `Role sebelumnya: ${targetUser.role}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pengguna '${targetUser.nama}' (${targetUser.email}) berhasil dihapus.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus pengguna" },
      { status: 500 }
    );
  }
}
