import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  ALL_ACTIS_MENU_ITEMS,
  ACTIS_ACCESS_CATEGORIES,
  ACTIS_ROLE_LEVELS,
  isValidActisRoleKey,
} from "@/lib/accessLevels";
import {
  getAllowedMenusForRole,
  getStoredAccessLevels,
  resetStoredAccessLevels,
  saveStoredAccessLevels,
} from "@/lib/accessLevelsStore";

export const dynamic = "force-dynamic";

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
};

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const store = await getStoredAccessLevels();
    const isAdmin = auth.user.role === "admin";
    const myAllowedMenus = getAllowedMenusForRole(store.roles, auth.user.role);

    return NextResponse.json(
      {
        success: true,
        myRole: auth.user.role,
        myAllowedMenus,
        canManage: isAdmin,
        permissionsByRole: isAdmin ? store.roles : undefined,
        rolesMeta: isAdmin ? ACTIS_ROLE_LEVELS : undefined,
        categories: isAdmin ? ACTIS_ACCESS_CATEGORIES : undefined,
        totalMenus: ALL_ACTIS_MENU_ITEMS.length,
        updatedAt: store.updatedAt,
        updatedBy: store.updatedBy,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error("GET /api/access-levels error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memuat konfigurasi Level Akses." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Payload JSON tidak valid." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    let saved;
    let activityText = "Memperbarui konfigurasi Level Akses menu ACTIS";
    let activityDetail = "";

    if (body.action === "reset") {
      const targetRole = typeof body.role === "string" ? body.role.trim() : null;
      if (targetRole && !isValidActisRoleKey(targetRole)) {
        return NextResponse.json(
          { success: false, error: `Role '${targetRole}' tidak dikenal.` },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
      saved = await resetStoredAccessLevels(targetRole, auth.user.nama);
      activityText = targetRole
        ? `Mereset Level Akses role [${targetRole}] ke standar default`
        : "Mereset seluruh konfigurasi Level Akses ke standar default";
    } else if (body.roles && typeof body.roles === "object") {
      saved = await saveStoredAccessLevels(body.roles, auth.user.nama);
      const summary = ACTIS_ROLE_LEVELS.map(
        (r) => `${r.key}:${saved!.roles[r.key].length}/${ALL_ACTIS_MENU_ITEMS.length}`
      ).join(", ");
      activityDetail = summary;
    } else {
      return NextResponse.json(
        { success: false, error: "Parameter 'roles' atau 'action' wajib diisi." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: activityText,
      detail: activityDetail,
      user_agent: userAgent,
    }).catch(() => {});

    const myAllowedMenus = getAllowedMenusForRole(saved.roles, auth.user.role);

    return NextResponse.json(
      {
        success: true,
        message: "Konfigurasi Level Akses berhasil disimpan.",
        myRole: auth.user.role,
        myAllowedMenus,
        permissionsByRole: saved.roles,
        updatedAt: saved.updatedAt,
        updatedBy: saved.updatedBy,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    console.error("PUT /api/access-levels error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal menyimpan konfigurasi Level Akses." },
      { status: 500, headers: NO_CACHE_HEADERS }
    );
  }
}

export async function POST(request: NextRequest) {
  return PUT(request);
}
