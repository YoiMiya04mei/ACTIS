"use client";

import React from "react";
import Link from "next/link";
import { useCurrentUser } from "@/context/UserContext";
import {
  Server,
  Network,
  Terminal,
  FileText,
  FolderClock,
  Sliders,
  ArrowRight,
  ShieldCheck,
  Zap,
  Cpu,
  Layers,
  Sparkles,
  ClipboardCheck,
  CheckCircle2,
} from "lucide-react";

export default function ToolsHubPage() {
  const { currentUser } = useCurrentUser();
  const isSuperAdmin = currentUser?.role === "admin";

  const tools = [
    {
      title: "MikroTik Generator (16 Tools)",
      description:
        "Generator konfigurasi lengkap RouterOS v6 & v7: PCC Load Balancing, WireGuard VPN, PPPoE Server, Hotspot, Queue Tree, VLAN Bridge, OSPF, BGP, Port Forwarding NAT, Firewall Hardening, Netwatch Alert, dan DoH.",
      icon: Server,
      color: "from-blue-600 to-indigo-600",
      badge: "16 Generator",
      badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200 dark:border-blue-800",
      href: "/tools/mikrotik",
      features: [
        "PCC Load Balancing 2-8 ISP",
        "WireGuard VPN & Road Warrior",
        "PPPoE & Hotspot Server",
        "Queue Tree & Bridge VLAN Filtering",
      ],
    },
    {
      title: "Traffic QoS Bandwidth Shaper",
      description:
        "Generator Traffic Classifier, Traffic Behavior (CAR/PIR/CBS), Traffic Policy, dan Interface binding untuk pembatasan bandwidth (Single & Batch) dengan script rollback otomatis.",
      icon: Network,
      color: "from-emerald-600 to-teal-600",
      badge: "QoS Shaper",
      badgeColor: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
      href: "/tools/traffic-qos",
      features: [
        "Single & Batch Bandwidth (MBPS, GBPS)",
        "CAR & PIR Dynamic Rate Calculation",
        "Interface Binding Script",
        "Undo / Rollback Script Generator",
      ],
    },
    {
      title: "Aktivasi Huawei OLT / ONT",
      description:
        "Wizard aktivasi terstruktur 5 langkah untuk provisioning GPON OLT Huawei: VLAN Profile, ONT Auth, WAN Static Route, Gemport & Service-port mapping, serta rollback script.",
      icon: Terminal,
      color: "from-rose-600 to-pink-600",
      badge: "Super Admin",
      badgeColor: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
      href: "/tools/huawei",
      superAdminOnly: true,
      features: [
        "GPON VLAN Service Profile",
        "ONT SN & Password Auth",
        "WAN IP & Peer Auto-Calculation",
        "Gemport to SVLAN Translation",
      ],
    },
    {
      title: "Generator Dokumen & Surat Resmi",
      description:
        "Pembuat surat dan dokumen operasional NOC standar industri: Berita Acara (BA), Surat Tugas (ST), Permit Keluar/Masuk Barang (PM), Reason For Outage (RFO), dan Bank Payment Voucher (BPV).",
      icon: FileText,
      color: "from-purple-600 to-violet-600",
      badge: "5 Dokumen",
      badgeColor: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
      href: "/tools/documents",
      features: [
        "Berita Acara Aktivasi / Relokasi",
        "Surat Tugas Teknisi & Field Engineer",
        "Permit Masuk/Keluar Barang DC",
        "Laporan RFO & Voucher Pembayaran",
      ],
    },
    {
      title: "Arsip & Riwayat Dokumen",
      description:
        "Pusat pencarian, arsip, dan pengelolaan seluruh dokumen yang telah diterbitkan. Mendukung preview A4 interaktif, cetak printer, download PDF, dan salin ringkasan pesan WhatsApp.",
      icon: FolderClock,
      color: "from-amber-600 to-orange-600",
      badge: "Arsip",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      href: "/tools/documents/history",
      features: [
        "Pencarian & Filter Multidokumen",
        "Preview Lembar Kertas A4 Otentik",
        "Ekspor PDF & Cetak Langsung",
        "Template Pesan WhatsApp Otomatis",
      ],
    },
    {
      title: "Pengaturan Template & Kop Surat",
      description:
        "Kustomisasi kop surat perusahaan (banner gambar / logo), stempel digital, kontak perusahaan, serta daftar tanda tangan resmi untuk otentikasi dokumen cetak.",
      icon: Sliders,
      color: "from-slate-600 to-zinc-700",
      badge: "Super Admin",
      badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
      href: "/tools/templates",
      superAdminOnly: true,
      features: [
        "Upload Banner Kop Surat & Logo",
        "Ekstraksi Kop dari File .DOCX & .PDF",
        "Stempel Digital & Pengaturan Penandatangan",
        "Simpan Otomatis ke Database Lokal",
      ],
    },
  ];

  const visibleTools = tools.filter((t) => !t.superAdminOnly || isSuperAdmin);

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              NOC Engineering Suite
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Network Tools & Document Generator
            </span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Cpu className="w-6 h-6 mr-2 text-blue-600 dark:text-blue-400" />
            NOC Tools & Script Generator
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Kumpulan generator konfigurasi jaringan (MikroTik, Traffic QoS, Huawei OLT) serta sistem
            pembuatan dokumen dan surat operasional resmi (BA, ST, Permit, RFO, BPV).
          </p>
        </div>
      </div>

      {/* Grid of Tools Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {visibleTools.map((t, idx) => {
          const Icon = t.icon;
          return (
            <Link
              key={idx}
              href={t.href}
              className="group relative flex flex-col justify-between p-5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-blue-400 dark:hover:border-blue-600 transition-all cursor-pointer overflow-hidden"
            >
              <div>
                {/* Header Card: Icon & Badge */}
                <div className="flex items-start justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-xl bg-gradient-to-br ${t.color} text-white flex items-center justify-center shadow-md group-hover:scale-105 transition-transform`}
                  >
                    <Icon className="w-6 h-6" />
                  </div>
                  <span
                    className={`text-[10px] font-black px-2.5 py-1 rounded-full border uppercase tracking-wider ${t.badgeColor}`}
                  >
                    {t.badge}
                  </span>
                </div>

                {/* Title & Description */}
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {t.title}
                </h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 leading-relaxed">
                  {t.description}
                </p>

                {/* Features Pill List */}
                <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
                  {t.features.map((f, fIdx) => (
                    <div
                      key={fIdx}
                      className="flex items-center text-[11px] text-slate-600 dark:text-slate-400 font-medium"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Launch Button */}
              <div className="mt-5 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                <span>Buka Generator Tool</span>
                <ArrowRight className="w-4 h-4 ml-1 group-hover:translate-x-1 transition-transform" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

