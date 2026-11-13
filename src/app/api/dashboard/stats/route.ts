import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAllMonitors } from "@/lib/icmpMonitorService";
import { getIpamOverviewData } from "@/lib/ipamService";
import { requireAuth } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const activeScope = { status: { notIn: ["Completed", "Cancelled"] } };

    // Parallel fetch for top speed performance
    const [
      // 1. Queue statistics
      activeQueueCount,
      queueAktivasi,
      queueUpgrade,
      queueDowngrade,
      queueIsolir,
      queueUnisolir,
      queueTerminate,
      recentOrders,

      // 2. POP Site statistics
      totalPopSites,
      popSitesActive,
      popSitesIsolir,
      popSitesTerminated,

      // 3. Enterprise statistics
      totalEnterprise,
      enterpriseActive,
      enterpriseIsolir,
      enterpriseTerminated,

      // 4. IPAM Data (phpIPAM overview)
      ipamData,
    ] = await Promise.all([
      // Queue
      prisma.popSiteOrder.count({ where: activeScope }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Aktivasi Baru", ...activeScope } }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Upgrade", ...activeScope } }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Downgrade", ...activeScope } }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Isolir", ...activeScope } }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Unisolir", ...activeScope } }),
      prisma.popSiteOrder.count({ where: { tipe_order: "Terminate", ...activeScope } }),
      prisma.popSiteOrder.findMany({
        where: activeScope,
        orderBy: { created_at: "desc" },
        take: 6,
        select: {
          id: true,
          ticket_number: true,
          tipe_order: true,
          status: true,
          kategori_layanan: true,
          sub_layanan: true,
          nama_pic: true,
          nama_perusahaan: true,
          layanan_dedicated: true,
          vlan: true,
          created_at: true,
          creator: {
            select: { nama: true, role: true },
          },
        },
      }),

      // POP Sites (kategori POP Site atau bukan Enterprise)
      prisma.popSite.count({
        where: {
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        },
      }),
      prisma.popSite.count({
        where: {
          status_layanan: "Active",
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        },
      }),
      prisma.popSite.count({
        where: {
          status_layanan: "Isolir",
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        },
      }),
      prisma.popSite.count({
        where: {
          status_layanan: "Terminated",
          OR: [
            { kategori_layanan: "POP Site" },
            { kategori_layanan: { not: "Enterprise" } },
          ],
        },
      }),

      // Enterprise Sites
      prisma.popSite.count({
        where: { kategori_layanan: "Enterprise" },
      }),
      prisma.popSite.count({
        where: { kategori_layanan: "Enterprise", status_layanan: "Active" },
      }),
      prisma.popSite.count({
        where: { kategori_layanan: "Enterprise", status_layanan: "Isolir" },
      }),
      prisma.popSite.count({
        where: { kategori_layanan: "Enterprise", status_layanan: "Terminated" },
      }),

      // 4. IPAM Overview (direct phpIPAM calculation)
      getIpamOverviewData().catch(() => null),
    ]);

    // ICMP Monitoring quick summary
    let monitoringSummary = {
      total: 0,
      up: 0,
      down: 0,
      pending: 0,
      avg_uptime: 100,
    };

    try {
      const monitors = await getAllMonitors();
      const up = monitors.filter((m) => m.status === "UP").length;
      const down = monitors.filter((m) => m.status === "DOWN").length;
      const pending = monitors.filter((m) => m.status === "PENDING").length;
      const validUptimes = monitors.map((m) => m.stats?.uptime_pct ?? m.uptime_pct);
      const avgUptime =
        validUptimes.length > 0
          ? parseFloat((validUptimes.reduce((a, b) => a + b, 0) / validUptimes.length).toFixed(1))
          : 100.0;

      monitoringSummary = {
        total: monitors.length,
        up,
        down,
        pending,
        avg_uptime: avgUptime,
      };
    } catch (e) {
      // fallback
    }

    return NextResponse.json({
      success: true,
      data: {
        queue: {
          total: activeQueueCount,
          aktivasi: queueAktivasi,
          upgrade: queueUpgrade,
          downgrade: queueDowngrade,
          isolir: queueIsolir,
          unisolir: queueUnisolir,
          terminate: queueTerminate,
        },
        popSites: {
          total: totalPopSites,
          active: popSitesActive,
          isolir: popSitesIsolir,
          terminated: popSitesTerminated,
        },
        enterprise: {
          total: totalEnterprise,
          active: enterpriseActive,
          isolir: enterpriseIsolir,
          terminated: enterpriseTerminated,
        },
        monitoring: monitoringSummary,
        ipam: {
          totalPrefixes: ipamData?.summary?.totalPrefixes ?? 0,
          totalIps: ipamData?.summary?.totalIps ?? 0,
          totalUsableHosts: ipamData?.summary?.totalUsableHosts ?? 0,
          totalUsedIps: ipamData?.summary?.totalUsedIps ?? 0,
          totalFreeIps: ipamData?.summary?.totalFreeIps ?? 0,
          overallUsagePct: ipamData?.summary?.overallUsagePct ?? 0,
        },
        recentOrders,
      },
    });
  } catch (err: any) {
    console.error("GET /api/dashboard/stats error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
}
