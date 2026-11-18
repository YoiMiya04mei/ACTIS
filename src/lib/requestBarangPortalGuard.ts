import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RB_SESSION_COOKIE_NAME, verifySecureSessionToken } from "@/lib/security";
import {
  buildPortalSyntheticEmail,
  isRequestBarangLoginRequired,
} from "@/lib/requestBarangAuth";

export interface PortalSessionActor {
  id: string;
  nama: string;
  username: string;
  email: string;
}

export function extractPortalRequestIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  return realIp || "unknown";
}

/**
 * Guards all `/api/public/*` portal endpoints used by `/request-barang`.
 * When `request_barang_require_login` is enabled (default), requires an active
 * `RequestBarangAccount` authenticated via the isolated `actis_rb_session` cookie.
 */
export async function guardRequestBarangApiAccess(
  request: NextRequest
): Promise<
  | { ok: true; user: PortalSessionActor | null }
  | { ok: false; response: NextResponse }
> {
  const loginRequired = await isRequestBarangLoginRequired();
  const rbToken = request.cookies.get(RB_SESSION_COOKIE_NAME)?.value;
  const session = verifySecureSessionToken(rbToken, "rb_session");

  let dbAccount: {
    id: string;
    nama: string;
    username: string;
    is_active: boolean;
  } | null = null;

  if (session) {
    dbAccount = await prisma.requestBarangAccount.findUnique({
      where: { id: session.id },
      select: {
        id: true,
        nama: true,
        username: true,
        is_active: true,
      },
    });
  }

  if (!dbAccount) {
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

  if (loginRequired && !dbAccount.is_active) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          code: "NO_PERMISSION",
          error:
            "Akun Web /request-barang ini sedang dinonaktifkan oleh Administrator di menu Pengaturan User Akses.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    ok: true,
    user: {
      id: dbAccount.id,
      nama: dbAccount.nama,
      username: dbAccount.username,
      email: buildPortalSyntheticEmail(dbAccount.username),
    },
  };
}
