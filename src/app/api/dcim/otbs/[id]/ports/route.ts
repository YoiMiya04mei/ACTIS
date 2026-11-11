import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: otbId } = await params;
    const body = await request.json();
    const {
      core_numbers,
      status,
      route_pair,
      destination_otb,
      customer_name,
      attenuation_db,
      distance_km,
      notes,
    } = body as {
      core_numbers?: number[];
      status?: string;
      route_pair?: string | null;
      destination_otb?: string | null;
      customer_name?: string | null;
      attenuation_db?: number | string | null;
      distance_km?: number | string | null;
      notes?: string | null;
    };

    const otb = await prisma.opticalOtb.findUnique({ where: { id: otbId } });
    if (!otb) {
      return NextResponse.json({ success: false, error: "OTB tidak ditemukan." }, { status: 404 });
    }

    const cores = Array.isArray(core_numbers)
      ? core_numbers.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0)
      : [];

    if (cores.length === 0) {
      return NextResponse.json(
        { success: false, error: "Pilih minimal 1 nomor core OTB." },
        { status: 400 }
      );
    }

    const isReset = status === "Available";

    await prisma.otbCorePort.updateMany({
      where: {
        otb_id: otbId,
        core_number: { in: cores },
      },
      data: {
        ...(status ? { status } : {}),
        ...(isReset
          ? {
              route_pair: null,
              destination_otb: null,
              customer_name: null,
              order_id: null,
              pop_site_id: null,
              ticket_number: null,
              site_code: null,
              notes: notes ?? null,
            }
          : {
              ...(route_pair !== undefined ? { route_pair: route_pair?.trim() || null } : {}),
              ...(destination_otb !== undefined ? { destination_otb: destination_otb?.trim() || null } : {}),
              ...(customer_name !== undefined ? { customer_name: customer_name?.trim() || null } : {}),
              ...(notes !== undefined ? { notes: notes?.trim() || null } : {}),
            }),
        ...(attenuation_db !== undefined
          ? {
              attenuation_db:
                attenuation_db === "" || attenuation_db === null ? null : Number(attenuation_db),
            }
          : {}),
        ...(distance_km !== undefined
          ? {
              distance_km:
                distance_km === "" || distance_km === null ? null : Number(distance_km),
            }
          : {}),
      },
    });

    const updatedPorts = await prisma.otbCorePort.findMany({
      where: { otb_id: otbId, core_number: { in: cores } },
      orderBy: { core_number: "asc" },
    });

    const sessionUser = verifySessionToken(request.cookies.get("actis_session")?.value);
    recordActivity({
      nama_lengkap: sessionUser?.nama || "NOC Engineer",
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_DATA",
      aktifitas: `Mengubah status Core #${cores.join(", #")} pada OTB ${otb.code} menjadi ${status || "Updated"}`,
      detail: customer_name || route_pair || undefined,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Core #${cores.join(", #")} di ${otb.code} berhasil diperbarui.`,
      data: updatedPorts,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal memperbarui Core OTB";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

