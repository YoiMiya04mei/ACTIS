import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { site_ids } = body;

    if (!Array.isArray(site_ids) || site_ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "Silakan pilih minimal 1 POP Site untuk dihapus." },
        { status: 400 }
      );
    }

    const actorUser = auth.user;

    // Fetch targeted sites
    const sites = await prisma.popSite.findMany({
      where: { id: { in: site_ids } },
    });

    if (sites.length === 0) {
      return NextResponse.json(
        { success: false, error: "Tidak ada POP Site yang ditemukan sesuai pilihan." },
        { status: 404 }
      );
    }

    // STRICT CHECK: Every single site MUST be Terminated
    const nonTerminated = sites.filter((s) => s.status_layanan !== "Terminated");
    if (nonTerminated.length > 0) {
      const sampleNames = nonTerminated.map((s) => `${s.site_id} (${s.status_layanan})`).join(", ");
      return NextResponse.json(
        {
          success: false,
          error: `Penghapusan dibatalkan. Terdapat ${nonTerminated.length} sirkuit yang belum berstatus Terminated: ${sampleNames}. Hanya sirkuit berstatus Terminated yang boleh dihapus oleh Super Admin.`,
        },
        { status: 400 }
      );
    }

    const validIds = sites.map((s) => s.id);
    const validSiteCodes = sites.map((s) => s.site_id);

    // Delete linked orders
    await prisma.popSiteOrder.deleteMany({
      where: { pop_site_id: { in: validIds } },
    });

    // Delete pop sites
    await prisma.popSite.deleteMany({
      where: { id: { in: validIds } },
    });

    // Record Activity Log
    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: actorUser.nama,
      email: actorUser.email,
      ip_address: clientIp,
      tipe: "DELETE_SITE",
      aktifitas: `Menghapus massal ${validSiteCodes.length} POP Site berstatus Terminated`,
      detail: `Sirkuit yang dihapus: ${validSiteCodes.join(", ")}`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Berhasil menghapus ${validSiteCodes.length} POP Site berstatus Terminated secara permanen.`,
      deleted_count: validSiteCodes.length,
      deleted_sites: validSiteCodes,
    });
  } catch (err: any) {
    console.error("POST /api/pop-sites/bulk-delete error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal menghapus POP Site secara massal." },
      { status: 500 }
    );
  }
}
