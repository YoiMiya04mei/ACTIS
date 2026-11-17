import crypto from "crypto";
import { encryptSecret } from "@/lib/backupCrypto";
import { validateGoogleWebhookUrl } from "@/lib/networkSafety";

export { validateGoogleWebhookUrl };

export const GOOGLE_DRIVE_SCOPE_FILE = "https://www.googleapis.com/auth/drive.file";
export const GOOGLE_DRIVE_SCOPE_FULL = "https://www.googleapis.com/auth/drive";
export const GOOGLE_SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/**
 * Preserves an existing encrypted secret when masked/blank placeholders are submitted.
 */
export function preserveOrUpdateSecret(
  incoming: string | undefined,
  existingEnc: string | null
): string | null {
  if (incoming === undefined) return existingEnc;
  const trimmed = incoming.trim();
  if (!trimmed) return existingEnc;
  if (trimmed.includes("••••") || trimmed.includes("(Tersimpan Terenkripsi)")) {
    return existingEnc;
  }
  return encryptSecret(trimmed);
}

/**
 * Exchange Service Account credentials for a Google OAuth2 access token via JWT RS256.
 */
export async function getServiceAccountAccessToken(
  clientEmail: string,
  privateKeyPem: string,
  scopes: string = GOOGLE_DRIVE_SCOPE_FULL
): Promise<string> {
  const nowSec = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const claim = Buffer.from(
    JSON.stringify({
      iss: clientEmail,
      scope: scopes,
      aud: "https://oauth2.googleapis.com/token",
      exp: nowSec + 3600,
      iat: nowSec,
    })
  ).toString("base64url");

  const unsigned = `${header}.${claim}`;
  const signer = crypto.createSign("RSA-SHA256");
  signer.update(unsigned);
  signer.end();
  const signature = signer.sign(privateKeyPem.replace(/\\n/g, "\n"), "base64url");
  const jwt = `${unsigned}.${signature}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      `Gagal autentikasi Service Account Google: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
    );
  }
  return tokenData.access_token;
}

/**
 * Exchange OAuth2 Refresh Token for a fresh Google access token.
 */
export async function getOAuth2AccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
): Promise<string> {
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(
      `Gagal refresh OAuth2 token Google: ${tokenData.error_description || tokenData.error || tokenRes.statusText}`
    );
  }
  return tokenData.access_token;
}

/**
 * Build Google OAuth2 consent URL with configurable scopes.
 */
export function buildGoogleOAuthAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string,
  scopes: string = GOOGLE_DRIVE_SCOPE_FILE
): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", scopes);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url.toString();
}

export async function exchangeGoogleOAuthCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}): Promise<{ refresh_token?: string; access_token?: string; error?: string }> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: params.code,
      client_id: params.clientId,
      client_secret: params.clientSecret,
      redirect_uri: params.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const data = await res.json();
  if (!res.ok) {
    return { error: data.error_description || data.error || res.statusText };
  }
  return data;
}

/**
 * Find or create a subfolder inside parentFolderId via Google Drive v3 API.
 */
export async function ensureDriveSubfolder(
  accessToken: string,
  parentFolderId: string | undefined,
  folderName: string
): Promise<string> {
  const escaped = folderName.replace(/'/g, "\\'");
  const parentFilter = parentFolderId ? `'${parentFolderId}' in parents and ` : "";
  const q = `${parentFilter}name = '${escaped}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id,name)");
  searchUrl.searchParams.set("supportsAllDrives", "true");
  searchUrl.searchParams.set("includeItemsFromAllDrives", "true");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const searchJson = await searchRes.json();
  if (searchRes.ok && Array.isArray(searchJson.files) && searchJson.files.length > 0) {
    return searchJson.files[0].id;
  }

  const createBody: Record<string, unknown> = {
    name: folderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (parentFolderId) {
    createBody.parents = [parentFolderId];
  }

  const createRes = await fetch(
    "https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(createBody),
    }
  );
  const createJson = await createRes.json();
  if (!createRes.ok || !createJson.id) {
    throw new Error(
      `Gagal membuat folder '${folderName}' di Google Drive: ${createJson.error?.message || createRes.statusText}`
    );
  }
  return createJson.id;
}
