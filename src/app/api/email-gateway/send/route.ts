import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import { getAllowedMenusForRole, getStoredAccessLevels } from "@/lib/accessLevelsStore";
import {
  getCategoryLabel,
  sendGatewayEmail,
  type EmailGatewayAttachmentInput,
} from "@/lib/emailGatewayService";
import { parseEmailAddressList } from "@/lib/emailGatewayTypes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    if (auth.user.role !== "admin") {
      const accessStore = await getStoredAccessLevels();
      const allowedMenus = getAllowedMenusForRole(accessStore.roles, auth.user.role);
      const canSendDocEmail =
        allowedMenus.includes("tools_documents") ||
        allowedMenus.includes("tools_history");
      if (!canSendDocEmail) {
        return NextResponse.json(
          {
            success: false,
            error: "Akses ditolak: Anda tidak memiliki izin mengakses Dokumen / Arsip Surat.",
          },
          { status: 403 }
        );
      }
    }

    const rate = checkRateLimit(`email_send:${auth.user.id}`, 30, 60);
    if (!rate.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: `Batas pengiriman email sementara tercapai. Silakan tunggu ${rate.retryAfter || 60} detik.`,
        },
        { status: 429 }
      );
    }

    const body = (await request.json().catch(() => null)) as {
      to?: string | string[];
      cc?: string | string[];
      replyTo?: string;
      subject?: string;
      bodyText?: string;
      htmlBody?: string;
      category?: string;
      documentNumber?: string;
      attachmentFilename?: string;
      attachmentBase64?: string;
      attachmentContentType?: string;
    } | null;

    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { success: false, error: "Data pengiriman email tidak valid." },
        { status: 400 }
      );
    }

    const attachments: EmailGatewayAttachmentInput[] = [];
    if (body.attachmentBase64 && typeof body.attachmentBase64 === "string") {
      attachments.push({
        filename: body.attachmentFilename || "dokumen-actis.pdf",
        contentBase64: body.attachmentBase64,
        contentType: body.attachmentContentType || "application/pdf",
      });
    }

    const result = await sendGatewayEmail({
      to: body.to || "",
      cc: body.cc,
      replyTo: body.replyTo,
      subject: body.subject || "",
      bodyText: body.bodyText || "",
      htmlBody: body.htmlBody,
      attachments,
    });

    const recipientsText = parseEmailAddressList(body.to).join(", ");
    const catLabel = getCategoryLabel(body.category);
    const docNo = body.documentNumber ? ` [${body.documentNumber}]` : "";
    const clientIp =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const userAgent = parseUserAgent(request.headers.get("user-agent"));

    recordActivity({
      nama_lengkap: auth.user.nama,
      email: auth.user.email,
      ip_address: clientIp,
      tipe: "DOCUMENT",
      aktifitas: `Mengirim email ${catLabel}${docNo} ke ${recipientsText}`,
      detail: `Subjek: ${String(body.subject || "").slice(0, 120)}${
        attachments.length > 0 ? ` | Lampiran: ${attachments[0].filename}` : ""
      }`,
      user_agent: userAgent,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: `Email berhasil dikirim ke ${recipientsText}.`,
      data: result,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Gagal mengirim email dokumen.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
