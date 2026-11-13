import { NextRequest, NextResponse } from "next/server";
import { getMonitorById } from "@/lib/icmpMonitorService";
import { requireAuth } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "24h";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const monitor = await getMonitorById(id, { timeframe, startDate, endDate });

    if (!monitor) {
      return NextResponse.json(
        { success: false, error: "Monitor tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: monitor });
  } catch (err: any) {
    console.error("GET /api/monitoring/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch monitor" },
      { status: 500 }
    );
  }
}
