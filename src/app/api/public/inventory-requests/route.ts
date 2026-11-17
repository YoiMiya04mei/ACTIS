import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  RB_SESSION_COOKIE_NAME,
  verifySecureSessionToken,
  type AuthenticatedUser,
} from "@/lib/security";
import {
  createPublicInventoryRequest,
  getPublicInventoryCatalog,
} from "@/lib/inventoryService";
import { triggerInventoryMirrorSync } from "@/lib/inventoryMirrorService";
import {
  hasRequestBarangAccess,
  isRequestBarangLoginRequired,
} from "@/lib/requestBarangAuth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";

function extractRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

async function guardRequestBarangApiAccess(
  request: NextRequest
): Promise<
  | { ok: true; user: AuthenticatedUser | null }
  | { ok: false; response: NextResponse }
> {
  const loginRequired = await isRequestBarangLoginRequired();
  const rbToken = request.cookies.get(RB_SESSION_COOKIE_NAME)?.value;
  const session = verifySecureSessionToken(rbToken, "rb_session");

  let dbUser: AuthenticatedUser | null = null;
  if (session) {
    dbUser = await prisma.user.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        nama: true,
        email: true,
        username: true,
        role: true,
        request_barang_access: true,
      },
    });
  }

  if (!dbUser) {
    if (loginRequired) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            success: false,
            code: "AUTH_REQUIRED",
            error: "Silakan login ke portal Web Request Barang terlebih dahulu.",
          },
          { status: 401 }
        ),
      };
    }
    return { ok: true, user: null };
  }

  if (loginRequired && !hasRequestBarangAccess(dbUser)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "NO_PERMISSION",
          error:
            "Akun Anda tidak diizinkan mengakses Web /request-barang. Hubungi Administrator di menu Pengaturan User Akses.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user: dbUser };
}

export async function GET(request: NextRequest) {
  const access = await guardRequestBarangApiAccess(request);
  if (!access.ok) return access.response;

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
  const access = await guardRequestBarangApiAccess(request);
  if (!access.ok) return access.response;

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

    if (access.user) {
      recordActivity({
        nama_lengkap: access.user.nama,
        email: access.user.email,
        ip_address: ip === "unknown" ? "103.155.196.63" : ip,
        tipe: "UPDATE_DATA",
        aktifitas: `Mengirim Form Request Barang Keluar ${created.request_number} (PIC: ${created.pic_name}) melalui portal /request-barang`,
        user_agent: parseUserAgent(request.headers.get("user-agent")),
      }).catch(() => {});
    }

    triggerInventoryMirrorSync({
      event: "REQUEST_CREATE",
      triggeredBy: access.user
        ? `${created.pic_name} (${access.user.nama})`
        : created.pic_name || "Form Request Barang",
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
