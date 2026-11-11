import crypto from "crypto";
import { diffLines } from "diff";
import { prisma } from "@/lib/prisma";
import { pullDeviceConfigViaSsh } from "@/lib/networkSshService";
import { resolveIntervalDays } from "@/lib/backupVendorProfiles";
import { uploadBackupToGDrive, syncBackupRecordToGDrive } from "@/lib/gdriveSyncService";
import { recordActivity } from "@/lib/activityLogService";

export const SETTING_KEY_BACKUP_SCHEDULE = "network_backup_settings";

export interface NetworkBackupGlobalSettings {
  auto_enabled: boolean;
  default_schedule_mode: "1d" | "3d" | "7d" | "30d" | "custom_days";
  default_interval_days: number;
  window_start: string; // HH:MM WIB, e.g. "03:00"
  window_end: string;   // HH:MM WIB, e.g. "05:00"
  timezone: string;     // "Asia/Jakarta"
  default_retention_count: number;
  only_save_if_changed: boolean;
  last_scheduler_tick_at?: string | null;
}

const DEFAULT_GLOBAL_SETTINGS: NetworkBackupGlobalSettings = {
  auto_enabled: true,
  default_schedule_mode: "1d",
  default_interval_days: 1,
  window_start: "03:00",
  window_end: "05:00",
  timezone: "Asia/Jakarta",
  default_retention_count: 30,
  only_save_if_changed: false,
  last_scheduler_tick_at: null,
};

const globalLockRef = globalThis as unknown as {
  __actisBackupLocks?: Set<string>;
  __actisBackupSchedulerStarted?: boolean;
};

function getDeviceLocks(): Set<string> {
  if (!globalLockRef.__actisBackupLocks) {
    globalLockRef.__actisBackupLocks = new Set<string>();
  }
  return globalLockRef.__actisBackupLocks;
}

export async function getBackupGlobalSettings(): Promise<NetworkBackupGlobalSettings> {
  try {
    const row = await prisma.systemSetting.findUnique({
      where: { key: SETTING_KEY_BACKUP_SCHEDULE },
    });
    if (!row?.value) return DEFAULT_GLOBAL_SETTINGS;
    const parsed = JSON.parse(row.value);
    return {
      ...DEFAULT_GLOBAL_SETTINGS,
      ...parsed,
      timezone: "Asia/Jakarta",
    };
  } catch (err) {
    console.error("Failed to read network_backup_settings:", err);
    return DEFAULT_GLOBAL_SETTINGS;
  }
}

export async function saveBackupGlobalSettings(
  input: Partial<NetworkBackupGlobalSettings>
): Promise<NetworkBackupGlobalSettings> {
  const current = await getBackupGlobalSettings();
  const mode = input.default_schedule_mode || current.default_schedule_mode;
  const intervalDays =
    input.default_interval_days !== undefined
      ? resolveIntervalDays(mode, input.default_interval_days)
      : resolveIntervalDays(mode, current.default_interval_days);

  const updated: NetworkBackupGlobalSettings = {
    ...current,
    ...input,
    default_schedule_mode: mode,
    default_interval_days: intervalDays,
    window_start: normalizeHHMM(input.window_start || current.window_start, "03:00"),
    window_end: normalizeHHMM(input.window_end || current.window_end, "05:00"),
    default_retention_count: Math.max(
      0,
      Math.min(365, Number(input.default_retention_count ?? current.default_retention_count) || 0)
    ),
    timezone: "Asia/Jakarta",
  };

  await prisma.systemSetting.upsert({
    where: { key: SETTING_KEY_BACKUP_SCHEDULE },
    update: { value: JSON.stringify(updated) },
    create: { key: SETTING_KEY_BACKUP_SCHEDULE, value: JSON.stringify(updated) },
  });

  return updated;
}

export function normalizeHHMM(val: string | null | undefined, fallback = "03:00"): string {
  if (!val) return fallback;
  const m = /^(\d{1,2}):(\d{2})$/.exec(val.trim());
  if (!m) return fallback;
  const hh = Math.min(23, Math.max(0, parseInt(m[1], 10)));
  const mm = Math.min(59, Math.max(0, parseInt(m[2], 10)));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function parseMinutesOfDay(hhmm: string): number {
  const [h, m] = normalizeHHMM(hhmm).split(":").map((n) => parseInt(n, 10));
  return h * 60 + m;
}

export function getJakartaClock(date: Date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;

  const year = parseInt(map.year, 10);
  const month = parseInt(map.month, 10);
  const day = parseInt(map.day, 10);
  const hour = parseInt(map.hour, 10) % 24;
  const minute = parseInt(map.minute, 10);
  const dayNumber = Math.floor(Date.UTC(year, month - 1, day) / 86400000);

  return {
    year,
    month,
    day,
    hour,
    minute,
    minutesOfDay: hour * 60 + minute,
    dayNumber,
    dateStr: `${map.year}-${map.month}-${map.day}`,
    hhmm: `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`,
  };
}

function isInsideWindow(minutesOfDay: number, startMin: number, endMin: number): boolean {
  if (startMin === endMin) return true;
  if (startMin < endMin) {
    return minutesOfDay >= startMin && minutesOfDay <= endMin;
  }
  // Wraps midnight (e.g. 23:00 -> 01:00)
  return minutesOfDay >= startMin || minutesOfDay <= endMin;
}

export function getEffectiveIntervalDays(
  device: { schedule_mode: string; schedule_days: number | null },
  globalSettings: NetworkBackupGlobalSettings
): number {
  if (!device.schedule_mode || device.schedule_mode === "global") {
    return resolveIntervalDays(
      globalSettings.default_schedule_mode,
      globalSettings.default_interval_days
    );
  }
  return resolveIntervalDays(device.schedule_mode, device.schedule_days);
}

export function isDeviceDueForAutoBackup(
  device: {
    auto_backup_enabled: boolean;
    protocol: string;
    schedule_mode: string;
    schedule_days: number | null;
    schedule_time: string | null;
    last_auto_backup_at: Date | null;
    last_status: string;
    updated_at: Date;
  },
  globalSettings: NetworkBackupGlobalSettings,
  now: Date = new Date()
): boolean {
  if (!globalSettings.auto_enabled || !device.auto_backup_enabled) return false;
  if (device.protocol !== "ssh") return false;

  // Prevent stale RUNNING lock blocking forever (expire after 5 min)
  if (
    device.last_status === "RUNNING" &&
    now.getTime() - new Date(device.updated_at).getTime() < 5 * 60 * 1000
  ) {
    return false;
  }

  const clock = getJakartaClock(now);
  const hasCustomTime = Boolean(device.schedule_time && /^\d{1,2}:\d{2}$/.test(device.schedule_time));
  const startMin = hasCustomTime
    ? parseMinutesOfDay(device.schedule_time!)
    : parseMinutesOfDay(globalSettings.window_start);
  const endMin = hasCustomTime
    ? (startMin + 120) % 1440
    : parseMinutesOfDay(globalSettings.window_end);

  if (!isInsideWindow(clock.minutesOfDay, startMin, endMin)) {
    return false;
  }

  if (!device.last_auto_backup_at) {
    return true;
  }

  const lastClock = getJakartaClock(device.last_auto_backup_at);
  const intervalDays = getEffectiveIntervalDays(device, globalSettings);
  return clock.dayNumber - lastClock.dayNumber >= intervalDays;
}

export function computeNextBackupAt(
  device: {
    auto_backup_enabled: boolean;
    protocol: string;
    schedule_mode: string;
    schedule_days: number | null;
    schedule_time: string | null;
    last_auto_backup_at: Date | null;
  },
  globalSettings: NetworkBackupGlobalSettings,
  now: Date = new Date()
): string | null {
  if (!globalSettings.auto_enabled || !device.auto_backup_enabled || device.protocol !== "ssh") {
    return null;
  }

  const intervalDays = getEffectiveIntervalDays(device, globalSettings);
  const startHHMM =
    device.schedule_time && /^\d{1,2}:\d{2}$/.test(device.schedule_time)
      ? normalizeHHMM(device.schedule_time)
      : globalSettings.window_start;
  const startMin = parseMinutesOfDay(startHHMM);
  const [hh, mm] = startHHMM.split(":").map((n) => parseInt(n, 10));

  const nowClock = getJakartaClock(now);
  let targetDayNumber = nowClock.dayNumber;

  if (!device.last_auto_backup_at) {
    if (nowClock.minutesOfDay > startMin + 120) {
      targetDayNumber += 1;
    }
  } else {
    const lastClock = getJakartaClock(device.last_auto_backup_at);
    targetDayNumber = lastClock.dayNumber + intervalDays;
    if (targetDayNumber < nowClock.dayNumber) {
      targetDayNumber = nowClock.minutesOfDay > startMin + 120 ? nowClock.dayNumber + 1 : nowClock.dayNumber;
    } else if (targetDayNumber === nowClock.dayNumber && nowClock.minutesOfDay > startMin + 120) {
      targetDayNumber = nowClock.dayNumber + 1;
    }
  }

  // Convert Jakarta dayNumber + hh:mm (UTC+7) back into UTC timestamp
  const targetUtcMs = targetDayNumber * 86400000 + (hh * 60 + mm - 7 * 60) * 60000;
  return new Date(targetUtcMs).toISOString();
}

function computeConfigStats(content: string, previousContent?: string | null) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const lineCount = lines.length;
  const sizeBytes = Buffer.byteLength(normalized, "utf8");
  const configHash = crypto.createHash("sha256").update(normalized).digest("hex");

  let changedFromPrev = true;
  let diffAdded = lineCount;
  let diffRemoved = 0;

  if (previousContent !== null && previousContent !== undefined) {
    const prevNorm = previousContent.replace(/\r\n/g, "\n");
    const prevHash = crypto.createHash("sha256").update(prevNorm).digest("hex");
    if (prevHash === configHash) {
      changedFromPrev = false;
      diffAdded = 0;
      diffRemoved = 0;
    } else {
      const changes = diffLines(prevNorm, normalized);
      let added = 0;
      let removed = 0;
      for (const part of changes) {
        const count = part.count || 0;
        if (part.added) added += count;
        else if (part.removed) removed += count;
      }
      changedFromPrev = true;
      diffAdded = added;
      diffRemoved = removed;
    }
  }

  return {
    normalized,
    lineCount,
    sizeBytes,
    configHash,
    changedFromPrev,
    diffAdded,
    diffRemoved,
  };
}

async function enforceDeviceRetention(deviceId: string, retentionLimit: number) {
  if (!retentionLimit || retentionLimit <= 0) return;

  const oldRows = await prisma.networkConfigBackup.findMany({
    where: { device_id: deviceId },
    orderBy: { created_at: "desc" },
    skip: retentionLimit,
    select: { id: true },
  });

  if (oldRows.length > 0) {
    await prisma.networkConfigBackup.deleteMany({
      where: { id: { in: oldRows.map((r) => r.id) } },
    });
  }
}

export async function saveManualOrUploadedBackup(params: {
  deviceId: string;
  content: string;
  triggeredBy: string;
  backupType?: "manual" | "upload";
  commandUsed?: string;
}) {
  const device = await prisma.networkDevice.findUnique({
    where: { id: params.deviceId },
  });
  if (!device) {
    throw new Error("Perangkat network tidak ditemukan.");
  }

  const prevSuccess = await prisma.networkConfigBackup.findFirst({
    where: { device_id: device.id, status: "SUCCESS" },
    orderBy: { created_at: "desc" },
    select: { config_content: true },
  });

  const stats = computeConfigStats(params.content, prevSuccess?.config_content);
  const now = new Date();

  const backup = await prisma.networkConfigBackup.create({
    data: {
      device_id: device.id,
      backup_type: params.backupType || "upload",
      status: "SUCCESS",
      config_content: stats.normalized,
      config_hash: stats.configHash,
      line_count: stats.lineCount,
      size_bytes: stats.sizeBytes,
      changed_from_prev: stats.changedFromPrev,
      diff_added: stats.diffAdded,
      diff_removed: stats.diffRemoved,
      command_used: params.commandUsed || "Manual Upload / Snapshot",
      triggered_by: params.triggeredBy,
      gdrive_status: device.gdrive_sync_enabled ? "PENDING" : "SKIPPED",
      created_at: now,
    },
  });

  await prisma.networkDevice.update({
    where: { id: device.id },
    data: {
      last_backup_at: now,
      last_status: "SUCCESS",
      last_error: null,
    },
  });

  let finalBackup = backup;
  if (device.gdrive_sync_enabled) {
    const syncRes = await syncBackupRecordToGDrive(backup.id).catch(() => null);
    if (syncRes?.backup) finalBackup = syncRes.backup;
  }

  const globalSettings = await getBackupGlobalSettings();
  const retention = device.retention_count || globalSettings.default_retention_count;
  await enforceDeviceRetention(device.id, retention);

  return finalBackup;
}

export async function runBackupForDevice(
  deviceId: string,
  options: { backupType: "auto" | "manual"; triggeredBy: string }
): Promise<{
  success: boolean;
  skipped?: boolean;
  deviceName: string;
  backup?: any;
  error?: string;
}> {
  const locks = getDeviceLocks();
  if (locks.has(deviceId)) {
    return {
      success: false,
      skipped: true,
      deviceName: deviceId,
      error: "Proses backup untuk perangkat ini sedang berjalan.",
    };
  }

  locks.add(deviceId);
  try {
    const device = await prisma.networkDevice.findUnique({
      where: { id: deviceId },
    });

    if (!device) {
      throw new Error("Perangkat network tidak ditemukan.");
    }

    if (device.protocol !== "ssh") {
      return {
        success: false,
        skipped: true,
        deviceName: device.name,
        error: `Perangkat '${device.name}' bertipe upload manual (tidak menggunakan SSH otomatis).`,
      };
    }

    await prisma.networkDevice.update({
      where: { id: device.id },
      data: { last_status: "RUNNING" },
    });

    const pullRes = await pullDeviceConfigViaSsh(device);
    const now = new Date();

    const prevSuccess = await prisma.networkConfigBackup.findFirst({
      where: { device_id: device.id, status: "SUCCESS" },
      orderBy: { created_at: "desc" },
      select: { config_content: true },
    });

    const stats = computeConfigStats(pullRes.config, prevSuccess?.config_content);
    const globalSettings = await getBackupGlobalSettings();

    if (
      options.backupType === "auto" &&
      globalSettings.only_save_if_changed &&
      prevSuccess &&
      !stats.changedFromPrev
    ) {
      await prisma.networkDevice.update({
        where: { id: device.id },
        data: {
          last_backup_at: now,
          last_auto_backup_at: now,
          last_status: "SUCCESS",
          last_error: null,
        },
      });
      return {
        success: true,
        skipped: true,
        deviceName: device.name,
      };
    }

    const created = await prisma.networkConfigBackup.create({
      data: {
        device_id: device.id,
        backup_type: options.backupType,
        status: "SUCCESS",
        config_content: stats.normalized,
        config_hash: stats.configHash,
        line_count: stats.lineCount,
        size_bytes: stats.sizeBytes,
        changed_from_prev: stats.changedFromPrev,
        diff_added: stats.diffAdded,
        diff_removed: stats.diffRemoved,
        command_used: pullRes.commandUsed,
        triggered_by: options.triggeredBy,
        gdrive_status: device.gdrive_sync_enabled ? "PENDING" : "SKIPPED",
        created_at: now,
      },
    });

    await prisma.networkDevice.update({
      where: { id: device.id },
      data: {
        last_backup_at: now,
        ...(options.backupType === "auto" ? { last_auto_backup_at: now } : {}),
        last_status: "SUCCESS",
        last_error: null,
      },
    });

    let finalBackup = created;
    if (device.gdrive_sync_enabled) {
      const gdriveRes = await uploadBackupToGDrive({
        deviceName: device.name,
        vendor: device.vendor,
        host: device.host,
        content: stats.normalized,
        createdAt: now,
        lineCount: stats.lineCount,
        sizeBytes: stats.sizeBytes,
      });

      finalBackup = await prisma.networkConfigBackup.update({
        where: { id: created.id },
        data: {
          gdrive_status: gdriveRes.status,
          gdrive_file_id: gdriveRes.fileId || null,
          gdrive_file_url: gdriveRes.fileUrl || null,
          gdrive_synced_at: gdriveRes.status === "SYNCED" ? new Date() : null,
          gdrive_error: gdriveRes.status === "FAILED" ? gdriveRes.error || "Sync GDrive gagal" : null,
        },
      });
    }

    const retention = device.retention_count || globalSettings.default_retention_count;
    await enforceDeviceRetention(device.id, retention);

    recordActivity({
      nama_lengkap: options.triggeredBy,
      tipe: options.backupType === "auto" ? "BACKUP_AUTO" : "BACKUP_MANUAL",
      aktifitas: `Backup config ${device.name} (${device.vendor.toUpperCase()}) [${options.backupType}]`,
      detail: `${stats.lineCount} baris, ${stats.sizeBytes} bytes, GDrive: ${finalBackup.gdrive_status}`,
    }).catch(() => {});

    return {
      success: true,
      deviceName: device.name,
      backup: finalBackup,
    };
  } catch (err: any) {
    const errMsg = err?.message || "Gagal menarik config via SSH.";
    console.error(`Backup error for device ${deviceId}:`, errMsg);

    try {
      const dev = await prisma.networkDevice.findUnique({
        where: { id: deviceId },
        select: { id: true, name: true, vendor: true },
      });
      if (dev) {
        await prisma.networkDevice.update({
          where: { id: dev.id },
          data: {
            last_status: "FAILED",
            last_error: errMsg,
          },
        });

        await prisma.networkConfigBackup.create({
          data: {
            device_id: dev.id,
            backup_type: options.backupType,
            status: "FAILED",
            config_content: "",
            config_hash: "",
            line_count: 0,
            size_bytes: 0,
            changed_from_prev: false,
            error_message: errMsg,
            triggered_by: options.triggeredBy,
            gdrive_status: "SKIPPED",
          },
        });

        recordActivity({
          nama_lengkap: options.triggeredBy,
          tipe: "BACKUP_FAILED",
          aktifitas: `Gagal backup config ${dev.name} (${dev.vendor.toUpperCase()})`,
          detail: errMsg,
        }).catch(() => {});
      }
    } catch (innerErr) {
      console.error("Failed recording backup failure:", innerErr);
    }

    return {
      success: false,
      deviceName: deviceId,
      error: errMsg,
    };
  } finally {
    locks.delete(deviceId);
  }
}

export async function runScheduledBackupsTick(forceRunAll = false, triggeredBy = "Scheduler Auto") {
  const globalSettings = await getBackupGlobalSettings();
  const now = new Date();

  const devices = await prisma.networkDevice.findMany({
    where: {
      protocol: "ssh",
      ...(forceRunAll ? {} : { auto_backup_enabled: true }),
    },
    orderBy: { name: "asc" },
  });

  const targetDevices = forceRunAll
    ? devices
    : devices.filter((d) => isDeviceDueForAutoBackup(d, globalSettings, now));

  const results: Array<{ deviceId: string; deviceName: string; success: boolean; error?: string }> = [];

  // Process up to 3 devices concurrently so VPS resources stay bounded
  const batchSize = 3;
  for (let i = 0; i < targetDevices.length; i += batchSize) {
    const batch = targetDevices.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (dev) => {
        const res = await runBackupForDevice(dev.id, {
          backupType: forceRunAll ? "manual" : "auto",
          triggeredBy,
        });
        return {
          deviceId: dev.id,
          deviceName: dev.name,
          success: res.success,
          error: res.error,
        };
      })
    );
    results.push(...batchResults);
  }

  // Update last tick timestamp & retry up to 3 pending GDrive syncs
  if (!forceRunAll) {
    const pendingGDrive = await prisma.networkConfigBackup.findMany({
      where: {
        status: "SUCCESS",
        gdrive_status: { in: ["PENDING", "FAILED"] },
        device: { gdrive_sync_enabled: true },
        created_at: { gte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
      },
      orderBy: { created_at: "desc" },
      take: 3,
      select: { id: true },
    });

    for (const item of pendingGDrive) {
      await syncBackupRecordToGDrive(item.id).catch(() => {});
    }

    await prisma.systemSetting
      .upsert({
        where: { key: SETTING_KEY_BACKUP_SCHEDULE },
        update: {
          value: JSON.stringify({
            ...globalSettings,
            last_scheduler_tick_at: now.toISOString(),
          }),
        },
        create: {
          key: SETTING_KEY_BACKUP_SCHEDULE,
          value: JSON.stringify({
            ...globalSettings,
            last_scheduler_tick_at: now.toISOString(),
          }),
        },
      })
      .catch(() => {});
  }

  return {
    checked: devices.length,
    executed: results.length,
    succeeded: results.filter((r) => r.success).length,
    failed: results.filter((r) => !r.success).length,
    results,
  };
}

let isTickRunning = false;
export function ensureBackupSchedulerStarted(intervalSec = 60) {
  if (typeof window !== "undefined") return;
  if (globalLockRef.__actisBackupSchedulerStarted) return;
  globalLockRef.__actisBackupSchedulerStarted = true;

  const runTick = async () => {
    if (isTickRunning) return;
    isTickRunning = true;
    try {
      await runScheduledBackupsTick(false, "Scheduler Auto");
    } catch (err) {
      console.error("Backup scheduler tick error:", err);
    } finally {
      isTickRunning = false;
    }
  };

  setInterval(runTick, intervalSec * 1000);
}

