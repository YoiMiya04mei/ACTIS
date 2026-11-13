import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format") || "json"; // "json" | "csv"

  try {
    const items = await prisma.inventoryItem.findMany({
      include: {
        category: true,
        stock: true,
      },
      orderBy: { code: "asc" },
    });

    if (format === "csv") {
      const headers = [
        "Kode Barang",
        "Nama Barang",
        "Kategori",
        "Jenis",
        "Merek",
        "Model",
        "Serial Number",
        "Satuan",
        "Stok Tersedia",
        "Stok Minimum",
        "Sedang Digunakan",
        "Lokasi Penyimpanan",
        "Status",
      ];

      const rows = items.map((it) => [
        `"${it.code}"`,
        `"${it.name.replace(/"/g, '""')}"`,
        `"${it.category.name.replace(/"/g, '""')}"`,
        `"${it.type}"`,
        `"${(it.brand || "").replace(/"/g, '""')}"`,
        `"${(it.model || "").replace(/"/g, '""')}"`,
        `"${(it.serial_number || "").replace(/"/g, '""')}"`,
        `"${it.unit}"`,
        it.stock ? it.stock.available_stock.toString() : "0",
        it.min_stock.toString(),
        it.stock ? it.stock.total_in_use.toString() : "0",
        `"${(it.storage_location || "").replace(/"/g, '""')}"`,
        it.is_active ? "Aktif" : "Nonaktif",
      ]);

      const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");

      return new NextResponse(csvContent, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="inventory-items-${Date.now()}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: items,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal mengekspor data barang." },
      { status: 500 }
    );
  }
}

