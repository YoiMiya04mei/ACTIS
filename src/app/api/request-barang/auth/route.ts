import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  createRememberToken,
  createSessionToken,
  invalidateRememberToken,
  invalidateSessionToken,
  verifyPassword,
  verifyPasswordFingerprint,
  verifyRememberToken,
  verifySessionToken,
} from "@/lib/auth";
import { parseUserAgent, recordActivity } from "@/lib/activityLogService";
import {
  checkRateLimit,
  getRememberCookieOptions,
  getRequestClientIp,
  getSessionCookieOptions,
  RB_REMEMBER_COOKIE_NAME,
  RB_SESSION_COOKIE_NAME,
  REMEMBER_TOKEN_MAX_AGE,
} from "@/lib/security";
import {
  findUserByLoginUsername,
  getConfiguredIdleTimeoutMinutes,
  hasRequestBarangAccess,
  isRequestBarangLoginRequired,
  normalizeUsername,
} from "@/lib/requestBarangAuth";

export const dynamic = "force-dynamic";

const STANDARD_SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours without Remember Me

function getDisplayUsername(user: { username?: string | null; email: string }): string {
  return user.username || user.email.split("@")[0] || user.email;
}

function clearRbRememberCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(RB_REMEMBER_COOKIE_NAME, "", {
    ...getRememberCookieOptions(0, request),
    maxAge: 0,
  });
  return response;
}

function clearRbSessionCookie(response: NextResponse, request?: NextRequest) {
  response.cookies.set(RB_SESSION_COOKIE_NAME, "", {
    ...getSessionCookieOptions(0, request),
    maxAge: 0,
  });
  return response;
}

export async function GET(request: NextRequest) {
  try {
    const [loginRequired, idleTimeoutMinutes] = await Promise.all([
      isRequestBarangLoginRequired(),
      getConfiguredIdleTimeoutMinutes(),
    ]);

    const rbSessionToken = request.cookies.get(RB_SESSION_COOKIE_NAME)?.value;
    const verified = verifySessionToken(rbSessionToken, "rb_session");

    let dbUser: {
      id: string;
      nama: string;
      email: string;
      username: string | null;
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
          username: true,
          role: true,
          request_barang_access: true,
        },
      });
    }

    const authenticated = Boolean(dbUser);
    const hasAccess = dbUser ? hasRequestBarangAccess(dbUser) : false;

    // Resolve valid Remember Me user for quick login card if not currently authenticated
    let rememberedUser: {
      id: string;
      nama: string;
      username: string;
      role: string;
    } | null = null;
    let shouldClearInvalidRemember = false;

    const rbRememberCookie = request.cookies.get(RB_REMEMBER_COOKIE_NAME)?.value;
    if (!authenticated && rbRememberCookie) {
      const remPayload = verifyRememberToken(rbRememberCookie, "rb_remember");
      if (!remPayload) {
        shouldClearInvalidRemember = true;
      } else {
        const remDbUser = await prisma.user.findUnique({
          where: { id: remPayload.id },
          select: {
            id: true,
            nama: true,
            email: true,
            username: true,
            role: true,
            request_barang_access: true,
            password_hash: true,
          },
        });
        if (
          !remDbUser ||
          !verifyPasswordFingerprint(remPayload.pwdSig, remDbUser.password_hash) ||
          !hasRequestBarangAccess(remDbUser)
        ) {
          shouldClearInvalidRemember = true;
        } else {
          rememberedUser = {
            id: remDbUser.id,
            nama: remDbUser.nama,
            username: getDisplayUsername(remDbUser),
            role: remDbUser.role,
          };
        }
      }
    }

    const response = NextResponse.json(
      {
        success: true,
        loginRequired,
        idleTimeoutMinutes,
        authenticated,
        hasAccess,
        user: dbUser
          ? {
              ...dbUser,
              username: getDisplayUsername(dbUser),
            }
          : null,
        rememberedUser,
        reason: !authenticated
          ? "AUTH_REQUIRED"
          : !hasAccess
            ? "NO_PERMISSION"
            : null,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } }
    );

    if (shouldClearInvalidRemember) {
      clearRbRememberCookie(response, request);
    }

    return response;
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
    const useRememberCookie = Boolean(body?.useRememberCookie);

    // Quick login via verified Remember Me token
    if (useRememberCookie) {
      const keepRememberMe = body?.rememberMe !== false;
      const rememberCookie = request.cookies.get(RB_REMEMBER_COOKIE_NAME)?.value;
      const remPayload = verifyRememberToken(rememberCookie, "rb_remember");
      if (!remPayload) {
        const res = NextResponse.json(
          {
            success: false,
            error: "Sesi Ingat Saya sudah kedaluwarsa. Silakan masuk dengan username dan password.",
          },
          { status: 401 }
        );
        return clearRbRememberCookie(res, request);
      }

      const dbUser = await prisma.user.findUnique({
        where: { id: remPayload.id },
        select: {
          id: true,
          nama: true,
          email: true,
          username: true,
          role: true,
          request_barang_access: true,
          password_hash: true,
        },
      });

      if (!dbUser || !verifyPasswordFingerprint(remPayload.pwdSig, dbUser.password_hash)) {
        const res = NextResponse.json(
          {
            success: false,
            error: "Sesi Ingat Saya tidak valid atau password telah diubah. Silakan masuk manual.",
          },
          { status: 401 }
        );
        return clearRbRememberCookie(res, request);
      }

      if (!hasRequestBarangAccess(dbUser)) {
        const res = NextResponse.json(
          {
            success: false,
            code: "NO_PERMISSION",
            error:
              "Akses akun ini ke Web /request-barang telah dinonaktifkan di menu Pengaturan User Akses.",
          },
          { status: 403 }
        );
        return clearRbRememberCookie(res, request);
      }

      const accLimit = checkRateLimit(`remember:acc:${dbUser.id}`, 10, 300);
      if (!accLimit.allowed) {
        return NextResponse.json(
          {
            success: false,
            error: `Terlalu banyak permintaan login cepat. Silakan tunggu ${accLimit.retryAfter} detik.`,
          },
          { status: 429 }
        );
      }

      if (rememberCookie) {
        invalidateRememberToken(rememberCookie, "rb_remember");
      }

      const sessionPayload = {
        id: dbUser.id,
        nama: dbUser.nama,
        email: dbUser.email,
        username: getDisplayUsername(dbUser),
        role: dbUser.role,
      };
      const sessionMaxAge = keepRememberMe ? REMEMBER_TOKEN_MAX_AGE : STANDARD_SESSION_MAX_AGE;
      const sessionToken = createSessionToken(sessionPayload, sessionMaxAge, {
        rememberMe: keepRememberMe,
        purpose: "rb_session",
      });

      recordActivity({
        nama_lengkap: dbUser.nama,
        email: dbUser.email,
        ip_address: clientIp,
        tipe: "LOGIN_SUCCESS",
        aktifitas: `Berhasil login ke portal Web /request-barang via Ingat Saya (@${sessionPayload.username}) — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      const response = NextResponse.json({
        success: true,
        message: "Berhasil masuk ke portal Request Barang.",
        user: {
          ...sessionPayload,
          request_barang_access: dbUser.request_barang_access,
        },
        rememberMe: keepRememberMe,
      });

      response.cookies.set(
        RB_SESSION_COOKIE_NAME,
        sessionToken,
        getSessionCookieOptions(sessionMaxAge, request)
      );

      if (keepRememberMe) {
        const rotatedRemember = createRememberToken(
          { id: dbUser.id, email: dbUser.email },
          dbUser.password_hash,
          REMEMBER_TOKEN_MAX_AGE,
          "rb_remember"
        );
        response.cookies.set(
          RB_REMEMBER_COOKIE_NAME,
          rotatedRemember,
          getRememberCookieOptions(REMEMBER_TOKEN_MAX_AGE, request)
        );
      } else {
        clearRbRememberCookie(response, request);
      }

      return response;
    }

    // Standard Username + Password Login
    const rawUsername = String(body?.username ?? "").trim();
    const cleanUsername = normalizeUsername(rawUsername);
    const password = String(body?.password || "");
    const useRemember = Boolean(body?.rememberMe);

    if (!cleanUsername || !password) {
      return NextResponse.json(
        { success: false, error: "Username dan password wajib diisi." },
        { status: 400 }
      );
    }

    if (cleanUsername.includes("@")) {
      return NextResponse.json(
        {
          success: false,
          error: "Gunakan username (bukan alamat email) untuk login ke portal /request-barang.",
        },
        { status: 400 }
      );
    }

    const accountLimit = checkRateLimit(`login:acc:${cleanUsername}`, 5, 300);
    if (!accountLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Akun ini terkunci sementara karena terlalu banyak percobaan login yang gagal. Silakan tunggu ${accountLimit.retryAfter} detik.`,
        },
        { status: 429 }
      );
    }

    const user = await findUserByLoginUsername(cleanUsername);

    if (!user || !verifyPassword(password, user.password_hash, user.email)) {
      recordActivity({
        nama_lengkap: user?.nama || cleanUsername,
        email: user?.email || cleanUsername,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login portal /request-barang gagal — kredensial salah untuk username '${cleanUsername}' — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Username atau password salah." },
        { status: 401 }
      );
    }

    if (!hasRequestBarangAccess(user)) {
      recordActivity({
        nama_lengkap: user.nama,
        email: user.email,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login portal /request-barang ditolak — akun @${getDisplayUsername(user)} belum diizinkan di Pengaturan User Akses (${userAgent})`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        {
          success: false,
          code: "NO_PERMISSION",
          error:
            "Akun Anda belum diizinkan login ke Web /request-barang. Minta Administrator mengaktifkannya di menu Pengaturan User Akses.",
        },
        { status: 403 }
      );
    }

    const displayUsername = getDisplayUsername(user);
    const sessionPayload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      username: displayUsername,
      role: user.role,
    };

    const sessionMaxAge = useRemember ? REMEMBER_TOKEN_MAX_AGE : STANDARD_SESSION_MAX_AGE;
    const token = createSessionToken(sessionPayload, sessionMaxAge, {
      rememberMe: useRemember,
      purpose: "rb_session",
    });

    recordActivity({
      nama_lengkap: user.nama,
      email: user.email,
      ip_address: clientIp,
      tipe: "LOGIN_SUCCESS",
      aktifitas: useRemember
        ? `Berhasil login ke portal Web /request-barang (@${displayUsername}, Ingat Saya aktif) — ${userAgent}`
        : `Berhasil login ke portal Web /request-barang (@${displayUsername}) — ${userAgent}`,
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

    response.cookies.set(
      RB_SESSION_COOKIE_NAME,
      token,
      getSessionCookieOptions(sessionMaxAge, request)
    );

    const existingRemember = request.cookies.get(RB_REMEMBER_COOKIE_NAME)?.value;
    if (useRemember) {
      if (existingRemember) {
        invalidateRememberToken(existingRemember, "rb_remember");
      }
      const rememberToken = createRememberToken(
        { id: user.id, email: user.email },
        user.password_hash,
        REMEMBER_TOKEN_MAX_AGE,
        "rb_remember"
      );
      response.cookies.set(
        RB_REMEMBER_COOKIE_NAME,
        rememberToken,
        getRememberCookieOptions(REMEMBER_TOKEN_MAX_AGE, request)
      );
    } else {
      if (existingRemember) {
        invalidateRememberToken(existingRemember, "rb_remember");
      }
      clearRbRememberCookie(response, request);
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
  const body = await request.json().catch(() => ({}));
  const isIdleTimeout =
    body?.reason === "timeout" || request.nextUrl.searchParams.get("reason") === "timeout";
  const forgetDevice =
    Boolean(body?.forgetDevice) || request.nextUrl.searchParams.get("forgetDevice") === "1";

  const sessionCookie = request.cookies.get(RB_SESSION_COOKIE_NAME)?.value;
  const sessionUser = verifySessionToken(sessionCookie, "rb_session");

  if (sessionUser) {
    invalidateSessionToken(sessionCookie, "rb_session");
    recordActivity({
      nama_lengkap: sessionUser.nama,
      email: sessionUser.email,
      ip_address: clientIp,
      tipe: "LOGOUT",
      aktifitas: isIdleTimeout
        ? `Sesi portal /request-barang ditutup otomatis (idle timeout) — ${userAgent}`
        : `Keluar dari portal Web /request-barang — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});
  }

  const response = NextResponse.json({
    success: true,
    message: "Berhasil keluar dari portal Web Request Barang.",
    preservedRememberMe: Boolean(request.cookies.get(RB_REMEMBER_COOKIE_NAME)?.value) && !forgetDevice,
  });

  clearRbSessionCookie(response, request);

  if (forgetDevice) {
    const rememberCookie = request.cookies.get(RB_REMEMBER_COOKIE_NAME)?.value;
    if (rememberCookie) {
      invalidateRememberToken(rememberCookie, "rb_remember");
    }
    clearRbRememberCookie(response, request);
  }

  return response;
}
