import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { listRacksWithStats } from "@/lib/dcimService";
import { computeRackStats } from "@/lib/dcimUtils";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const racks = await listRacksWithStats(search);

    return NextResponse.json({
      success: true,
      data: racks,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat database Rack 3D";
    console.error("GET /api/dcim/racks error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { code, name, location, room_zone, total_u, power_capacity_va, status, notes } = body as {
      code?: string;
      name?: string;
      location?: string;
      room_zone?: string;
      total_u?: number;
      power_capacity_va?: number;
      status?: string;
      notes?: string;
    };

    const cleanCode = code?.trim().toUpperCase();
    const cleanName = name?.trim();
    const cleanLocation = location?.trim();
    const parsedU = Number(total_u || 42);

    if (!cleanCode || !cleanName || !cleanLocation) {
      return NextResponse.json(
        { success: false, error: "Kode Rack, Nama Rack, dan Lokasi Data Center wajib diisi." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(parsedU) || parsedU < 10 || parsedU > 52) {
      return NextResponse.json(
        { success: false, error: "Kapasitas Total U Rack harus antara 10U hingga 52U." },
        { status: 400 }
      );
    }

    const existing = await prisma.dataCenterRack.findUnique({ where: { code: cleanCode } });
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kode Rack '${cleanCode}' sudah terdaftar.` },
        { status: 409 }
      );
    }

    const created = await prisma.dataCenterRack.create({
      data: {
        code: cleanCode,
        name: cleanName,
        location: cleanLocation,
        room_zone: room_zone?.trim() || null,
        total_u: parsedU,
        power_capacity_va: power_capacity_va ? Number(power_capacity_va) : 5000,
        status: status || "Active",
        notes: notes?.trim() || null,
      },
      include: { slots: true },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "CREATE_DEVICE",
      aktifitas: `Menambahkan Rack 3D baru ${cleanCode} (${parsedU}U)`,
      detail: cleanLocation,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Rack ${cleanCode} (${parsedU}U) berhasil ditambahkan ke Database Rack 3D.`,
      data: {
        ...created,
        stats: computeRackStats(created.total_u, created.slots),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menambahkan Rack 3D";
    console.error("POST /api/dcim/racks error:", err);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

