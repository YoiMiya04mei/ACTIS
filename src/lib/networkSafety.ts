import net from "node:net";

/**
 * SSRF Protection: Checks if an IP or host is loopback, link-local, cloud metadata, or unsafe target.
 */
export function isRestrictedNetworkTarget(host: string): boolean {
  if (!host || typeof host !== "string") return true;
  let clean = host.trim().toLowerCase().replace(/[\[\]]/g, "");

  // Cloud metadata services & known SSRF aliases
  if (
    clean === "169.254.169.254" ||
    clean === "fd00:ec2::254" ||
    clean === "instance-data" ||
    clean === "metadata.google.internal" ||
    clean.includes("metadata.google") ||
    clean.includes("169.254.")
  ) {
    return true;
  }

  // IPv4-mapped IPv6 (e.g. ::ffff:127.0.0.1 or ::ffff:169.254.169.254)
  if (clean.startsWith("::ffff:")) {
    clean = clean.replace("::ffff:", "");
  }

  // Localhost aliases & IPv6 loopback
  if (
    clean === "localhost" ||
    clean === "127.0.0.1" ||
    clean === "::1" ||
    clean === "0.0.0.0" ||
    clean === "::" ||
    clean === "0:0:0:0:0:0:0:1" ||
    clean === "0:0:0:0:0:0:0:0"
  ) {
    return true;
  }

  // IPv6 link-local (fe80::/10)
  if (
    clean.startsWith("fe80:") ||
    clean.startsWith("fe9") ||
    clean.startsWith("fea") ||
    clean.startsWith("feb")
  ) {
    return true;
  }

  // Obfuscated integer/hex/octal IP detection (e.g. 2130706433, 0177.0.0.1, 0x7f000001)
  if (/^0x[0-9a-f]+$/i.test(clean) || /^\d+$/.test(clean) || /^0[0-7]+$/i.test(clean)) {
    return true;
  }

  // IPv4 checks
  if (net.isIPv4(clean)) {
    const parts = clean.split(".").map(Number);
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }

  return false;
}

/**
 * Validates Google Apps Script Web App URL with SSRF protection (HTTPS-only, public target).
 */
export function validateGoogleWebhookUrl(
  rawUrl: string
): { ok: true; url: string } | { ok: false; error: string } {
  const trimmed = (rawUrl || "").trim();
  if (!trimmed) {
    return { ok: false, error: "URL Google Apps Script wajib diisi." };
  }
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "Format URL Google Apps Script tidak valid." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "URL Google Apps Script wajib menggunakan protokol HTTPS." };
  }

  if (isRestrictedNetworkTarget(parsed.hostname)) {
    return { ok: false, error: "Target URL jaringan internal / terlarang tidak diizinkan." };
  }

  return { ok: true, url: parsed.toString() };
}
