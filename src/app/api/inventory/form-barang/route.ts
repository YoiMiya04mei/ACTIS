import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/security";
import { getInventoryPermissions } from "@/lib/inventoryAuth";
import { prisma } from "@/lib/prisma";
import { formatWorkTypeLabel } from "@/lib/inventoryRequest";
import {
  buildFormBarangDataFromOutTransaction,
  buildFormBarangDataFromRequest,
  type FormBarangSourceListItem,
} from "@/lib/inventoryFormBarang";

const OUT_TX_DETAIL_INCLUDE = {
  approved_requests: {
    orderBy: { created_at: "asc" as const },
    select: {
      id: true,
      request_number: true,
      pic_name: true,
      pic_phone: true,
      request_date: true,
      work_types: true,
      work_type_other: true,
      pickup_location: true,
      notes: true,
      status: true,
      approved_by_name: true,
      approved_at: true,
    },
  },
  details: {
    orderBy: { id: "asc" as const },
    include: {
      item: {
        select: {
          id: true,
          code: true,
          name: true,
          unit: true,
          storage_location: true,
          category: { select: { name: true } },
        },
      },
    },
  },
  client_usages: {
    orderBy: { created_at: "asc" as const },
    include: {
      items: {
        include: {
          item: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
            },
          },
        },
      },
    },
  },
  returns: {
    orderBy: { return_date: "asc" as const },
    include: {
      details: {
        include: {
          item: {
            select: {
              id: true,
              code: true,
              name: true,
              unit: true,
            },
          },
        },
      },
    },
  },
} satisfies Prisma.InventoryTransactionInclude;

function parseBoolParam(val: string | null, defaultValue = false): boolean {
  if (val === null) return defaultValue;
  const norm = val.trim().toLowerCase();
  if (norm === "true" || norm === "1" || norm === "yes") return true;
  if (norm === "false" || norm === "0" || norm === "no") return false;
  return defaultValue;
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (!auth.ok) return auth.response;

  const permissions = getInventoryPermissions(auth.user);
  if (!permissions.canView) {
    return NextResponse.json(
      { success: false, error: "Akses ditolak." },
      { status: 403 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const txIdParam = searchParams.get("tx_id")?.trim();
    const requestIdParam = searchParams.get("request_id")?.trim();
    const idParam = searchParams.get("id")?.trim();
    const sourceTypeParam = searchParams.get("sourceType")?.trim();

    const includeSerialNumbers = parseBoolParam(searchParams.get("includeSerials"), false);
    const includePendingRemaining = parseBoolParam(
      searchParams.get("includePendingRemaining"),
      false
    );
    const prefillPenerimaName = parseBoolParam(
      searchParams.get("prefillPenerima"),
      true
    );

    const options = {
      includeSerialNumbers,
      includePendingRemaining,
      prefillPenerimaName,
    };

    const targetTxId =
      txIdParam || (sourceTypeParam === "transaction" && idParam ? idParam : "");
    const targetReqId =
      requestIdParam || (sourceTypeParam === "request" && idParam ? idParam : "");

    if (targetTxId) {
      const tx = await prisma.inventoryTransaction.findFirst({
        where: { id: targetTxId, type: "OUT" },
        include: OUT_TX_DETAIL_INCLUDE,
      });

      if (!tx) {
        return NextResponse.json(
          { success: false, error: "Transaksi Barang Keluar tidak ditemukan." },
          { status: 404 }
        );
      }

      const document = buildFormBarangDataFromOutTransaction(tx, options);
      return NextResponse.json(
        { success: true, data: document },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    if (targetReqId) {
      const reqRecord = await prisma.inventoryRequest.findUnique({
        where: { id: targetReqId },
        include: {
          items: {
            include: {
              item: {
                select: { id: true, code: true, name: true, unit: true, storage_location: true },
              },
            },
          },
        },
      });

      if (!reqRecord) {
        return NextResponse.json(
          { success: false, error: "Data Request Barang tidak ditemukan." },
          { status: 404 }
        );
      }

      if (reqRecord.out_transaction_id) {
        const linkedTx = await prisma.inventoryTransaction.findFirst({
          where: { id: reqRecord.out_transaction_id, type: "OUT" },
          include: OUT_TX_DETAIL_INCLUDE,
        });
        if (linkedTx) {
          const document = buildFormBarangDataFromOutTransaction(linkedTx, options);
          return NextResponse.json(
            { success: true, data: document },
            { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
          );
        }
      }

      const document = buildFormBarangDataFromRequest(reqRecord, options);
      return NextResponse.json(
        { success: true, data: document },
        { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
      );
    }

    // List mode for searchable flow selector
    const search = searchParams.get("search")?.trim() || "";
    const statusFilter = searchParams.get("status")?.trim().toUpperCase() || "ALL";
    const limit = Math.max(
      1,
      Math.min(100, parseInt(searchParams.get("limit") || "50", 10) || 50)
    );

    const includeTransactions = statusFilter !== "REQUEST_PENDING";
    const includeRequests = statusFilter === "ALL" || statusFilter === "REQUEST_PENDING";

    const txWhere: Prisma.InventoryTransactionWhereInput = { type: "OUT" };
    if (statusFilter !== "ALL" && statusFilter !== "REQUEST_PENDING") {
      txWhere.status = statusFilter;
    }
    if (search) {
      txWhere.OR = [
        { transaction_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { location: { contains: search, mode: "insensitive" } },
        { purpose: { contains: search, mode: "insensitive" } },
        {
          approved_requests: {
            some: {
              OR: [
                { request_number: { contains: search, mode: "insensitive" } },
                { pickup_location: { contains: search, mode: "insensitive" } },
              ],
            },
          },
        },
        {
          returns: {
            some: { return_number: { contains: search, mode: "insensitive" } },
          },
        },
        {
          client_usages: {
            some: { client_name: { contains: search, mode: "insensitive" } },
          },
        },
      ];
    }

    const reqWhere: Prisma.InventoryRequestWhereInput = {
      out_transaction_id: null,
      status: statusFilter === "REQUEST_PENDING" ? "PENDING" : { in: ["PENDING", "REJECTED"] },
    };
    if (search) {
      reqWhere.OR = [
        { request_number: { contains: search, mode: "insensitive" } },
        { pic_name: { contains: search, mode: "insensitive" } },
        { pickup_location: { contains: search, mode: "insensitive" } },
      ];
    }

    const [txList, reqList] = await Promise.all([
      includeTransactions
        ? prisma.inventoryTransaction.findMany({
            where: txWhere,
            take: limit,
            orderBy: { transaction_date: "desc" },
            include: OUT_TX_DETAIL_INCLUDE,
          })
        : Promise.resolve([]),
      includeRequests
        ? prisma.inventoryRequest.findMany({
            where: reqWhere,
            take: Math.min(limit, 30),
            orderBy: { created_at: "desc" },
            include: {
              items: {
                select: { id: true, quantity: true },
              },
            },
          })
        : Promise.resolve([]),
    ]);

    const items: FormBarangSourceListItem[] = [];

    for (const tx of txList) {
      const mapped = buildFormBarangDataFromOutTransaction(tx, {
        includeSerialNumbers: false,
        includePendingRemaining: false,
      });
      const req = tx.approved_requests?.[0] || null;
      items.push({
        sourceType: "transaction",
        id: tx.id,
        request_id: req?.id || null,
        out_transaction_id: tx.id,
        request_number: req?.request_number || null,
        request_status: req?.status || null,
        transaction_number: tx.transaction_number,
        transaction_status: tx.status,
        pic_name: mapped.requestInfo.namaTim || tx.pic_name || "-",
        location: mapped.requestInfo.lokasiPengembalian || tx.location || "-",
        date_iso: tx.transaction_date.toISOString(),
        work_type_label:
          req
            ? formatWorkTypeLabel(req.work_types, req.work_type_other)
            : mapped.requestInfo.workTypes.join(", ") || tx.purpose || "-",
        items_count: mapped.barangKeluar.length,
        used_count: mapped.barangTerpakai.length,
        returns_count: mapped.barangKembali.length,
        total_out_qty: mapped.summary.totalOutQty,
        total_used_qty: mapped.summary.totalUsedQty,
        total_returned_qty: mapped.summary.totalReturnedQty,
        total_remaining_qty: mapped.summary.totalRemainingQty,
      });
    }

    for (const req of reqList) {
      items.push({
        sourceType: "request",
        id: req.id,
        request_id: req.id,
        out_transaction_id: null,
        request_number: req.request_number,
        request_status: req.status,
        transaction_number: null,
        transaction_status: null,
        pic_name: req.pic_name,
        location: req.pickup_location,
        date_iso: req.request_date.toISOString(),
        work_type_label: formatWorkTypeLabel(req.work_types, req.work_type_other),
        items_count: req.items.length,
        used_count: 0,
        returns_count: 0,
        total_out_qty: 0,
        total_used_qty: 0,
        total_returned_qty: 0,
        total_remaining_qty: 0,
      });
    }

    items.sort((a, b) => new Date(b.date_iso).getTime() - new Date(a.date_iso).getTime());

    return NextResponse.json(
      { success: true, data: items.slice(0, limit) },
      { status: 200, headers: { "Cache-Control": "no-store, max-age=0" } }
    );
  } catch (error: any) {
    console.error("Error in GET /api/inventory/form-barang:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "Gagal memuat data Form Barang." },
      { status: 500 }
    );
  }
}
