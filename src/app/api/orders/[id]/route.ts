import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateNocCoordinationText } from "@/lib/ticketUtils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const order = await prisma.popSiteOrder.findUnique({
      where: { id },
      include: {
        creator: {
          select: { id: true, nama: true, email: true, role: true },
        },
        test_results: {
          orderBy: { uploaded_at: "desc" },
          include: {
            uploader: { select: { id: true, nama: true, role: true } },
          },
        },
        progress_logs: {
          orderBy: { created_at: "asc" }, // chronological order for timeline feed
          include: {
            user: { select: { id: true, nama: true, role: true, email: true } },
          },
        },
      },
    });

    if (!order) {
      return NextResponse.json(
        { success: false, error: "Order tiket tidak ditemukan." },
        { status: 404 }
      );
    }

    const configDispatchText = generateNocCoordinationText(order);

    return NextResponse.json({
      success: true,
      data: order,
      config_dispatch_text: configDispatchText,
    });
  } catch (err: any) {
    console.error("GET /api/orders/[id] error:", err);
    return NextResponse.json(
      { success: false, error: err.message || "Failed to load order" },
      { status: 500 }
    );
  }
}

