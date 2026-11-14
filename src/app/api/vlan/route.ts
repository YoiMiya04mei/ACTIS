import { NextRequest, NextResponse } from "next/server";
import { getVlanOverviewData } from "@/lib/vlanService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const data = await getVlanOverviewData();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error("GET /api/vlan error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal memuat data VLAN Management." },
      { status: 500 }
    );
  }
}
