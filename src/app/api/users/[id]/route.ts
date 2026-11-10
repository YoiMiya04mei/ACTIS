import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken, hashPassword } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Authorization check: ONLY Administrator can edit users
    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);

    const body = await request.json();
    const { nama, email, role, password, actorRole } = body;

    const callerRole = sessionUser?.role || actorRole;
    if (callerRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Hanya akun dengan level Administrator yang memiliki hak akses untuk mengedit pengguna.",
        },
        { status: 403 }
      );
    }

    // 2. Check if target user exists
    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // 3. Validate inputs
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

    // 4. Prepare update payload
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

    // If new password provided by administrator (optional reset)
    if (password && String(password).trim().length > 0) {
      const cleanPass = String(password).trim();
      if (cleanPass.length < 6) {
        return NextResponse.json(
          { success: false, error: "Password baru minimal 6 karakter." },
          { status: 400 }
        );
      }
      updateData.password_hash = hashPassword(cleanPass);
    }

    // 5. Update user in database
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

    // Catat ke Log Aplikasi
    const actorName = sessionUser?.nama || "Administrator";
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
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
      { success: false, error: err.message || "Gagal mengedit pengguna" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    // 1. Authorization check: ONLY Administrator can delete users
    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);

    // Optional query parameter or header for actorRole/actorId fallback
    const url = new URL(request.url);
    const actorRole = url.searchParams.get("actorRole") || sessionUser?.role;
    const actorId = url.searchParams.get("actorId") || sessionUser?.id;

    if (actorRole !== "admin") {
      return NextResponse.json(
        {
          success: false,
          error: "Akses ditolak: Hanya akun dengan level Administrator yang memiliki hak akses untuk menghapus pengguna.",
        },
        { status: 403 }
      );
    }

    // 2. Prevent deleting own account
    if (actorId && actorId === id) {
      return NextResponse.json(
        {
          success: false,
          error: "Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif digunakan.",
        },
        { status: 400 }
      );
    }

    // 3. Check if user exists
    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "Pengguna tidak ditemukan." },
        { status: 404 }
      );
    }

    // 4. Check for foreign key associations to prevent database errors and preserve audit trail
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

    // 5. Delete user
    await prisma.user.delete({
      where: { id },
    });

    // Catat ke Log Aplikasi
    const actorName = sessionUser?.nama || "Administrator";
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: actorName,
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
      { success: false, error: err.message || "Gagal menghapus pengguna" },
      { status: 500 }
    );
  }
}
