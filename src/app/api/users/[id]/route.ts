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

    if (existingUser.email === "system.archived@actis.internal" || existingUser.id === "usr-system-archived") {
      return NextResponse.json(
        { success: false, error: "Akun arsip sistem dilindungi dan tidak dapat diubah." },
        { status: 400 }
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

    // Protect system archived account from deletion
    if (targetUser.email === "system.archived@actis.internal" || targetUser.id === "usr-system-archived") {
      return NextResponse.json(
        {
          success: false,
          error: "Akun arsip sistem dilindungi dan tidak dapat dihapus untuk menjaga integritas data.",
        },
        { status: 400 }
      );
    }

    const orderCount = await prisma.popSiteOrder.count({ where: { created_by: id } });
    const logCount = await prisma.orderProgressLog.count({ where: { user_id: id } });
    const testCount = await prisma.testResult.count({ where: { uploaded_by: id } });
    const changeLogCount = await prisma.siteDataChangeLog.count({ where: { user_id: id } });

    const totalHistory = orderCount + logCount + testCount + changeLogCount;

    // Jika pengguna memiliki riwayat tiket, log, atau uji coba:
    // Alihkan relasi ke akun Arsip Sistem agar data riwayat/history tetap utuh (Zero Data Loss)
    if (totalHistory > 0) {
      const ARCHIVE_EMAIL = "system.archived@actis.internal";
      const ARCHIVE_ID = "usr-system-archived";

      const archiveUser = await prisma.user.upsert({
        where: { email: ARCHIVE_EMAIL },
        update: {},
        create: {
          id: ARCHIVE_ID,
          email: ARCHIVE_EMAIL,
          nama: "Arsip Sistem (Akun Nonaktif)",
          role: "noc_engineer",
          password_hash: null, // Akun arsip tidak memiliki password dan tidak dapat login
        },
      });

      // 1. Catat pembuat awal tiket pada catatan_tambahan dan relokasi created_by
      if (orderCount > 0) {
        const userOrders = await prisma.popSiteOrder.findMany({
          where: { created_by: id },
          select: { id: true, catatan_tambahan: true },
        });

        for (const ord of userOrders) {
          const authorNote = `[Pembuat Tiket Awal: ${targetUser.nama} (${targetUser.email})]`;
          const updatedCatatan = ord.catatan_tambahan
            ? `${ord.catatan_tambahan}\n${authorNote}`
            : authorNote;
          await prisma.popSiteOrder.update({
            where: { id: ord.id },
            data: {
              catatan_tambahan: updatedCatatan,
              created_by: archiveUser.id,
            },
          });
        }
      }

      // 2. Cantumkan nama pembuat log pada catatan_progress dan relokasi user_id
      if (logCount > 0) {
        const userLogs = await prisma.orderProgressLog.findMany({
          where: { user_id: id },
          select: { id: true, catatan_progress: true },
        });

        for (const log of userLogs) {
          const authorPrefix = `[${targetUser.nama}] `;
          const updatedCatatan = log.catatan_progress.startsWith(authorPrefix)
            ? log.catatan_progress
            : `${authorPrefix}${log.catatan_progress}`;
          await prisma.orderProgressLog.update({
            where: { id: log.id },
            data: {
              catatan_progress: updatedCatatan,
              user_id: archiveUser.id,
            },
          });
        }
      }

      // 3. Relokasi testResult uploaded_by ke akun arsip
      if (testCount > 0) {
        await prisma.testResult.updateMany({
          where: { uploaded_by: id },
          data: { uploaded_by: archiveUser.id },
        });
      }

      // 4. Catat author pada siteDataChangeLog dan relokasi user_id
      if (changeLogCount > 0) {
        const changeLogs = await prisma.siteDataChangeLog.findMany({
          where: { user_id: id },
          select: { id: true, catatan: true },
        });

        for (const cl of changeLogs) {
          const authorNote = `[Oleh: ${targetUser.nama}]`;
          const updatedCatatan = cl.catatan
            ? `${cl.catatan}\n${authorNote}`
            : authorNote;
          await prisma.siteDataChangeLog.update({
            where: { id: cl.id },
            data: {
              catatan: updatedCatatan,
              user_id: archiveUser.id,
            },
          });
        }
      }
    }

    // Hapus akun pengguna target secara permanen dari tabel users
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
      detail: totalHistory > 0
        ? `Role: ${targetUser.role}. Riwayat dialihkan ke Arsip Sistem (${orderCount} tiket, ${logCount} log aktivitas, ${testCount} hasil tes).`
        : `Role: ${targetUser.role}. Tidak memiliki riwayat tiket/aktivitas.`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pengguna '${targetUser.nama}' (${targetUser.email}) berhasil dihapus. Seluruh riwayat sistem tetap tersimpan aman.`,
    });
  } catch (err: any) {
    console.error("DELETE /api/users/[id] error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menghapus pengguna" },
      { status: 500 }
    );
  }
}
