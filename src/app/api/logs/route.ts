import { NextRequest, NextResponse } from "next/server";
import {
  getActivityLogs,
  recordActivity,
  clearActivityLogs,
  parseUserAgent,
} from "@/lib/activityLogService";
import { requireAuth } from "@/lib/security";

export const dynamic = "force-dynamic";

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
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || undefined;
    const tipe = searchParams.get("tipe") || undefined;
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25", 10)));
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
      { success: false, error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const rawUa = request.headers.get("user-agent") || body.user_agent;
    const userAgent = parseUserAgent(rawUa);
    const ipAddress = getClientIp(request);

    const log = await recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: ipAddress,
      tipe: body.tipe || "INFO",
      aktifitas: String(body.aktifitas || "Aktivitas tercatat"),
      detail: body.detail ? String(body.detail) : null,
      user_agent: userAgent,
    });

    return NextResponse.json({
      success: true,
      log,
    });
  } catch (error: any) {
    console.error("POST /api/logs error:", error);
    return NextResponse.json(
      { success: false, error: "Failed to record log" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  // CRITICAL SECURITY FIX: Only Administrator can clear audit logs!
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    await clearActivityLogs();

    const clientIp = getClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));
    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SYSTEM",
      aktifitas: "Membersihkan seluruh riwayat log aktivitas aplikasi",
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({ success: true, message: "Logs cleared" });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: "Failed to clear logs" },
      { status: 500 }
    );
  }
}
