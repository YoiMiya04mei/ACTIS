/**
 * Telegram Bot Notification Service untuk ACTIS ICMP Monitoring
 * Mengirim notifikasi real-time saat status ICMP ping DOWN/Timeout dan RECOVERED/UP.
 */

import { prisma } from "./prisma";

export interface TelegramConfig {
  bot_token: string;
  chat_id: string;
  enabled: boolean;
  notif_down: boolean;
  notif_up: boolean;
}

/**
 * Mengambil konfigurasi Telegram dari database system_settings dengan fallback ke process.env
 */
export async function getTelegramConfig(): Promise<TelegramConfig> {
  let dbSettings: Record<string, string> = {};
  try {
    const rows = await prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            "telegram_bot_token",
            "telegram_chat_id",
            "telegram_notif_enabled",
            "telegram_notif_down",
            "telegram_notif_up",
          ],
        },
      },
    });
    dbSettings = rows.reduce((acc, curr) => {
      acc[curr.key] = curr.value;
      return acc;
    }, {} as Record<string, string>);
  } catch (err) {
    console.error("Error reading Telegram config from DB:", err);
  }

  const bot_token =
    dbSettings.telegram_bot_token || process.env.TELEGRAM_BOT_TOKEN || "";
  const chat_id =
    dbSettings.telegram_chat_id || process.env.TELEGRAM_CHAT_ID || "";
  const enabled =
    (dbSettings.telegram_notif_enabled ?? process.env.TELEGRAM_NOTIF_ENABLED) ===
    "true";
  const notif_down =
    (dbSettings.telegram_notif_down ?? "true") === "true";
  const notif_up =
    (dbSettings.telegram_notif_up ?? "true") === "true";

  return {
    bot_token,
    chat_id,
    enabled,
    notif_down,
    notif_up,
  };
}

/**
 * Menyimpan konfigurasi Telegram ke database
 */
export async function saveTelegramConfig(
  config: Partial<TelegramConfig>
): Promise<TelegramConfig> {
  const updates: Array<{ key: string; value: string }> = [];

  if (config.bot_token !== undefined) {
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

  for (const item of updates) {
    await prisma.systemSetting.upsert({
      where: { key: item.key },
      update: { value: item.value },
      create: { key: item.key, value: item.value },
    });
  }

  return await getTelegramConfig();
}

/**
 * Mengirim pesan ke Telegram Bot API
 */
export async function sendTelegramMessage(
  text: string,
  customConfig?: { bot_token?: string; chat_id?: string }
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = await getTelegramConfig();
    const token = customConfig?.bot_token || config.bot_token;
    const chatId = customConfig?.chat_id || config.chat_id;

    if (!token || !chatId) {
      return {
        success: false,
        error: "Bot Token atau Chat ID Telegram belum dikonfigurasi.",
      };
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
    console.error("sendTelegramMessage Exception:", err);
    return {
      success: false,
      error: err.message || "Gagal menghubungi server Telegram.",
    };
  }
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
function getFormattedWibTime(): string {
  const d = new Date();
  return d.toLocaleString("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }) + " WIB";
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
  const vlanDisplay = rawVlan !== undefined && rawVlan !== null && rawVlan !== "" ? String(rawVlan) : "-";
  const serverDisplay = rawServer && String(rawServer).trim() !== "" ? String(rawServer).trim() : "-";

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

  await sendTelegramMessage(message);
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
  const latencyStr = latencyMs !== null && latencyMs !== undefined ? `${latencyMs} ms` : "< 1 ms";
  const uptimeStr = monitor.uptime_pct !== undefined ? `${monitor.uptime_pct.toFixed(1)}%` : "100%";

  const rawVlan = monitor.pop_site?.vlan ?? monitor.vlan;
  const rawServer = monitor.pop_site?.server ?? monitor.server;
  const vlanDisplay = rawVlan !== undefined && rawVlan !== null && rawVlan !== "" ? String(rawVlan) : "-";
  const serverDisplay = rawServer && String(rawServer).trim() !== "" ? String(rawServer).trim() : "-";

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

  await sendTelegramMessage(message);
}

/**
 * Mengirim pesan tes koneksi Telegram Bot
 */
export async function sendTestNotification(
  testConfig?: { bot_token?: string; chat_id?: string }
): Promise<{ success: boolean; error?: string }> {
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

  return await sendTelegramMessage(message, testConfig);
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

