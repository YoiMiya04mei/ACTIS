import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { getAllSharedSyncMeta } from "@/lib/sharedDocumentStore";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const versions = await getAllSharedSyncMeta();
    return NextResponse.json(
      {
        success: true,
        versions,
        serverTime: new Date().toISOString(),
      },
      {
        headers: {
          "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        },
      }
    );
  } catch (err: unknown) {
    console.error("GET /api/storage/sync-meta error:", err);
    return NextResponse.json(
      { success: false, error: "Gagal mengambil metadata sinkronisasi dokumen." },
      { status: 500 }
    );
  }
}
