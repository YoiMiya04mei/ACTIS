import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { requireAuth, validateUploadedBuffer } from "@/lib/security";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth(request, {
    allowedRoles: ["admin", "noc_engineer", "field_engineer"],
  });
  if (!auth.ok) return auth.response;

  try {
    const { id: orderId } = await params;

    const order = await prisma.popSiteOrder.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const contentType = request.headers.get("content-type") || "";

    let fileUrl = "";
    let fileName = "";
    let fileType = "image/png";
    const uploaderId = auth.user.id;
    const uploaderName = auth.user.nama;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Tidak ada file yang diunggah." },
          { status: 400 }
        );
      }

      fileName = file.name;
      fileType = file.type || "application/octet-stream";

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);

      // Strict file validation: magic bytes, MIME, allowed extensions (.png, .jpg, .jpeg, .pdf), max 10MB
      const validation = validateUploadedBuffer(buffer, fileName);
      if (!validation.valid) {
        return NextResponse.json(
          { success: false, error: validation.error || "Format atau isi file tidak valid." },
          { status: 400 }
        );
      }

      // Save file to public/uploads with random token prefix to prevent overwriting or guessing
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const randomPrefix = crypto.randomBytes(12).toString("hex");
      const sanitizedName = path.basename(fileName).replace(/[^a-zA-Z0-9.-]/g, "_");
      const storedFileName = `${Date.now()}_${randomPrefix}_${sanitizedName}`;
      const filePath = path.join(uploadsDir, storedFileName);

      fs.writeFileSync(filePath, buffer);
      fileUrl = `/uploads/${storedFileName}`;
    } else {
      // JSON payload (e.g. simulated test or verified external link)
      const body = await request.json();
      fileUrl = body.file_url;
      fileName = body.file_name || "test_result.png";
      fileType = body.file_type || "image/png";

      if (!fileUrl || typeof fileUrl !== "string") {
        return NextResponse.json(
          { success: false, error: "file_url wajib disediakan." },
          { status: 400 }
        );
      }

      // Security check on external URL / relative path
      if (!fileUrl.startsWith("/uploads/") && !fileUrl.startsWith("https://")) {
        return NextResponse.json(
          { success: false, error: "file_url harus berupa HTTPS URL atau file upload internal (/uploads/)." },
          { status: 400 }
        );
      }
    }

    // Save test result record bound to authenticated user
    const testRecord = await prisma.testResult.create({
      data: {
        order_id: orderId,
        file_url: fileUrl,
        file_name: fileName,
        file_type: fileType,
        uploaded_by: uploaderId,
      },
      include: {
        uploader: { select: { id: true, nama: true, role: true } },
      },
    });

    // Update waktu_aktivasi on order when test results are uploaded
    const activationTime = order.waktu_aktivasi || new Date();
    await prisma.popSiteOrder.update({
      where: { id: orderId },
      data: {
        waktu_aktivasi: activationTime,
      },
    });

    // Append to immutable progress log
    const progressNote = `Hasil uji jaringan diunggah: "${fileName}" oleh ${uploaderName}. Waktu laporan aktivasi tercatat. Syarat Completion terpenuhi.`;
    await prisma.orderProgressLog.create({
      data: {
        order_id: orderId,
        user_id: uploaderId,
        action_type: "Test Uploaded",
        status_sebelum: order.status,
        status_sesudah: order.status,
        catatan_progress: progressNote,
      },
    });

    // Record application-wide activity log
    recordActivity({
      nama_lengkap: uploaderName,
      email: auth.user.email || null,
      ip_address: request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "103.155.196.63",
      tipe: "UPDATE_ORDER",
      aktifitas: `Mengunggah hasil uji jaringan untuk tiket ${order.ticket_number} (${fileName})`,
      detail: progressNote,
      user_agent: parseUserAgent(request.headers.get("user-agent")),
    }).catch(() => {});

    // Trigger async sync to Google Sheets
    buildPayloadForOrder(orderId, "TEST_UPLOADED", {
      updatedBy: uploaderName,
      progressNote,
    }).then((payload) => {
      if (payload) dispatchSheetsSync(payload, orderId);
    });

    return NextResponse.json({
      success: true,
      message: `File "${fileName}" berhasil diunggah. Tombol Selesaikan Aktivasi kini aktif!`,
      data: testRecord,
    });
  } catch (err: any) {
    console.error("POST /api/orders/[id]/test-results error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to upload test result" },
      { status: 500 }
    );
  }
}

