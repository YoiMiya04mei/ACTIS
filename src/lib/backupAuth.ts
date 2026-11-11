import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export interface AuthenticatedBackupUser {
  id: string;
  nama: string;
  email: string;
  role: string;
}

/**
 * Enforce strict session cookie verification + live DB role check for Backup Config endpoints.
 * Allowed roles: 'admin' and 'noc_engineer'.
 * Destructive & GDrive/global settings mutations can require 'admin'.
 */
export async function requireBackupAuth(
  request: NextRequest,
  options?: { requireAdmin?: boolean }
): Promise<
  | { ok: true; user: AuthenticatedBackupUser }
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
          error: "Akses ditolak: Fitur Network Config Backup hanya tersedia untuk Administrator dan NOC Engineer.",
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
          error: "Akses ditolak: Tindakan ini hanya diizinkan untuk akun Administrator.",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, user: dbUser };
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "127.0.0.1";
}

export function resolveAppOrigin(request: NextRequest): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured && configured.startsWith("http") && !configured.includes("perusahaan-anda.net")) {
    return configured.replace(/\/+$/, "");
  }
  const proto = request.headers.get("x-forwarded-proto") || "http";
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host") || "localhost:3000";
  return `${proto}://${host}`;
}
