import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const settings = await prisma.systemSetting.findMany();
    const settingsMap = settings.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);

    return NextResponse.json({ success: true, data: settingsMap });
  } catch (err: any) {
    console.error("GET /api/settings error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Strict authorization: Only Administrator can modify system settings
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { key, value } = body;

    if (!key || typeof key !== "string") {
      return NextResponse.json(
        { success: false, error: "Setting key is required" },
        { status: 400 }
      );
    }

    const updated = await prisma.systemSetting.upsert({
      where: { key: key.trim() },
      update: { value: String(value ?? "") },
      create: { key: key.trim(), value: String(value ?? "") },
    });

    const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Memperbarui konfigurasi sistem [${key}]`,
      detail: typeof value === "string" && value.length > 200 ? `${value.substring(0, 197)}...` : String(value || ""),
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Pengaturan '${key}' berhasil diperbarui.`,
      data: updated,
    });
  } catch (err: any) {
    console.error("POST /api/settings error:", err);
    return NextResponse.json(
      { success: false, error: "Failed to update setting" },
      { status: 500 }
    );
  }
}
