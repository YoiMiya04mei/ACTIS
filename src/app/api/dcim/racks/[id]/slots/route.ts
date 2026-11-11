import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isRackRangeFree } from "@/lib/dcimUtils";
import { verifySessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: rackId } = await params;
    const body = await request.json();
    const {
      start_u,
      unit_size,
      device_name,
      serial_number,
      customer_name,
      pic_name,
      device_type,
      power_draw_watt,
      color_tag,
      status,
      notes,
    } = body;

    const rack = await prisma.dataCenterRack.findUnique({
      where: { id: rackId },
      include: { slots: true },
    });

    if (!rack) {
      return NextResponse.json({ success: false, error: "Rack tidak ditemukan." }, { status: 404 });
    }

    const startU = Number(start_u);
    const unitSize = Number(unit_size || 1);

    if (!device_name || !String(device_name).trim()) {
      return NextResponse.json(
        { success: false, error: "Nama perangkat wajib diisi." },
        { status: 400 }
      );
    }

    const rangeCheck = isRackRangeFree(rack.total_u, rack.slots, startU, unitSize);
    if (!rangeCheck.valid) {
      return NextResponse.json(
        { success: false, error: rangeCheck.reason || "Rentang U tidak tersedia." },
        { status: 409 }
      );
    }

    const created = await prisma.rackUnitAllocation.create({
      data: {
        rack_id: rack.id,
        start_u: startU,
        unit_size: unitSize,
        end_u: rangeCheck.endU,
        device_name: String(device_name).trim(),
        serial_number: serial_number ? String(serial_number).trim() : null,
        customer_name: customer_name ? String(customer_name).trim() : null,
        pic_name: pic_name ? String(pic_name).trim() : null,
        device_type: device_type ? String(device_type) : "Server",
        power_draw_watt: power_draw_watt !== undefined ? Number(power_draw_watt) : unitSize * 300,
        color_tag: color_tag || "#3b82f6",
        status: status || "Occupied",
        notes: notes ? String(notes).trim() : null,
      },
    });

    const sessionUser = verifySessionToken(request.cookies.get("actis_session")?.value);
    recordActivity({
      nama_lengkap: sessionUser?.nama || "NOC Engineer",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_DATA",
      aktifitas: `Memasang unit ${created.device_name} di Rack ${rack.code} (U${startU}-U${rangeCheck.endU})`,
      detail: created.customer_name || undefined,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Perangkat berhasil dipasang di ${rack.code} posisi U${startU}–U${rangeCheck.endU}.`,
      data: created,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memasang unit di Rack";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

