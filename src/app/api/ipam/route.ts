import { NextRequest, NextResponse } from "next/server";
import { getIpamOverviewData } from "@/lib/ipamService";

export async function GET(request: NextRequest) {
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

