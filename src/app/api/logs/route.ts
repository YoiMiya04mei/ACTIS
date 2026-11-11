import { NextRequest, NextResponse } from "next/server";
import {
  getActivityLogs,
  recordActivity,
  clearActivityLogs,
  parseUserAgent,
} from "@/lib/activityLogService";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "103.155.196.63";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const tipe = searchParams.get("tipe") || undefined;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = parseInt(searchParams.get("limit") || "25", 10);
    const sortBy = (searchParams.get("sortBy") as any) || "created_at";
    const sortOrder = (searchParams.get("sortOrder") as any) || "desc";
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const data = await getActivityLogs({
      search,
      tipe,
      page,
      limit,
      sortBy,
      sortOrder,
      startDate,
      endDate,
    });

    return NextResponse.json({
      success: true,
      ...data,
    });
  } catch (error: any) {
    console.error("GET /api/logs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawUa = request.headers.get("user-agent") || body.user_agent;
    const userAgent = parseUserAgent(rawUa);
    const ipAddress = body.ip_address || getClientIp(request);

    const log = await recordActivity({
      nama_lengkap: body.nama_lengkap || "SISTEM",
      email: body.email || null,
      ip_address: ipAddress,
      tipe: body.tipe || "INFO",
      aktifitas: body.aktifitas,
      detail: body.detail || null,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error: any) {
    console.error("POST /api/logs error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Failed to record log" },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    await clearActivityLogs();
    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Failed to clear logs" },
      { status: 500 }
    );
  }
}

