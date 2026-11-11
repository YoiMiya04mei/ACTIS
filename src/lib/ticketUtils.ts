import { prisma } from "./prisma";
import { formatRackPositionLabel, formatOtbCoreLabel } from "./dcimUtils";

/**
 * Standard Dedicated Service Bandwidth Options:
 * - 50Mbps to 950Mbps (step 50Mbps)
 * - 1G
 * - 1,1G to 10G (step 0.1G)
 */
export const DEDICATED_SERVICE_OPTIONS: string[] = (() => {
  const options: string[] = [];
  for (let mb = 50; mb < 1000; mb += 50) {
    options.push(`${mb}Mbps`);
  }
  for (let g10 = 10; g10 <= 100; g10++) {
    if (g10 % 10 === 0) {
      options.push(`${g10 / 10}G`);
    } else {
      const whole = Math.floor(g10 / 10);
      const dec = g10 % 10;
      options.push(`${whole},${dec}G`);
    }
  }
  return options;
})();

/**
 * Parse bandwidth string (e.g. "50Mbps", "100 Mbps", "1G", "1,5G", "1.5 Gbps", "Dedicated 1:1 2 Gbps") to numerical Mbps value.
 */
export function parseBandwidthToMbps(val: string | null | undefined): number {
  if (!val) return 0;
  const str = String(val).trim().replace(",", ".");
  const match = str.match(/(\d+(?:\.\d+)?)\s*(gbps|g|mbps|m|kbps|k)\b/i);
  if (match) {
    const num = parseFloat(match[1]);
    const unit = match[2].toLowerCase();
    if (unit.startsWith("g")) return num * 1000;
    if (unit.startsWith("m")) return num;
    if (unit.startsWith("k")) return num / 1000;
  }
  const numOnly = parseFloat(str);
  return !isNaN(numOnly) ? numOnly : 0;
}

/**
 * Get available upgrade options strictly greater than current service bandwidth.
 */
export function getUpgradeOptions(
  currentLayanan: string | null | undefined,
  optionsList: string[] = DEDICATED_SERVICE_OPTIONS
): string[] {
  const currentMbps = parseBandwidthToMbps(currentLayanan);
  return optionsList.filter((opt) => parseBandwidthToMbps(opt) > currentMbps);
}

/**
 * Get available downgrade options strictly less than current service bandwidth.
 */
export function getDowngradeOptions(
  currentLayanan: string | null | undefined,
  optionsList: string[] = DEDICATED_SERVICE_OPTIONS
): string[] {
  const currentMbps = parseBandwidthToMbps(currentLayanan);
  return optionsList.filter((opt) => parseBandwidthToMbps(opt) < currentMbps);
}

/**
 * Standard ISP Server / BRAS Aggregator Options
 */
export const DEFAULT_SERVER_OPTIONS: string[] = [
  "JAKARTA P1",
  "SUKABUMI",
  "CIANJUR (GEKBRONG)",
  "BANDUNG (BBU)",
  "LOMBOK TIMUR (PTC)",
  "POP CIMAUNG (DEPI)",
  "POP MARGA'ASIH (FERIHANZANI)",
  "SAGARANTEN",
  "PELABUHAN RATU",
];

/**
 * Standard ISP Infrastructure Options
 */
export const DEFAULT_INFRASTRUCTURE_OPTIONS: string[] = [
  "JDP",
  "MITRA (jemput)",
  "METRONEXIA",
  "BITSREAM",
  "METRO E LINTAS ARTHA",
  "METRO E ION (HSP)",
  "METRO E IFORTE",
];

/**
 * Standard ISP Media Koneksi Options
 */
export const DEFAULT_MEDIA_OPTIONS: string[] = [
  "SFP",
  "ONT",
];

/**
 * Generates sequential ticket number with format: ACT-YYYYMMDD-XXXX
 */
export async function generateTicketNumber(): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const datePrefix = `ACT-${yyyy}${mm}${dd}-`;

  // Count existing orders for today
  const countToday = await prisma.popSiteOrder.count({
    where: {
      ticket_number: {
        startsWith: datePrefix,
      },
    },
  });

  const nextSeq = String(countToday + 1).padStart(4, "0");
  return `${datePrefix}${nextSeq}`;
}

/**
 * Generates unique Site Code: POP-YYYYMM-XXXX or ENT-YYYYMM-XXXX
 */
export async function generateSiteCode(categoryPrefix: string = "POP"): Promise<string> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const prefix = `${categoryPrefix}-${yyyy}${mm}-`;

  const count = await prisma.popSite.count({
    where: {
      site_id: {
        startsWith: prefix,
      },
    },
  });

  const nextSeq = String(count + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Generates ready-to-paste WhatsApp/Telegram ISP NOC coordination text
 */
export function generateNocCoordinationText(order: {
  ticket_number: string;
  kategori_layanan?: string | null;
  sub_layanan?: string | null;
  nama_pic: string;
  kontak_pic: string | string[];
  nama_perusahaan?: string | null;
  email_pic?: string | null;
  alamat_instalasi?: string | null;
  ip_public?: string | null;
  ip_private?: string | null;
  vlan?: number | null;
  layanan_dedicated?: string | null;
  server?: string | null;
  infrastruktur?: string | null;
  media_koneksi?: string | null;
  sn_ont?: string | null;
  kapasitas_layanan?: string | null;
  interkoneksi?: string | null;
  port_media?: string | null;
  tipe_layanan_collo?: string | null;
  nama_perangkat?: string | null;
  sn_perangkat?: string | null;
  prefix_advertise?: string | null;
  as_number?: string | null;
  sid?: string | null;
  ao?: string | null;
  nomor_order?: string | null;
  rack_code?: string | null;
  rack_unit_start?: number | null;
  rack_unit_end?: number | null;
  otb_code?: string | null;
  otb_core_numbers?: string | null;
  waktu_aktivasi?: Date | string | null;
  catatan_tambahan?: string | null;
  status: string;
}): string {
  let kontakArr: string[] = [];
  if (Array.isArray(order.kontak_pic)) {
    kontakArr = order.kontak_pic;
  } else if (typeof order.kontak_pic === "string") {
    try {
      kontakArr = JSON.parse(order.kontak_pic);
    } catch {
      kontakArr = [order.kontak_pic];
    }
  }

  const isTelkom = order.media_koneksi?.toLowerCase().includes("telkom");
  const timeStr = order.waktu_aktivasi
    ? `${new Date(order.waktu_aktivasi).toLocaleString("id-ID", {
        timeZone: "Asia/Jakarta",
        dateStyle: "medium",
        timeStyle: "short",
      })} WIB`
    : "Menunggu Upload Hasil Uji Test";

  let headerService = "POP SITE PROVISIONING";
  if (order.kategori_layanan === "Enterprise") {
    headerService = `ENTERPRISE - ${String(order.sub_layanan || "").toUpperCase()}`;
  }

  let text = `========================================
📡 *[ACTIS - ${headerService}]*
========================================
*No. Tiket*       : ${order.ticket_number}
*Kategori*        : ${order.kategori_layanan || "POP Site"}${order.sub_layanan ? ` (${order.sub_layanan})` : ""}
*Status*          : ${order.status.toUpperCase()}
*Waktu Aktivasi*  : ${timeStr}

👤 *DATA PIC & PERUSAHAAN*
• PIC             : ${order.nama_pic}${order.nama_perusahaan ? ` (${order.nama_perusahaan})` : ""}
• Kontak          : ${kontakArr.join(", ") || "-"}${order.email_pic ? `\n• Email          : ${order.email_pic}` : ""}${order.alamat_instalasi ? `\n• Alamat / Lokasi: ${order.alamat_instalasi}` : ""}`;

  if (order.kategori_layanan === "Enterprise") {
    if (order.sub_layanan === "LocalLoop") {
      text += `

⚡ *PARAMETER LOCALLOOP*
• Layanan LocalLoop : ${order.layanan_dedicated || "-"}
• Kapasitas Layanan : ${order.kapasitas_layanan || "-"}
• Interkoneksi      : ${order.interkoneksi || "-"}
• Infrastruktur     : ${order.infrastruktur || "-"}
• Port Interkoneksi : ${order.port_media || "-"}
• Media Koneksi     : ${order.media_koneksi || "-"}
• SN ONT            : ${order.sn_ont || "-"}`;
    } else if (order.sub_layanan === "Collocation Rack") {
      const rackPos = formatRackPositionLabel(order.rack_code, order.rack_unit_start, order.rack_unit_end);
      text += `

⚡ *PARAMETER COLLOCATION RACK*
• Tipe Layanan   : ${order.tipe_layanan_collo || "-"}
• Nama Perangkat : ${order.nama_perangkat || "-"}
• Serial Number  : ${order.sn_perangkat || "-"}${rackPos !== "-" ? `\n• Posisi Rack 3D : ${rackPos}` : ""}`;
    } else if (order.sub_layanan === "Dark Fiber") {
      const otbPos = formatOtbCoreLabel(order.otb_code, order.otb_core_numbers);
      text += `

⚡ *PARAMETER DARK FIBER*
• Layanan Core   : ${order.layanan_dedicated || "-"}
• Server / Hub   : ${order.server || "-"}${otbPos !== "-" ? `\n• Port OTB 3D    : ${otbPos}` : ""}`;
    } else if (order.sub_layanan === "Content") {
      let prefixStr = order.prefix_advertise || "-";
      try {
        const parsed = JSON.parse(order.prefix_advertise || "[]");
        if (Array.isArray(parsed)) prefixStr = parsed.join(", ");
      } catch {}

      text += `

⚡ *PARAMETER BGP & CONTENT PEERING*
• Layanan Content : ${order.layanan_dedicated || "-"}
• AS Number       : ${order.as_number || "-"}
• Prefix Advertise: ${prefixStr}
• Interkoneksi    : ${order.interkoneksi || "-"}
• VLAN ID         : ${order.vlan || "-"}
• IP Private      : ${order.ip_private || "-"}
• Server / Core   : ${order.server || "-"}
• Media Koneksi   : ${order.media_koneksi || "-"}`;
    } else if (order.sub_layanan === "Enterprise Dedicated") {
      text += `

⚡ *PARAMETER ENTERPRISE DEDICATED*
• Layanan Dedicated : ${order.layanan_dedicated || "-"}
• Infrastruktur     : ${order.infrastruktur || "-"}
• Media Koneksi     : ${order.media_koneksi || "-"}
• VLAN ID           : ${order.vlan ?? "-"}
• IP Public         : ${order.ip_public || "-"}
• IP Private        : ${order.ip_private || "-"}
• Server / Aggregator: ${order.server || "-"}
• SN ONT            : ${order.sn_ont || "-"}`;
    }
  } else {
    text += `

⚡ *PARAMETER JARINGAN POP SITE*
• Layanan Dedicated: ${order.layanan_dedicated || "-"}
• Infrastruktur    : ${order.infrastruktur || "-"}
• Media Koneksi    : ${order.media_koneksi || "-"}
• VLAN ID          : ${order.vlan ?? "-"}
• IP Public        : ${order.ip_public || "-"}
• IP Private       : ${order.ip_private || "-"}
• Server / BRAS    : ${order.server || "-"}
• SN ONT           : ${order.sn_ont || "-"}`;
  }

  const isMetronexia = order.infrastruktur?.toLowerCase().includes("metronexia") || order.media_koneksi?.toLowerCase().includes("metronexia");

  if (isMetronexia) {
    text += `

🏢 *METRONEXIA INTEGRATION*
• SID Metronexia: ${order.sid || "-"}
• AO Metronexia : ${order.ao || "-"}
• No. Order     : ${order.nomor_order || "-"}`;
  } else if (isTelkom) {
    text += `

🏢 *METRO TELKOM INTEGRATION*
• SID Telkom    : ${order.sid || "-"}
• AO Telkom     : ${order.ao || "-"}
• No. Order     : ${order.nomor_order || "-"}`;
  }

  if (order.catatan_tambahan) {
    text += `

📝 *Catatan Tambahan*: ${order.catatan_tambahan}`;
  }

  text += `
========================================
_Generated automatically from ACTIS Provisioning Engine_`;

  return text;
}

