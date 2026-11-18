import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  ALL_ACTIS_MENU_ITEMS,
  ACTIS_ACCESS_CATEGORIES,
} from "@/lib/accessLevels";
import {
  createCustomRoleLevel,
  deleteCustomRoleLevel,
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
        rolesList: store.rolesList,
        customRoles: store.customRoles,
        permissionsByRole: isAdmin ? store.roles : undefined,
        rolesMeta: isAdmin ? store.rolesList : undefined,
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

    if (body.action === "create_role") {
      try {
        const result = await createCustomRoleLevel(
          {
            name: String(body.name || ""),
            copyFromRole:
              typeof body.copyFromRole === "string" ? body.copyFromRole : null,
            description:
              typeof body.description === "string" ? body.description : null,
          },
          auth.user.nama
        );

        recordActivity({
          nama_lengkap: auth.user.nama,
          email: auth.user.email,
          ip_address: clientIp,
          tipe: "SETTING_UPDATE",
          aktifitas: `Menambahkan Level Akses user baru: ${result.createdRole.label} (${result.createdRole.key})`,
          detail: `Menu aktif awal: ${result.state.roles[result.createdRole.key]?.length ?? 0} menu`,
          user_agent: userAgent,
        }).catch(() => {});

        return NextResponse.json(
          {
            success: true,
            message: `Level user "${result.createdRole.label}" berhasil ditambahkan.`,
            createdRole: result.createdRole,
            myRole: auth.user.role,
            myAllowedMenus: getAllowedMenusForRole(result.state.roles, auth.user.role),
            rolesList: result.state.rolesList,
            customRoles: result.state.customRoles,
            permissionsByRole: result.state.roles,
            updatedAt: result.state.updatedAt,
            updatedBy: result.state.updatedBy,
          },
          { status: 201, headers: NO_CACHE_HEADERS }
        );
      } catch (err: unknown) {
        return NextResponse.json(
          {
            success: false,
            error:
              err instanceof Error ? err.message : "Gagal membuat level user baru.",
          },
          { status: 400, headers: NO_CACHE_HEADERS }
        );
      }
    }

    let saved;
    let activityText = "Memperbarui konfigurasi Level Akses menu ACTIS";
    let activityDetail = "";

    if (body.action === "reset") {
      const targetRole = typeof body.role === "string" ? body.role.trim() : null;
      const before = await getStoredAccessLevels();
      if (targetRole && !before.rolesList.some((r) => r.key === targetRole)) {
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
      const summary = saved.rolesList
        .map(
          (r) => `${r.key}:${saved!.roles[r.key]?.length ?? 1}/${ALL_ACTIS_MENU_ITEMS.length}`
        )
        .join(", ");
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
        rolesList: saved.rolesList,
        customRoles: saved.customRoles,
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

export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    let roleKey = searchParams.get("role")?.trim() || "";
    if (!roleKey) {
      const body = await request.json().catch(() => null);
      if (body && typeof body.role === "string") {
        roleKey = body.role.trim();
      }
    }

    if (!roleKey) {
      return NextResponse.json(
        { success: false, error: "Parameter 'role' wajib diisi." },
        { status: 400, headers: NO_CACHE_HEADERS }
      );
    }

    const result = await deleteCustomRoleLevel(roleKey, auth.user.nama);
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "SETTING_UPDATE",
      aktifitas: `Menghapus Level Akses buatan sendiri: ${result.deletedRole.label} (${result.deletedRole.key})`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json(
      {
        success: true,
        message: `Level user "${result.deletedRole.label}" berhasil dihapus.`,
        deletedRole: result.deletedRole,
        myRole: auth.user.role,
        myAllowedMenus: getAllowedMenusForRole(result.state.roles, auth.user.role),
        rolesList: result.state.rolesList,
        customRoles: result.state.customRoles,
        permissionsByRole: result.state.roles,
        updatedAt: result.state.updatedAt,
        updatedBy: result.state.updatedBy,
      },
      { headers: NO_CACHE_HEADERS }
    );
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error:
          err instanceof Error ? err.message : "Gagal menghapus level user.",
      },
      { status: 400, headers: NO_CACHE_HEADERS }
    );
  }
}
