import crypto from "crypto";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret, maskSecret } from "@/lib/backupCrypto";
import { parseSerialList } from "@/lib/inventoryClientFinish";
import { formatWorkTypeLabel, parseWorkTypes } from "@/lib/inventoryRequest";
import { getGDriveStoredConfig } from "@/lib/gdriveSyncService";
import {
  buildGoogleOAuthAuthorizeUrl,
  exchangeGoogleOAuthCode,
  getOAuth2AccessToken,
  getServiceAccountAccessToken,
  GOOGLE_DRIVE_SCOPE_FILE,
  GOOGLE_DRIVE_SCOPE_FULL,
  GOOGLE_SHEETS_SCOPE,
  preserveOrUpdateSecret,
  validateGoogleWebhookUrl,
} from "@/lib/googleAuth";
import {
  buildInventorySheetsMatrices,
  extractGoogleResourceId,
  formatWibTimestamp,
  INVENTORY_MIRROR_APPS_SCRIPT_TEMPLATE,
  INVENTORY_SHEET_TAB_NAMES,
  type InventoryMirrorEventType,
  type InventoryMirrorSnapshot,
  type SheetTabMatrix,
} from "@/lib/inventoryMirrorPayload";

export type InventoryMirrorMethod = "apps_script" | "oauth2" | "service_account";

export interface InventoryMirrorStoredConfig {
  enabled: boolean;
  auto_sync: boolean;
  save_drive_backup: boolean;
  method: InventoryMirrorMethod;
  spreadsheet_id: string;
  spreadsheet_url: string;
  folder_id: string;
  apps_script_url: string;
  apps_script_secret_enc: string | null;
  oauth_client_id: string;
  oauth_client_secret_enc: string | null;
  oauth_refresh_token_enc: string | null;
  sa_client_email: string;
  sa_private_key_enc: string | null;
}

export interface InventoryMirrorPublicConfig {
  enabled: boolean;
  auto_sync: boolean;
  save_drive_backup: boolean;
  method: InventoryMirrorMethod;
  spreadsheet_id: string;
  spreadsheet_url: string;
  folder_id: string;
  apps_script_url: string;
  apps_script_secret_masked: string;
  has_apps_script_secret: boolean;
  oauth_client_id: string;
  oauth_client_secret_masked: string;
  has_oauth_client_secret: boolean;
  oauth_refresh_token_masked: string;
  has_oauth_refresh_token: boolean;
  sa_client_email: string;
  sa_private_key_masked: string;
  has_sa_private_key: boolean;
  is_configured: boolean;
}

export interface InventoryMirrorLogEntry {
  id: string;
  event: InventoryMirrorEventType | string;
  triggered_by: string;
  status: "SUCCESS" | "FAILED";
  message: string;
  spreadsheet_url?: string;
  drive_file_url?: string;
  items_count: number;
  transactions_count: number;
  created_at: string;
}

export interface InventoryMirrorSyncState {
  total_success: number;
  total_failed: number;
  last_synced_at: string | null;
  last_status: "SUCCESS" | "FAILED" | null;
  last_error: string | null;
  last_spreadsheet_url: string | null;
  last_drive_file_url: string | null;
  logs: InventoryMirrorLogEntry[];
}

export const SETTING_KEY_INVENTORY_MIRROR = "inventory_mirror_config";
export const SETTING_KEY_INVENTORY_MIRROR_LOGS = "inventory_mirror_logs";

export const INVENTORY_MIRROR_OAUTH_SCOPES = `${GOOGLE_DRIVE_SCOPE_FILE} ${GOOGLE_SHEETS_SCOPE}`;
export const INVENTORY_MIRROR_DRIVE_FILENAME = "ACTIS_Inventory_Database_Mirror.json";

export { INVENTORY_MIRROR_APPS_SCRIPT_TEMPLATE };

function getDefaultStoredConfig(): InventoryMirrorStoredConfig {
  const envSaEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || "";
  const envSaKey = process.env.GOOGLE_PRIVATE_KEY
    ? process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n")
    : "";

  return {
    enabled: false,
    auto_sync: true,
    save_drive_backup: true,
    method: "apps_script",
    spreadsheet_id: "",
    spreadsheet_url: "",
    folder_id: "",
    apps_script_url: "",
    apps_script_secret_enc: null,
    oauth_client_id: process.env.GOOGLE_OAUTH_CLIENT_ID || "",
    oauth_client_secret_enc: process.env.GOOGLE_OAUTH_CLIENT_SECRET
      ? encryptSecret(process.env.GOOGLE_OAUTH_CLIENT_SECRET)
      : null,
    oauth_refresh_token_enc: null,
    sa_client_email: envSaEmail,
    sa_private_key_enc: envSaKey ? encryptSecret(envSaKey) : null,
  };
}

export async function getInventoryMirrorStoredConfig(): Promise<InventoryMirrorStoredConfig> {
  const fallback = getDefaultStoredConfig();
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_INVENTORY_MIRROR },
    });
    if (!row?.value) return fallback;
    const parsed = JSON.parse(row.value);
    return {
      ...fallback,
      ...parsed,
      spreadsheet_id: parsed.spreadsheet_id || "",
      spreadsheet_url:
        parsed.spreadsheet_url ||
        (parsed.spreadsheet_id
          ? `https://docs.google.com/spreadsheets/d/${parsed.spreadsheet_id}/edit`
          : ""),
      sa_client_email: parsed.sa_client_email || fallback.sa_client_email,
      sa_private_key_enc: parsed.sa_private_key_enc || fallback.sa_private_key_enc,
      oauth_client_id: parsed.oauth_client_id || fallback.oauth_client_id,
      oauth_client_secret_enc: parsed.oauth_client_secret_enc || fallback.oauth_client_secret_enc,
    };
  } catch (err) {
    console.error("Failed to read Inventory Mirror config:", err);
    return fallback;
  }
}

export function isInventoryMirrorConfigReady(cfg: InventoryMirrorStoredConfig): boolean {
  if (!cfg.enabled) return false;
  if (cfg.method === "apps_script") {
    return Boolean(cfg.apps_script_url && validateGoogleWebhookUrl(cfg.apps_script_url).ok);
  }
  if (cfg.method === "oauth2") {
    return Boolean(cfg.oauth_client_id && cfg.oauth_client_secret_enc && cfg.oauth_refresh_token_enc);
  }
  if (cfg.method === "service_account") {
    return Boolean(cfg.sa_client_email && cfg.sa_private_key_enc && (cfg.spreadsheet_id || cfg.folder_id));
  }
  return false;
}

export async function getInventoryMirrorPublicConfig(): Promise<InventoryMirrorPublicConfig> {
  const cfg = await getInventoryMirrorStoredConfig();
  return {
    enabled: cfg.enabled,
    auto_sync: cfg.auto_sync !== false,
    save_drive_backup: cfg.save_drive_backup !== false,
    method: cfg.method,
    spreadsheet_id: cfg.spreadsheet_id || "",
    spreadsheet_url:
      cfg.spreadsheet_url ||
      (cfg.spreadsheet_id ? `https://docs.google.com/spreadsheets/d/${cfg.spreadsheet_id}/edit` : ""),
    folder_id: cfg.folder_id || "",
    apps_script_url: cfg.apps_script_url || "",
    apps_script_secret_masked: cfg.apps_script_secret_enc ? maskSecret(cfg.apps_script_secret_enc) : "",
    has_apps_script_secret: Boolean(cfg.apps_script_secret_enc),
    oauth_client_id: cfg.oauth_client_id || "",
    oauth_client_secret_masked: cfg.oauth_client_secret_enc ? maskSecret(cfg.oauth_client_secret_enc) : "",
    has_oauth_client_secret: Boolean(cfg.oauth_client_secret_enc),
    oauth_refresh_token_masked: cfg.oauth_refresh_token_enc ? maskSecret(cfg.oauth_refresh_token_enc) : "",
    has_oauth_refresh_token: Boolean(cfg.oauth_refresh_token_enc),
    sa_client_email: cfg.sa_client_email || "",
    sa_private_key_masked: cfg.sa_private_key_enc ? "-----BEGIN PRIVATE KEY----- (Tersimpan Terenkripsi)" : "",
    has_sa_private_key: Boolean(cfg.sa_private_key_enc),
    is_configured: isInventoryMirrorConfigReady(cfg),
  };
}

export async function saveInventoryMirrorConfig(input: {
  enabled?: boolean;
  auto_sync?: boolean;
  save_drive_backup?: boolean;
  method?: InventoryMirrorMethod;
  spreadsheet_id?: string;
  spreadsheet_url?: string;
  folder_id?: string;
  apps_script_url?: string;
  apps_script_secret?: string;
  clear_apps_script_secret?: boolean;
  oauth_client_id?: string;
  oauth_client_secret?: string;
  oauth_refresh_token?: string;
  sa_client_email?: string;
  sa_private_key?: string;
}): Promise<InventoryMirrorPublicConfig> {
  const current = await getInventoryMirrorStoredConfig();
  const nextMethod: InventoryMirrorMethod = input.method || current.method;

  let nextWebhookUrl = current.apps_script_url;
  if (input.apps_script_url !== undefined) {
    const trimmedUrl = input.apps_script_url.trim();
    if (trimmedUrl) {
      const check = validateGoogleWebhookUrl(trimmedUrl);
      if (!check.ok) {
        throw new Error(check.error);
      }
      nextWebhookUrl = check.url;
    } else {
      nextWebhookUrl = "";
    }
  }

  const nextSpreadsheetId =
    input.spreadsheet_id !== undefined
      ? extractGoogleResourceId(input.spreadsheet_id, "spreadsheet")
      : current.spreadsheet_id;

  const nextFolderId =
    input.folder_id !== undefined
      ? extractGoogleResourceId(input.folder_id, "folder")
      : current.folder_id;

  const nextSpreadsheetUrl =
    input.spreadsheet_url !== undefined
      ? input.spreadsheet_url.trim()
      : nextSpreadsheetId && nextSpreadsheetId !== current.spreadsheet_id
        ? `https://docs.google.com/spreadsheets/d/${nextSpreadsheetId}/edit`
        : nextSpreadsheetId
          ? current.spreadsheet_url || `https://docs.google.com/spreadsheets/d/${nextSpreadsheetId}/edit`
          : "";

  const updated: InventoryMirrorStoredConfig = {
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : current.enabled,
    auto_sync: input.auto_sync !== undefined ? Boolean(input.auto_sync) : current.auto_sync,
    save_drive_backup:
      input.save_drive_backup !== undefined ? Boolean(input.save_drive_backup) : current.save_drive_backup,
    method: nextMethod,
    spreadsheet_id: nextSpreadsheetId,
    spreadsheet_url: nextSpreadsheetUrl,
    folder_id: nextFolderId,
    apps_script_url: nextWebhookUrl,
    apps_script_secret_enc: input.clear_apps_script_secret
      ? null
      : preserveOrUpdateSecret(input.apps_script_secret, current.apps_script_secret_enc),
    oauth_client_id:
      input.oauth_client_id !== undefined ? input.oauth_client_id.trim() : current.oauth_client_id,
    oauth_client_secret_enc: preserveOrUpdateSecret(
      input.oauth_client_secret,
      current.oauth_client_secret_enc
    ),
    oauth_refresh_token_enc: preserveOrUpdateSecret(
      input.oauth_refresh_token,
      current.oauth_refresh_token_enc
    ),
    sa_client_email:
      input.sa_client_email !== undefined ? input.sa_client_email.trim() : current.sa_client_email,
    sa_private_key_enc: preserveOrUpdateSecret(
      input.sa_private_key ? input.sa_private_key.replace(/\\n/g, "\n") : input.sa_private_key,
      current.sa_private_key_enc
    ),
  };

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_INVENTORY_MIRROR },
    update: { value: JSON.stringify(updated) },
    create: { key: SETTING_KEY_INVENTORY_MIRROR, value: JSON.stringify(updated) },
  });

  return getInventoryMirrorPublicConfig();
}

export async function copyBackupGDriveCredentialsToMirror(): Promise<{
  copiedFields: string[];
  config: InventoryMirrorPublicConfig;
}> {
  const backupCfg = await getGDriveStoredConfig();
  const current = await getInventoryMirrorStoredConfig();
  const copiedFields: string[] = [];

  const next: InventoryMirrorStoredConfig = { ...current };
  if (backupCfg.oauth_client_id) {
    next.oauth_client_id = backupCfg.oauth_client_id;
    copiedFields.push("OAuth2 Client ID");
  }
  if (backupCfg.oauth_client_secret_enc) {
    next.oauth_client_secret_enc = backupCfg.oauth_client_secret_enc;
    copiedFields.push("OAuth2 Client Secret");
  }
  if (backupCfg.sa_client_email) {
    next.sa_client_email = backupCfg.sa_client_email;
    copiedFields.push("Service Account Email");
  }
  if (backupCfg.sa_private_key_enc) {
    next.sa_private_key_enc = backupCfg.sa_private_key_enc;
    copiedFields.push("Service Account Private Key");
  }
  if (!next.folder_id && backupCfg.folder_id) {
    next.folder_id = backupCfg.folder_id;
    copiedFields.push("Folder ID");
  }

  if (copiedFields.length === 0) {
    throw new Error("Belum ada kredensial OAuth2 / Service Account tersimpan di menu Backup Config.");
  }

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_INVENTORY_MIRROR },
    update: { value: JSON.stringify(next) },
    create: { key: SETTING_KEY_INVENTORY_MIRROR, value: JSON.stringify(next) },
  });

  return { copiedFields, config: await getInventoryMirrorPublicConfig() };
}

export async function getInventoryMirrorSyncState(): Promise<InventoryMirrorSyncState> {
  const empty: InventoryMirrorSyncState = {
    total_success: 0,
    total_failed: 0,
    last_synced_at: null,
    last_status: null,
    last_error: null,
    last_spreadsheet_url: null,
    last_drive_file_url: null,
    logs: [],
  };

  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_INVENTORY_MIRROR_LOGS },
    });
    if (!row?.value) return empty;
    const parsed = JSON.parse(row.value);
    return {
      ...empty,
      ...parsed,
      logs: Array.isArray(parsed.logs) ? parsed.logs.slice(0, 50) : [],
    };
  } catch {
    return empty;
  }
}

async function appendInventoryMirrorLog(entry: Omit<InventoryMirrorLogEntry, "id" | "created_at">) {
  const state = await getInventoryMirrorSyncState();
  const nowIso = new Date().toISOString();
  const fullEntry: InventoryMirrorLogEntry = {
    id: crypto.randomUUID(),
    ...entry,
    created_at: nowIso,
  };

  const nextState: InventoryMirrorSyncState = {
    total_success: state.total_success + (entry.status === "SUCCESS" ? 1 : 0),
    total_failed: state.total_failed + (entry.status === "FAILED" ? 1 : 0),
    last_synced_at: entry.status === "SUCCESS" ? nowIso : state.last_synced_at,
    last_status: entry.status,
    last_error: entry.status === "FAILED" ? entry.message : null,
    last_spreadsheet_url: entry.spreadsheet_url || state.last_spreadsheet_url,
    last_drive_file_url: entry.drive_file_url || state.last_drive_file_url,
    logs: [fullEntry, ...state.logs].slice(0, 50),
  };

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_INVENTORY_MIRROR_LOGS },
    update: { value: JSON.stringify(nextState) },
    create: { key: SETTING_KEY_INVENTORY_MIRROR_LOGS, value: JSON.stringify(nextState) },
  });
}

export async function getInventoryMirrorLiveCounts() {
  const [items, activeItems, units, transactions, returns, requests] = await Promise.all([
    prisma.inventoryItem.count(),
    prisma.inventoryItem.count({ where: { is_active: true } }),
    prisma.inventoryItemUnit.count(),
    prisma.inventoryTransaction.count(),
    prisma.inventoryReturn.count(),
    prisma.inventoryRequest.count(),
  ]);

  return {
    items,
    active_items: activeItems,
    units,
    transactions,
    returns,
    requests,
  };
}

/**
 * Queries full live Inventory Management database snapshot ready for mirroring & export.
 */
export async function buildInventoryMirrorSnapshot(): Promise<InventoryMirrorSnapshot> {
  const [itemsRaw, unitsRaw, txRaw, returnsRaw, requestsRaw] = await Promise.all([
    prisma.inventoryItem.findMany({
      orderBy: [{ code: "asc" }],
      include: {
        category: { select: { name: true } },
        stock: true,
      },
    }),
    prisma.inventoryItemUnit.findMany({
      orderBy: [{ created_at: "desc" }],
      take: 2500,
      include: {
        item: { select: { code: true, name: true } },
      },
    }),
    prisma.inventoryTransaction.findMany({
      orderBy: [{ transaction_date: "desc" }, { created_at: "desc" }],
      take: 1500,
      include: {
        details: {
          include: {
            item: { select: { code: true, name: true, unit: true } },
          },
        },
      },
    }),
    prisma.inventoryReturn.findMany({
      orderBy: [{ return_date: "desc" }, { created_at: "desc" }],
      take: 1500,
      include: {
        out_transaction: { select: { transaction_number: true } },
        details: {
          include: {
            item: { select: { name: true, unit: true } },
          },
        },
      },
    }),
    prisma.inventoryRequest.findMany({
      orderBy: [{ created_at: "desc" }],
      take: 1500,
      include: {
        out_transaction: { select: { transaction_number: true } },
        items: {
          include: {
            item: { select: { code: true, name: true, unit: true } },
          },
        },
      },
    }),
  ]);

  let totalAvailableStock = 0;
  let activeItemsCount = 0;

  const items = itemsRaw.map((it) => {
    const avail = Number(it.stock?.available_stock || 0);
    if (it.is_active) activeItemsCount++;
    totalAvailableStock += avail;
    return {
      id: it.id,
      code: it.code,
      name: it.name,
      category_name: it.category?.name || "-",
      brand: it.brand || "-",
      model: it.model || "-",
      unit: it.unit,
      storage_location: it.storage_location || "-",
      initial_stock: Number(it.stock?.initial_stock || 0),
      total_in: Number(it.stock?.total_in || 0),
      total_out: Number(it.stock?.total_out || 0),
      total_in_use: Number(it.stock?.total_in_use || 0),
      total_consumed: Number(it.stock?.total_consumed || 0),
      total_returned: Number(it.stock?.total_returned || 0),
      total_damaged: Number(it.stock?.total_damaged || 0),
      total_lost: Number(it.stock?.total_lost || 0),
      available_stock: avail,
      min_stock: Number(it.min_stock || 0),
      is_active: it.is_active,
      updated_at: formatWibTimestamp(it.stock?.updated_at || it.updated_at),
    };
  });

  const units = unitsRaw.map((u) => ({
    id: u.id,
    item_code: u.item?.code || "-",
    item_name: u.item?.name || "-",
    serial_number: u.serial_number,
    mac_address: u.mac_address || "-",
    status: u.status,
    condition: u.condition,
    current_pic: u.current_pic || "-",
    current_location: u.current_location || "-",
    updated_at: formatWibTimestamp(u.updated_at),
  }));

  const transactions = txRaw.map((t) => {
    const itemsSummary = (t.details || [])
      .map((d) => `${d.item?.name || d.item_id} (${Number(d.quantity)} ${d.unit})`)
      .join(", ");
    const allSns = (t.details || []).flatMap((d) => parseSerialList(d.unit_serial_numbers));
    return {
      id: t.id,
      transaction_number: t.transaction_number,
      type: t.type,
      transaction_date: formatWibTimestamp(t.transaction_date),
      warehouse_officer: t.warehouse_officer,
      pic_name: t.pic_name || "-",
      pic_phone: t.pic_phone || "-",
      department: t.department || "-",
      location: t.location || "-",
      status: t.status,
      items_summary: itemsSummary || "-",
      serial_numbers: allSns.length > 0 ? allSns.join(", ") : "-",
      notes: t.notes || "-",
    };
  });

  const returns = returnsRaw.map((r) => ({
    id: r.id,
    return_number: r.return_number,
    out_transaction_number: r.out_transaction?.transaction_number || "-",
    return_date: formatWibTimestamp(r.return_date),
    pic_name: r.pic_name,
    recipient_officer: r.recipient_officer,
    details_summary: (r.details || [])
      .map((d) => `${d.item?.name || d.item_id} (${Number(d.quantity)} ${d.item?.unit || "Unit"} - ${d.condition})`)
      .join(", "),
    notes: r.notes || "-",
  }));

  const requests = requestsRaw.map((req) => {
    const parsedTypes = parseWorkTypes(req.work_types);
    const workLabel = formatWorkTypeLabel(parsedTypes, req.work_type_other);
    const processedBy = req.approved_by_name
      ? `ACC: ${req.approved_by_name}`
      : req.rejected_by_name
        ? `Tolak: ${req.rejected_by_name}`
        : "-";
    return {
      id: req.id,
      request_number: req.request_number,
      request_date: formatWibTimestamp(req.request_date),
      pic_name: req.pic_name,
      pic_phone: req.pic_phone || "-",
      work_type_label: workLabel || "-",
      pickup_location: req.pickup_location,
      status: req.status,
      out_transaction_number: req.out_transaction?.transaction_number || "-",
      processed_by: processedBy,
      items_summary: (req.items || [])
        .map((it) => `${it.item?.name || it.item_id} (${Number(it.quantity)} ${it.unit})`)
        .join(", "),
      notes: req.notes || "-",
    };
  });

  const now = new Date();
  return {
    generated_at_iso: now.toISOString(),
    generated_at_wib: formatWibTimestamp(now),
    summary: {
      total_items: items.length,
      active_items: activeItemsCount,
      total_available_stock: totalAvailableStock,
      total_units: units.length,
      total_transactions: transactions.length,
      total_returns: returns.length,
      total_requests: requests.length,
    },
    items,
    units,
    transactions,
    returns,
    requests,
  };
}

export function buildInventoryOAuthAuthorizeUrl(
  clientId: string,
  redirectUri: string,
  state: string
): string {
  return buildGoogleOAuthAuthorizeUrl(clientId, redirectUri, state, INVENTORY_MIRROR_OAUTH_SCOPES);
}

export async function exchangeInventoryMirrorOAuthCode(params: {
  code: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
}) {
  return exchangeGoogleOAuthCode(params);
}

async function createAndPopulateSpreadsheetDirect(params: {
  accessToken: string;
  existingSpreadsheetId?: string;
  folderId?: string;
  matrices: SheetTabMatrix[];
  snapshot: InventoryMirrorSnapshot;
  event: string;
  triggeredBy: string;
}): Promise<{ spreadsheetId: string; spreadsheetUrl: string }> {
  const requiredTabs = [...params.matrices.map((m) => m.tabName), "Meta_Mirror_Sync"];
  let spreadsheetId = params.existingSpreadsheetId?.trim() || "";
  let spreadsheetUrl = spreadsheetId
    ? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`
    : "";

  if (!spreadsheetId) {
    const createRes = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          title: "ACTIS - Inventory Database Mirror",
          locale: "id_ID",
          timeZone: "Asia/Jakarta",
        },
        sheets: requiredTabs.map((title) => ({
          properties: { title, gridProperties: { frozenRowCount: 1 } },
        })),
      }),
    });
    const createJson = await createRes.json();
    if (!createRes.ok || !createJson.spreadsheetId) {
      throw new Error(
        `Gagal membuat Google Spreadsheet baru: ${createJson.error?.message || createRes.statusText}`
      );
    }
    spreadsheetId = createJson.spreadsheetId;
    spreadsheetUrl =
      createJson.spreadsheetUrl || `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`;

    if (params.folderId) {
      await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(spreadsheetId)}?addParents=${encodeURIComponent(params.folderId)}&supportsAllDrives=true`,
        {
          method: "PATCH",
          headers: { Authorization: `Bearer ${params.accessToken}` },
        }
      ).catch(() => {});
    }
  } else {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=spreadsheetId,spreadsheetUrl,sheets.properties.title`,
      {
        headers: { Authorization: `Bearer ${params.accessToken}` },
      }
    );
    const metaJson = await metaRes.json();
    if (!metaRes.ok || !metaJson.spreadsheetId) {
      throw new Error(
        `Gagal membaca Spreadsheet ID '${spreadsheetId}': ${metaJson.error?.message || metaRes.statusText}`
      );
    }
    spreadsheetUrl = metaJson.spreadsheetUrl || spreadsheetUrl;
    const existingTitles = new Set<string>(
      (metaJson.sheets || []).map((s: any) => s?.properties?.title).filter(Boolean)
    );
    const missingTabs = requiredTabs.filter((title) => !existingTitles.has(title));
    if (missingTabs.length > 0) {
      const addRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}:batchUpdate`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            requests: missingTabs.map((title) => ({
              addSheet: { properties: { title, gridProperties: { frozenRowCount: 1 } } },
            })),
          }),
        }
      );
      if (!addRes.ok) {
        const addErr = await addRes.json().catch(() => ({}));
        throw new Error(
          `Gagal menambahkan sheet tab baru: ${addErr.error?.message || addRes.statusText}`
        );
      }
    }
  }

  // Clear previous cell values on target mirror tabs cleanly before writing fresh state
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchClear`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ranges: requiredTabs.map((t) => `'${t}'!A:Z`),
      }),
    }
  );

  const metaRows: Array<Array<string | number>> = [
    ["Parameter", "Nilai"],
    ["Last Synced (WIB)", params.snapshot.generated_at_wib],
    ["Event Trigger", params.event],
    ["Triggered By", params.triggeredBy],
    ["Total Master SKU", params.snapshot.summary.total_items],
    ["Total Stok Tersedia", params.snapshot.summary.total_available_stock],
    ["Total Serial Number", params.snapshot.summary.total_units],
    ["Total Riwayat Transaksi", params.snapshot.summary.total_transactions],
  ];

  const valueRanges = [
    ...params.matrices.map((m) => ({
      range: `'${m.tabName}'!A1`,
      majorDimension: "ROWS",
      values: [m.headers, ...m.rows],
    })),
    {
      range: `'Meta_Mirror_Sync'!A1`,
      majorDimension: "ROWS",
      values: metaRows,
    },
  ];

  const writeRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values:batchUpdate`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        valueInputOption: "RAW",
        data: valueRanges,
      }),
    }
  );
  const writeJson = await writeRes.json().catch(() => ({}));
  if (!writeRes.ok) {
    throw new Error(
      `Gagal menulis data ke Google Sheets: ${writeJson.error?.message || writeRes.statusText}`
    );
  }

  return { spreadsheetId, spreadsheetUrl };
}

async function upsertDriveJsonMirrorDirect(params: {
  accessToken: string;
  folderId?: string;
  snapshot: InventoryMirrorSnapshot;
}): Promise<{ fileId: string; fileUrl: string }> {
  const escapedName = INVENTORY_MIRROR_DRIVE_FILENAME.replace(/'/g, "\\'");
  const parentFilter = params.folderId ? `'${params.folderId}' in parents and ` : "";
  const q = `${parentFilter}name = '${escapedName}' and trashed = false`;

  const searchUrl = new URL("https://www.googleapis.com/drive/v3/files");
  searchUrl.searchParams.set("q", q);
  searchUrl.searchParams.set("fields", "files(id,webViewLink)");
  searchUrl.searchParams.set("supportsAllDrives", "true");
  searchUrl.searchParams.set("includeItemsFromAllDrives", "true");

  const searchRes = await fetch(searchUrl.toString(), {
    headers: { Authorization: `Bearer ${params.accessToken}` },
  });
  const searchJson = await searchRes.json().catch(() => ({}));
  const existingFile =
    searchRes.ok && Array.isArray(searchJson.files) ? searchJson.files[0] : null;

  const jsonContent = JSON.stringify(params.snapshot, null, 2);

  if (existingFile?.id) {
    const patchRes = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(existingFile.id)}?uploadType=media&supportsAllDrives=true&fields=id,webViewLink`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${params.accessToken}`,
          "Content-Type": "application/json; charset=UTF-8",
        },
        body: jsonContent,
      }
    );
    const patchJson = await patchRes.json().catch(() => ({}));
    if (!patchRes.ok || !patchJson.id) {
      throw new Error(
        `Gagal memperbarui file JSON mirror di Google Drive: ${patchJson.error?.message || patchRes.statusText}`
      );
    }
    return {
      fileId: patchJson.id,
      fileUrl: patchJson.webViewLink || `https://drive.google.com/file/d/${patchJson.id}/view`,
    };
  }

  const boundary = `actis_inv_mirror_${crypto.randomBytes(10).toString("hex")}`;
  const metadata: Record<string, unknown> = {
    name: INVENTORY_MIRROR_DRIVE_FILENAME,
    mimeType: "application/json",
    description: "ACTIS Inventory Management Database Mirror Snapshot",
  };
  if (params.folderId) {
    metadata.parents = [params.folderId];
  }

  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${jsonContent}\r\n` +
    `--${boundary}--`;

  const uploadRes = await fetch(
    "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,webViewLink",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${params.accessToken}`,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    }
  );
  const uploadJson = await uploadRes.json().catch(() => ({}));
  if (!uploadRes.ok || !uploadJson.id) {
    const rawMsg = uploadJson.error?.message || uploadRes.statusText || "Unknown Drive error";
    if (rawMsg.toLowerCase().includes("storage quota")) {
      throw new Error(
        "Service Account tidak memiliki kuota penyimpanan di My Drive pribadi. Untuk backup file JSON ke Drive, gunakan metode 'Apps Script Webhook', 'Google OAuth2', atau arahkan Folder ID ke Shared Drive."
      );
    }
    throw new Error(`Gagal mengunggah JSON mirror ke Google Drive: ${rawMsg}`);
  }

  return {
    fileId: uploadJson.id,
    fileUrl: uploadJson.webViewLink || `https://drive.google.com/file/d/${uploadJson.id}/view`,
  };
}

/**
 * Executes a full Inventory Management mirror sync to Google Sheets and/or Google Drive.
 */
export async function syncInventoryMirrorNow(options: {
  event: InventoryMirrorEventType | string;
  triggeredBy?: string;
  forceEvenIfDisabled?: boolean;
}): Promise<{
  status: "SUCCESS" | "SKIPPED" | "FAILED";
  message: string;
  spreadsheetId?: string;
  spreadsheetUrl?: string;
  driveFileId?: string;
  driveFileUrl?: string;
  summary?: InventoryMirrorSnapshot["summary"];
}> {
  const cfg = await getInventoryMirrorStoredConfig();
  const actor = options.triggeredBy || "System";

  if (!cfg.enabled && !options.forceEvenIfDisabled) {
    return { status: "SKIPPED", message: "Mirroring Google Drive / Sheets belum diaktifkan." };
  }

  if (cfg.method === "apps_script") {
    const urlCheck = validateGoogleWebhookUrl(cfg.apps_script_url);
    if (!urlCheck.ok) {
      const msg = urlCheck.error;
      await appendInventoryMirrorLog({
        event: options.event,
        triggered_by: actor,
        status: "FAILED",
        message: msg,
        items_count: 0,
        transactions_count: 0,
      });
      return { status: "FAILED", message: msg };
    }
  } else if (!isInventoryMirrorConfigReady({ ...cfg, enabled: true })) {
    const msg = "Konfigurasi kredensial Google Drive / Sheets belum lengkap.";
    await appendInventoryMirrorLog({
      event: options.event,
      triggered_by: actor,
      status: "FAILED",
      message: msg,
      items_count: 0,
      transactions_count: 0,
    });
    return { status: "FAILED", message: msg };
  }

  const snapshot = await buildInventoryMirrorSnapshot();
  const matrices = buildInventorySheetsMatrices(snapshot);

  try {
    let spreadsheetId = cfg.spreadsheet_id || "";
    let spreadsheetUrl = cfg.spreadsheet_url || "";
    let driveFileId = "";
    let driveFileUrl = "";
    let resultMessage = "";

    if (cfg.method === "apps_script") {
      const secret = decryptSecret(cfg.apps_script_secret_enc) || "";
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        const res = await fetch(cfg.apps_script_url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            secret,
            action: "sync_inventory",
            event: options.event,
            triggeredBy: actor,
            spreadsheetId: cfg.spreadsheet_id || "",
            folderId: cfg.folder_id || "",
            saveDriveBackupJson: cfg.save_drive_backup !== false,
            driveBackupFileName: INVENTORY_MIRROR_DRIVE_FILENAME,
            generatedAtWib: snapshot.generated_at_wib,
            summary: snapshot.summary,
            sheets: matrices,
            snapshot: cfg.save_drive_backup !== false ? snapshot : undefined,
          }),
          signal: controller.signal,
          redirect: "follow",
        });

        const text = await res.text();
        let parsed: any = null;
        try {
          parsed = JSON.parse(text);
        } catch {
          throw new Error(
            res.ok
              ? `Respons Apps Script bukan JSON valid: ${text.slice(0, 120)}`
              : `HTTP ${res.status} dari Apps Script: ${text.slice(0, 120)}`
          );
        }

        if (!parsed?.success) {
          throw new Error(parsed?.error || "Apps Script mengembalikan status gagal.");
        }

        spreadsheetId = parsed.spreadsheetId || spreadsheetId;
        spreadsheetUrl = parsed.spreadsheetUrl || spreadsheetUrl;
        driveFileId = parsed.driveFileId || "";
        driveFileUrl = parsed.driveFileUrl || "";
        resultMessage =
          parsed.message ||
          `Mirroring selesai (${snapshot.summary.total_items} SKU, ${snapshot.summary.total_transactions} transaksi).`;
      } finally {
        clearTimeout(timeout);
      }
    } else {
      let accessToken = "";
      if (cfg.method === "oauth2") {
        const clientSecret = decryptSecret(cfg.oauth_client_secret_enc);
        const refreshToken = decryptSecret(cfg.oauth_refresh_token_enc);
        if (!cfg.oauth_client_id || !clientSecret || !refreshToken) {
          throw new Error("Kredensial OAuth2 Google belum lengkap.");
        }
        accessToken = await getOAuth2AccessToken(cfg.oauth_client_id, clientSecret, refreshToken);
      } else {
        const privateKey = decryptSecret(cfg.sa_private_key_enc);
        if (!cfg.sa_client_email || !privateKey) {
          throw new Error("Email atau Private Key Service Account Google belum lengkap.");
        }
        accessToken = await getServiceAccountAccessToken(
          cfg.sa_client_email,
          privateKey,
          `${GOOGLE_SHEETS_SCOPE} ${GOOGLE_DRIVE_SCOPE_FULL}`
        );
      }

      if (cfg.method === "oauth2" || cfg.spreadsheet_id) {
        const sheetRes = await createAndPopulateSpreadsheetDirect({
          accessToken,
          existingSpreadsheetId: cfg.spreadsheet_id,
          folderId: cfg.folder_id || undefined,
          matrices,
          snapshot,
          event: options.event,
          triggeredBy: actor,
        });
        spreadsheetId = sheetRes.spreadsheetId;
        spreadsheetUrl = sheetRes.spreadsheetUrl;
      }

      if (cfg.save_drive_backup !== false) {
        const driveRes = await upsertDriveJsonMirrorDirect({
          accessToken,
          folderId: cfg.folder_id || undefined,
          snapshot,
        });
        driveFileId = driveRes.fileId;
        driveFileUrl = driveRes.fileUrl;
      }

      resultMessage = `Mirroring sukses (${snapshot.summary.total_items} SKU, ${snapshot.summary.total_units} SN, ${snapshot.summary.total_transactions} transaksi).`;
    }

    if (
      spreadsheetId &&
      (spreadsheetId !== cfg.spreadsheet_id || (spreadsheetUrl && spreadsheetUrl !== cfg.spreadsheet_url))
    ) {
      await saveInventoryMirrorConfig({
        spreadsheet_id: spreadsheetId,
        spreadsheet_url: spreadsheetUrl,
      }).catch(() => {});
    }

    await appendInventoryMirrorLog({
      event: options.event,
      triggered_by: actor,
      status: "SUCCESS",
      message: resultMessage,
      spreadsheet_url: spreadsheetUrl || undefined,
      drive_file_url: driveFileUrl || undefined,
      items_count: snapshot.summary.total_items,
      transactions_count: snapshot.summary.total_transactions,
    });

    return {
      status: "SUCCESS",
      message: resultMessage,
      spreadsheetId: spreadsheetId || undefined,
      spreadsheetUrl: spreadsheetUrl || undefined,
      driveFileId: driveFileId || undefined,
      driveFileUrl: driveFileUrl || undefined,
      summary: snapshot.summary,
    };
  } catch (err: any) {
    const errorMsg =
      err?.name === "AbortError"
        ? "Timeout: Koneksi mirror ke Google memakan waktu terlalu lama."
        : err?.message || "Gagal melakukan mirroring ke Google Drive / Sheets.";

    await appendInventoryMirrorLog({
      event: options.event,
      triggered_by: actor,
      status: "FAILED",
      message: errorMsg,
      items_count: snapshot.summary.total_items,
      transactions_count: snapshot.summary.total_transactions,
    }).catch(() => {});

    return {
      status: "FAILED",
      message: errorMsg,
      summary: snapshot.summary,
    };
  }
}

// Single-flight coalescing queue so rapid consecutive mutations never race Google writes
let inFlightMirrorPromise: Promise<void> | null = null;
let queuedMirrorParams: { event: InventoryMirrorEventType | string; triggeredBy?: string } | null = null;

async function runCoalescedMirror(params: {
  event: InventoryMirrorEventType | string;
  triggeredBy?: string;
}) {
  try {
    const cfg = await getInventoryMirrorStoredConfig();
    if (!cfg.enabled || !cfg.auto_sync || !isInventoryMirrorConfigReady(cfg)) {
      return;
    }
    await syncInventoryMirrorNow({
      event: params.event,
      triggeredBy: params.triggeredBy,
    });
  } catch (err) {
    console.error("Background Inventory Mirror sync error:", err);
  }
}

/**
 * Non-blocking fire-and-forget trigger called after primary SQL mutations commit.
 * Safe to invoke from API routes or inventoryService functions.
 */
export function triggerInventoryMirrorSync(params: {
  event: InventoryMirrorEventType | string;
  triggeredBy?: string;
}) {
  if (inFlightMirrorPromise) {
    queuedMirrorParams = params;
    return;
  }

  inFlightMirrorPromise = (async () => {
    let next: typeof queuedMirrorParams = params;
    while (next) {
      queuedMirrorParams = null;
      await runCoalescedMirror(next);
      next = queuedMirrorParams;
    }
  })().finally(() => {
    inFlightMirrorPromise = null;
  });
}

export { INVENTORY_SHEET_TAB_NAMES };
