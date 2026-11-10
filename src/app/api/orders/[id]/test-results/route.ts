import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { buildPayloadForOrder, dispatchSheetsSync } from "@/lib/sheetsSync";
import fs from "fs";
import path from "path";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    let uploaderId = "";

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;
      uploaderId = (formData.get("uploader_id") as string) || "";

      if (!file) {
        return NextResponse.json(
          { success: false, error: "Tidak ada file yang diunggah." },
          { status: 400 }
        );
      }

      fileName = file.name;
      fileType = file.type || "application/octet-stream";

      // Save file to public/uploads
      const uploadsDir = path.join(process.cwd(), "public", "uploads");
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const timestamp = Date.now();
      const sanitizedName = fileName.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storedFileName = `${timestamp}_${sanitizedName}`;
      const filePath = path.join(uploadsDir, storedFileName);

      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      fs.writeFileSync(filePath, buffer);

      fileUrl = `/uploads/${storedFileName}`;
    } else {
      // JSON payload (e.g. direct external link or test simulated)
      const body = await request.json();
      fileUrl = body.file_url;
      fileName = body.file_name || "test_result.png";
      fileType = body.file_type || "image/png";
      uploaderId = body.uploader_id || "";

      if (!fileUrl) {
        return NextResponse.json(
          { success: false, error: "file_url wajib disediakan." },
          { status: 400 }
        );
      }
    }

    if (!uploaderId) {
      const defaultUser = await prisma.user.findFirst({
        where: { role: "noc_engineer" },
      });
      uploaderId = defaultUser?.id || "usr-noc-001";
    }

    const uploader = await prisma.user.findUnique({ where: { id: uploaderId } });
    const uploaderName = uploader?.nama || "NOC Engineer";

    // Save test result record
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
      email: uploader?.email || null,
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

