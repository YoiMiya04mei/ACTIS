import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/security";
import { prisma } from "@/lib/prisma";
import { getInventoryPermissions } from "@/lib/inventoryAuth";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const categories = await prisma.inventoryCategory.findMany({
      include: {
        _count: {
          select: { items: true },
        },
      },
      orderBy: { name: "asc" },
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

