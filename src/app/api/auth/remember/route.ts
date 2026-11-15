import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyRememberToken,
  createSessionToken,
  createRememberToken,
  invalidateRememberToken,
  verifyPasswordFingerprint,
} from "@/lib/auth";
import {
  REMEMBER_COOKIE_NAME,
  REMEMBER_TOKEN_MAX_AGE,
  checkRateLimit,
  getSessionCookieOptions,
  getRememberCookieOptions,
  getRequestClientIp,
} from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

async function resolveRememberedUser(request: NextRequest) {
  const rememberCookie = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
  if (!rememberCookie) {
    return { status: "missing" as const };
  }

  const payload = verifyRememberToken(rememberCookie);
  if (!payload) {
    return { status: "invalid" as const, rememberCookie };
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: payload.id },
    select: {
      id: true,
      nama: true,
      email: true,
      role: true,
      password_hash: true,
    },
  });

  if (!dbUser || !verifyPasswordFingerprint(payload.pwdSig, dbUser.password_hash)) {
    return { status: "invalid" as const, rememberCookie };
  }

  return {
    status: "valid" as const,
    rememberCookie,
    payload,
    dbUser,
  };
}

function clearRememberCookie(response: NextResponse) {
  response.cookies.set(REMEMBER_COOKIE_NAME, "", {
    ...getRememberCookieOptions(0),
    maxAge: 0,
  });
  return response;
}

/**
 * GET /api/auth/remember
 * Checks if a valid, unrevoked, password-matched Remember Me cookie exists for quick login UI.
 */
export async function GET(request: NextRequest) {
  try {
    const resolved = await resolveRememberedUser(request);

    if (resolved.status !== "valid") {
      const response = NextResponse.json(
        { success: true, remembered: false, user: null },
        { headers: { "Cache-Control": "no-store" } }
      );
      if (resolved.status === "invalid") {
        clearRememberCookie(response);
      }
      return response;
    }

    return NextResponse.json(
      {
        success: true,
        remembered: true,
        user: {
          id: resolved.dbUser.id,
          nama: resolved.dbUser.nama,
          email: resolved.dbUser.email,
          role: resolved.dbUser.role,
        },
        expiresAt: resolved.payload.exp * 1000,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err: any) {
    console.error("GET /api/auth/remember error:", err);
    return NextResponse.json(
      { success: false, remembered: false, error: "Gagal memeriksa status Ingat Saya." },
      { status: 500 }
    );
  }
}

/**
 * POST /api/auth/remember
 * Exchanges a verified Remember Me token for a fresh authenticated session and rotated token.
 */
export async function POST(request: NextRequest) {
  try {
    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    const ipLimit = checkRateLimit(`remember:ip:${clientIp}`, 15, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan login cepat. Silakan tunggu ${ipLimit.retryAfter} detik.`,
        },
        { status: 429 }
      );
    }

    const resolved = await resolveRememberedUser(request);
    if (resolved.status !== "valid") {
      const response = NextResponse.json(
        {
          success: false,
          error:
            resolved.status === "invalid"
              ? "Sesi Ingat Saya sudah kedaluwarsa atau kata sandi telah diubah. Silakan masuk manual dengan email dan password."
              : "Data Ingat Saya tidak ditemukan. Silakan masuk dengan email dan password.",
        },
        { status: 401 }
      );
      return clearRememberCookie(response);
    }

    const accountLimit = checkRateLimit(`remember:acc:${resolved.dbUser.id}`, 10, 300);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak permintaan untuk akun ini. Silakan tunggu ${accountLimit.retryAfter} detik.`,
        },
        { status: 429 }
      );
    }

    const sessionPayload = {
      id: resolved.dbUser.id,
      nama: resolved.dbUser.nama,
      email: resolved.dbUser.email,
      role: resolved.dbUser.role,
    };

    // Rotate Remember Me token to prevent token replay
    invalidateRememberToken(resolved.rememberCookie);

    const sessionToken = createSessionToken(sessionPayload, REMEMBER_TOKEN_MAX_AGE, {
      rememberMe: true,
    });
    const nextRememberToken = createRememberToken(
      { id: resolved.dbUser.id, email: resolved.dbUser.email },
      resolved.dbUser.password_hash,
      REMEMBER_TOKEN_MAX_AGE
    );

    recordActivity({
      nama_lengkap: resolved.dbUser.nama,
      email: resolved.dbUser.email,
      ip_address: clientIp,
      tipe: "LOGIN_SUCCESS",
      aktifitas: `Berhasil login ke aplikasi via Remember Me — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "Berhasil masuk kembali dengan Ingat Saya.",
      user: sessionPayload,
      rememberMe: true,
    });

    response.cookies.set("actis_session", sessionToken, getSessionCookieOptions(REMEMBER_TOKEN_MAX_AGE));
    response.cookies.set(
      REMEMBER_COOKIE_NAME,
      nextRememberToken,
      getRememberCookieOptions(REMEMBER_TOKEN_MAX_AGE)
    );

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/remember error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memproses Masuk Cepat." },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/auth/remember
 * Revokes and clears the Remember Me token on this device ("Ganti Akun / Lupakan").
 */
export async function DELETE(request: NextRequest) {
  const rememberCookie = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
  if (rememberCookie) {
    invalidateRememberToken(rememberCookie);
  }

  const response = NextResponse.json({
    success: true,
    message: "Data Ingat Saya di perangkat ini berhasil dihapus.",
  });
  return clearRememberCookie(response);
}
