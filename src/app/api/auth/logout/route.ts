import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken, invalidateSessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { getSessionCookieOptions } from "@/lib/security";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "103.155.196.63";
}

export async function POST(request: NextRequest) {
  const sessionCookie = request.cookies.get("actis_session")?.value;
  const sessionUser = verifySessionToken(sessionCookie);
  const clientIp = getClientIp(request);
  const userAgent = parseUserAgent(request.headers.get("user-agent"));

  if (sessionUser) {
    // Cryptographically revoke the token so it cannot be re-used
    invalidateSessionToken(sessionCookie);

    recordActivity({
      nama_lengkap: sessionUser.nama,
      email: sessionUser.email,
      ip_address: clientIp,
      tipe: "LOGOUT",
      aktifitas: `Sesi ditutup — logout dari aplikasi — ${userAgent}`,
      user_agent: userAgent,
    }).catch(() => {});
  }

  const response = NextResponse.json({
    success: true,
    message: "Logout berhasil.",
  });

  // Clear cookie completely
  response.cookies.set("actis_session", "", {
    ...getSessionCookieOptions(0),
    maxAge: 0,
  });

  return response;
}
