import { NextRequest, NextResponse } from "next/server";
import { getIpamOverviewData } from "@/lib/ipamService";
import { requireAuth } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const data = await getIpamOverviewData();
    return NextResponse.json({
      success: true,
      data,
    });
  } catch (err: any) {
    console.error("GET /api/ipam error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch IPAM data" },
      { status: 500 }
    );
  }
}

