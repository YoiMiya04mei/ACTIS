"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KategoriBarangPage() {
  const router = useRouter();

  useEffect(() => {
    // Menu Kategori Barang dialihkan langsung ke Master Barang (Kategori: Aktif & Pasif)
    router.replace("/inventory/items");
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-3">
        <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm font-semibold text-slate-500">
          Mengalihkan ke Master Barang...
        </p>
      </div>
    </div>
  );
}
