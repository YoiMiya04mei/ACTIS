const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding Inventory data...");

  // 1. Categories
  const categoriesData = [
    { name: "Networking & Routing", description: "Perangkat aktif jaringan: Router, Switch, MikroTik, dsb." },
    { name: "Fiber Optic & Transceiver", description: "Transceiver SFP, OTB, Patch Cord, dsb." },
    { name: "Kabel & Konektor", description: "Kabel UTP, Fiber Optik, RJ45, Konektor FO." },
    { name: "Tools & Alat Ukur", description: "Splicer, OTDR, OPM, Tang Crimping, toolkit teknisi." },
    { name: "Material Instalasi", description: "Baut rack, kabel ties, isolasi, aksesoris pasang." },
    { name: "Server & Collocation", description: "Server rackmount, PDU, UPS, dan laptop operasional." },
  ];

  const categoryMap = {};
  for (const cat of categoriesData) {
    const record = await prisma.inventoryCategory.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categoryMap[cat.name] = record.id;
  }
  console.log("Categories ready:", Object.keys(categoryMap).length);

  // 2. Standard Items & Initial Stocks
  const itemsData = [
    // Reusable
    {
      code: "ITM-ROU-0001",
      name: "MikroTik Cloud Core Router CCR2004-16G-2S+",
      category_id: categoryMap["Networking & Routing"],
      type: "REUSABLE",
      brand: "MikroTik",
      model: "CCR2004-16G-2S+",
      serial_number: "CCR-2004-88910",
      unit: "Unit",
      min_stock: 2,
      storage_location: "Gudang Utama - Rak A1",
      description: "Core Router 16 Port Gigabit & 2 Port 10G SFP+",
      initial_stock: 10,
    },
    {
      code: "ITM-SWI-0001",
      name: "Switch Ruijie Reyee RG-NBS3200-24SFP/8GT4XS",
      category_id: categoryMap["Networking & Routing"],
      type: "REUSABLE",
      brand: "Ruijie",
      model: "RG-NBS3200",
      unit: "Unit",
      min_stock: 2,
      storage_location: "Gudang Utama - Rak A2",
      description: "Switch 24 Port SFP + 8 Port Gigabit Combo + 4 Port 10G SFP+",
      initial_stock: 8,
    },
    {
      code: "ITM-SFP-0001",
      name: "Transceiver SFP+ 10G LR Single Mode 10km 1310nm",
      category_id: categoryMap["Fiber Optic & Transceiver"],
      type: "REUSABLE",
      brand: "Cisco / OEM",
      model: "SFP-10G-LR",
      unit: "Pcs",
      min_stock: 10,
      storage_location: "Gudang Utama - Laci B1",
      description: "Modul optik 10G LR LC Duplex 10km",
      initial_stock: 50,
    },
    {
      code: "ITM-OTB-0001",
      name: "Optical Termination Box (OTB) 24 Core Rackmount SC/UPC",
      category_id: categoryMap["Fiber Optic & Transceiver"],
      type: "REUSABLE",
      brand: "NetLink",
      model: "OTB-24-SC",
      unit: "Unit",
      min_stock: 3,
      storage_location: "Gudang Utama - Rak B2",
      description: "Panel OTB 24 port SC adapter tray",
      initial_stock: 12,
    },
    {
      code: "ITM-TLS-0001",
      name: "Fusion Splicer Fiber Optic Fujikura 90S+",
      category_id: categoryMap["Tools & Alat Ukur"],
      type: "REUSABLE",
      brand: "Fujikura",
      model: "90S+",
      serial_number: "FJK-90S-00449",
      unit: "Unit",
      min_stock: 1,
      storage_location: "Ruang Lab & Alat Teknisi",
      description: "Splicer FO core-to-core alignment dengan cleaver",
      initial_stock: 3,
    },
    {
      code: "ITM-TLS-0002",
      name: "Optical Power Meter (OPM) & Visual Fault Locator (VFL)",
      category_id: categoryMap["Tools & Alat Ukur"],
      type: "REUSABLE",
      brand: "Joinwit",
      model: "JW3208",
      unit: "Unit",
      min_stock: 2,
      storage_location: "Ruang Lab & Alat Teknisi",
      description: "Tester redaman optik dBm dan senter laser FO",
      initial_stock: 8,
    },
    {
      code: "ITM-LAP-0001",
      name: "Laptop Operasional Teknisi Lenovo ThinkPad L14",
      category_id: categoryMap["Server & Collocation"],
      type: "REUSABLE",
      brand: "Lenovo",
      model: "ThinkPad L14 Gen 3",
      serial_number: "LNV-TP-L14-8801",
      unit: "Unit",
      min_stock: 1,
      storage_location: "Ruang NOC / Gudang",
      description: "Laptop instalasi & konfigurasi jaringan lapangan",
      initial_stock: 5,
    },

    // Consumable
    {
      code: "ITM-CAB-0001",
      name: "Kabel UTP Cat6 Belden Original 1000ft (305m)",
      category_id: categoryMap["Kabel & Konektor"],
      type: "CONSUMABLE",
      brand: "Belden",
      model: "Cat6 7814A",
      unit: "Roll",
      min_stock: 5,
      storage_location: "Gudang Utama - Rak C1",
      description: "Kabel LAN Cat6 solid copper 305 meter per roll",
      initial_stock: 25,
    },
    {
      code: "ITM-CAB-0002",
      name: "Kabel Fiber Optic Dropcore 1 Core 3 Steel Wire (1000m)",
      category_id: categoryMap["Kabel & Konektor"],
      type: "CONSUMABLE",
      brand: "Voksel / ZTT",
      model: "1C-3W-1000M",
      unit: "Roll",
      min_stock: 3,
      storage_location: "Gudang Utama - Pallet FO",
      description: "Kabel dropcore FO outdoor 1000 meter drum kayu",
      initial_stock: 15,
    },
    {
      code: "ITM-CON-0001",
      name: "Konektor RJ45 Cat6 CommScope / AMP (Isi 50 pcs)",
      category_id: categoryMap["Kabel & Konektor"],
      type: "CONSUMABLE",
      brand: "CommScope",
      model: "Cat6 Modular Plug",
      unit: "Box",
      min_stock: 10,
      storage_location: "Gudang Utama - Laci C2",
      description: "Konektor RJ45 Cat6 unshielded",
      initial_stock: 40,
    },
    {
      code: "ITM-PAT-0001",
      name: "Patch Cord Fiber Optic SC/UPC to LC/UPC Simplex 3M",
      category_id: categoryMap["Fiber Optic & Transceiver"],
      type: "CONSUMABLE",
      brand: "OEM",
      model: "SM-SC-LC-3M",
      unit: "Pcs",
      min_stock: 20,
      storage_location: "Gudang Utama - Rak B1",
      description: "Patch cord single mode simplex 3 meter",
      initial_stock: 100,
    },
    {
      code: "ITM-MAT-0001",
      name: "Kabel Ties / Cable Tie 200mm x 3.6mm (Isi 100 pcs)",
      category_id: categoryMap["Material Instalasi"],
      type: "CONSUMABLE",
      brand: "KSS",
      model: "CV-200",
      unit: "Pack",
      min_stock: 15,
      storage_location: "Gudang Utama - Rak D1",
      description: "Kabel ties pengikat jalur kabel rack",
      initial_stock: 60,
    },
    {
      code: "ITM-MAT-0002",
      name: "Isolasi Listrik Hitam Nitto 21 PVC Tape",
      category_id: categoryMap["Material Instalasi"],
      type: "CONSUMABLE",
      brand: "Nitto",
      model: "Nitto 21",
      unit: "Roll",
      min_stock: 10,
      storage_location: "Gudang Utama - Rak D2",
      description: "Isolasi kabel hitam standar kelistrikan",
      initial_stock: 50,
    },
  ];

  for (const itm of itemsData) {
    const existing = await prisma.inventoryItem.findUnique({
      where: { code: itm.code },
    });

    if (!existing) {
      const { initial_stock, ...itemFields } = itm;
      const createdItem = await prisma.inventoryItem.create({
        data: {
          ...itemFields,
          min_stock: itm.min_stock,
          is_active: true,
        },
      });

      await prisma.inventoryStock.create({
        data: {
          item_id: createdItem.id,
          initial_stock: initial_stock,
          total_in: initial_stock,
          available_stock: initial_stock,
        },
      });

      await prisma.inventoryMovement.create({
        data: {
          item_id: createdItem.id,
          movement_type: "IN",
          quantity: initial_stock,
          balance_before: 0,
          balance_after: initial_stock,
          reference_type: "ADJUSTMENT",
          reference_id: createdItem.id,
          performed_by: "System Initial Seed",
          notes: "Inisialisasi Stok Awal Master Barang",
        },
      });
    }
  }

  console.log("Inventory seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Error seeding inventory:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

