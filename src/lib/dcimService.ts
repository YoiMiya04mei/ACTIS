import { prisma } from "@/lib/prisma";
import {
  getTiaColorForCore,
  getTiaTubeColorForTray,
  isRackRangeFree,
  computeRackStats,
  computeOtbStats,
  DataCenterRackItem,
  OpticalOtbItem,
} from "@/lib/dcimUtils";

/**
 * Menghasilkan definisi seluruh port/core TIA-598 untuk sebuah OTB.
 */
export function buildOtbPortsData(
  otbId: string,
  totalCores: number,
  coresPerTray: number = 12
) {
  const safePerTray = Math.max(1, Math.min(24, coresPerTray || 12));
  const rows: Array<{
    otb_id: string;
    core_number: number;
    tray_number: number;
    tube_color: string;
    core_color: string;
    status: string;
  }> = [];

  for (let core = 1; core <= totalCores; core++) {
    const trayNumber = Math.ceil(core / safePerTray);
    const tubeColor = getTiaTubeColorForTray(trayNumber);
    const coreColor = getTiaColorForCore(core, Math.min(12, safePerTray));
    rows.push({
      otb_id: otbId,
      core_number: core,
      tray_number: trayNumber,
      tube_color: tubeColor.labelId,
      core_color: coreColor.labelId,
      status: "Available",
    });
  }

  return rows;
}

/**
 * Mengisi data contoh awal (seed) untuk Database Rack 3D & Database OTB 3D satu kali saja jika database masih kosong.
 */
export async function ensureDcimSeedData(): Promise<void> {
  const flag = await prisma.systemSetting.findUnique({
    where: { key: "dcim_seed_initialized" },
  });
  if (flag?.value === "true") {
    return;
  }

  const [rackCount, otbCount] = await Promise.all([
    prisma.dataCenterRack.count(),
    prisma.opticalOtb.count(),
  ]);

  if (rackCount > 0 || otbCount > 0) {
    await prisma.systemSetting.upsert({
      where: { key: "dcim_seed_initialized" },
      update: { value: "true" },
      create: { key: "dcim_seed_initialized", value: "true" },
    });
    return;
  }

  // 1. Seed Data Center Racks
  const rack1 = await prisma.dataCenterRack.create({
    data: {
      code: "DC-CYBER1-R01",
      name: "Rack Collo Cyber 1 - R01",
      location: "Gedung Cyber 1 Lt. 3, Ruang DC-02, Jakarta Selatan",
      room_zone: "Row A / Cold Aisle",
      total_u: 42,
      power_capacity_va: 6000,
      status: "Active",
      notes: "Rack Collocation utama Gedung Cyber 1 dengan dual redundant PDU A/B.",
      slots: {
        create: [
          {
            start_u: 1,
            unit_size: 2,
            end_u: 2,
            device_name: "APC Smart-UPS & Dual PDU A/B",
            serial_number: "PDU-APC-9901A",
            customer_name: "Internal DC Infrastructure",
            device_type: "PDU",
            power_draw_watt: 120,
            color_tag: "#f59e0b",
            status: "Occupied",
          },
          {
            start_u: 10,
            unit_size: 1,
            end_u: 10,
            device_name: "DNS & NTP Resolver Node",
            serial_number: "HPE-DL20-1102",
            customer_name: "PT Akses Cepat Internal",
            device_type: "Server",
            power_draw_watt: 220,
            color_tag: "#3b82f6",
            status: "Occupied",
          },
          {
            start_u: 15,
            unit_size: 2,
            end_u: 16,
            device_name: "Server Dell PowerEdge R740",
            serial_number: "SN-DELL-740881",
            customer_name: "PT FinTech Nusantara",
            pic_name: "Ibu Rina Suryani",
            device_type: "Server",
            power_draw_watt: 550,
            color_tag: "#3b82f6",
            status: "Occupied",
          },
          {
            start_u: 20,
            unit_size: 4,
            end_u: 23,
            device_name: "Blade Chassis SuperMicro 4U",
            serial_number: "SMC-4U-88412",
            customer_name: "PT Cloud Indo Prima",
            pic_name: "Pak Hendra",
            device_type: "Server",
            power_draw_watt: 1250,
            color_tag: "#10b981",
            status: "Occupied",
          },
          {
            start_u: 30,
            unit_size: 2,
            end_u: 31,
            device_name: "Synology Enterprise NAS RS3621xs+",
            serial_number: "SYN-NAS-3310",
            customer_name: "PT Media Arsip Digital",
            device_type: "Storage",
            power_draw_watt: 380,
            color_tag: "#10b981",
            status: "Reserved",
            notes: "Menunggu pemasangan rack rail & kabel DAC.",
          },
          {
            start_u: 36,
            unit_size: 1,
            end_u: 36,
            device_name: "OTB Patch Panel 48 Core SC/UPC",
            serial_number: "OTB-PP-CY1-01",
            customer_name: "Internal NOC Backbone",
            device_type: "Patch Panel",
            power_draw_watt: 0,
            color_tag: "#64748b",
            status: "Occupied",
          },
          {
            start_u: 38,
            unit_size: 1,
            end_u: 38,
            device_name: "FortiGate 200F HA Security",
            serial_number: "FGT200F-88410",
            customer_name: "Managed Firewall Pool",
            device_type: "Firewall",
            power_draw_watt: 190,
            color_tag: "#ef4444",
            status: "Occupied",
          },
          {
            start_u: 40,
            unit_size: 1,
            end_u: 40,
            device_name: "MikroTik CCR2216-1G-12XS-2XQ",
            serial_number: "MTK-CCR2216-01",
            customer_name: "Core BGP Jakarta P1",
            device_type: "Router",
            power_draw_watt: 145,
            color_tag: "#8b5cf6",
            status: "Occupied",
          },
          {
            start_u: 41,
            unit_size: 2,
            end_u: 42,
            device_name: "Cisco Nexus 93180YC-FX Top-of-Rack",
            serial_number: "CIS-N9K-44901",
            customer_name: "Top-of-Rack Switch",
            device_type: "Switch",
            power_draw_watt: 320,
            color_tag: "#06b6d4",
            status: "Occupied",
          },
        ],
      },
    },
  });

  await prisma.dataCenterRack.create({
    data: {
      code: "DC-CYBER2-R02",
      name: "Rack Collo Cyber 2 - R02",
      location: "Menara Cyber 2 Lt. 5, MMR Data Center, Jakarta Selatan",
      room_zone: "Row B / High Density",
      total_u: 42,
      power_capacity_va: 8000,
      status: "Active",
      notes: "Rack ekspansi Cyber 2 kapasitas daya tinggi hingga 8 kVA.",
      slots: {
        create: [
          {
            start_u: 1,
            unit_size: 2,
            end_u: 2,
            device_name: "Eaton Smart PDU Redundant",
            serial_number: "ETN-PDU-202",
            customer_name: "Internal DC Infrastructure",
            device_type: "PDU",
            power_draw_watt: 95,
            color_tag: "#f59e0b",
            status: "Occupied",
          },
          {
            start_u: 3,
            unit_size: 2,
            end_u: 4,
            device_name: "Huawei OceanStor Backup Server",
            serial_number: "HW-OS-9021",
            customer_name: "PT Bank Sentra Daerah",
            device_type: "Storage",
            power_draw_watt: 480,
            color_tag: "#10b981",
            status: "Occupied",
          },
          {
            start_u: 41,
            unit_size: 2,
            end_u: 42,
            device_name: "Huawei CloudEngine S6730 TOR Switch",
            serial_number: "HW-CE-55120",
            customer_name: "Top-of-Rack Switch",
            device_type: "Switch",
            power_draw_watt: 280,
            color_tag: "#06b6d4",
            status: "Occupied",
          },
        ],
      },
    },
  });

  await prisma.dataCenterRack.create({
    data: {
      code: "DC-IDC3-R03",
      name: "Rack Collo IDC Duren Tiga - R03",
      location: "IDC Duren Tiga Lt. 2, Ruang OpenIXP, Jakarta Selatan",
      room_zone: "Zone Peering C",
      total_u: 42,
      power_capacity_va: 5000,
      status: "Active",
      notes: "Tersedia ruang kosong luas untuk Full Rack / Half Rack 21U / Quarter Rack 10U.",
      slots: {
        create: [
          {
            start_u: 1,
            unit_size: 1,
            end_u: 1,
            device_name: "Vertical Strip PDU Master",
            serial_number: "IDC-PDU-03",
            customer_name: "Internal DC Infrastructure",
            device_type: "PDU",
            power_draw_watt: 60,
            color_tag: "#f59e0b",
            status: "Occupied",
          },
          {
            start_u: 42,
            unit_size: 1,
            end_u: 42,
            device_name: "Arista 7050SX3 Peering Switch",
            serial_number: "ARS-7050-031",
            customer_name: "OpenIXP Peering Aggregate",
            device_type: "Switch",
            power_draw_watt: 240,
            color_tag: "#06b6d4",
            status: "Occupied",
          },
        ],
      },
    },
  });

  await prisma.dataCenterRack.create({
    data: {
      code: "DC-BDG-POP-R04",
      name: "Rack Collo POP Bandung BBU - R04",
      location: "POP Bandung (BBU), Jl. Asia Afrika No. 45, Bandung",
      room_zone: "POP Regional Jawa Barat",
      total_u: 24,
      power_capacity_va: 3500,
      status: "Active",
      notes: "Rack Regional POP Bandung 24U untuk server edge & CDN lokal.",
      slots: {
        create: [
          {
            start_u: 22,
            unit_size: 2,
            end_u: 23,
            device_name: "Huawei NE40E-X3 Edge Router",
            serial_number: "HW-NE40E-BDG01",
            customer_name: "POP Bandung Backbone",
            device_type: "Router",
            power_draw_watt: 420,
            color_tag: "#8b5cf6",
            status: "Occupied",
          },
          {
            start_u: 24,
            unit_size: 1,
            end_u: 24,
            device_name: "OTB Patch Panel Regional BBU",
            serial_number: "OTB-BDG-01",
            customer_name: "Internal Backbone",
            device_type: "Patch Panel",
            power_draw_watt: 0,
            color_tag: "#64748b",
            status: "Occupied",
          },
        ],
      },
    },
  });

  // Ensure rack1 id referenced cleanly
  void rack1;

  // 2. Seed Optical OTBs
  const otb1 = await prisma.opticalOtb.create({
    data: {
      code: "OTB-CYBER2-01",
      name: "OTB Backbone Cyber 2 → Tifa",
      location: "POP Menara Cyber 2, MMR Lt. 5, Rack A-01",
      pop_node: "POP Menara Cyber 2",
      total_cores: 48,
      cores_per_tray: 12,
      connector_type: "SC/UPC",
      fiber_mode: "Single-Mode G.652D",
      status: "Active",
      notes: "Trunk Dark Fiber 48 Core menuju Gedung Tifa & Kuningan.",
    },
  });
  const otb1Ports = buildOtbPortsData(otb1.id, 48, 12).map((p) => {
    if (p.core_number === 1 || p.core_number === 2) {
      return {
        ...p,
        status: "Used",
        customer_name: "PT Transmedia Network",
        route_pair: "POP Menara Cyber 2 -> POP Gedung Tifa",
        destination_otb: `OTB-TIFA-A01 #${p.core_number}`,
        attenuation_db: 1.42,
        distance_km: 2.8,
      };
    }
    if (p.core_number === 3 || p.core_number === 4) {
      return {
        ...p,
        status: "Used",
        customer_name: "Bank Nusantara Syariah",
        route_pair: "POP Menara Cyber 2 -> Graha Niaga",
        destination_otb: `OTB-GRAHA-02 #${p.core_number}`,
        attenuation_db: 2.15,
        distance_km: 4.5,
      };
    }
    if (p.core_number === 7 || p.core_number === 8) {
      return {
        ...p,
        status: "Reserved",
        customer_name: "PT Logistik Cepat",
        route_pair: "POP Menara Cyber 2 -> Kawasan Rasuna",
        attenuation_db: 1.65,
        distance_km: 3.1,
      };
    }
    if (p.core_number === 11) {
      return {
        ...p,
        status: "Damaged",
        notes: "LOS / Bending terdeteksi di manhole MH-04 (OTDR 1.2 km).",
        attenuation_db: 18.4,
        distance_km: 1.2,
      };
    }
    if (p.core_number === 13 || p.core_number === 14) {
      return {
        ...p,
        status: "Used",
        customer_name: "PT Fintech Kapital",
        route_pair: "POP Menara Cyber 2 -> IDC Duren Tiga",
        destination_otb: `OTB-IDC3-CORE01 #${p.core_number - 12}`,
        attenuation_db: 2.85,
        distance_km: 6.4,
      };
    }
    return p;
  });
  await prisma.otbCorePort.createMany({ data: otb1Ports });

  const otb2 = await prisma.opticalOtb.create({
    data: {
      code: "OTB-TIFA-A01",
      name: "OTB Distribusi Gedung Tifa A01",
      location: "POP Gedung Tifa Lt. 4, Kuningan Barat, Jakarta Selatan",
      pop_node: "POP Gedung Tifa",
      total_cores: 24,
      cores_per_tray: 12,
      connector_type: "SC/APC",
      fiber_mode: "Single-Mode G.652D",
      status: "Active",
      notes: "OTB SC/APC Low-Return-Loss untuk terminasi Dark Fiber pelanggan korporat.",
    },
  });
  const otb2Ports = buildOtbPortsData(otb2.id, 24, 12).map((p) => {
    if (p.core_number === 1 || p.core_number === 2) {
      return {
        ...p,
        status: "Used",
        customer_name: "PT Transmedia Network",
        route_pair: "POP Gedung Tifa -> POP Menara Cyber 2",
        destination_otb: `OTB-CYBER2-01 #${p.core_number}`,
        attenuation_db: 1.4,
        distance_km: 2.8,
      };
    }
    if (p.core_number === 5 || p.core_number === 6) {
      return {
        ...p,
        status: "Reserved",
        customer_name: "Booking Survey Enterprise",
        route_pair: "POP Gedung Tifa -> SCBD Lot 10",
        attenuation_db: 1.9,
        distance_km: 3.4,
      };
    }
    return p;
  });
  await prisma.otbCorePort.createMany({ data: otb2Ports });

  const otb3 = await prisma.opticalOtb.create({
    data: {
      code: "OTB-IDC3-CORE01",
      name: "OTB Core Peering IDC Duren Tiga",
      location: "IDC Duren Tiga Lt. 2, Ruang Fiber Terminasi",
      pop_node: "POP IDC Duren Tiga",
      total_cores: 96,
      cores_per_tray: 12,
      connector_type: "LC/UPC",
      fiber_mode: "Single-Mode G.657A1",
      status: "Active",
      notes: "OTB kepadatan tinggi 96 Core LC/UPC untuk Dark Fiber & Peering cross-connect.",
    },
  });
  const otb3Ports = buildOtbPortsData(otb3.id, 96, 12).map((p) => {
    if (p.core_number === 1 || p.core_number === 2) {
      return {
        ...p,
        status: "Used",
        customer_name: "PT Fintech Kapital",
        route_pair: "IDC Duren Tiga -> POP Menara Cyber 2",
        destination_otb: `OTB-CYBER2-01 #${p.core_number + 12}`,
        attenuation_db: 2.85,
        distance_km: 6.4,
      };
    }
    if (p.core_number >= 25 && p.core_number <= 28) {
      return {
        ...p,
        status: "Used",
        customer_name: "CDN Edge Peering (4 Core)",
        route_pair: "IDC Duren Tiga -> Cyber 1 Lt. 3",
        attenuation_db: 2.3,
        distance_km: 5.9,
      };
    }
    return p;
  });
  await prisma.otbCorePort.createMany({ data: otb3Ports });

  await prisma.systemSetting.upsert({
    where: { key: "dcim_seed_initialized" },
    update: { value: "true" },
    create: { key: "dcim_seed_initialized", value: "true" },
  });
}

export async function listRacksWithStats(search?: string): Promise<DataCenterRackItem[]> {
  await ensureDcimSeedData();

  const racks = await prisma.dataCenterRack.findMany({
    where: search?.trim()
      ? {
          OR: [
            { code: { contains: search.trim(), mode: "insensitive" } },
            { name: { contains: search.trim(), mode: "insensitive" } },
            { location: { contains: search.trim(), mode: "insensitive" } },
            { room_zone: { contains: search.trim(), mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { code: "asc" },
    include: {
      slots: {
        orderBy: { start_u: "asc" },
      },
    },
  });

  return racks.map((r) => ({
    ...r,
    stats: computeRackStats(r.total_u, r.slots),
  }));
}

export async function listOtbsWithStats(search?: string): Promise<OpticalOtbItem[]> {
  await ensureDcimSeedData();

  const otbs = await prisma.opticalOtb.findMany({
    where: search?.trim()
      ? {
          OR: [
            { code: { contains: search.trim(), mode: "insensitive" } },
            { name: { contains: search.trim(), mode: "insensitive" } },
            { location: { contains: search.trim(), mode: "insensitive" } },
            { pop_node: { contains: search.trim(), mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { code: "asc" },
    include: {
      ports: {
        orderBy: { core_number: "asc" },
      },
    },
  });

  return otbs.map((o) => ({
    ...o,
    stats: computeOtbStats(o.total_cores, o.ports),
  }));
}

/**
 * Mereservasi slot U pada Data Center Rack untuk tiket aktivasi Collocation baru.
 */
export async function reserveRackSlotForOrder(params: {
  rackId: string;
  startU: number;
  unitSize: number;
  deviceName: string;
  serialNumber?: string | null;
  customerName?: string | null;
  picName?: string | null;
  orderId: string;
  ticketNumber: string;
}) {
  const rack = await prisma.dataCenterRack.findUnique({
    where: { id: params.rackId },
    include: { slots: true },
  });
  if (!rack) {
    throw new Error("Data Center Rack tidak ditemukan.");
  }

  const check = isRackRangeFree(rack.total_u, rack.slots, params.startU, params.unitSize);
  if (!check.valid) {
    throw new Error(check.reason || "Slot rack tidak tersedia.");
  }

  const createdSlot = await prisma.rackUnitAllocation.create({
    data: {
      rack_id: rack.id,
      start_u: params.startU,
      unit_size: params.unitSize,
      end_u: check.endU,
      device_name: params.deviceName || "Collocation Equipment",
      serial_number: params.serialNumber || null,
      customer_name: params.customerName || null,
      pic_name: params.picName || null,
      device_type: params.unitSize >= 10 ? "Collocation Block" : "Server",
      power_draw_watt: params.unitSize * 300,
      color_tag: "#3b82f6",
      status: "Reserved",
      order_id: params.orderId,
      ticket_number: params.ticketNumber,
      notes: `Dipesan melalui tiket ${params.ticketNumber}`,
    },
  });

  return { rack, slot: createdSlot };
}

/**
 * Mereservasi sekumpulan Core OTB untuk tiket aktivasi Dark Fiber baru.
 */
export async function reserveOtbCoresForOrder(params: {
  otbId: string;
  coreNumbers: number[];
  customerName?: string | null;
  routePair?: string | null;
  orderId: string;
  ticketNumber: string;
}) {
  const otb = await prisma.opticalOtb.findUnique({
    where: { id: params.otbId },
    include: { ports: true },
  });
  if (!otb) {
    throw new Error("Database OTB tidak ditemukan.");
  }

  const uniqueCores = Array.from(new Set(params.coreNumbers)).sort((a, b) => a - b);
  if (uniqueCores.length === 0) {
    throw new Error("Pilih minimal 1 Core OTB.");
  }

  const portMap = new Map(otb.ports.map((p) => [p.core_number, p]));
  for (const num of uniqueCores) {
    const port = portMap.get(num);
    if (!port) {
      throw new Error(`Core #${num} tidak ditemukan di ${otb.code}.`);
    }
    if (port.status !== "Available") {
      throw new Error(`Core #${num} di ${otb.code} sedang berstatus ${port.status}.`);
    }
  }

  await prisma.otbCorePort.updateMany({
    where: {
      otb_id: otb.id,
      core_number: { in: uniqueCores },
    },
    data: {
      status: "Reserved",
      customer_name: params.customerName || null,
      route_pair: params.routePair || null,
      order_id: params.orderId,
      ticket_number: params.ticketNumber,
      notes: `Dipesan melalui tiket ${params.ticketNumber}`,
    },
  });

  return { otb, coreNumbers: uniqueCores };
}

/**
 * Sinkronisasi status slot Rack & core OTB saat tiket berubah ke Completed atau Terminated.
 */
export async function syncDcimOnOrderCompletion(params: {
  orderId: string;
  tipeOrder: string;
  popSiteId?: string | null;
  siteCode?: string | null;
}) {
  if (params.tipeOrder === "Terminate") {
    await releaseDcimForOrder(params.orderId, params.popSiteId);
    return;
  }

  await prisma.rackUnitAllocation.updateMany({
    where: {
      OR: [
        { order_id: params.orderId },
        ...(params.popSiteId ? [{ pop_site_id: params.popSiteId }] : []),
      ],
    },
    data: {
      status: "Occupied",
      ...(params.popSiteId ? { pop_site_id: params.popSiteId } : {}),
      ...(params.siteCode ? { site_code: params.siteCode } : {}),
    },
  });

  await prisma.otbCorePort.updateMany({
    where: {
      OR: [
        { order_id: params.orderId },
        ...(params.popSiteId ? [{ pop_site_id: params.popSiteId }] : []),
      ],
    },
    data: {
      status: "Used",
      ...(params.popSiteId ? { pop_site_id: params.popSiteId } : {}),
      ...(params.siteCode ? { site_code: params.siteCode } : {}),
    },
  });
}

/**
 * Melepaskan reservasi atau alokasi Rack & OTB ketika tiket dibatalkan atau di-Terminate.
 */
export async function releaseDcimForOrder(
  orderId: string,
  popSiteId?: string | null,
  onlyReserved: boolean = false
) {
  const scopeOr = [
    { order_id: orderId },
    ...(popSiteId ? [{ pop_site_id: popSiteId }] : []),
  ];

  await prisma.rackUnitAllocation.deleteMany({
    where: {
      AND: [
        { OR: scopeOr },
        ...(onlyReserved ? [{ status: "Reserved" }] : []),
      ],
    },
  });

  await prisma.otbCorePort.updateMany({
    where: {
      AND: [
        { OR: scopeOr },
        ...(onlyReserved ? [{ status: "Reserved" }] : []),
      ],
    },
    data: {
      status: "Available",
      customer_name: null,
      route_pair: null,
      destination_otb: null,
      order_id: null,
      pop_site_id: null,
      ticket_number: null,
      site_code: null,
      notes: null,
    },
  });
}

