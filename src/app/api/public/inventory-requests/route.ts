import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/security";
import {
  createPublicInventoryRequest,
  getPublicInventoryCatalog,
} from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";

function extractRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

export async function GET() {
  try {
    const items = await getPublicInventoryCatalog();
    return NextResponse.json(
      { success: true, data: items },
      {
        status: 200,
        headers: { "Cache-Control": "no-store, max-age=0" },
      }
    );
  } catch (error: any) {
    console.error("Error in GET /api/public/inventory-requests:", error);
    return NextResponse.json(
      { success: false, error: "Gagal memuat daftar barang tersedia." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = extractRequestIp(request);
  const rate = checkRateLimit(`public-inv-req:${ip}`, 20, 60);
  if (!rate.allowed) {
    return NextResponse.json(
      {
        success: false,
        error: `Terlalu banyak pengiriman request. Silakan coba lagi dalam ${rate.retryAfter || 60} detik.`,
      },
      { status: 429 }
    );
  }

  try {
    const body = await request.json();
    const created = await createPublicInventoryRequest(
      body,
      ip === "unknown" ? null : ip
    );

    triggerInventoryMirrorSync({
      event: "REQUEST_CREATE",
      triggeredBy: created.pic_name || "Form Publik",
    });

    return NextResponse.json(
      {
        success: true,
        data: created,
        message: `Request barang ${created.request_number} berhasil dikirim dan menunggu ACC petugas gudang.`,
      },
      { status: 201 }
    );
  } catch (error: any) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : 400;
    console.error("Error in POST /api/public/inventory-requests:", error);
    return NextResponse.json(
      {
        success: false,
        field: error?.field,
        error: error?.message || "Gagal mengirim form request barang.",
      },
      { status }
    );
  }
}
