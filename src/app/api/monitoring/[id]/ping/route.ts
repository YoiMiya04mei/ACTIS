import { NextRequest, NextResponse } from "next/server";
import { executePingForMonitor } from "@/lib/icmpMonitorService";
import { requireAuth } from "@/lib/security";

export async function POST(
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

    const updated = await executePingForMonitor(id, { timeframe, startDate, endDate });

    return NextResponse.json({
      success: true,
      message: `Ping selesai: ${updated.status} (${updated.latency_ms ?? "-"} ms)`,
      data: updated,
    });
  } catch (err: any) {
    console.error("POST /api/monitoring/[id]/ping error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to execute ping" },
      { status: 500 }
    );
  }
}
