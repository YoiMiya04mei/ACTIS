import { computeNextBackupAt } from "@/lib/backupSchedulerService";

export function serializeDeviceSafe(device: any, globalSettings: any) {
  return {
    id: device.id,
    name: device.name,
    host: device.host,
    port: device.port,
    vendor: device.vendor,
    platform: device.platform,
    protocol: device.protocol,
    username: device.username,
    has_password: Boolean(device.password_enc),
    has_enable_password: Boolean(device.enable_password_enc),
    has_ssh_private_key: Boolean(device.ssh_private_key_enc),
    custom_command: device.custom_command,
    pre_command: device.pre_command,
    pop_site_id: device.pop_site_id,
    pop_site: device.pop_site || null,
    auto_backup_enabled: device.auto_backup_enabled,
    schedule_mode: device.schedule_mode,
    schedule_days: device.schedule_days,
    schedule_time: device.schedule_time,
    retention_count: device.retention_count,
    gdrive_sync_enabled: device.gdrive_sync_enabled,
    last_backup_at: device.last_backup_at,
    last_auto_backup_at: device.last_auto_backup_at,
    last_status: device.last_status,
    last_error: device.last_error,
    next_backup_at: computeNextBackupAt(device, globalSettings),
    backup_count: device._count?.backups ?? undefined,
    created_by: device.created_by,
    created_at: device.created_at,
    updated_at: device.updated_at,
  };
}

