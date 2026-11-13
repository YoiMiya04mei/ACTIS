import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeRackStats } from "@/lib/dcimUtils";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const rack = await prisma.dataCenterRack.findUnique({
      where: { id },
      include: {
        slots: { orderBy: { start_u: "asc" } },
      },
    });

    if (!rack) {
      return NextResponse.json({ success: false, error: "Rack tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...rack,
        stats: computeRackStats(rack.total_u, rack.slots),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat detail Rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const { name, location, room_zone, total_u, power_capacity_va, status, notes } = body;

    const existing = await prisma.dataCenterRack.findUnique({
      where: { id },
      include: { slots: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: "Rack tidak ditemukan." }, { status: 404 });
    }

    const nextTotalU = total_u !== undefined ? Number(total_u) : existing.total_u;
    if (!Number.isInteger(nextTotalU) || nextTotalU < 10 || nextTotalU > 52) {
      return NextResponse.json(
        { success: false, error: "Kapasitas Total U Rack harus antara 10U hingga 52U." },
        { status: 400 }
      );
    }

    const highestUsedU = existing.slots.reduce((max, s) => Math.max(max, s.end_u), 0);
    if (nextTotalU < highestUsedU) {
      return NextResponse.json(
        {
          success: false,
          error: `Total U tidak boleh lebih kecil dari slot tertinggi yang terisi (U${highestUsedU}).`,
        },
        { status: 400 }
      );
    }

    const updated = await prisma.dataCenterRack.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(location !== undefined ? { location: String(location).trim() } : {}),
        ...(room_zone !== undefined ? { room_zone: room_zone ? String(room_zone).trim() : null } : {}),
        total_u: nextTotalU,
        ...(power_capacity_va !== undefined ? { power_capacity_va: Number(power_capacity_va) } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
      },
      include: { slots: { orderBy: { start_u: "asc" } } },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_DATA",
      aktifitas: `Memperbarui data Rack ${updated.code}`,
      detail: `${updated.total_u}U · ${updated.location}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        stats: computeRackStats(updated.total_u, updated.slots),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui Rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const rack = await prisma.dataCenterRack.findUnique({
      where: { id },
      include: { slots: true },
    });

    if (!rack) {
      return NextResponse.json({ success: false, error: "Rack tidak ditemukan." }, { status: 404 });
    }

    const force = new URL(request.url).searchParams.get("force") === "true";
    if (!force && rack.slots.length > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `Rack ${rack.code} masih memiliki ${rack.slots.length} perangkat terpasang. Kosongkan unit terlebih dahulu sebelum menghapus rack.`,
        },
        { status: 409 }
      );
    }

    await prisma.dataCenterRack.delete({ where: { id } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "DELETE_DATA",
      aktifitas: `Menghapus Rack ${rack.code}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({ success: true, message: `Rack ${rack.code} berhasil dihapus.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus Rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

