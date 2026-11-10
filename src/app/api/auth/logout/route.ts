import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

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

  response.cookies.set("actis_session", "", {
    path: "/",
    maxAge: 0,
  });

  return response;
}

