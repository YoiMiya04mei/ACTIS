import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildOtbPortsData, listOtbsWithStats } from "@/lib/dcimService";
import { computeOtbStats } from "@/lib/dcimUtils";
import { verifySessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const otbs = await listOtbsWithStats(search);

    return NextResponse.json({
      success: true,
      data: otbs,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat database OTB 3D";
    console.error("GET /api/dcim/otbs error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      code,
      name,
      location,
      pop_node,
      total_cores,
      cores_per_tray,
      connector_type,
      fiber_mode,
      status,
      notes,
    } = body;

    const cleanCode = code ? String(code).trim().toUpperCase() : "";
    const cleanName = name ? String(name).trim() : "";
    const cleanLocation = location ? String(location).trim() : "";
    const totalCores = Number(total_cores || 48);
    const perTray = Number(cores_per_tray || 12);

    if (!cleanCode || !cleanName || !cleanLocation) {
      return NextResponse.json(
        { success: false, error: "Kode OTB, Nama OTB, dan Lokasi POP wajib diisi." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(totalCores) || totalCores < 6 || totalCores > 288) {
      return NextResponse.json(
        { success: false, error: "Total Core OTB harus antara 6 hingga 288 core." },
        { status: 400 }
      );
    }

    const existing = await prisma.opticalOtb.findUnique({ where: { code: cleanCode } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kode OTB '${cleanCode}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const created = await prisma.opticalOtb.create({
      data: {
        code: cleanCode,
        name: cleanName,
        location: cleanLocation,
        pop_node: pop_node ? String(pop_node).trim() : null,
        total_cores: totalCores,
        cores_per_tray: perTray,
        connector_type: connector_type || "SC/UPC",
        fiber_mode: fiber_mode || "Single-Mode G.652D",
        status: status || "Active",
        notes: notes ? String(notes).trim() : null,
      },
    });

    const portsData = buildOtbPortsData(created.id, totalCores, perTray);
    await prisma.otbCorePort.createMany({ data: portsData });

    const createdWithPorts = await prisma.opticalOtb.findUnique({
      where: { id: created.id },
      include: { ports: { orderBy: { core_number: "asc" } } },
    });

    const sessionUser = verifySessionToken(request.cookies.get("actis_session")?.value);
    recordActivity({
      nama_lengkap: sessionUser?.nama || "Administrator",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "CREATE_DEVICE",
      aktifitas: `Menambahkan OTB 3D baru ${cleanCode} (${totalCores} Core ${created.connector_type})`,
      detail: cleanLocation,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `OTB ${cleanCode} (${totalCores} Core) berhasil dibuat.`,
      data: createdWithPorts
        ? {
            ...createdWithPorts,
            stats: computeOtbStats(createdWithPorts.total_cores, createdWithPorts.ports),
          }
        : created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal membuat OTB 3D";
    console.error("POST /api/dcim/otbs error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

