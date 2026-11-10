import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyPassword, hashPassword, createSessionToken } from "@/lib/auth";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "103.155.196.63";
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;
    const clientIp = getClientIp(request);
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    if (!email || !password) {
      return NextResponse.json(
        { success: false, error: "Email dan password wajib diisi." },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      recordActivity({
        nama_lengkap: cleanEmail.split("@")[0] || cleanEmail,
        email: cleanEmail,
        ip_address: clientIp,
        tipe: "LOGIN_FAILED",
        aktifitas: `Login gagal — username ${cleanEmail.split("@")[0] || cleanEmail} — ${userAgent}`,
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
        aktifitas: `Login gagal — username ${cleanEmail.split("@")[0] || cleanEmail} — ${userAgent}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json(
        { success: false, error: "Email atau password salah." },
        { status: 401 }
      );
    }

    // Auto-hash initial default password if it was null
    if (!user.password_hash) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: { password_hash: hashPassword(password) },
        });
      } catch (err) {
        console.error("Failed to auto-hash password:", err);
      }
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

    // Set session cookie
    response.cookies.set("actis_session", token, {
      httpOnly: false, // accessible to client for fast state recovery if needed
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      sameSite: "lax",
    });

    return response;
  } catch (err: any) {
    console.error("POST /api/auth/login error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Gagal melakukan login" },
      { status: 500 }
    );
  }
}

