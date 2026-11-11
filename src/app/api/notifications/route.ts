import { NextRequest, NextResponse } from "next/server";
import { verifySessionToken } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notificationService";

async function resolveNotificationActor(
  request: NextRequest,
  fallbackUserId?: string | null
): Promise<{ userKey: string; role: string } | null> {
  const token = request.cookies.get("actis_session")?.value;
  const session = verifySessionToken(token);

  if (session) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: session.id },
        select: { id: true, role: true },
      });
      if (dbUser) {
        return { userKey: dbUser.id, role: dbUser.role };
      }
    } catch {
      // Fallback to verified token payload if DB lookup fails temporarily
    }
    return { userKey: session.id, role: session.role };
  }

  // Fallback for local/demo mode without active session cookie:
  // look up userId in DB so role cannot be forged directly via query params.
  if (fallbackUserId) {
    try {
      const dbUser = await prisma.user.findUnique({
        where: { id: fallbackUserId },
        select: { id: true, role: true },
      });
      if (dbUser) {
        return { userKey: dbUser.id, role: dbUser.role };
      }
    } catch {
      // Ignore lookup error
    }
    return { userKey: fallbackUserId, role: "noc_engineer" };
  }

  return null;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedUserId = searchParams.get("userId");

    const actor = await resolveNotificationActor(request, requestedUserId);
    if (!actor) {
      return NextResponse.json(
        {
          success: false,
          error: "Sesi pengguna tidak ditemukan. Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    const result = await getUserNotifications(actor.userKey, actor.role);

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat notifikasi" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { action, notificationId, userId } = body || {};

    const actor = await resolveNotificationActor(request, userId);
    if (!actor) {
      return NextResponse.json(
        {
          success: false,
          error: "Sesi pengguna tidak ditemukan. Silakan login terlebih dahulu.",
        },
        { status: 401 }
      );
    }

    if (action === "mark_read" && typeof notificationId === "string" && notificationId.trim()) {
      await markNotificationRead(actor.userKey, notificationId.trim());
    } else if (action === "mark_all_read") {
      const current = await getUserNotifications(actor.userKey, actor.role);
      await markAllNotificationsRead(
        actor.userKey,
        current.notifications.map((n) => n.id)
      );
    } else {
      return NextResponse.json(
        { success: false, error: "Aksi notifikasi tidak valid." },
        { status: 400 }
      );
    }

    const updated = await getUserNotifications(actor.userKey, actor.role);

    return NextResponse.json({
      success: true,
      ...updated,
    });
  } catch (error: any) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memperbarui status notifikasi" },
      { status: 500 }
    );
  }
}

