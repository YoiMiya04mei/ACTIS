import { prisma } from "./prisma";

export interface SyncPayload {
  event: "CREATE_ORDER" | "PROGRESS_UPDATE" | "CONFIG_PUSHED" | "TEST_UPLOADED" | "STATUS_CHANGE" | "FORCE_SYNC";
  ticket_number: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_perusahaan?: string | null;
  email_pic?: string | null;
  nama_pic: string;
  kontak_pic?: string[];
  alamat_instalasi?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | null;
  layanan_dedicated?: string | null;
  kapasitas_layanan?: string | null;
  interkoneksi?: string | null;
  port_media?: string | null;
  tipe_layanan_collo?: string | null;
  nama_perangkat?: string | null;
  sn_perangkat?: string | null;
  prefix_advertise?: string | null;
  as_number?: string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sn_ont?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  status: string;
  status_sebelum?: string | null;
  status_sesudah?: string | null;
  updated_by: string;
  progress_note: string;
  timestamp: string;
  test_result_links: string[];
  waktu_aktivasi?: string;
  created_at?: string;
  completed_at?: string | null;
}

/**
 * Gets the current configured webhook URL from system settings or env
 */
export async function getWebhookUrl(): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({
      where: { key: "GOOGLE_APPS_SCRIPT_WEBHOOK_URL" },
    });
    if (setting && setting.value.trim().length > 0) {
      return setting.value.trim();
    }
  } catch (err) {
    console.error("Failed to read system setting for webhook URL:", err);
  }
  return process.env.GOOGLE_APPS_SCRIPT_WEBHOOK_URL || "";
}

/**
 * Dispatches an event payload asynchronously to Google Apps Script Webhook
 * Non-blocking: will never crash or delay caller
 */
export async function dispatchSheetsSync(payload: SyncPayload, orderId?: string): Promise<{ success: boolean; message: string }> {
  // Run asynchronously without blocking caller if desired, but we return a promise so caller can await if needed
  const webhookUrl = await getWebhookUrl();

  const isConfigured =
    webhookUrl &&
    !webhookUrl.includes("SAMPLE_ACTIS_WEBHOOK") &&
    webhookUrl.startsWith("http");

  if (!isConfigured) {
    const note = `[Simulated] Webhook URL not configured or is sample. Simulated sync success for ${payload.ticket_number}.`;
    await prisma.sheetsSyncLog.create({
      data: {
        order_id: orderId || null,
        event: payload.event,
        payload: JSON.stringify(payload),
        status: "SUCCESS",
        response_message: note,
      },
    });
    return { success: true, message: note };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000); // 12 seconds max

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
      redirect: "follow",
    });

    clearTimeout(timeout);

    const text = await res.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(text);
    } catch {
      resJson = { raw: text };
    }

    const isOk = res.ok && (resJson?.status === "success" || !resJson?.status);
    const logStatus = isOk ? "SUCCESS" : "FAILED";
    const msg = resJson?.message || `HTTP ${res.status}: ${text.slice(0, 150)}`;

    await prisma.sheetsSyncLog.create({
      data: {
        order_id: orderId || null,
        event: payload.event,
        payload: JSON.stringify(payload),
        status: logStatus,
        response_message: msg,
      },
    });

    return { success: isOk, message: msg };
  } catch (err: any) {
    const errorMsg = err?.name === "AbortError" ? "Timeout: Webhook took too long to respond." : (err?.message || String(err));
    console.error("Sheets sync dispatch error:", errorMsg);

    await prisma.sheetsSyncLog.create({
      data: {
        order_id: orderId || null,
        event: payload.event,
        payload: JSON.stringify(payload),
        status: "FAILED",
        response_message: `Network/Webhook Error: ${errorMsg}`,
      },
    });

    return { success: false, message: errorMsg };
  }
}

/**
 * Builds standard sync payload from order model & progress log
 */
export async function buildPayloadForOrder(
  orderId: string,
  event: SyncPayload["event"],
  options?: {
    updatedBy?: string;
    progressNote?: string;
    statusSebelum?: string | null;
    statusSesudah?: string | null;
  }
): Promise<SyncPayload | null> {
  const order = await prisma.popSiteOrder.findUnique({
    where: { id: orderId },
    include: {
      creator: true,
      test_results: true,
      progress_logs: {
        orderBy: { created_at: "desc" },
        take: 1,
        include: { user: true },
      },
    },
  });

  if (!order) return null;

  let kontakPic: string[] = [];
  try {
    kontakPic = JSON.parse(order.kontak_pic);
  } catch {
    kontakPic = [order.kontak_pic];
  }

  const latestLog = order.progress_logs[0];
  const testLinks = order.test_results.map((t) => t.file_url);

  const updatedBy = options?.updatedBy || latestLog?.user?.nama || order.creator?.nama || "System";
  const progressNote =
    options?.progressNote ||
    latestLog?.catatan_progress ||
    `Order status: ${order.status}`;

  const now = new Date();
  const timestampStr = now.toISOString().replace("T", " ").substring(0, 19);

  return {
    event,
    ticket_number: order.ticket_number,
    kategori_layanan: order.kategori_layanan,
    sub_layanan: order.sub_layanan,
    nama_perusahaan: order.nama_perusahaan,
    email_pic: order.email_pic,
    nama_pic: order.nama_pic,
    kontak_pic: kontakPic,
    alamat_instalasi: order.alamat_instalasi,
    ip_public: order.ip_public,
    ip_private: order.ip_private,
    vlan: order.vlan,
    layanan_dedicated: order.layanan_dedicated,
    kapasitas_layanan: order.kapasitas_layanan,
    interkoneksi: order.interkoneksi,
    port_media: order.port_media,
    tipe_layanan_collo: order.tipe_layanan_collo,
    nama_perangkat: order.nama_perangkat,
    sn_perangkat: order.sn_perangkat,
    prefix_advertise: order.prefix_advertise,
    as_number: order.as_number,
    server: order.server,
    infrastruktur: order.infrastruktur,
    media_koneksi: order.media_koneksi,
    sn_ont: order.sn_ont,
    sid: order.sid,
    ao: order.ao,
    nomor_order: order.nomor_order,
    status: order.status,
    status_sebelum: options?.statusSebelum ?? latestLog?.status_sebelum ?? null,
    status_sesudah: options?.statusSesudah ?? order.status,
    updated_by: updatedBy,
    progress_note: progressNote,
    timestamp: timestampStr,
    test_result_links: testLinks,
    waktu_aktivasi: order.waktu_aktivasi ? order.waktu_aktivasi.toISOString().replace("T", " ").substring(0, 19) : "",
    created_at: order.created_at ? order.created_at.toISOString().replace("T", " ").substring(0, 19) : "",
    completed_at: order.completed_at ? order.completed_at.toISOString().replace("T", " ").substring(0, 19) : null,
  };
}

/**
 * Triggers Force Sync for all orders in database
 */
export async function forceSyncAllOrdersToSheets(triggeredBy: string = "Admin"): Promise<{
  total: number;
  synced: number;
  results: Array<{ ticket: string; success: boolean; message: string }>;
}> {
  const orders = await prisma.popSiteOrder.findMany({
    orderBy: { created_at: "asc" },
  });

  const results: Array<{ ticket: string; success: boolean; message: string }> = [];

  for (const order of orders) {
    const payload = await buildPayloadForOrder(order.id, "FORCE_SYNC", {
      updatedBy: `${triggeredBy} (Force Sync)`,
      progressNote: "Manual bulk synchronization to Google Spreadsheet initiated.",
    });

    if (payload) {
      const res = await dispatchSheetsSync(payload, order.id);
      results.push({
        ticket: order.ticket_number,
        success: res.success,
        message: res.message,
      });
    }
  }

  const successCount = results.filter((r) => r.success).length;
  return {
    total: orders.length,
    synced: successCount,
    results,
  };
}

