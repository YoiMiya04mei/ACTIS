export type NetworkVendor = "mikrotik" | "cisco" | "juniper" | "huawei" | "custom";

export type ScheduleMode = "global" | "1d" | "3d" | "7d" | "30d" | "custom_days";

export interface VendorProfile {
  id: NetworkVendor;
  label: string;
  shortLabel: string;
  fileExt: string;
  defaultPort: number;
  execMode: "exec" | "shell";
  defaultPreCommand: string;
  defaultCommand: string;
  badgeColor: string;
  platforms: Array<{
    label: string;
    preCommand: string;
    command: string;
    execMode: "exec" | "shell";
  }>;
}

export const VENDOR_PROFILES: Record<NetworkVendor, VendorProfile> = {
  mikrotik: {
    id: "mikrotik",
    label: "MikroTik RouterOS",
    shortLabel: "MikroTik",
    fileExt: "rsc",
    defaultPort: 22,
    execMode: "exec",
    defaultPreCommand: "",
    defaultCommand: "/export show-sensitive",
    badgeColor: "blue",
    platforms: [
      {
        label: "RouterOS v7 (Full Sensitive Export)",
        preCommand: "",
        command: "/export show-sensitive",
        execMode: "exec",
      },
      {
        label: "RouterOS v6 / v7 Standard (/export)",
        preCommand: "",
        command: "/export",
        execMode: "exec",
      },
      {
        label: "RouterOS Terse (/export terse)",
        preCommand: "",
        command: "/export terse",
        execMode: "exec",
      },
    ],
  },
  juniper: {
    id: "juniper",
    label: "Juniper Junos OS",
    shortLabel: "Juniper",
    fileExt: "conf",
    defaultPort: 22,
    execMode: "shell",
    defaultPreCommand: "set cli screen-length 0",
    defaultCommand: "show configuration | no-more",
    badgeColor: "emerald",
    platforms: [
      {
        label: "Junos OS Hierarchy (show configuration)",
        preCommand: "set cli screen-length 0",
        command: "show configuration | no-more",
        execMode: "shell",
      },
      {
        label: "Junos OS Flat Set (display set)",
        preCommand: "set cli screen-length 0",
        command: "show configuration | display set | no-more",
        execMode: "shell",
      },
    ],
  },
  huawei: {
    id: "huawei",
    label: "Huawei VRP / SmartAX OLT",
    shortLabel: "Huawei",
    fileExt: "cfg",
    defaultPort: 22,
    execMode: "shell",
    defaultPreCommand: "screen-length 0 temporary",
    defaultCommand: "display current-configuration",
    badgeColor: "rose",
    platforms: [
      {
        label: "Huawei VRP Router / Switch",
        preCommand: "screen-length 0 temporary",
        command: "display current-configuration",
        execMode: "shell",
      },
      {
        label: "Huawei SmartAX MA5600/MA5800 OLT",
        preCommand: "enable\nconfig\nscroll 512",
        command: "display current-configuration",
        execMode: "shell",
      },
      {
        label: "H3C / HP Comware",
        preCommand: "screen-length disable",
        command: "display current-configuration",
        execMode: "shell",
      },
    ],
  },
  cisco: {
    id: "cisco",
    label: "Cisco IOS / IOS-XE / NX-OS",
    shortLabel: "Cisco",
    fileExt: "cfg",
    defaultPort: 22,
    execMode: "shell",
    defaultPreCommand: "terminal length 0",
    defaultCommand: "show running-config",
    badgeColor: "indigo",
    platforms: [
      {
        label: "Cisco IOS / IOS-XE",
        preCommand: "terminal length 0",
        command: "show running-config",
        execMode: "shell",
      },
      {
        label: "Cisco NX-OS",
        preCommand: "terminal length 0",
        command: "show running-config",
        execMode: "shell",
      },
      {
        label: "Cisco ASA Firewall",
        preCommand: "terminal pager 0",
        command: "more system:running-config",
        execMode: "shell",
      },
    ],
  },
  custom: {
    id: "custom",
    label: "Vendor Lain / Custom (VyOS, Ubiquiti, ZTE, dll.)",
    shortLabel: "Custom",
    fileExt: "txt",
    defaultPort: 22,
    execMode: "shell",
    defaultPreCommand: "",
    defaultCommand: "show running-config",
    badgeColor: "slate",
    platforms: [
      {
        label: "VyOS / EdgeRouter",
        preCommand: "set terminal length 0",
        command: "show configuration commands",
        execMode: "shell",
      },
      {
        label: "ZTE OLT / Switch",
        preCommand: "terminal length 0",
        command: "show running-config",
        execMode: "shell",
      },
      {
        label: "Linux / Generic SSH Exec",
        preCommand: "",
        command: "cat /etc/network/interfaces",
        execMode: "exec",
      },
    ],
  },
};

export function getVendorProfile(vendor: string | null | undefined): VendorProfile {
  const key = (vendor || "custom").toLowerCase() as NetworkVendor;
  return VENDOR_PROFILES[key] || VENDOR_PROFILES.custom;
}

export function resolveIntervalDays(mode: string | null | undefined, customDays?: number | null): number {
  switch (mode) {
    case "1d":
      return 1;
    case "3d":
      return 3;
    case "7d":
      return 7;
    case "30d":
      return 30;
    case "custom_days": {
      const n = Number(customDays || 1);
      return Number.isFinite(n) && n >= 1 ? Math.min(Math.round(n), 365) : 1;
    }
    default:
      return 1;
  }
}

export function formatScheduleLabel(mode: string | null | undefined, customDays?: number | null): string {
  switch (mode) {
    case "global":
      return "Ikut Jadwal Global";
    case "1d":
      return "Setiap 1 Hari (Harian)";
    case "3d":
      return "Setiap 3 Hari";
    case "7d":
      return "Setiap 1 Minggu (7 Hari)";
    case "30d":
      return "Setiap 1 Bulan (30 Hari)";
    case "custom_days": {
      const n = resolveIntervalDays("custom_days", customDays);
      return `Setiap ${n} Hari`;
    }
    default:
      return "Setiap 1 Hari";
  }
}

export function formatBackupSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) {
    return kb >= 10 ? `${Math.round(kb)} KB` : `${kb.toFixed(1)} KB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(2)} MB`;
}

export function formatJakartaDateTime(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return "-";
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  if (Number.isNaN(d.getTime())) return "-";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);

  const map: Record<string, string> = {};
  for (const p of parts) {
    map[p.type] = p.value;
  }
  return `${map.day}-${map.month}-${map.year} ${map.hour}:${map.minute}:${map.second}`;
}

export function buildBackupFileName(deviceName: string, vendor: string, dateInput: string | Date): string {
  const safeName = deviceName
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "device";
  const profile = getVendorProfile(vendor);
  const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const map: Record<string, string> = {};
  for (const p of parts) map[p.type] = p.value;
  const stamp = `${map.year}-${map.month}-${map.day}_${map.hour}-${map.minute}-${map.second}`;
  return `${safeName}_${profile.id}_${stamp}.${profile.fileExt}`;
}

