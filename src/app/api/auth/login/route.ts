import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, createSessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { checkRateLimit, getSessionCookieOptions } from "@/lib/security";

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
    const { email, password } = body;

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

    const token = createSessionToken(sessionPayload);

    // Record login success log
    recordActivity({
      nama_lengkap: user.nama,
      email: user.email,
      ip_address: clientIp,
      tipe: "LOGIN_SUCCESS",
      aktifitas: `Berhasil login ke aplikasi — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});

    const response = NextResponse.json({
      success: true,
      message: "Login berhasil.",
      user: sessionPayload,
    });

    // Set secure HttpOnly session cookie
    response.cookies.set("actis_session", token, getSessionCookieOptions(60 * 60 * 24 * 7));

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { success: false, error: err?.message || "Gagal melakukan proses autentikasi." },
      { status: 500 }
    );
  }
}
