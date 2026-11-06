import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kategori = searchParams.get("kategori"); // "Enterprise" | "POP Site"
    const sub_layanan = searchParams.get("sub_layanan");
    const status = searchParams.get("status");
    const search = searchParams.get("search");
    const tipe = searchParams.get("tipe");

    const andConditions: any[] = [];

    // Filter by Kategori Layanan
    if (kategori === "Enterprise") {
      andConditions.push({ kategori_layanan: "Enterprise" });
    } else if (kategori === "POP Site") {
      andConditions.push({
        OR: [
          { kategori_layanan: "POP Site" },
          { kategori_layanan: { not: "Enterprise" } },
        ],
      });
    }

    // Filter by Sub Layanan (for Enterprise: LocalLoop, Collocation Rack, Dark Fiber, Content)
    if (sub_layanan && sub_layanan !== "Semua") {
      andConditions.push({ sub_layanan: sub_layanan });
    }

    if (status && status !== "Semua") {
      andConditions.push({ status_layanan: status });
    }

    if (tipe && tipe !== "Semua") {
      andConditions.push({
        orders: {
          some: {
            tipe_order: tipe,
          },
        },
      });
    }

    if (search && search.trim().length > 0) {
      const q = search.trim();
      const searchOr: any[] = [
        { site_id: { contains: q } },
        { initial_ticket: { contains: q } },
        { nama_pic: { contains: q } },
        { nama_perusahaan: { contains: q } },
        { email_pic: { contains: q } },
        { as_number: { contains: q } },
        { sub_layanan: { contains: q } },
        { alamat_instalasi: { contains: q } },
        { media_koneksi: { contains: q } },
        { infrastruktur: { contains: q } },
        { server: { contains: q } },
        { sid: { contains: q } },
      ];
      const parsedVlan = parseInt(q, 10);
      if (!isNaN(parsedVlan)) {
        searchOr.push({ vlan: parsedVlan });
      }
      andConditions.push({ OR: searchOr });
    }

    const where = andConditions.length > 0 ? { AND: andConditions } : {};

    const sites = await prisma.popSite.findMany({
      where,
      orderBy: { created_at: "desc" },
      include: {
        orders: {
          orderBy: { created_at: "desc" },
          include: {
            test_results: true,
            creator: { select: { id: true, nama: true, role: true } },
            progress_logs: {
              orderBy: { created_at: "desc" },
              include: { user: { select: { id: true, nama: true, role: true } } },
            },
          },
        },
        _count: {
          select: { orders: true },
        },
      },
    });

    // Base scope for counting within the selected category
    const baseScope: any = kategori === "Enterprise"
      ? { kategori_layanan: "Enterprise" }
      : kategori === "POP Site"
      ? { OR: [{ kategori_layanan: "POP Site" }, { kategori_layanan: { not: "Enterprise" } }] }
      : {};

    const totalActive = await prisma.popSite.count({ where: { ...baseScope, status_layanan: "Active" } });
    const totalIsolir = await prisma.popSite.count({ where: { ...baseScope, status_layanan: "Isolir" } });
    const totalTerminated = await prisma.popSite.count({ where: { ...baseScope, status_layanan: "Terminated" } });

    // Classification counts
    const historyCounts = {
      all: await prisma.popSite.count({ where: baseScope }),
      aktivasi: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Aktivasi Baru" } } } }),
      upgrade: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Upgrade" } } } }),
      downgrade: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Downgrade" } } } }),
      isolir: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Isolir" } } } }),
      unisolir: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Unisolir" } } } }),
      terminate: await prisma.popSite.count({ where: { ...baseScope, orders: { some: { tipe_order: "Terminate" } } } }),
    };

    // Sub layanan counts for Enterprise
    let subLayananCounts = undefined;
    if (kategori === "Enterprise") {
      subLayananCounts = {
        all: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise" } }),
        localloop: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise", sub_layanan: "LocalLoop" } }),
        collocation: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise", sub_layanan: "Collocation Rack" } }),
        darkfiber: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise", sub_layanan: "Dark Fiber" } }),
        content: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise", sub_layanan: "Content" } }),
        dedicated: await prisma.popSite.count({ where: { kategori_layanan: "Enterprise", sub_layanan: "Enterprise Dedicated" } }),
      };
    }

    return NextResponse.json({
      success: true,
      data: sites,
      summary: {
        total: sites.length,
        active: totalActive,
        isolir: totalIsolir,
        terminated: totalTerminated,
      },
      history_counts: historyCounts,
      sub_layanan_counts: subLayananCounts,
    });
  } catch (err: any) {
    console.error("GET /api/pop-sites error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch sites" },
      { status: 500 }
    );
  }
}
