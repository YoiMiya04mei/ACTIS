import { NextRequest, NextResponse } from "next/server";
import { pingAllMonitors } from "@/lib/icmpMonitorService";
import { requireAuth } from "@/lib/security";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await pingAllMonitors();
    return NextResponse.json({
      success: true,
      message: `Pengecekan ICMP Ping selesai: ${result.up} Online, ${result.down} Offline dari ${result.total} monitor.`,
      result,
    });
  } catch (err: any) {
    console.error("POST /api/monitoring/ping-all error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to ping monitors" },
      { status: 500 }
    );
  }
}

