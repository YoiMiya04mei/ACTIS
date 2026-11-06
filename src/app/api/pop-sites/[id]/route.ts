import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const site = await prisma.popSite.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: { created_at: "desc" },
          include: {
            creator: { select: { id: true, nama: true, role: true } },
            test_results: true,
            progress_logs: {
              orderBy: { created_at: "asc" },
              include: { user: { select: { id: true, nama: true, role: true } } },
            },
          },
        },
      },
    });

    if (!site) {
      return NextResponse.json(
        { success: false, error: "POP Site tidak ditemukan" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: site });
  } catch (err: any) {
    console.error("GET /api/pop-sites/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load POP site" },
      { status: 500 }
    );
  }
}

