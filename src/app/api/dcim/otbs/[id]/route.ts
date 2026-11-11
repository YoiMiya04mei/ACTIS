import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeOtbStats } from "@/lib/dcimUtils";
import { verifySessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const otb = await prisma.opticalOtb.findUnique({
      where: { id },
      include: { ports: { orderBy: { core_number: "asc" } } },
    });

    if (!otb) {
      return NextResponse.json({ success: false, error: "OTB tidak ditemukan." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        ...otb,
        stats: computeOtbStats(otb.total_cores, otb.ports),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memuat detail OTB";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { name, location, pop_node, connector_type, fiber_mode, status, notes } = body;

    const existing = await prisma.opticalOtb.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: "OTB tidak ditemukan." }, { status: 404 });
    }

    const updated = await prisma.opticalOtb.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: String(name).trim() } : {}),
        ...(location !== undefined ? { location: String(location).trim() } : {}),
        ...(pop_node !== undefined ? { pop_node: pop_node ? String(pop_node).trim() : null } : {}),
        ...(connector_type !== undefined ? { connector_type: String(connector_type) } : {}),
        ...(fiber_mode !== undefined ? { fiber_mode: String(fiber_mode) } : {}),
        ...(status !== undefined ? { status: String(status) } : {}),
        ...(notes !== undefined ? { notes: notes ? String(notes).trim() : null } : {}),
      },
      include: { ports: { orderBy: { core_number: "asc" } } },
    });

    const sessionUser = verifySessionToken(request.cookies.get("actis_session")?.value);
    recordActivity({
      nama_lengkap: sessionUser?.nama || "Administrator",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_DATA",
      aktifitas: `Memperbarui data OTB ${updated.code}`,
      detail: updated.location,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      data: {
        ...updated,
        stats: computeOtbStats(updated.total_cores, updated.ports),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui OTB";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const otb = await prisma.opticalOtb.findUnique({
      where: { id },
      include: { ports: true },
    });

    if (!otb) {
      return NextResponse.json({ success: false, error: "OTB tidak ditemukan." }, { status: 404 });
    }

    const activeCores = otb.ports.filter((p) => p.status === "Used" || p.status === "Reserved").length;
    const force = new URL(request.url).searchParams.get("force") === "true";
    if (!force && activeCores > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `OTB ${otb.code} masih memiliki ${activeCores} core berstatus Used/Reserved.`,
        },
        { status: 409 }
      );
    }

    await prisma.opticalOtb.delete({ where: { id } });

    const sessionUser = verifySessionToken(request.cookies.get("actis_session")?.value);
    recordActivity({
      nama_lengkap: sessionUser?.nama || "Administrator",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "DELETE_DATA",
      aktifitas: `Menghapus OTB ${otb.code}`,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({ success: true, message: `OTB ${otb.code} berhasil dihapus.` });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menghapus OTB";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

