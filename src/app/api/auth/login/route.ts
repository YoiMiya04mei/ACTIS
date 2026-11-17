import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  verifyPassword,
  createSessionToken,
  createRememberToken,
  invalidateRememberToken,
} from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  checkRateLimit,
  getSessionCookieOptions,
  getRememberCookieOptions,
  REMEMBER_COOKIE_NAME,
  REMEMBER_TOKEN_MAX_AGE,
} from "@/lib/security";

const STANDARD_SESSION_MAX_AGE = 60 * 60 * 24; // 24 hours without Remember Me

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "103.155.196.63";
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    // Rate Limiting Protection (Brute Force Defense)
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
    const { email, password, rememberMe } = body;
    const useRemember = Boolean(rememberMe);

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // Account-specific rate limit
    const accountLimit = checkRateLimit(`login:acc:${cleanEmail}`, 5, 300);
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
      where: { email: cleanEmail },
    });

    if (!user) {
      recordActivity({
        nama_lengkap: cleanEmail.split("@")[0] || cleanEmail,
        email: cleanEmail,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login gagal — username ${cleanEmail.split("@")[0] || cleanEmail} tidak ditemukan — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    const isValid = verifyPassword(password, user.password_hash, user.email);
    if (!isValid) {
      recordActivity({
        nama_lengkap: user.nama || cleanEmail.split("@")[0] || cleanEmail,
        email: cleanEmail,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login gagal — password salah untuk ${cleanEmail} — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: user.id,
      nama: user.nama,
      email: user.email,
      role: user.role,
    };

    const userResponsePayload = {
      ...sessionPayload,
      request_barang_access: user.request_barang_access,
    };

    const sessionMaxAge = useRemember ? REMEMBER_TOKEN_MAX_AGE : STANDARD_SESSION_MAX_AGE;
    const token = createSessionToken(sessionPayload, sessionMaxAge, { rememberMe: useRemember });

    // Record login success log
    recordActivity({
      nama_lengkap: user.nama,
      email: user.email,
      ip_address: clientIp,
      tipe: "LOGIN_SUCCESS",
      aktifitas: useRemember
        ? `Berhasil login ke aplikasi (Ingat Saya aktif) — ${userAgent}`
        : `Berhasil login ke aplikasi — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      user: userResponsePayload,
      rememberMe: useRemember,
    });

    // Set secure HttpOnly session cookie
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
    } else {
      const existingRemember = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
      if (existingRemember) {
        invalidateRememberToken(existingRemember);
      }
      response.cookies.set(REMEMBER_COOKIE_NAME, "", {
        ...getRememberCookieOptions(0, request),
        maxAge: 0,
      });
    }

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal melakukan proses autentikasi." },
      { status: 500 }
    );
  }
}
