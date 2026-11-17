import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { resolveAppOrigin } from "@/lib/backupAuth";
import { decryptSecret } from "@/lib/backupCrypto";
import {
  exchangeInventoryMirrorOAuthCode,
  getInventoryMirrorStoredConfig,
  saveInventoryMirrorConfig,
} from "@/lib/inventoryMirrorService";

export async function GET(request: NextRequest) {
  const origin = resolveAppOrigin(request);
  const returnUrl = new URL("/inventory/mirror", origin);

  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) {
    returnUrl.searchParams.set("oauth_error", "Sesi Administrator dibutuhkan untuk menghubungkan Google Drive & Sheets.");
    return NextResponse.redirect(returnUrl);
  }

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const errorParam = searchParams.get("error");
  const expectedState = request.cookies.get("actis_inv_mirror_oauth_state")?.value;

  if (errorParam) {
    returnUrl.searchParams.set("oauth_error", `Google OAuth dibatalkan: ${errorParam}`);
    return NextResponse.redirect(returnUrl);
  }

  if (!code || !state || !expectedState || state !== expectedState) {
    returnUrl.searchParams.set("oauth_error", "Validasi state OAuth Google gagal atau kedaluwarsa.");
    return NextResponse.redirect(returnUrl);
  }

  try {
    const cfg = await getInventoryMirrorStoredConfig();
    const clientSecret = decryptSecret(cfg.oauth_client_secret_enc);
    if (!cfg.oauth_client_id || !clientSecret) {
      returnUrl.searchParams.set("oauth_error", "Client ID / Secret OAuth2 belum tersimpan.");
      return NextResponse.redirect(returnUrl);
    }

    const redirectUri = `${origin}/api/inventory/mirror/oauth/callback`;
    const tokenRes = await exchangeInventoryMirrorOAuthCode({
      code,
      clientId: cfg.oauth_client_id,
      clientSecret,
      redirectUri,
    });

    if (tokenRes.error || !tokenRes.refresh_token) {
      returnUrl.searchParams.set(
        "oauth_error",
        tokenRes.error ||
          "Google tidak mengembalikan refresh_token. Hapus akses aplikasi di myaccount.google.com/permissions lalu hubungkan ulang."
      );
      return NextResponse.redirect(returnUrl);
    }

    await saveInventoryMirrorConfig({
      enabled: true,
      method: "oauth2",
      oauth_refresh_token: tokenRes.refresh_token,
    });

    returnUrl.searchParams.set("oauth", "connected");
    const response = NextResponse.redirect(returnUrl);
    response.cookies.delete("actis_inv_mirror_oauth_state");
    return response;
  } catch (err: any) {
    returnUrl.searchParams.set("oauth_error", err?.message || "Gagal menukar kode OAuth Google.");
    return NextResponse.redirect(returnUrl);
  }
}
