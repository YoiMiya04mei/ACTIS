import { NextRequest, NextResponse } from "next/server";
import {
  getUserNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/lib/notificationService";
import { requireAuth } from "@/lib/security";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const result = await getUserNotifications(auth.user.id, auth.user.role);

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
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { action, notificationId } = body || {};

    if (action === "mark_read" && typeof notificationId === "string" && notificationId.trim()) {
      await markNotificationRead(auth.user.id, notificationId.trim());
    } else if (action === "mark_all_read") {
      const current = await getUserNotifications(auth.user.id, auth.user.role);
      await markAllNotificationsRead(
        auth.user.id,
        current.notifications.map((n) => n.id)
      );
    } else {
      return NextResponse.json(
        { success: false, error: "Aksi notifikasi tidak valid." },
        { status: 400 }
      );
    }

    const updated = await getUserNotifications(auth.user.id, auth.user.role);

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
