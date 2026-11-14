import { NextRequest, NextResponse } from "next/server";
import { checkVlanAvailabilityOnServer } from "@/lib/vlanService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const server = searchParams.get("server") || "";
    const vlanRaw = searchParams.get("vlan");
    const excludeSiteId = searchParams.get("excludeSiteId") || undefined;

    const parsedVlan =
      vlanRaw !== null && vlanRaw.trim() !== "" ? parseInt(vlanRaw.trim(), 10) : null;

    if (!server.trim()) {
      return NextResponse.json({
        success: true,
        data: {
          server: "",
          vlan: isNaN(Number(parsedVlan)) ? null : parsedVlan,
          available: true,
          nextAvailableVlan: null,
          activatedConflicts: [],
          queueConflicts: [],
        },
      });
    }

    const result = await checkVlanAvailabilityOnServer({
      server: server.trim(),
      vlan: parsedVlan !== null && !isNaN(parsedVlan) ? parsedVlan : null,
      excludeSiteId,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error("GET /api/vlan/check error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memeriksa ketersediaan VLAN." },
      { status: 500 }
    );
  }
}
