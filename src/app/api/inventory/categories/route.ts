import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    // Pastikan kategori baku "Aktif" dan "Pasif" selalu tersedia
    const catAktif = await prisma.inventoryCategory.upsert({
      where: { name: "Aktif" },
      update: {},
      create: {
        name: "Aktif",
        description: "Perangkat Aktif (Elektronik / Bertenaga Listrik seperti Router, Switch, OLT, ONT/Modem, SFP, Server, dsb)",
      },
    });

    const catPasif = await prisma.inventoryCategory.upsert({
      where: { name: "Pasif" },
      update: {},
      create: {
        name: "Pasif",
        description: "Perangkat / Material Pasif (Non-Elektronik seperti Kabel Fiber Optik, Drop Core, Patch Cord, OTB, Splitter, Closure, dsb)",
      },
    });

    // Migrasikan item lama yang masih menggunakan kategori selain Aktif/Pasif
    const legacyCategories = await prisma.inventoryCategory.findMany({
      where: {
        name: { notIn: ["Aktif", "Pasif"] },
      },
      include: {
        items: true,
      },
    });

    for (const legacy of legacyCategories) {
      if (legacy.items.length > 0) {
        const isPassive = /kabel|cable|fiber|drop|patch|otb|closure|splitter|material|baut|konektor|roset|pasif|passive/i.test(legacy.name);
        const targetCategory = isPassive ? catPasif : catAktif;
        await prisma.inventoryItem.updateMany({
          where: { category_id: legacy.id },
          data: { category_id: targetCategory.id },
        });
      }
    }

    // Ambil data kategori resmi (Aktif & Pasif) beserta jumlah itemnya
    const categories = await prisma.inventoryCategory.findMany({
      where: {
        name: { in: ["Aktif", "Pasif"] },
      },
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: "asc" }, // Aktif, Pasif
    });

    return NextResponse.json({
      success: true,
      data: categories,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal memuat kategori barang." },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canManageMaster) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak: Hanya Admin/Warehouse Admin yang dapat mengelola kategori." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || null;

    if (!name) {
      return NextResponse.json(
        { success: false, error: "Nama kategori wajib diisi." },
        { status: 400 }
      );
    }

    const existing = await prisma.inventoryCategory.findUnique({
      where: { name },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: `Kategori '${name}' sudah ada.` },
        { status: 400 }
      );
    }

    const category = await prisma.inventoryCategory.create({
      data: {
        name,
        description,
      },
    });

    return NextResponse.json({
      success: true,
      data: category,
      message: "Kategori berhasil ditambahkan.",
    }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || "Gagal membuat kategori barang." },
      { status: 500 }
    );
  }
}

