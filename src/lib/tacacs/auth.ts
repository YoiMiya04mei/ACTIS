import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthenticatedTacacsUser {
  id: string;
  nama: string;
  email: string;
  role: string;
}

/**
 * Enforce strict session cookie verification + live DB role check for TACACS+ endpoints.
 * Allowed roles: 'admin' and 'noc_engineer'.
 * Mutations (create/edit/delete users, groups, clients, settings, start/stop server) require 'admin'.
 */
export async function requireTacacsAuth(
  request: NextRequest,
  options?: { requireAdmin?: boolean }
): Promise<
  | { ok: true; user: AuthenticatedTacacsUser }
  | { ok: false; response: NextResponse }
> {
  const token = request.cookies.get("actis_session")?.value;
  const session = verifySessionToken(token);

  if (!session) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          error: "Sesi login tidak ditemukan atau telah kedaluwarsa. Silakan login terlebih dahulu.",
        },
        { status: 401 }
      ),
    };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: session.id },
    select: { id: true, nama: true, email: true, role: true },
  });

  if (!dbUser) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "AUTH_REQUIRED",
          error: "Akun pengguna tidak ditemukan di database. Silakan login kembali.",
        },
        { status: 401 }
      ),
    };
  }

  const allowedRoles = ["admin", "noc_engineer"];
  if (!allowedRoles.includes(dbUser.role)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN",
          error: "Akses ditolak: Fitur TACACS+ Server hanya tersedia untuk Administrator dan NOC Engineer.",
        },
        { status: 403 }
      ),
    };
  }

  if (options?.requireAdmin && dbUser.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "FORBIDDEN_ADMIN_ONLY",
          error: "Akses ditolak: Konfigurasi dan kontrol server TACACS+ hanya diizinkan untuk Administrator.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user: dbUser };
}

