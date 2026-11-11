import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireBackupAuth, resolveAppOrigin } from "@/lib/backupAuth";
import {
  buildGoogleOAuthAuthorizeUrl,
  getGDriveStoredConfig,
} from "@/lib/gdriveSyncService";

export async function GET(request: NextRequest) {
  const auth = await requireBackupAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const cfg = await getGDriveStoredConfig();
  if (!cfg.oauth_client_id || !cfg.oauth_client_secret_enc) {
    return NextResponse.json(
      {
        success: false,
        error: "Simpan Google OAuth2 Client ID dan Client Secret terlebih dahulu sebelum menghubungkan akun.",
      },
      { status: 400 }
    );
  }

  const origin = resolveAppOrigin(request);
  const redirectUri = `${origin}/api/backups/gdrive/oauth/callback`;
  const state = crypto.randomBytes(24).toString("hex");
  const authUrl = buildGoogleOAuthAuthorizeUrl(cfg.oauth_client_id, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("actis_gdrive_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });
  return response;
}
