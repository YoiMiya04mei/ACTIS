/**
 * Telegram Bot Notification Service untuk ACTIS:
 * 1. Bot Alert ICMP Ping Monitoring (DOWN / Timeout & RECOVERED / UP)
 * 2. Bot Notifikasi Tiket Provisioning Selesai (Completed) — memakai Bot Token & Chat ID terpisah.
 */

import { prisma } from "./prisma";
import { formatRackPositionLabel, formatOtbCoreLabel } from "./dcimUtils";

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  notif_down: boolean;
  notif_up: boolean;
}

export interface TicketTelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  include_specs: boolean;
  include_notes: boolean;
}

const ICMP_SETTING_KEYS = [
  "telegram_bot_token",
  "telegram_chat_id",
  "telegram_notif_enabled",
  "telegram_notif_down",
  "telegram_notif_up",
] as const;

const TICKET_SETTING_KEYS = [
  "ticket_telegram_bot_token",
  "ticket_telegram_chat_id",
  "ticket_telegram_notif_enabled",
  "ticket_telegram_include_specs",
  "ticket_telegram_include_notes",
] as const;

/**
 * Menyamarkan Bot Token agar aman dikirim ke frontend.
 */
export function maskBotToken(token: string): string {
  if (!token) return "";
  const parts = token.split(":");
  if (parts.length === 2) {
    return `${parts[0]}:${"*".repeat(Math.min(Math.max(parts[1].length - 4, 4), 16))}${parts[1].slice(-4)}`;
  }
  return "••••••••••••••••";
}

/**
 * Memeriksa apakah nilai token dari form adalah placeholder/masked token atau kosong.
 */
export function isMaskedTokenInput(token?: string | null): boolean {
  const trimmed = (token || "").trim();
  return !trimmed || trimmed.includes("••••") || trimmed.includes("***");
}

async function readSystemSettingsMap(keys: readonly string[]): Promise<Record<string, string>> {
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: { in: [...keys] },
      },
    });
    return rows.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  } catch (err) {
    console.error("Error reading Telegram settings from DB:", err);
    return {};
  }
}

async function upsertSystemSettings(entries: Array<{ key: string; value: string }>): Promise<void> {
  for (const item of entries) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: { key: item.key, value: item.value },
    });
  }
}

/**
 * Pengirim pesan low-level ke Telegram Bot API.
 * Selalu menggunakan token & chatId eksplisit agar Bot ICMP dan Bot Tiket tidak pernah tertukar.
 */
async function dispatchTelegramHtmlMessage(
  token: string,
  chatId: string,
  text: string
): Promise<{ success: boolean; error?: string }> {
  if (!token || !chatId) {
    return {
      success: false,
      error: "Bot Token atau Chat ID Telegram belum dikonfigurasi.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      const errorMsg = data.description || "Gagal mengirim pesan ke Telegram API";
      console.error("Telegram API Error:", errorMsg);
      return { success: false, error: errorMsg };
    }

    return { success: true };
  } catch (err: any) {
    console.error("dispatchTelegramHtmlMessage Exception:", err);
    return {
      success: false,
      error:
        err?.name === "AbortError"
          ? "Koneksi ke Telegram API timeout (10 detik)."
          : err?.message || "Gagal menghubungi server Telegram.",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function resolveTestCredentials(
  stored: { bot_token: string; chat_id: string },
  custom?: { bot_token?: string; chat_id?: string }
): { token: string; chatId: string } {
  const token = isMaskedTokenInput(custom?.bot_token)
    ? stored.bot_token
    : String(custom?.bot_token).trim();
  const chatId = custom?.chat_id?.trim() || stored.chat_id;
  return { token, chatId };
}

/**
 * Mengambil konfigurasi Telegram ICMP Ping dari database system_settings dengan fallback ke process.env
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  const dbSettings = await readSystemSettingsMap(ICMP_SETTING_KEYS);

  const bot_token =
    dbSettings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || "";
  const chat_id =
    dbSettings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || "";
  const enabled =
    (dbSettings.telegram_notif_enabled ?? process.env.TELEGRAM_NOTIF_ENABLED) ===
    "true";
  const notif_down = (dbSettings.telegram_notif_down ?? "true") === "true";
  const notif_up = (dbSettings.telegram_notif_up ?? "true") === "true";

  return {
    bot_token,
    chat_id,
    enabled,
    notif_down,
    notif_up,
  };
}

/**
 * Menyimpan konfigurasi Telegram ICMP Ping ke database
 */
export async function saveTelegramConfig(
  config: Partial<TelegramConfig>
): Promise<TelegramConfig> {
  const updates: Array<{ key: string; value: string }> = [];

  if (config.bot_token !== undefined && !isMaskedTokenInput(config.bot_token)) {
    updates.push({ key: "telegram_bot_token", value: config.bot_token.trim() });
  }
  if (config.chat_id !== undefined) {
    updates.push({ key: "telegram_chat_id", value: config.chat_id.trim() });
  }
  if (config.enabled !== undefined) {
    updates.push({
      key: "telegram_notif_enabled",
      value: config.enabled ? "true" : "false",
    });
  }
  if (config.notif_down !== undefined) {
    updates.push({
      key: "telegram_notif_down",
      value: config.notif_down ? "true" : "false",
    });
  }
  if (config.notif_up !== undefined) {
    updates.push({
      key: "telegram_notif_up",
      value: config.notif_up ? "true" : "false",
    });
  }

  await upsertSystemSettings(updates);
  return await getTelegramConfig();
}

/**
 * Mengambil konfigurasi Bot Telegram khusus Tiket Selesai (terpisah penuh dari ICMP Ping).
 */
export async function getTicketTelegramConfig(): Promise<TicketTelegramConfig> {
  const dbSettings = await readSystemSettingsMap(TICKET_SETTING_KEYS);

  const bot_token =
    dbSettings.ticket_telegram_bot_token ||
    process.env.TICKET_TELEGRAM_BOT_TOKEN ||
    "";
  const chat_id =
    dbSettings.ticket_telegram_chat_id ||
    process.env.TICKET_TELEGRAM_CHAT_ID ||
    "";
  const enabled =
    (dbSettings.ticket_telegram_notif_enabled ??
      process.env.TICKET_TELEGRAM_NOTIF_ENABLED) === "true";
  const include_specs =
    (dbSettings.ticket_telegram_include_specs ?? "true") === "true";
  const include_notes =
    (dbSettings.ticket_telegram_include_notes ?? "true") === "true";

  return {
    bot_token,
    chat_id,
    enabled,
    include_specs,
    include_notes,
  };
}

/**
 * Menyimpan konfigurasi Bot Telegram khusus Tiket Selesai ke database
 */
export async function saveTicketTelegramConfig(
  config: Partial<TicketTelegramConfig>
): Promise<TicketTelegramConfig> {
  const updates: Array<{ key: string; value: string }> = [];

  if (config.bot_token !== undefined && !isMaskedTokenInput(config.bot_token)) {
    updates.push({
      key: "ticket_telegram_bot_token",
      value: config.bot_token.trim(),
    });
  }
  if (config.chat_id !== undefined) {
    updates.push({
      key: "ticket_telegram_chat_id",
      value: config.chat_id.trim(),
    });
  }
  if (config.enabled !== undefined) {
    updates.push({
      key: "ticket_telegram_notif_enabled",
      value: config.enabled ? "true" : "false",
    });
  }
  if (config.include_specs !== undefined) {
    updates.push({
      key: "ticket_telegram_include_specs",
      value: config.include_specs ? "true" : "false",
    });
  }
  if (config.include_notes !== undefined) {
    updates.push({
      key: "ticket_telegram_include_notes",
      value: config.include_notes ? "true" : "false",
    });
  }

  await upsertSystemSettings(updates);
  return await getTicketTelegramConfig();
}

/**
 * Mengirim pesan ke Telegram Bot API (untuk ICMP Monitoring / kompatibilitas caller existing)
 */
export async function sendTelegramMessage(
  text: string,
  customConfig?: { bot_token?: string; chat_id?: string }
): Promise<{ success: boolean; error?: string }> {
  const config = await getTelegramConfig();
  const { token, chatId } = resolveTestCredentials(config, customConfig);
  return dispatchTelegramHtmlMessage(token, chatId, text);
}

export interface TelegramMonitorPayload {
  name: string;
  ip_address: string;
  kategori: string;
  uptime_pct?: number;
  vlan?: number | string | null;
  server?: string | null;
  pop_site?: {
    site_id: string;
    nama_pic: string;
    layanan_dedicated?: string | null;
    vlan?: number | string | null;
    server?: string | null;
  } | null;
}

/**
 * Format tanggal dan waktu WIB standar NOC
 */
function getFormattedWibTime(date: Date = new Date()): string {
  return (
    date.toLocaleString("id-ID", {
      timeZone: "Asia/Jakarta",
      dateStyle: "medium",
      timeStyle: "medium",
    }) + " WIB"
  );
}

/**
 * Mengirim notifikasi peringatan ICMP Ping DOWN / TIMEOUT
 */
export async function notifyIcmpDown(
  monitor: TelegramMonitorPayload,
  errorMsg?: string
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.notif_down) return;

  const siteId = monitor.pop_site?.site_id || "N/A";
  const sitePic = monitor.pop_site?.nama_pic || "";
  const displayName = sitePic ? `[${siteId}] ${sitePic}` : monitor.name;
  const reason = errorMsg || "Request Timed Out / Host Unreachable";
  const timestamp = getFormattedWibTime();

  const rawVlan = monitor.pop_site?.vlan ?? monitor.vlan;
  const rawServer = monitor.pop_site?.server ?? monitor.server;
  const vlanDisplay =
    rawVlan !== undefined && rawVlan !== null && rawVlan !== ""
      ? String(rawVlan)
      : "-";
  const serverDisplay =
    rawServer && String(rawServer).trim() !== ""
      ? String(rawServer).trim()
      : "-";

  const message = `🚨 <b>[ALERT] ICMP PING DOWN / TIMEOUT</b>
━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Site:</b> ${escapeHtml(displayName)}
🌐 <b>IP Target:</b> <code>${escapeHtml(monitor.ip_address)}</code>
🖧 <b>VLAN:</b> <code>${escapeHtml(vlanDisplay)}</code>
🖥️ <b>Server / BRAS:</b> ${escapeHtml(serverDisplay)}
📊 <b>Kategori:</b> ${escapeHtml(monitor.kategori)}
🔴 <b>Status:</b> <b>DOWN / RTO ❌</b>
⚠️ <b>Keterangan:</b> ${escapeHtml(reason)}
🕒 <b>Waktu Kejadian:</b> ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━
🤖 <i>ACTIS NOC Uptime Monitor Engine</i>`;

  await dispatchTelegramHtmlMessage(config.bot_token, config.chat_id, message);
}

/**
 * Mengirim notifikasi pemulihan ICMP Ping RECOVERED / UP
 */
export async function notifyIcmpUp(
  monitor: TelegramMonitorPayload,
  latencyMs?: number | null
): Promise<void> {
  const config = await getTelegramConfig();
  if (!config.enabled || !config.notif_up) return;

  const siteId = monitor.pop_site?.site_id || "N/A";
  const sitePic = monitor.pop_site?.nama_pic || "";
  const displayName = sitePic ? `[${siteId}] ${sitePic}` : monitor.name;
  const timestamp = getFormattedWibTime();
  const latencyStr =
    latencyMs !== null && latencyMs !== undefined ? `${latencyMs} ms` : "< 1 ms";
  const uptimeStr =
    monitor.uptime_pct !== undefined ? `${monitor.uptime_pct.toFixed(1)}%` : "100%";

  const rawVlan = monitor.pop_site?.vlan ?? monitor.vlan;
  const rawServer = monitor.pop_site?.server ?? monitor.server;
  const vlanDisplay =
    rawVlan !== undefined && rawVlan !== null && rawVlan !== ""
      ? String(rawVlan)
      : "-";
  const serverDisplay =
    rawServer && String(rawServer).trim() !== ""
      ? String(rawServer).trim()
      : "-";

  const message = `✅ <b>[RECOVERY] ICMP PING NORMAL / UP</b>
━━━━━━━━━━━━━━━━━━━━━━
🏢 <b>Site:</b> ${escapeHtml(displayName)}
🌐 <b>IP Target:</b> <code>${escapeHtml(monitor.ip_address)}</code>
🖧 <b>VLAN:</b> <code>${escapeHtml(vlanDisplay)}</code>
🖥️ <b>Server / BRAS:</b> ${escapeHtml(serverDisplay)}
📊 <b>Kategori:</b> ${escapeHtml(monitor.kategori)}
🟢 <b>Status:</b> <b>UP / RECOVERED ✅</b>
⚡ <b>Rata-rata Latency:</b> ${escapeHtml(latencyStr)}
📈 <b>Uptime:</b> ${escapeHtml(uptimeStr)}
🕒 <b>Waktu Pemulihan:</b> ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━
🤖 <i>ACTIS NOC Uptime Monitor Engine</i>`;

  await dispatchTelegramHtmlMessage(config.bot_token, config.chat_id, message);
}

/**
 * Mengirim pesan tes koneksi Telegram Bot ICMP Monitoring
 */
export async function sendTestNotification(
  testConfig?: { bot_token?: string; chat_id?: string }
): Promise<{ success: boolean; error?: string }> {
  const config = await getTelegramConfig();
  const { token, chatId } = resolveTestCredentials(config, testConfig);
  const timestamp = getFormattedWibTime();
  const message = `🚀 <b>[TEST NOTIFIKASI] ACTIS NOC MONITOR</b>
━━━━━━━━━━━━━━━━━━━━━━
Bot Telegram berhasil terhubung dengan sistem <b>ACTIS Network Monitoring</b>!

🔔 <b>Parameter Notifikasi Aktif:</b>
• Informasi Site & Pelanggan
• IP Public Target
• <b>VLAN ID</b> & <b>Server / BRAS Aggregator</b>
• Alert otomatis saat ICMP Ping Timeout / DOWN
• Notifikasi otomatis saat ICMP Ping Pulih / RECOVERED (UP)
• Real-time monitoring sirkuit POP Site & Enterprise

🕒 <b>Waktu Pengujian:</b> ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━
✅ <i>Konfigurasi bot telegram Anda berfungsi dengan baik.</i>`;

  return dispatchTelegramHtmlMessage(token, chatId, message);
}

/**
 * Mengirim pesan tes koneksi Bot Telegram Tiket Selesai (terpisah dari Bot ICMP)
 */
export async function sendTicketTestNotification(
  testConfig?: { bot_token?: string; chat_id?: string }
): Promise<{ success: boolean; error?: string }> {
  const config = await getTicketTelegramConfig();
  const { token, chatId } = resolveTestCredentials(config, testConfig);
  const timestamp = getFormattedWibTime();
  const message = `🎫 <b>[TEST NOTIFIKASI] ACTIS TIKET PROVISIONING</b>
━━━━━━━━━━━━━━━━━━━━━━
Bot Telegram khusus <b>Tiket Selesai (Completed)</b> berhasil terhubung dengan sistem ACTIS!

📌 <b>Pemisahan Bot Aktif:</b>
• Menggunakan API Bot Token &amp; Chat ID khusus tiket
• Terpisah penuh dari Bot Alert ICMP Ping Monitoring
• Otomatis mengirim laporan saat tiket Aktivasi, Upgrade, Downgrade, Isolir, Unisolir, atau Terminate berstatus <b>Completed</b>

🕒 <b>Waktu Pengujian:</b> ${timestamp}
━━━━━━━━━━━━━━━━━━━━━━
✅ <i>Konfigurasi bot telegram tiket Anda berfungsi dengan baik.</i>`;

  return dispatchTelegramHtmlMessage(token, chatId, message);
}

export interface TicketCompletedPayload {
  ticket_number: string;
  tipe_order: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_pic: string;
  nama_perusahaan?: string | null;
  kontak_pic?: string | string[] | null;
  alamat_instalasi?: string | null;
  layanan_dedicated?: string | null;
  kapasitas_layanan?: string | null;
  tipe_layanan_collo?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  rack_code?: string | null;
  rack_unit_start?: number | null;
  rack_unit_end?: number | null;
  otb_code?: string | null;
  otb_core_numbers?: string | null;
  site_code?: string | null;
  completed_by?: string | null;
  completion_note?: string | null;
  test_count?: number;
  completed_at?: Date | string | null;
}

function parseKontakPicList(kontak?: string | string[] | null): string {
  if (!kontak) return "-";
  if (Array.isArray(kontak)) {
    const cleaned = kontak.map((k) => String(k).trim()).filter(Boolean);
    return cleaned.length > 0 ? cleaned.join(", ") : "-";
  }
  try {
    const parsed = JSON.parse(kontak);
    if (Array.isArray(parsed)) {
      const cleaned = parsed.map((k) => String(k).trim()).filter(Boolean);
      return cleaned.length > 0 ? cleaned.join(", ") : "-";
    }
  } catch {
    // Plain text contact fallback
  }
  return kontak.trim() || "-";
}

/**
 * Mengirim notifikasi otomatis ke Telegram Bot khusus Tiket ketika tiket berubah menjadi Completed.
 */
export async function notifyTicketCompleted(
  payload: TicketCompletedPayload
): Promise<{ sent: boolean; error?: string }> {
  const config = await getTicketTelegramConfig();
  if (!config.enabled || !config.bot_token || !config.chat_id) {
    return { sent: false };
  }

  const completedDate = payload.completed_at
    ? new Date(payload.completed_at)
    : new Date();
  const timestamp = Number.isNaN(completedDate.getTime())
    ? getFormattedWibTime()
    : getFormattedWibTime(completedDate);

  const kategoriDisplay = payload.sub_layanan
    ? `${payload.kategori_layanan || "Enterprise"} (${payload.sub_layanan})`
    : payload.kategori_layanan || "POP Site";

  const picDisplay = payload.nama_perusahaan
    ? `${payload.nama_pic} (${payload.nama_perusahaan})`
    : payload.nama_pic;

  const kontakDisplay = parseKontakPicList(payload.kontak_pic);

  const lines: string[] = [
    `✅ <b>[TIKET SELESAI - ${escapeHtml(payload.tipe_order.toUpperCase())}]</b>`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    `🎫 <b>No. Tiket:</b> <code>${escapeHtml(payload.ticket_number)}</code>`,
  ];

  if (payload.site_code) {
    lines.push(`🆔 <b>Site ID:</b> <code>${escapeHtml(payload.site_code)}</code>`);
  }

  lines.push(
    `🏢 <b>Kategori:</b> ${escapeHtml(kategoriDisplay)}`,
    `👤 <b>PIC / Pelanggan:</b> ${escapeHtml(picDisplay)}`,
    `📞 <b>Kontak PIC:</b> ${escapeHtml(kontakDisplay)}`
  );

  if (payload.alamat_instalasi?.trim()) {
    lines.push(`📍 <b>Lokasi:</b> ${escapeHtml(payload.alamat_instalasi.trim())}`);
  }

  if (config.include_specs) {
    const serviceName =
      payload.layanan_dedicated ||
      payload.kapasitas_layanan ||
      payload.tipe_layanan_collo;
    const specLines: string[] = [];

    if (serviceName?.trim()) {
      specLines.push(`⚡ <b>Layanan / BW:</b> ${escapeHtml(serviceName.trim())}`);
    }
    if (payload.ip_public?.trim()) {
      specLines.push(`🌐 <b>IP Public:</b> <code>${escapeHtml(payload.ip_public.trim())}</code>`);
    }
    if (payload.ip_private?.trim()) {
      specLines.push(`🔌 <b>IP Private:</b> <code>${escapeHtml(payload.ip_private.trim())}</code>`);
    }
    if (
      payload.vlan !== undefined &&
      payload.vlan !== null &&
      String(payload.vlan).trim() !== ""
    ) {
      specLines.push(`🖧 <b>VLAN ID:</b> <code>${escapeHtml(String(payload.vlan))}</code>`);
    }
    if (payload.server?.trim()) {
      specLines.push(`🖥️ <b>Server / BRAS:</b> ${escapeHtml(payload.server.trim())}`);
    }
    if (payload.infrastruktur?.trim() || payload.media_koneksi?.trim()) {
      const infra = [payload.infrastruktur, payload.media_koneksi]
        .filter((v) => v && v.trim() !== "")
        .join(" / ");
      specLines.push(`🏗️ <b>Infra / Media:</b> ${escapeHtml(infra)}`);
    }
    if (payload.sid?.trim() || payload.ao?.trim() || payload.nomor_order?.trim()) {
      const refParts: string[] = [];
      if (payload.sid?.trim()) refParts.push(`SID: ${payload.sid.trim()}`);
      if (payload.ao?.trim()) refParts.push(`AO: ${payload.ao.trim()}`);
      if (payload.nomor_order?.trim()) refParts.push(`Order: ${payload.nomor_order.trim()}`);
      specLines.push(`📦 <b>Ref Provider:</b> ${escapeHtml(refParts.join(" | "))}`);
    }
    const rackPos = formatRackPositionLabel(
      payload.rack_code,
      payload.rack_unit_start,
      payload.rack_unit_end
    );
    if (rackPos !== "-") {
      specLines.push(`🗄️ <b>Rack 3D:</b> <code>${escapeHtml(rackPos)}</code>`);
    }
    const otbPos = formatOtbCoreLabel(payload.otb_code, payload.otb_core_numbers);
    if (otbPos !== "-") {
      specLines.push(`🔌 <b>OTB Core 3D:</b> <code>${escapeHtml(otbPos)}</code>`);
    }

    if (specLines.length > 0) {
      lines.push("", ...specLines);
    }
  }

  if (config.include_notes) {
    lines.push("");
    if (typeof payload.test_count === "number" && payload.test_count > 0) {
      lines.push(`📎 <b>Bukti Hasil Test:</b> ${payload.test_count} file terunggah`);
    }
    if (payload.completion_note?.trim()) {
      const note = payload.completion_note.trim();
      const shortNote = note.length > 350 ? `${note.slice(0, 347)}...` : note;
      lines.push(`📝 <b>Catatan:</b> ${escapeHtml(shortNote)}`);
    }
  }

  lines.push(
    "",
    `👷 <b>Diselesaikan Oleh:</b> ${escapeHtml(payload.completed_by || "NOC Engineer")}`,
    `🕒 <b>Waktu Selesai:</b> ${timestamp}`,
    "━━━━━━━━━━━━━━━━━━━━━━",
    "🤖 <i>ACTIS Ticket Provisioning Notification Bot</i>"
  );

  const result = await dispatchTelegramHtmlMessage(
    config.bot_token,
    config.chat_id,
    lines.join("\n")
  );

  if (!result.success) {
    console.error(
      `Ticket Telegram notification failed (${payload.ticket_number}):`,
      result.error
    );
  }

  return { sent: result.success, error: result.error };
}

export interface OrderRecordForTelegram {
  ticket_number: string;
  tipe_order: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_pic: string;
  nama_perusahaan?: string | null;
  kontak_pic?: string | string[] | null;
  alamat_instalasi?: string | null;
  layanan_dedicated?: string | null;
  kapasitas_layanan?: string | null;
  tipe_layanan_collo?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  rack_code?: string | null;
  rack_unit_start?: number | null;
  rack_unit_end?: number | null;
  otb_code?: string | null;
  otb_core_numbers?: string | null;
  pop_site_id?: string | null;
  completed_at?: Date | string | null;
}

/**
 * Helper terpusat untuk memetakan record order dan melengkapi kode site sebelum mengirim notifikasi Telegram tiket selesai.
 */
export async function notifyOrderCompleted(params: {
  order: OrderRecordForTelegram;
  siteCode?: string | null;
  popSiteId?: string | null;
  completedBy?: string | null;
  completionNote?: string | null;
  testCount?: number;
  completedAt?: Date | string | null;
}): Promise<{ sent: boolean; error?: string }> {
  let resolvedSiteCode = params.siteCode ?? null;
  const targetSiteId = params.popSiteId ?? params.order.pop_site_id ?? null;

  if (!resolvedSiteCode && targetSiteId) {
    try {
      const popSite = await prisma.popSite.findUnique({
        where: { id: targetSiteId },
        select: { site_id: true },
      });
      resolvedSiteCode = popSite?.site_id ?? null;
    } catch {
      resolvedSiteCode = null;
    }
  }

  return notifyTicketCompleted({
    ticket_number: params.order.ticket_number,
    tipe_order: params.order.tipe_order,
    kategori_layanan: params.order.kategori_layanan,
    sub_layanan: params.order.sub_layanan,
    nama_pic: params.order.nama_pic,
    nama_perusahaan: params.order.nama_perusahaan,
    kontak_pic: params.order.kontak_pic,
    alamat_instalasi: params.order.alamat_instalasi,
    layanan_dedicated: params.order.layanan_dedicated,
    kapasitas_layanan: params.order.kapasitas_layanan,
    tipe_layanan_collo: params.order.tipe_layanan_collo,
    ip_public: params.order.ip_public,
    ip_private: params.order.ip_private,
    vlan: params.order.vlan,
    server: params.order.server,
    infrastruktur: params.order.infrastruktur,
    media_koneksi: params.order.media_koneksi,
    sid: params.order.sid,
    ao: params.order.ao,
    nomor_order: params.order.nomor_order,
    rack_code: params.order.rack_code,
    rack_unit_start: params.order.rack_unit_start,
    rack_unit_end: params.order.rack_unit_end,
    otb_code: params.order.otb_code,
    otb_core_numbers: params.order.otb_core_numbers,
    site_code: resolvedSiteCode,
    completed_by: params.completedBy,
    completion_note: params.completionNote,
    test_count: params.testCount,
    completed_at: params.completedAt ?? params.order.completed_at,
  });
}

/**
 * Escape karakter HTML untuk Telegram API
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
