import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";

export async function GET() {
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
      { success: false, error: err.message || "Failed to fetch settings" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { key, value, actorRole } = body;

    if (!key) {
      return NextResponse.json(
        { success: false, error: "Setting key is required" },
        { status: 400 }
      );
    }

    // Role-based protection: Only Administrator can add/modify/delete server_options, infrastructure_options, or media_options
    if (key === "server_options" || key === "infrastructure_options" || key === "media_options") {
      const sessionCookie = request.cookies.get("actis_session")?.value;
      const sessionUser = verifySessionToken(sessionCookie);
      const effectiveRole = sessionUser?.role || actorRole;

      if (effectiveRole !== "admin") {
        const entityMap: Record<string, string> = {
          server_options: "server",
          infrastructure_options: "infrastruktur",
          media_options: "media koneksi",
        };
        const entityName = entityMap[key] || "sistem";
        return NextResponse.json(
          {
            success: false,
            error: `Akses ditolak: Hanya akun Administrator yang berhak menambah atau menghapus konfigurasi ${entityName}.`,
          },
          { status: 403 }
        );
      }
    }

    const updated = await prisma.systemSetting.upsert({
      where: { key },
      update: { value: String(value || "") },
      create: { key, value: String(value || "") },
    });

    return NextResponse.json({
      success: true,
      message: `Pengaturan '${key}' berhasil diperbarui.`,
      data: updated,
    });
  } catch (err: any) {
    console.error("POST /api/settings error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to update setting" },
      { status: 500 }
    );
  }
}
