import { NextRequest, NextResponse } from "next/server";
import {
  getMonitorBySiteId,
  ensureIcmpMonitorForSite,
  executePingForMonitor,
} from "@/lib/icmpMonitorService";
import { requireAuth } from "@/lib/security";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: popSiteId } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "24h";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    let monitor = await getMonitorBySiteId(popSiteId, { timeframe, startDate, endDate });

    // If monitor doesn't exist yet, try to ensure/create it if eligible
    if (!monitor) {
      await ensureIcmpMonitorForSite(popSiteId);
      monitor = await getMonitorBySiteId(popSiteId, { timeframe, startDate, endDate });
    }

    return NextResponse.json({
      success: true,
      data: monitor,
    });
  } catch (err: any) {
    console.error("GET /api/pop-sites/[id]/monitoring error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch site monitor" },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { id: popSiteId } = await params;
    const { searchParams } = new URL(request.url);
    const timeframe = searchParams.get("timeframe") || "24h";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    let monitor = await getMonitorBySiteId(popSiteId);

    if (!monitor) {
      monitor = await ensureIcmpMonitorForSite(popSiteId);
    }

    if (!monitor) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Sirkuit ini tidak memenuhi syarat ICMP monitoring (hanya untuk POP Site dan Enterprise Dedicated).",
        },
        { status: 400 }
      );
    }

    const updated = await executePingForMonitor(monitor.id, { timeframe, startDate, endDate });

    return NextResponse.json({
      success: true,
      message: `Ping selesai: ${updated.status} (${updated.latency_ms ?? "-"} ms)`,
      data: updated,
    });
  } catch (err: any) {
    console.error("POST /api/pop-sites/[id]/monitoring error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to ping site monitor" },
      { status: 500 }
    );
  }
}
