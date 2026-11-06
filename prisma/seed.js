const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding ACTIS database...');

  // 1. Clean existing records
  await prisma.orderProgressLog.deleteMany();
  await prisma.testResult.deleteMany();
  await prisma.sheetsSyncLog.deleteMany();
  await prisma.popSiteOrder.deleteMany();
  await prisma.popSite.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemSetting.deleteMany();

  // 2. Create Users with required roles
  const adminUser = await prisma.user.create({
    data: {
      id: 'usr-admin-001',
      nama: 'Ahmad Fauzi (Head of NOC)',
      email: 'admin.noc@isp-enterprise.net',
      role: 'admin',
    },
  });

  const nocUser1 = await prisma.user.create({
    data: {
      id: 'usr-noc-001',
      nama: 'Budi Santoso (NOC Engineer)',
      email: 'budi.santoso@isp-enterprise.net',
      role: 'noc_engineer',
    },
  });

  const nocUser2 = await prisma.user.create({
    data: {
      id: 'usr-noc-002',
      nama: 'Reza Pratama (Senior NOC)',
      email: 'reza.pratama@isp-enterprise.net',
      role: 'noc_engineer',
    },
  });

  const fieldEngineer = await prisma.user.create({
    data: {
      id: 'usr-field-001',
      nama: 'Dimas Kurniawan (Field Engineer)',
      email: 'dimas.k@isp-enterprise.net',
      role: 'field_engineer',
    },
  });

  const salesUser = await prisma.user.create({
    data: {
      id: 'usr-sales-001',
      nama: 'Sarah Novita (Sales Corporate)',
      email: 'sarah.novita@isp-enterprise.net',
      role: 'sales_corporate',
    },
  });

  console.log('Users created.');

  // 3. Create Orders
  // Order 1: Metro Telkom in progress
  const order1 = await prisma.popSiteOrder.create({
    data: {
      id: 'ord-act-20261102-0012',
      ticket_number: 'ACT-20261102-0012',
      nama_pic: 'PT Sinar Logistik (PIC: Pak Danu)',
      kontak_pic: JSON.stringify(['081298765432', '085712348900']),
      alamat_instalasi: 'Kawasan Industri Jababeka V Blok C No. 18, Cikarang, Jawa Barat',
      ip_public: '103.148.72.130/30',
      ip_private: '10.240.15.22/30',
      vlan: 1420,
      layanan_dedicated: 'Metro-E 100 Mbps',
      server: 'BRAS-CKR-01 (Huawei NE40E)',
      infrastruktur: 'Fiber Optic',
      media_koneksi: 'Metro Telkom',
      sn_ont: 'ZTEGC9812A4F',
      sid: 'TELKOM-METRO-9812',
      ao: 'AO-2026-JKT-8821',
      nomor_order: 'ORD-TLK-771290',
      waktu_aktivasi: null,
      catatan_tambahan: 'Prioritas aktivasi sebelum jam kerja esok hari. SFP 10G LC Single Mode.',
      status: 'In Progress',
      created_by: salesUser.id,
      created_at: new Date('2026-11-02T08:30:00Z'),
    },
  });

  // Order 1 progress logs
  await prisma.orderProgressLog.create({
    data: {
      order_id: order1.id,
      user_id: salesUser.id,
      action_type: 'Status Change',
      status_sebelum: null,
      status_sesudah: 'Antrian Aktivasi',
      catatan_progress: 'Tiket aktivasi baru dibuat oleh Sales Corporate.',
      created_at: new Date('2026-11-02T08:30:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order1.id,
      user_id: nocUser1.id,
      action_type: 'Status Change',
      status_sebelum: 'Antrian Aktivasi',
      status_sesudah: 'In Progress',
      catatan_progress: 'Tiket diambil oleh NOC Budi Santoso. Memulai alokasi VLAN 1420 dan verifikasi link Telkom.',
      created_at: new Date('2026-11-02T10:15:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order1.id,
      user_id: nocUser1.id,
      action_type: 'Config Pushed',
      status_sebelum: 'In Progress',
      status_sesudah: 'In Progress',
      catatan_progress: 'Konfigurasi BGP Peer & Routing table verifikasi done di BRAS-CKR-01.',
      created_at: new Date('2026-11-02T14:15:00Z'),
    },
  });

  // Order 2: Completed order with test result
  const order2 = await prisma.popSiteOrder.create({
    data: {
      id: 'ord-act-20261101-0005',
      ticket_number: 'ACT-20261101-0005',
      nama_pic: 'Bank Artha Mandiri (PIC: Ibu Rina)',
      kontak_pic: JSON.stringify(['081122334455']),
      alamat_instalasi: 'Gedung Menara Cyber 2 Lantai 12, Jl. HR Rasuna Said, Kuningan, Jakarta Selatan',
      ip_public: '103.148.72.98/29',
      ip_private: '10.200.10.14/30',
      vlan: 2100,
      layanan_dedicated: 'Dedicated 1:1 500 Mbps',
      server: 'CORE-JKT-CYBER01 (Cisco ASR 9006)',
      infrastruktur: 'Fiber Optic',
      media_koneksi: 'Direct Fiber ISP',
      sn_ont: 'HWTC-881249A0',
      waktu_aktivasi: new Date('2026-11-01T15:00:00Z'),
      catatan_tambahan: 'Dual homing fiber patch cord LC-UPC to SC-APC.',
      status: 'Completed',
      created_by: salesUser.id,
      created_at: new Date('2026-11-01T09:00:00Z'),
      completed_at: new Date('2026-11-01T16:30:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order2.id,
      user_id: salesUser.id,
      action_type: 'Status Change',
      status_sebelum: null,
      status_sesudah: 'Antrian Aktivasi',
      catatan_progress: 'Permintaan aktivasi Dedicated Link Bank Artha Mandiri diajukan.',
      created_at: new Date('2026-11-01T09:00:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order2.id,
      user_id: nocUser2.id,
      action_type: 'Status Change',
      status_sebelum: 'Antrian Aktivasi',
      status_sesudah: 'In Progress',
      catatan_progress: 'NOC Reza mengambil tiket dan provisioning VLAN 2100.',
      created_at: new Date('2026-11-01T11:00:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order2.id,
      user_id: nocUser2.id,
      action_type: 'Test Uploaded',
      status_sebelum: 'In Progress',
      status_sesudah: 'In Progress',
      catatan_progress: 'Hasil speedtest 502 Mbps dan OPM -18.2 dBm berhasil diunggah.',
      created_at: new Date('2026-11-01T16:15:00Z'),
    },
  });

  await prisma.testResult.create({
    data: {
      id: 'tst-001-speedtest',
      order_id: order2.id,
      file_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80',
      file_name: 'Speedtest_500Mbps_BankArtha.png',
      file_type: 'image/png',
      uploaded_by: nocUser2.id,
      uploaded_at: new Date('2026-11-01T16:15:00Z'),
    },
  });

  await prisma.testResult.create({
    data: {
      id: 'tst-002-opm',
      order_id: order2.id,
      file_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8?auto=format&fit=crop&w=1200&q=80',
      file_name: 'OPM_Redaman_Minus18dBm.jpg',
      file_type: 'image/jpeg',
      uploaded_by: nocUser2.id,
      uploaded_at: new Date('2026-11-01T16:20:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order2.id,
      user_id: adminUser.id,
      action_type: 'Status Change',
      status_sebelum: 'In Progress',
      status_sesudah: 'Completed',
      catatan_progress: 'Aktivasi selesai diverifikasi. SLA testing passed. Layanan Go-Live.',
      created_at: new Date('2026-11-01T16:30:00Z'),
    },
  });

  // Create active POP Site in inventory for completed order
  const popSite1 = await prisma.popSite.create({
    data: {
      id: 'site-bam-001',
      site_id: 'POP-202611-0001',
      initial_ticket: order2.ticket_number,
      nama_pic: order2.nama_pic,
      kontak_pic: order2.kontak_pic,
      alamat_instalasi: order2.alamat_instalasi,
      ip_public: order2.ip_public,
      ip_private: order2.ip_private,
      vlan: order2.vlan,
      layanan_dedicated: order2.layanan_dedicated,
      server: order2.server,
      infrastruktur: order2.infrastruktur,
      media_koneksi: order2.media_koneksi,
      sn_ont: order2.sn_ont,
      status_layanan: 'Active',
      waktu_go_live: new Date('2026-11-01T16:30:00Z'),
    },
  });

  await prisma.popSiteOrder.update({
    where: { id: order2.id },
    data: { pop_site_id: popSite1.id },
  });

  // Order 3: Antrian Aktivasi (New)
  const order3 = await prisma.popSiteOrder.create({
    data: {
      id: 'ord-act-20261102-0024',
      ticket_number: 'ACT-20261102-0024',
      nama_pic: 'Hotel Grand Nusantara (PIC: Pak Hengky)',
      kontak_pic: JSON.stringify(['081388990011']),
      alamat_instalasi: 'Jl. Malioboro No. 45, Danurejan, Kota Yogyakarta, D.I. Yogyakarta',
      ip_public: '103.148.72.210/29',
      ip_private: '10.210.4.1/24',
      vlan: 1840,
      layanan_dedicated: 'Dedicated 1:1 200 Mbps',
      server: 'BRAS-YOG-02 (MikroTik CCR2004)',
      infrastruktur: 'Wireless PTP',
      media_koneksi: 'Radio Ubiquiti',
      sn_ont: 'UBQ-PRISM-99124',
      waktu_aktivasi: null,
      catatan_tambahan: 'Tower rooftop lantai 8. Arahkan antenna ke POP Kotabaru 5.8 GHz.',
      status: 'Antrian Aktivasi',
      created_by: salesUser.id,
      created_at: new Date('2026-11-02T13:00:00Z'),
    },
  });

  await prisma.orderProgressLog.create({
    data: {
      order_id: order3.id,
      user_id: salesUser.id,
      action_type: 'Status Change',
      status_sebelum: null,
      status_sesudah: 'Antrian Aktivasi',
      catatan_progress: 'Order baru masuk ke sistem. Menunggu assignment engineer NOC.',
      created_at: new Date('2026-11-02T13:00:00Z'),
    },
  });

  // Initial system settings
  await prisma.systemSetting.createMany({
    data: [
      {
        key: 'GOOGLE_APPS_SCRIPT_WEBHOOK_URL',
        value: 'https://script.google.com/macros/s/AKfycbz_SAMPLE_ACTIS_WEBHOOK/exec',
      },
      {
        key: 'AUTO_SYNC_TO_SHEETS',
        value: 'true',
      },
      {
        key: 'COMPANY_NAME',
        value: 'ACTIS Enterprise ISP Networks',
      },
    ],
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

