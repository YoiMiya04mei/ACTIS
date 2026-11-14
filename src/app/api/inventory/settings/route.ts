import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const settings = await prisma.inventorySetting.findMany();
    const settingsMap: Record<string, string> = {
      DEFAULT_MIN_STOCK: "5",
      ENABLE_AUTO_ITEM_CODE: "true",
      ALLOW_NEGATIVE_STOCK: "false",
      NOTIFY_ON_LOW_STOCK: "true",
      DEFAULT_WAREHOUSE_NAME: "Gudang Pusat",
      DEFAULT_STORAGE_LOCATION: "Gudang Pusat",
    };

    settings.forEach((s) => {
      settingsMap[s.key] = s.value;
    });

    return NextResponse.json({
      success: true,
      data: settingsMap,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat pengaturan inventory." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageSettings) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Super Admin yang dapat mengubah pengaturan inventory." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const entries = Object.entries(body);

    for (const [key, value] of entries) {
      if (typeof key === "string" && value !== undefined) {
        await prisma.inventorySetting.upsert({
          where: { key },
          create: {
            key,
            value: String(value),
          },
          update: {
            value: String(value),
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Pengaturan inventory berhasil disimpan.",
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal menyimpan pengaturan inventory." },
      { status: 500 }
    );
  }
}

