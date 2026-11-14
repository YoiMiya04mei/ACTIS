import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { processUploadedUpdateZip } from "@/lib/updateService";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { success: false, error: "Silakan pilih file .zip terlebih dahulu." },
        { status: 400 }
      );
    }

    const versionOverride = String(formData.get("version") || "").trim() || undefined;
    const customTitle = String(formData.get("title") || "").trim() || undefined;
    const customNotes = String(formData.get("changelog") || "").trim() || undefined;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const result = await processUploadedUpdateZip({
      buffer,
      fileName: file.name,
      fileSizeBytes: file.size,
      versionOverride,
      customTitle,
      customNotes,
      actor: auth.user,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (err: any) {
    const msg =
      typeof err?.message === "string" && err.message.length > 0
        ? err.message
        : "Gagal memproses paket update ZIP.";

    // Validation & ZIP structure failures return 400; unexpected IO returns 500
    const isValidationError =
      msg.includes("Format") ||
      msg.includes("Ukuran") ||
      msg.includes("magic bytes") ||
      msg.includes("Keamanan ZIP") ||
      msg.includes("kosong") ||
      msg.includes("tidak valid") ||
      msg.includes("tidak dikenali") ||
      msg.includes("bukan proyek ACTIS") ||
      msg.includes("release-manifest") ||
      msg.includes("package.json");

    console.error("POST /api/system/updates/upload-zip error:", err);
    return NextResponse.json(
      { success: false, error: msg },
      { status: isValidationError ? 400 : 500 }
    );
  }
}
