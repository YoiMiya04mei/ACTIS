import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { resolveAppOrigin } from "@/lib/backupAuth";
import {
  buildInventoryOAuthAuthorizeUrl,
  getInventoryMirrorStoredConfig,
} from "@/lib/inventoryMirrorService";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request, { requireAdmin: true });
  if (!auth.ok) return auth.response;

  const cfg = await getInventoryMirrorStoredConfig();
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
  const redirectUri = `${origin}/api/inventory/mirror/oauth/callback`;
  const state = crypto.randomBytes(24).toString("hex");
  const authUrl = buildInventoryOAuthAuthorizeUrl(cfg.oauth_client_id, redirectUri, state);

  const response = NextResponse.redirect(authUrl);
  response.cookies.set("actis_inv_mirror_oauth_state", state, {
    httpOnly: true,
    path: "/",
    maxAge: 600,
    sameSite: "lax",
  });
  return response;
}
