import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { recordActivity, parseUserAgent } from "@/lib/activityLogService";
import {
  resolveDraftConfigForTest,
  sendGatewayEmail,
  verifySmtpConnection,
  type UpdateEmailGatewayInput,
} from "@/lib/emailGatewayService";
import { isValidEmailAddress } from "@/lib/emailGatewayTypes";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      mode?: "verify" | "send_test";
      testRecipient?: string;
      draftConfig?: UpdateEmailGatewayInput;
    };

    const effectiveConfig = await resolveDraftConfigForTest(body.draftConfig || null);
    if (!effectiveConfig.smtpHost) {
      return NextResponse.json(
        { success: false, error: "Host Server SMTP wajib diisi sebelum melakukan pengujian." },
        { status: 400 }
      );
    }

    if (body.mode === "send_test") {
      const targetEmail = (body.testRecipient || auth.user.email || "").trim();
      if (!isValidEmailAddress(targetEmail)) {
        return NextResponse.json(
          { success: false, error: "Masukkan alamat email tujuan uji kirim yang valid." },
          { status: 400 }
        );
      }

      const nowText = new Date().toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "full",
        timeStyle: "medium",
      });

      const sendResult = await sendGatewayEmail(
        {
          to: targetEmail,
          subject: `[ACTIS Test Email] Verifikasi Email Gateway SMTP (${effectiveConfig.smtpHost})`,
          bodyText: [
            "Halo,",
            "",
            "Email ini merupakan pesan uji coba dari ACTIS Email Gateway untuk memastikan server SMTP telah terhubung dengan baik dan siap digunakan untuk mengirim surat resmi (RFO, Surat Tugas, Berita Acara, Permit Barang, dan Payment Voucher).",
            "",
            `Detail Pengujian:`,
            `- Diuji Oleh : ${auth.user.nama} (${auth.user.email})`,
            `- SMTP Host  : ${effectiveConfig.smtpHost}:${effectiveConfig.smtpPort} (${effectiveConfig.encryption.toUpperCase()})`,
            `- Pengirim   : ${effectiveConfig.fromName} <${effectiveConfig.fromEmail}>`,
            `- Waktu (WIB): ${nowText} WIB`,
            "",
            effectiveConfig.signatureText || "ACTIS Operations",
          ].join("\n"),
        },
        effectiveConfig
      );

      const clientIp =
        request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
      const userAgent = parseUserAgent(request.headers.get("user-agent"));
      recordActivity({
        nama_lengkap: auth.user.nama,
        email: auth.user.email,
        ip_address: clientIp,
        tipe: "SETTING_UPDATE",
        aktifitas: `Mengirim test email SMTP ke ${targetEmail}`,
        detail: `SMTP=${effectiveConfig.smtpHost}:${effectiveConfig.smtpPort} | MessageID=${sendResult.messageId}`,
        user_agent: userAgent,
      }).catch(() => {});

      return NextResponse.json({
        success: true,
        message: `Email uji coba berhasil dikirim ke ${targetEmail}.`,
        result: sendResult,
      });
    }

    await verifySmtpConnection(effectiveConfig);
    return NextResponse.json({
      success: true,
      message: `Koneksi SMTP ke ${effectiveConfig.smtpHost}:${effectiveConfig.smtpPort} (${effectiveConfig.encryption.toUpperCase()}) berhasil terverifikasi!`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Pengujian SMTP gagal.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }
}
