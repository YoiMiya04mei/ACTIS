import { NextRequest, NextResponse } from "next/server";
import {
  getAllMonitors,
  parseTimeframeRange,
  ensureBackgroundPingWorker,
} from "@/lib/icmpMonitorService";

export async function GET(request: NextRequest) {
  try {
    ensureBackgroundPingWorker(60);
    const { searchParams } = new URL(request.url);
    const kategori = searchParams.get("kategori") || "Semua";
    const status = searchParams.get("status") || "Semua";
    const search = searchParams.get("search") || "";
    const timeframe = searchParams.get("timeframe") || "24h";
    const startDate = searchParams.get("startDate") || "";
    const endDate = searchParams.get("endDate") || "";

    const timeRange = parseTimeframeRange(timeframe, startDate, endDate);

    const monitors = await getAllMonitors({
      kategori,
      status,
      search,
      timeframe,
      startDate,
      endDate,
    });

    const total = monitors.length;
    const up = monitors.filter((m) => m.status === "UP").length;
    const down = monitors.filter((m) => m.status === "DOWN").length;
    const pending = monitors.filter((m) => m.status === "PENDING").length;

    // Calculate aggregated latency and uptime based on the selected timeframe
    const latencies = monitors
      .map((m) => m.stats?.avg_latency ?? m.latency_ms)
      .filter((lat): lat is number => typeof lat === "number" && lat > 0);
    const avgLatency =
      latencies.length > 0
        ? parseFloat((latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1))
        : 0;

    const uptimes = monitors.map((m) => m.stats?.uptime_pct ?? m.uptime_pct);
    const avgUptime =
      uptimes.length > 0
        ? parseFloat((uptimes.reduce((a, b) => a + b, 0) / uptimes.length).toFixed(1))
        : 100.0;

    return NextResponse.json({
      success: true,
      summary: {
        total,
        up,
        down,
        pending,
        avg_latency: avgLatency,
        avg_uptime: avgUptime,
        timeframe: timeRange.preset,
        start_at: timeRange.startIso,
        end_at: timeRange.endIso,
      },
      data: monitors,
    });
  } catch (err: any) {
    console.error("GET /api/monitoring error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to fetch monitors" },
      { status: 500 }
    );
  }
}
