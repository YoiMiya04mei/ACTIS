import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySessionToken } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get("actis_session")?.value;
    const sessionUser = verifySessionToken(sessionCookie);

    if (!sessionUser) {
      return NextResponse.json({
        success: false,
        user: null,
      });
    }

    // Verify still exists in database
    const dbUser = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        nama: true,
        email: true,
        role: true,
        created_at: true,
      },
    });

    if (!dbUser) {
      return NextResponse.json({
        success: false,
        user: null,
      });
    }

    return NextResponse.json({
      success: true,
      user: dbUser,
    });
  } catch (err: any) {
    console.error("GET /api/auth/me error:", err);
    return NextResponse.json(
      { success: false, error: err.message },
      { status: 500 }
    );
  }
}

