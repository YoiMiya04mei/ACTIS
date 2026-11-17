import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createRememberToken,
  createSessionToken,
  invalidateRememberToken,
  invalidateSessionToken,
  verifyPassword,
  verifySessionToken,
} from "@/lib/auth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";
import {
  checkRateLimit,
  getRememberCookieOptions,
  getRequestClientIp,
  getSessionCookieOptions,
  REMEMBER_COOKIE_NAME,
  REMEMBER_TOKEN_MAX_AGE,
} from "@/lib/security";
import {
  hasRequestBarangAccess,
  isRequestBarangLoginRequired,
} from "@/lib/requestBarangAuth";

export const dynamic = "force-dynamic";

const STANDARD_SESSION_MAX_AGE = 60 * 60 * 24;

export async function GET(request: NextRequest) {
  try {
    const loginRequired = await isRequestBarangLoginRequired();
    const sessionToken = request.cookies.get("actis_session")?.value;
    const verified = verifySessionToken(sessionToken);

    let dbUser: {
      id: string;
      nama: string;
      email: string;
      role: string;
      request_barang_access: boolean | null;
    } | null = null;

    if (verified) {
      dbUser = await prisma.user.findUnique({
        where: { id: verified.id },
        select: {
          id: true,
          nama: true,
          email: true,
          role: true,
          request_barang_access: true,
        },
      });
    }

    const authenticated = Boolean(dbUser);
    const hasAccess = dbUser ? hasRequestBarangAccess(dbUser) : false;

    return NextResponse.json(
      {
        success: true,
        loginRequired,
        authenticated,
        hasAccess,
        user: dbUser,
        reason: !authenticated
          ? "AUTH_REQUIRED"
          : !hasAccess
            ? "NO_PERMISSION"
            : null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (err: any) {
    console.error("GET /api/request-barang/auth error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal memeriksa status autentikasi /request-barang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getRequestClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    const ipLimit = checkRateLimit(`login:ip:${clientIp}`, 15, 60);
    if (!ipLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Terlalu banyak percobaan login. Silakan tunggu ${ipLimit.retryAfter} detik sebelum mencoba kembali.`,
        },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const useRemember = Boolean(body?.rememberMe);

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const accountLimit = checkRateLimit(`login:acc:${email}`, 5, 300);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Akun ini terkunci sementara karena terlalu banyak percobaan login yang gagal. Silakan tunggu ${accountLimit.retryAfter} detik.`,
        },
        { status: 429 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        request_barang_access: true,
        password_hash: true,
      },
    });

    if (!user || !verifyPassword(password, user.password_hash, user.email)) {
      recordActivity({
        nama_lengkap: user?.nama || email.split("@")[0] || email,
        email,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login portal /request-barang gagal — kredensial salah untuk ${email} — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    if (!hasRequestBarangAccess(user)) {
      recordActivity({
        nama_lengkap: user.nama,
        email: user.email,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login portal /request-barang ditolak — akun belum memiliki izin di Pengaturan User Akses (${userAgent})`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          code: "NO_PERMISSION",
          error:
            "Akun Anda tidak diizinkan login ke Web /request-barang. Minta Administrator mengaktifkannya di menu Pengaturan User Akses.",
        },
        { status: 403 }
      );
    }

    const sessionPayload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
    };

    const sessionMaxAge = useRemember ? REMEMBER_TOKEN_MAX_AGE : STANDARD_SESSION_MAX_AGE;
    const token = createSessionToken(sessionPayload, sessionMaxAge, { rememberMe: useRemember });

    recordActivity({
      nama_lengkap: user.nama,
      email: user.email,
      ip_address: clientIp,
      tipe: "LOGIN_SUCCESS",
      aktifitas: `Berhasil login ke portal Web /request-barang — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "Login Web Request Barang berhasil.",
      user: {
        ...sessionPayload,
        request_barang_access: user.request_barang_access,
      },
      rememberMe: useRemember,
    });

    response.cookies.set("actis_session", token, getSessionCookieOptions(sessionMaxAge, request));

    if (useRemember) {
      const existingRemember = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
      if (existingRemember) {
        invalidateRememberToken(existingRemember);
      }
      const rememberToken = createRememberToken(
        { id: user.id, email: user.email },
        user.password_hash,
        REMEMBER_TOKEN_MAX_AGE
      );
      response.cookies.set(
        REMEMBER_COOKIE_NAME,
        rememberToken,
        getRememberCookieOptions(REMEMBER_TOKEN_MAX_AGE, request)
      );
    }

    return response;
  } catch (err: any) {
    console.error("POST /api/request-barang/auth error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal memproses login Web Request Barang." },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  const clientIp = getRequestClientIp(request);
  const userAgent = parseUserAgent(request.headers.get("user-agent"));
  const sessionCookie = request.cookies.get("actis_session")?.value;
  const sessionUser = verifySessionToken(sessionCookie);

  if (sessionUser) {
    invalidateSessionToken(sessionCookie);
    recordActivity({
      nama_lengkap: sessionUser.nama,
      email: sessionUser.email,
      ip_address: clientIp,
      tipe: "LOGOUT",
      aktifitas: `Keluar dari portal Web /request-barang — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});
  }

  const rememberCookie = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
  if (rememberCookie) {
    invalidateRememberToken(rememberCookie);
  }

  const response = NextResponse.json({
    success: true,
    message: "Berhasil keluar dari portal Web Request Barang.",
  });

  response.cookies.set("actis_session", "", {
    ...getSessionCookieOptions(0, request),
    maxAge: 0,
  });
  response.cookies.set(REMEMBER_COOKIE_NAME, "", {
    ...getRememberCookieOptions(0, request),
    maxAge: 0,
  });

  return response;
}
