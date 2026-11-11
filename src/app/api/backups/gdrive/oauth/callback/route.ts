import { NextRequest, NextResponse } from "next/server";
import { requireBackupAuth, resolveAppOrigin } from "@/lib/backupAuth";
import { decryptSecret } from "@/lib/backupCrypto";
import {
  exchangeGoogleOAuthCode,
  getGDriveStoredConfig,
  saveGDriveConfig,
} from "@/lib/gdriveSyncService";

export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request);
  const returnUrl = new URL("/backups", origin);

  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    returnUrl.searchParams.set("gdrive_error", "Sesi Admin dibutuhkan untuk menghubungkan Google Drive.");
    return NextResponse.redirect(returnUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const expectedState = request.cookies.get("actis_gdrive_oauth_state")?.value;

  if (errorParam) {
    returnUrl.searchParams.set("gdrive_error", `Google OAuth dibatalkan: ${errorParam}`);
    return NextResponse.redirect(returnUrl);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    returnUrl.searchParams.set("gdrive_error", "Validasi state OAuth Google gagal atau kedaluwarsa.");
    return NextResponse.redirect(returnUrl);
  }

  try {
    const cfg = await getGDriveStoredConfig();
    const clientSecret = decryptSecret(cfg.oauth_client_secret_enc);
    if (!cfg.oauth_client_id || !clientSecret) {
      returnUrl.searchParams.set("gdrive_error", "Client ID / Secret OAuth2 belum tersimpan.");
      return NextResponse.redirect(returnUrl);
    }

    const redirectUri = `${origin}/api/backups/gdrive/oauth/callback`;
    const tokenRes = await exchangeGoogleOAuthCode({
      code,
      clientId: cfg.oauth_client_id,
      clientSecret,
      redirectUri,
    });

    if (tokenRes.error || !tokenRes.refresh_token) {
      returnUrl.searchParams.set(
        "gdrive_error",
        tokenRes.error ||
          "Google tidak mengembalikan refresh_token. Hapus akses aplikasi di myaccount.google.com/permissions lalu hubungkan ulang."
      );
      return NextResponse.redirect(returnUrl);
    }

    await saveGDriveConfig({
      enabled: true,
      method: "oauth2",
      oauth_refresh_token: tokenRes.refresh_token,
    });

    returnUrl.searchParams.set("gdrive_oauth", "connected");
    const response = NextResponse.redirect(returnUrl);
    response.cookies.delete("actis_gdrive_oauth_state");
    return response;
  } catch (err: any) {
    returnUrl.searchParams.set("gdrive_error", err?.message || "Gagal menukar kode OAuth Google Drive.");
    return NextResponse.redirect(returnUrl);
  }
}
