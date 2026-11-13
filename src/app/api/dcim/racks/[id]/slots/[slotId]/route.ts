import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRackRangeFree } from "@/lib/dcimUtils";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id: rackId, slotId } = await params;
    const body = await request.json();

    const rack = await prisma.dataCenterRack.findUnique({
      where: { id: rackId },
      include: { slots: true },
    });
    if (!rack) {
      return NextResponse.json({ success: false, error: "Rack tidak ditemukan." }, { status: 404 });
    }

    const existing = rack.slots.find((s) => s.id === slotId);
    if (!existing) {
      return NextResponse.json({ success: false, error: "Unit rack tidak ditemukan." }, { status: 404 });
    }

    const nextStartU = body.start_u !== undefined ? Number(body.start_u) : existing.start_u;
    const nextUnitSize = body.unit_size !== undefined ? Number(body.unit_size) : existing.unit_size;

    const rangeCheck = isRackRangeFree(rack.total_u, rack.slots, nextStartU, nextUnitSize, existing.id);
    if (!rangeCheck.valid) {
      return NextResponse.json(
        { success: false, error: rangeCheck.reason || "Rentang U bentrok." },
        { status: 409 }
      );
    }

    const updated = await prisma.rackUnitAllocation.update({
      where: { id: slotId },
      data: {
        start_u: nextStartU,
        unit_size: nextUnitSize,
        end_u: rangeCheck.endU,
        ...(body.device_name !== undefined ? { device_name: String(body.device_name).trim() } : {}),
        ...(body.serial_number !== undefined
          ? { serial_number: body.serial_number ? String(body.serial_number).trim() : null }
          : {}),
        ...(body.customer_name !== undefined
          ? { customer_name: body.customer_name ? String(body.customer_name).trim() : null }
          : {}),
        ...(body.pic_name !== undefined
          ? { pic_name: body.pic_name ? String(body.pic_name).trim() : null }
          : {}),
        ...(body.device_type !== undefined ? { device_type: String(body.device_type) } : {}),
        ...(body.power_draw_watt !== undefined ? { power_draw_watt: Number(body.power_draw_watt) } : {}),
        ...(body.color_tag !== undefined ? { color_tag: String(body.color_tag) } : {}),
        ...(body.status !== undefined ? { status: String(body.status) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes ? String(body.notes).trim() : null } : {}),
      },
    });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_DATA",
      aktifitas: `Memperbarui unit ${updated.device_name} di Rack ${rack.code} (U${updated.start_u}-U${updated.end_u})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui unit rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; slotId: string }> }
) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id: rackId, slotId } = await params;
    const slot = await prisma.rackUnitAllocation.findUnique({
      where: { id: slotId },
      include: { rack: true },
    });
    if (!slot || slot.rack_id !== rackId) {
      return NextResponse.json({ success: false, error: "Unit rack tidak ditemukan." }, { status: 404 });
    }

    await prisma.rackUnitAllocation.delete({ where: { id: slotId } });

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "DELETE_DATA",
      aktifitas: `Melepas unit ${slot.device_name} dari Rack ${slot.rack.code} (U${slot.start_u}-U${slot.end_u})`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Unit di posisi U${slot.start_u}–U${slot.end_u} berhasil dilepas.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal melepas unit rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

