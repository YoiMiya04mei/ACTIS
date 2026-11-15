import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, invalidateSessionToken, invalidateRememberToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { getSessionCookieOptions, getRememberCookieOptions, REMEMBER_COOKIE_NAME } from "@/lib/security";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "103.155.196.63";
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const isIdleTimeout = body?.reason === "timeout";
  const forgetDevice = Boolean(body?.forgetDevice);

  const sessionCookie = request.cookies.get("actis_session")?.value;
  const sessionUser = verifySessionToken(sessionCookie);
  const hasRememberCookie = Boolean(request.cookies.get(REMEMBER_COOKIE_NAME)?.value);
  const clientIp = getClientIp(request);
  const userAgent = parseUserAgent(request.headers.get("user-agent"));

  if (sessionUser) {
    // Cryptographically revoke the session token so it cannot be re-used
    invalidateSessionToken(sessionCookie);

    recordActivity({
      nama_lengkap: sessionUser.nama,
      email: sessionUser.email,
      ip_address: clientIp,
      tipe: "LOGOUT",
      aktifitas: isIdleTimeout
        ? `Sesi ditutup otomatis (idle timeout) — logout dari aplikasi — ${userAgent}`
        : `Sesi ditutup — logout dari aplikasi — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});
  }

  const preservedRememberMe = hasRememberCookie && !forgetDevice;

  const response = NextResponse.json({
    success: true,
    message: "Logout berhasil.",
    preservedRememberMe,
  });

  // Always revoke and clear active session cookie
  response.cookies.set("actis_session", "", {
    ...getSessionCookieOptions(0, request),
    maxAge: 0,
  });

  // Preserve Remember Me token across idle timeouts and standard logouts when opted in;
  // only revoke when explicitly requested (`forgetDevice`), via `Ganti Akun`, or unchecking Remember Me at next login.
  if (forgetDevice) {
    const rememberCookie = request.cookies.get(REMEMBER_COOKIE_NAME)?.value;
    if (rememberCookie) {
      invalidateRememberToken(rememberCookie);
    }
    response.cookies.set(REMEMBER_COOKIE_NAME, "", {
      ...getRememberCookieOptions(0, request),
      maxAge: 0,
    });
  }

  return response;
}
