import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";
import {
  FinishClientPayload,
  computeRemainingSerialsForDetail,
  parseSerialList,
  validateFinishClientAllocations,
} from "./inventoryClientFinish";
import {
  buildStockInHistoryOnlyDeletePlan,
  computeNextTransactionSequence,
  computeStockOutDeleteReversal,
} from "./inventoryTransactionDelete";
import {
  formatWorkTypeLabel,
  parseWorkTypes,
  validatePublicInventoryRequestInput,
} from "./inventoryRequest";

// Format date as YYYYMMDD
export function getDateString(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Generate sequential transaction number e.g. OUT-20261113-0001
 */
export async function generateTransactionNumber(
  type: "IN" | "OUT" | "ADJ" | "OPN",
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const dateStr = getDateString();
  const prefix = `${type}-${dateStr}-`;

  const existing = await client.inventoryTransaction.findMany({
    where: {
      transaction_number: {
        startsWith: prefix,
      },
    },
    select: {
      transaction_number: true,
    },
  });

  return computeNextTransactionSequence(
    prefix,
    existing.map((row) => row.transaction_number)
  );
}

/**
 * Generate sequential return number e.g. RET-20261113-0001
 */
export async function generateReturnNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const dateStr = getDateString();
  const prefix = `RET-${dateStr}-`;

  const existing = await client.inventoryReturn.findMany({
    where: {
      return_number: {
        startsWith: prefix,
      },
    },
    select: {
      return_number: true,
    },
  });

  return computeNextTransactionSequence(
    prefix,
    existing.map((row) => row.return_number)
  );
}

/**
 * Generate sequential public request number e.g. REQ-20261116-0001
 */
export async function generateRequestNumber(
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const dateStr = getDateString();
  const prefix = `REQ-${dateStr}-`;

  const latest = await client.inventoryRequest.findFirst({
    where: {
      request_number: {
        startsWith: prefix,
      },
    },
    orderBy: {
      request_number: "desc",
    },
    select: {
      request_number: true,
    },
  });

  const lastSeq = latest?.request_number
    ? Number.parseInt(latest.request_number.slice(prefix.length), 10) || 0
    : 0;
  const nextSeq = String(lastSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

/**
 * Extract 3 uppercase consonant letters from Item Name (e.g. ROUTERBOARD -> RTR, MODEM -> MDM)
 */
export function extractConsonantsCode(name: string): string {
  if (!name || !name.trim()) return "ITM";

  // Ambil huruf konsonan alfabet (B, C, D, F, G, H, J, K, L, M, N, P, Q, R, S, T, V, W, X, Y, Z)
  const consonants = name.toUpperCase().replace(/[^BCDFGHJKLMNPQRSTVWXYZ]/g, "");

  if (consonants.length >= 3) {
    return consonants.slice(0, 3);
  }

  // Jika konsonan kurang dari 3, tambahkan huruf alfabet lain dari nama dan pad dengan X jika perlu
  const allLetters = name.toUpperCase().replace(/[^A-Z]/g, "");
  const combined = consonants + allLetters + "XXX";
  return combined.slice(0, 3);
}

/**
 * Generate sequential item code based on 3 consonant letters of item name followed by sequence ID (e.g. RTR-0001, MDM-0001)
 */
export async function generateItemCode(
  nameOrCode = "ITM",
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const prefix3 = extractConsonantsCode(nameOrCode);
  const prefix = `${prefix3}-`;

  const items = await client.inventoryItem.findMany({
    where: {
      code: {
        startsWith: prefix,
      },
    },
    select: {
      code: true,
    },
  });

  let maxSeq = 0;
  for (const it of items) {
    const numPart = it.code.substring(prefix.length);
    const parsed = parseInt(numPart, 10);
    if (!isNaN(parsed) && parsed > maxSeq) {
      maxSeq = parsed;
    }
  }

  const nextSeq = String(maxSeq + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
}

// ============================================================================
// TRANSACTION OPERATIONS (ATOMIC & CONCURRENCY-SAFE)
// ============================================================================

export interface StockInItemInput {
  item_id: string;
  quantity: number | string;
  unit?: string;
  serial_numbers?: string[];
  notes?: string;
}

export interface StockInPayload {
  transaction_date?: Date | string;
  warehouse_officer: string;
  notes?: string;
  permit_id?: string;
  permit_number?: string;
  items: StockInItemInput[];
  created_by?: string;
  user_name?: string;
}

/**
 * Stock In: Adds stock to inventory
 */
export async function processStockIn(payload: StockInPayload) {
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Daftar barang masuk tidak boleh kosong.");
  }

  return await prisma.$transaction(async (tx) => {
    const txNumber = await generateTransactionNumber("IN", tx);
    const txDate = payload.transaction_date ? new Date(payload.transaction_date) : new Date();

    const transaction = await tx.inventoryTransaction.create({
      data: {
        transaction_number: txNumber,
        type: "IN",
        transaction_date: txDate,
        warehouse_officer: payload.warehouse_officer,
        status: "COMPLETED",
        notes: payload.notes || null,
        permit_id: payload.permit_id || null,
        permit_number: payload.permit_number || null,
        created_by: payload.created_by || null,
      },
    });

    const allTxSerialNumbers = new Set<string>();

    for (const itemInput of payload.items) {
      const qtyNum = new Prisma.Decimal(itemInput.quantity);
      if (qtyNum.lessThanOrEqualTo(0)) {
        throw new Error(`Kuantitas barang harus lebih besar dari 0.`);
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: itemInput.item_id },
        include: { stock: true, category: true },
      });

      if (!item || !item.is_active) {
        throw new Error(
          !item
            ? `Barang dengan ID ${itemInput.item_id} tidak ditemukan di Master Barang.`
            : `Barang '${item.name}' (${item.code}) sudah dihapus atau dinonaktifkan di Master Barang.`
        );
      }

      const isAktif = item.category?.name?.toLowerCase() === "aktif";
      const isPasif = item.category?.name?.toLowerCase() === "pasif";

      // 1. Validasi bisnis kategori Pasif: tidak bisa/tidak perlu serial number
      if (isPasif) {
        itemInput.serial_numbers = [];
      }

      // 2. Validasi bisnis kategori Aktif: serial number wajib diisi tepat sesuai kuantitas
      if (isAktif) {
        const rawSns = itemInput.serial_numbers || [];
        const cleanSns = rawSns.map((s) => s.trim()).filter(Boolean);
        const expectedCount = Number(qtyNum);

        if (cleanSns.length !== expectedCount) {
          throw new Error(
            `Barang aktif '${item.name}' kuantitas ${expectedCount} wajib menyertakan ${expectedCount} Serial Number (terisi: ${cleanSns.length}).`
          );
        }

        const snSet = new Set(cleanSns);
        if (snSet.size !== cleanSns.length) {
          throw new Error(
            `Terdapat Serial Number duplikat pada input barang aktif '${item.name}'. Setiap unit wajib memiliki SN unik.`
          );
        }

        // Cek duplikasi antar baris dalam transaksi yang sama
        for (const sn of cleanSns) {
          if (allTxSerialNumbers.has(sn)) {
            throw new Error(
              `Serial Number '${sn}' dimasukkan lebih dari satu kali dalam transaksi barang masuk ini.`
            );
          }
          allTxSerialNumbers.add(sn);
        }

        itemInput.serial_numbers = cleanSns;
      }

      // Ensure stock record exists
      let stock = item.stock;
      if (!stock) {
        stock = await tx.inventoryStock.create({
          data: {
            item_id: item.id,
            available_stock: new Prisma.Decimal(0),
          },
        });
      }

      const balanceBefore = new Prisma.Decimal(stock.available_stock);
      const balanceAfter = balanceBefore.add(qtyNum);

      // Update Stock
      await tx.inventoryStock.update({
        where: { id: stock.id },
        data: {
          total_in: new Prisma.Decimal(stock.total_in).add(qtyNum),
          available_stock: balanceAfter,
        },
      });

      // Create Transaction Detail
      await tx.inventoryTransactionDetail.create({
        data: {
          transaction_id: transaction.id,
          item_id: item.id,
          quantity: qtyNum,
          unit: itemInput.unit || item.unit,
          unit_serial_numbers: itemInput.serial_numbers?.length
            ? JSON.stringify(itemInput.serial_numbers)
            : null,
          qty_returned: new Prisma.Decimal(0),
          qty_remaining: new Prisma.Decimal(0),
          status: "COMPLETED",
          notes: itemInput.notes || null,
        },
      });

      // 3. Masukkan serial number otomatis ke stock inventory (inventoryItemUnit)
      if (itemInput.serial_numbers && itemInput.serial_numbers.length > 0) {
        for (const sn of itemInput.serial_numbers) {
          const trimmedSn = sn.trim();
          if (!trimmedSn) continue;

          const existingUnit = await tx.inventoryItemUnit.findUnique({
            where: { serial_number: trimmedSn },
          });

          if (existingUnit && existingUnit.status === "AVAILABLE") {
            throw new Error(
              `Serial Number '${trimmedSn}' sudah terdaftar dan saat ini berstatus TERSEDIA di stok gudang.`
            );
          }
          if (existingUnit && existingUnit.status === "IN_USE") {
            throw new Error(
              `Serial Number '${trimmedSn}' sedang berstatus DIGUNAKAN (${existingUnit.current_pic || "teknisi"}). Harap gunakan alur Pengembalian Barang terlebih dahulu.`
            );
          }

          await tx.inventoryItemUnit.upsert({
            where: { serial_number: trimmedSn },
            create: {
              item_id: item.id,
              serial_number: trimmedSn,
              status: "AVAILABLE",
              condition: "BAIK",
              current_location: item.storage_location || "Gudang Utama",
            },
            update: {
              item_id: item.id,
              status: "AVAILABLE",
              condition: "BAIK",
              current_pic: null,
              current_location: item.storage_location || "Gudang Utama",
            },
          });
        }
      }

      // Append Movement
      await tx.inventoryMovement.create({
        data: {
          item_id: item.id,
          movement_type: "IN",
          quantity: qtyNum,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: "TRANSACTION",
          reference_id: transaction.id,
          transaction_id: transaction.id,
          performed_by: payload.user_name || payload.warehouse_officer || "Admin Gudang",
          notes: `Barang Masuk (${txNumber})`,
        },
      });
    }

    // Append Audit Log
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: transaction.id,
        action: "CREATE",
        user_id: payload.created_by,
        user_name: payload.user_name || payload.warehouse_officer || "Admin Gudang",
        data_after: JSON.stringify(transaction),
        reason: `Pencatatan Barang Masuk ${txNumber}`,
      },
    });

    return transaction;
  });
}

export interface StockOutItemInput {
  item_id: string;
  quantity: number | string;
  unit?: string;
  serial_numbers?: string[];
  notes?: string;
}

export interface StockOutPayload {
  transaction_date?: Date | string;
  pic_name: string;
  pic_phone?: string;
  department?: string;
  location?: string;
  purpose?: string;
  warehouse_officer: string;
  notes?: string;
  permit_id?: string;
  permit_number?: string;
  request_id?: string;
  items: StockOutItemInput[];
  created_by?: string;
  user_name?: string;
}

/**
 * Stock Out: Issues stock out of warehouse.
 * Validates available stock atomically.
 * All issued inventory items enter tracking cleanly via Barang Sedang Digunakan.
 */
export async function processStockOut(payload: StockOutPayload) {
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Daftar barang keluar tidak boleh kosong.");
  }
  if (!payload.pic_name?.trim()) {
    throw new Error("Nama PIC wajib diisi untuk transaksi barang keluar.");
  }
  if (!payload.warehouse_officer?.trim()) {
    throw new Error("Nama petugas gudang wajib diisi.");
  }

  return await prisma.$transaction(async (tx) => {
    let linkedRequestNumber: string | null = null;
    const reqId = payload.request_id?.trim() || "";
    if (reqId) {
      const existingReq = await tx.inventoryRequest.findUnique({
        where: { id: reqId },
        select: { id: true, request_number: true, status: true },
      });
      if (!existingReq) {
        throw new Error("Data request barang tidak ditemukan.");
      }
      if (existingReq.status !== "PENDING") {
        throw new Error(
          `Request ${existingReq.request_number} tidak dapat di-ACC karena statusnya sudah '${existingReq.status}'.`
        );
      }
      linkedRequestNumber = existingReq.request_number;
    }

    const txNumber = await generateTransactionNumber("OUT", tx);
    const txDate = payload.transaction_date ? new Date(payload.transaction_date) : new Date();

    // Determine initial master status (if any item is REUSABLE, status is SEDANG_DIGUNAKAN)
    const transaction = await tx.inventoryTransaction.create({
      data: {
        transaction_number: txNumber,
        type: "OUT",
        transaction_date: txDate,
        pic_name: payload.pic_name.trim(),
        pic_phone: payload.pic_phone?.trim() || null,
        department: payload.department?.trim() || null,
        location: payload.location?.trim() || null,
        purpose: payload.purpose?.trim() || null,
        warehouse_officer: payload.warehouse_officer.trim(),
        status: "SEDANG_DIGUNAKAN",
        notes: payload.notes || null,
        permit_id: payload.permit_id || null,
        permit_number: payload.permit_number || null,
        created_by: payload.created_by || null,
      },
    });

    for (const itemInput of payload.items) {
      const qtyNum = new Prisma.Decimal(itemInput.quantity);
      if (qtyNum.lessThanOrEqualTo(0)) {
        throw new Error(`Kuantitas barang harus lebih besar dari 0.`);
      }

      // Check current stock atomically with row-level lock or select inside tx
      const item = await tx.inventoryItem.findUnique({
        where: { id: itemInput.item_id },
        include: { stock: true, category: true },
      });

      if (!item || !item.is_active) {
        throw new Error(
          !item
            ? `Barang dengan ID ${itemInput.item_id} tidak ditemukan di Master Barang.`
            : `Barang '${item.name}' (${item.code}) sudah dihapus atau dinonaktifkan di Master Barang.`
        );
      }

      const stock = item.stock;
      const currentAvailable = stock ? new Prisma.Decimal(stock.available_stock) : new Prisma.Decimal(0);

      // Strict stock sufficiency check (Prevents overselling / negative stock)
      if (currentAvailable.lessThan(qtyNum)) {
        throw new Error(
          `Stok tidak mencukupi untuk '${item.name}' (${item.code}). Tersedia: ${currentAvailable.toString()} ${item.unit}, diminta: ${qtyNum.toString()} ${item.unit}.`
        );
      }

      const balanceBefore = currentAvailable;
      const balanceAfter = balanceBefore.minus(qtyNum);
      const isAktif = item.category?.name?.toLowerCase() === "aktif";
      const isPasif = item.category?.name?.toLowerCase() === "pasif";

      // Validasi Serial Number untuk Barang Kategori Aktif
      if (isAktif) {
        const sns = (itemInput.serial_numbers || []).map((s) => String(s).trim()).filter(Boolean);
        if (sns.length !== qtyNum.toNumber()) {
          throw new Error(
            `Barang '${item.name}' berkategori Aktif dengan kuantitas ${qtyNum.toString()} wajib memilih tepat ${qtyNum.toString()} Serial Number (terpilih: ${sns.length}).`
          );
        }
        const snSet = new Set(sns);
        if (snSet.size !== sns.length) {
          throw new Error(`Terdapat Serial Number duplikat untuk barang '${item.name}'.`);
        }
      }

      // Unified reusable stock accounting: increases total_out and total_in_use, reduces available_stock
      await tx.inventoryStock.update({
        where: { id: stock!.id },
        data: {
          total_out: new Prisma.Decimal(stock!.total_out).add(qtyNum),
          total_in_use: new Prisma.Decimal(stock!.total_in_use).add(qtyNum),
          available_stock: balanceAfter,
        },
      });

      const serialNumbersToRecord = isPasif
        ? []
        : (itemInput.serial_numbers || []).map((s) => String(s).trim()).filter(Boolean);

      await tx.inventoryTransactionDetail.create({
        data: {
          transaction_id: transaction.id,
          item_id: item.id,
          quantity: qtyNum,
          unit: itemInput.unit || item.unit,
          unit_serial_numbers: serialNumbersToRecord.length
            ? JSON.stringify(serialNumbersToRecord)
            : null,
          qty_returned: new Prisma.Decimal(0),
          qty_remaining: qtyNum,
          status: "ACTIVE",
          notes: itemInput.notes || null,
        },
      });

      // Update unit serial numbers if applicable
      if (serialNumbersToRecord.length) {
        for (const sn of serialNumbersToRecord) {
          const trimmedSn = sn.trim();
          if (!trimmedSn) continue;

          await tx.inventoryItemUnit.upsert({
            where: { serial_number: trimmedSn },
            create: {
              item_id: item.id,
              serial_number: trimmedSn,
              status: "IN_USE",
              condition: "BAIK",
              current_pic: payload.pic_name,
              current_location: payload.location || `Digunakan oleh ${payload.pic_name}`,
            },
            update: {
              status: "IN_USE",
              current_pic: payload.pic_name,
              current_location: payload.location || `Digunakan oleh ${payload.pic_name}`,
            },
          });
        }
      }

      // Movement record
      await tx.inventoryMovement.create({
        data: {
          item_id: item.id,
          movement_type: "OUT",
          quantity: qtyNum.negated(),
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: "TRANSACTION",
          reference_id: transaction.id,
          transaction_id: transaction.id,
          performed_by: payload.user_name || payload.warehouse_officer || "Admin Gudang",
          notes: `Barang Keluar (${txNumber}) kepada ${payload.pic_name}`,
        },
      });
    }

    // Append Audit Log
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: transaction.id,
        action: "CREATE",
        user_id: payload.created_by,
        user_name: payload.user_name || payload.warehouse_officer || "Admin Gudang",
        data_after: JSON.stringify(transaction),
        reason: linkedRequestNumber
          ? `Pencatatan Barang Keluar ${txNumber} (ACC Request ${linkedRequestNumber})`
          : `Pencatatan Barang Keluar ${txNumber}`,
      },
    });

    if (reqId) {
      const approverName =
        payload.user_name || payload.warehouse_officer || "Admin Gudang";
      const claimResult = await tx.inventoryRequest.updateMany({
        where: { id: reqId, status: "PENDING" },
        data: {
          status: "APPROVED",
          out_transaction_id: transaction.id,
          approved_by: payload.created_by || null,
          approved_by_name: approverName,
          approved_at: new Date(),
        },
      });

      if (claimResult.count !== 1) {
        throw new Error(
          `Request ${linkedRequestNumber || reqId} sudah diproses sebelumnya oleh petugas lain.`
        );
      }

      await tx.inventoryAuditLog.create({
        data: {
          entity_type: "REQUEST",
          entity_id: reqId,
          action: "APPROVE",
          user_id: payload.created_by || null,
          user_name: approverName,
          data_after: JSON.stringify({
            request_number: linkedRequestNumber,
            status: "APPROVED",
            out_transaction_id: transaction.id,
            transaction_number: txNumber,
          }),
          reason: `ACC Request Barang ${linkedRequestNumber || reqId} menjadi ${txNumber}`,
        },
      });
    }

    return transaction;
  });
}

export interface ReturnDetailInput {
  transaction_detail_id: string;
  quantity: number | string;
  condition: "BAIK" | "RUSAK_RINGAN" | "RUSAK_BERAT" | "HILANG";
  serial_numbers?: string[];
  action_taken?: string;
  notes?: string;
}

export interface ReturnPayload {
  out_transaction_id: string;
  return_date?: Date | string;
  pic_name: string;
  recipient_officer: string;
  notes?: string;
  details: ReturnDetailInput[];
  created_by?: string;
  user_name?: string;
}

/**
 * Process Return of Inventory Items
 * Supports partial and full returns.
 * Validates condition (only BAIK goes back to available_stock).
 */
export async function processReturn(payload: ReturnPayload) {
  if (!payload.details || payload.details.length === 0) {
    throw new Error("Daftar barang yang dikembalikan tidak boleh kosong.");
  }
  if (!payload.pic_name?.trim()) {
    throw new Error("Nama PIC pengembali wajib diisi.");
  }
  if (!payload.recipient_officer?.trim()) {
    throw new Error("Nama petugas penerima gudang wajib diisi.");
  }

  return await prisma.$transaction(async (tx) => {
    const outTx = await tx.inventoryTransaction.findUnique({
      where: { id: payload.out_transaction_id },
      include: {
        details: {
          include: { item: { include: { stock: true } } },
        },
      },
    });

    if (!outTx) {
      throw new Error(`Transaksi barang keluar dengan ID ${payload.out_transaction_id} tidak ditemukan.`);
    }

    const returnNumber = await generateReturnNumber(tx);
    const returnDate = payload.return_date ? new Date(payload.return_date) : new Date();

    const returnTx = await tx.inventoryReturn.create({
      data: {
        return_number: returnNumber,
        out_transaction_id: outTx.id,
        pic_name: payload.pic_name.trim(),
        recipient_officer: payload.recipient_officer.trim(),
        return_date: returnDate,
        notes: payload.notes || null,
        created_by: payload.created_by || null,
      },
    });

    for (const returnInput of payload.details) {
      const returnQty = new Prisma.Decimal(returnInput.quantity);
      if (returnQty.lessThanOrEqualTo(0)) {
        throw new Error(`Jumlah pengembalian harus lebih besar dari 0.`);
      }

      const txDetail = outTx.details.find((d) => d.id === returnInput.transaction_detail_id);
      if (!txDetail) {
        throw new Error(`Detail transaksi barang dengan ID ${returnInput.transaction_detail_id} tidak ditemukan.`);
      }

      const item = txDetail.item;

      // RULE 1: Jumlah kembali tidak boleh melebihi sisa barang yang masih keluar!
      const currentRemaining = new Prisma.Decimal(txDetail.qty_remaining);
      if (returnQty.greaterThan(currentRemaining)) {
        throw new Error(
          `Jumlah pengembalian (${returnQty.toString()}) melebihi sisa barang yang masih keluar (${currentRemaining.toString()}) untuk '${item.name}'.`
        );
      }

      const stock = item.stock;
      if (!stock) {
        throw new Error(`Data stok untuk barang '${item.name}' tidak ditemukan.`);
      }

      const balanceBefore = new Prisma.Decimal(stock.available_stock);
      let balanceAfter = balanceBefore;

      const isGoodCondition = returnInput.condition === "BAIK";
      const isDamaged = returnInput.condition === "RUSAK_RINGAN" || returnInput.condition === "RUSAK_BERAT";
      const isLost = returnInput.condition === "HILANG";

      // Stock adjustment according to condition:
      if (isGoodCondition) {
        // Condition BAIK: enters available_stock
        balanceAfter = balanceBefore.add(returnQty);
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            total_returned: new Prisma.Decimal(stock.total_returned).add(returnQty),
            total_in_use: new Prisma.Decimal(stock.total_in_use).minus(returnQty),
            available_stock: balanceAfter,
          },
        });
      } else if (isDamaged) {
        // Damaged: does NOT enter available stock. Logged to total_damaged.
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            total_damaged: new Prisma.Decimal(stock.total_damaged).add(returnQty),
            total_in_use: new Prisma.Decimal(stock.total_in_use).minus(returnQty),
          },
        });
      } else if (isLost) {
        // Lost: does NOT enter available stock. Logged to total_lost.
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            total_lost: new Prisma.Decimal(stock.total_lost).add(returnQty),
            total_in_use: new Prisma.Decimal(stock.total_in_use).minus(returnQty),
          },
        });
      }

      // Update Transaction Detail qty_returned and qty_remaining
      const updatedReturned = new Prisma.Decimal(txDetail.qty_returned).add(returnQty);
      const updatedRemaining = currentRemaining.minus(returnQty);
      const newDetailStatus = updatedRemaining.isZero() ? "FULLY_RETURNED" : "PARTIAL_RETURN";

      await tx.inventoryTransactionDetail.update({
        where: { id: txDetail.id },
        data: {
          qty_returned: updatedReturned,
          qty_remaining: updatedRemaining,
          status: newDetailStatus,
        },
      });

      // Include existing client_usages & returns when resolving serials automatically
      let serialsToUpdate = (returnInput.serial_numbers || [])
        .map((s) => s.trim())
        .filter(Boolean);

      if (serialsToUpdate.length === 0 && updatedRemaining.isZero() && txDetail.unit_serial_numbers) {
        const [existingUsages, existingReturns] = await Promise.all([
          tx.inventoryClientUsage.findMany({
            where: { out_transaction_id: outTx.id },
            include: { items: true },
          }),
          tx.inventoryReturn.findMany({
            where: { out_transaction_id: outTx.id },
            include: { details: true },
          }),
        ]);
        serialsToUpdate = computeRemainingSerialsForDetail(
          txDetail,
          existingUsages,
          existingReturns
        );
      }

      // Create Return Detail Record
      await tx.inventoryReturnDetail.create({
        data: {
          return_id: returnTx.id,
          transaction_detail_id: txDetail.id,
          item_id: item.id,
          quantity: returnQty,
          condition: returnInput.condition,
          serial_numbers: serialsToUpdate.length
            ? JSON.stringify(serialsToUpdate)
            : null,
          action_taken: returnInput.action_taken || (isGoodCondition ? "Masuk stok siap pakai" : "Karantina / Penanganan khusus"),
          notes: returnInput.notes || null,
        },
      });

      // Update serial units if tracked
      if (serialsToUpdate.length > 0) {
        for (const trimmedSn of serialsToUpdate) {
          await tx.inventoryItemUnit.updateMany({
            where: { serial_number: trimmedSn },
            data: {
              status: isGoodCondition ? "AVAILABLE" : isDamaged ? "DAMAGED" : "LOST",
              condition: returnInput.condition,
              current_pic: isGoodCondition ? null : payload.pic_name,
              current_location: isGoodCondition ? (item.storage_location || "Gudang") : "Area Karantina / Rusak",
            },
          });
        }
      }

      // Movement record
      const movementType = isGoodCondition ? "RETURN_GOOD" : "RETURN_DAMAGED";
      await tx.inventoryMovement.create({
        data: {
          item_id: item.id,
          movement_type: movementType,
          quantity: returnQty,
          balance_before: balanceBefore,
          balance_after: balanceAfter,
          reference_type: "RETURN",
          reference_id: returnTx.id,
          transaction_id: outTx.id,
          performed_by: payload.user_name || payload.recipient_officer || "Admin Gudang",
          notes: `Pengembalian (${returnNumber}) Kondisi: ${returnInput.condition}`,
        },
      });
    }

    // Check overall status of OUT transaction
    const allDetails = await tx.inventoryTransactionDetail.findMany({
      where: { transaction_id: outTx.id },
    });

    const allReusableReturned = allDetails
      .filter((d) => d.status !== "CONSUMED")
      .every((d) => new Prisma.Decimal(d.qty_remaining).isZero());

    const hasAnyReturned = allDetails.some((d) =>
      new Prisma.Decimal(d.qty_returned).greaterThan(0)
    );

    const overallStatus = allReusableReturned
      ? "SUDAH_KEMBALI"
      : hasAnyReturned
        ? "SEBAGIAN_KEMBALI"
        : outTx.status === "MENUNGGU_PENGEMBALIAN"
          ? "MENUNGGU_PENGEMBALIAN"
          : "SEDANG_DIGUNAKAN";

    await tx.inventoryTransaction.update({
      where: { id: outTx.id },
      data: { status: overallStatus },
    });

    // Append Audit Log
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "RETURN",
        entity_id: returnTx.id,
        action: "CREATE",
        user_id: payload.created_by,
        user_name: payload.user_name || payload.recipient_officer || "Admin Gudang",
        data_after: JSON.stringify(returnTx),
        reason: `Pencatatan Pengembalian Barang ${returnNumber}`,
      },
    });

    return returnTx;
  });
}

/**
 * Edit PIC, Location, or Notes of an in-use transaction.
 * IMPORTANT: This strictly does NOT modify stock figures, preserving audit trail!
 */
export async function updateInUseAssignment(params: {
  transaction_id: string;
  pic_name: string;
  pic_phone?: string;
  location?: string;
  notes?: string;
  reason: string;
  user_id?: string;
  user_name: string;
}) {
  if (!params.reason?.trim()) {
    throw new Error("Alasan perubahan PIC / lokasi wajib dicantumkan.");
  }

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryTransaction.findUnique({
      where: { id: params.transaction_id },
    });

    if (!existing) {
      throw new Error(`Transaksi dengan ID ${params.transaction_id} tidak ditemukan.`);
    }

    const dataBefore = {
      pic_name: existing.pic_name,
      pic_phone: existing.pic_phone,
      location: existing.location,
      notes: existing.notes,
    };

    const updated = await tx.inventoryTransaction.update({
      where: { id: params.transaction_id },
      data: {
        pic_name: params.pic_name.trim(),
        pic_phone: params.pic_phone?.trim() || null,
        location: params.location?.trim() || null,
        notes: params.notes || existing.notes,
      },
    });

    const dataAfter = {
      pic_name: updated.pic_name,
      pic_phone: updated.pic_phone,
      location: updated.location,
      notes: updated.notes,
    };

    // Audit log append-only
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "PIC_LOCATION_EDIT",
        entity_id: existing.id,
        action: "EDIT_PIC_LOCATION",
        user_id: params.user_id,
        user_name: params.user_name,
        data_before: JSON.stringify(dataBefore),
        data_after: JSON.stringify(dataAfter),
        reason: params.reason.trim(),
      },
    });

    return updated;
  });
}

/**
 * Stock Adjustment
 * Atomically adjusts stock with movement log and audit log.
 */
export async function adjustStock(params: {
  item_id: string;
  new_available_stock: number | string;
  reason: string;
  user_id?: string;
  user_name: string;
}) {
  const targetStock = new Prisma.Decimal(params.new_available_stock);
  if (targetStock.isNegative()) {
    throw new Error("Stok hasil penyesuaian tidak boleh bernilai negatif.");
  }
  if (!params.reason?.trim()) {
    throw new Error("Alasan penyesuaian stok wajib diisi.");
  }

  return await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: params.item_id },
      include: { stock: true },
    });

    if (!item || !item.stock) {
      throw new Error("Barang atau data stok tidak ditemukan.");
    }

    const balanceBefore = new Prisma.Decimal(item.stock.available_stock);
    const diff = targetStock.minus(balanceBefore);

    if (diff.isZero()) {
      return item.stock;
    }

    const updatedStock = await tx.inventoryStock.update({
      where: { id: item.stock.id },
      data: {
        available_stock: targetStock,
      },
    });

    const adjTxNumber = await generateTransactionNumber("ADJ", tx);

    const adjTx = await tx.inventoryTransaction.create({
      data: {
        transaction_number: adjTxNumber,
        type: "ADJUSTMENT",
        warehouse_officer: params.user_name,
        status: "COMPLETED",
        notes: `Penyesuaian stok manual. Alasan: ${params.reason.trim()}`,
        created_by: params.user_id,
      },
    });

    await tx.inventoryTransactionDetail.create({
      data: {
        transaction_id: adjTx.id,
        item_id: item.id,
        quantity: diff.abs(),
        unit: item.unit,
        status: "COMPLETED",
        notes: `Perubahan dari ${balanceBefore.toString()} ke ${targetStock.toString()}`,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        item_id: item.id,
        movement_type: "ADJUSTMENT",
        quantity: diff,
        balance_before: balanceBefore,
        balance_after: targetStock,
        reference_type: "ADJUSTMENT",
        reference_id: adjTx.id,
        transaction_id: adjTx.id,
        performed_by: params.user_name,
        notes: `Stock Adjustment (${adjTxNumber}): ${params.reason.trim()}`,
      },
    });

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "STOCK_ADJUSTMENT",
        entity_id: item.id,
        action: "ADJUST",
        user_id: params.user_id,
        user_name: params.user_name,
        data_before: JSON.stringify({ available_stock: balanceBefore.toString() }),
        data_after: JSON.stringify({ available_stock: targetStock.toString() }),
        reason: params.reason.trim(),
      },
    });

    return updatedStock;
  });
}

/**
 * Stock Opname
 * Updates physical count across multiple items.
 */
export async function performStockOpname(params: {
  warehouse_officer: string;
  notes?: string;
  items: Array<{
    item_id: string;
    physical_count: number | string;
    notes?: string;
  }>;
  user_id?: string;
  user_name: string;
}) {
  if (!params.items || params.items.length === 0) {
    throw new Error("Daftar barang stock opname tidak boleh kosong.");
  }

  return await prisma.$transaction(async (tx) => {
    const opnNumber = await generateTransactionNumber("OPN", tx);

    const opnTx = await tx.inventoryTransaction.create({
      data: {
        transaction_number: opnNumber,
        type: "OPNAME",
        warehouse_officer: params.warehouse_officer,
        status: "COMPLETED",
        notes: params.notes || "Hasil Stock Opname Fisik",
        created_by: params.user_id,
      },
    });

    for (const opnItem of params.items) {
      const physicalCount = new Prisma.Decimal(opnItem.physical_count);
      if (physicalCount.isNegative()) {
        throw new Error("Jumlah fisik barang tidak boleh negatif.");
      }

      const item = await tx.inventoryItem.findUnique({
        where: { id: opnItem.item_id },
        include: { stock: true },
      });

      if (!item || !item.stock) continue;

      const balanceBefore = new Prisma.Decimal(item.stock.available_stock);
      const diff = physicalCount.minus(balanceBefore);

      if (!diff.isZero()) {
        await tx.inventoryStock.update({
          where: { id: item.stock.id },
          data: { available_stock: physicalCount },
        });

        await tx.inventoryTransactionDetail.create({
          data: {
            transaction_id: opnTx.id,
            item_id: item.id,
            quantity: diff.abs(),
            unit: item.unit,
            status: "COMPLETED",
            notes: `Fisik: ${physicalCount.toString()}, Sistem: ${balanceBefore.toString()}, Selisih: ${diff.toString()}`,
          },
        });

        await tx.inventoryMovement.create({
          data: {
            item_id: item.id,
            movement_type: "ADJUSTMENT",
            quantity: diff,
            balance_before: balanceBefore,
            balance_after: physicalCount,
            reference_type: "OPNAME",
            reference_id: opnTx.id,
            transaction_id: opnTx.id,
            performed_by: params.user_name,
            notes: `Opname ${opnNumber}: Selisih ${diff.toString()} ${item.unit}`,
          },
        });
      }
    }

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: opnTx.id,
        action: "CREATE",
        user_id: params.user_id,
        user_name: params.user_name,
        data_after: JSON.stringify(opnTx),
        reason: `Pelaksanaan Stock Opname ${opnNumber}`,
      },
    });

    return opnTx;
  });
}

// ============================================================================
// DASHBOARD & ANALYTICS STATS
// ============================================================================

export async function getInventoryDashboardStats() {
  const [
    totalItems,
    stocks,
    activeInUseTransactions,
    recentIn,
    recentOut,
    recentReturns,
    categories,
  ] = await Promise.all([
    prisma.inventoryItem.count({ where: { is_active: true } }),
    prisma.inventoryStock.findMany({
      include: {
        item: {
          select: {
            id: true,
            name: true,
            code: true,
            unit: true,
            type: true,
            min_stock: true,
            category: { select: { name: true } },
          },
        },
      },
    }),
    prisma.inventoryTransactionDetail.findMany({
      where: {
        status: { in: ["ACTIVE", "PARTIAL_RETURN"] },
      },
      include: {
        transaction: true,
        item: true,
      },
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "IN" },
      orderBy: { created_at: "desc" },
      take: 5,
      include: {
        details: { include: { item: true } },
      },
    }),
    prisma.inventoryTransaction.findMany({
      where: { type: "OUT" },
      orderBy: { created_at: "desc" },
      take: 5,
      include: {
        details: { include: { item: true } },
      },
    }),
    prisma.inventoryReturn.findMany({
      orderBy: { created_at: "desc" },
      take: 5,
      include: {
        details: { include: { item: true } },
        out_transaction: true,
      },
    }),
    prisma.inventoryCategory.findMany({
      where: {
        name: { not: "MODEM", mode: "insensitive" },
      },
      include: {
        items: {
          where: { is_active: true },
          include: { stock: true },
        },
      },
      orderBy: { name: "asc" },
    }),
  ]);

  let totalAvailableStock = 0;
  let totalInUse = 0;
  let totalConsumed = 0;
  const lowStockItems: Array<{
    id: string;
    name: string;
    code: string;
    unit: string;
    available: number;
    min_stock: number;
    category: string;
  }> = [];

  for (const s of stocks) {
    const avail = Number(s.available_stock);
    const inUse = Number(s.total_in_use);
    const consumed = Number(s.total_consumed);
    const minStk = Number(s.item.min_stock);

    totalAvailableStock += avail;
    totalInUse += inUse;
    totalConsumed += consumed;

    if (minStk > 0 && avail <= minStk) {
      lowStockItems.push({
        id: s.item.id,
        name: s.item.name,
        code: s.item.code,
        unit: s.item.unit,
        available: avail,
        min_stock: minStk,
        category: s.item.category?.name || "Uncategorized",
      });
    }
  }

  // Monthly stats for the last 6 months
  const now = new Date();
  const monthsData: Array<{ month: string; in_count: number; out_count: number }> = [];

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const nextD = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const monthLabel = d.toLocaleString("id-ID", { month: "short", year: "2-digit" });

    const [inCount, outCount] = await Promise.all([
      prisma.inventoryTransaction.count({
        where: {
          type: "IN",
          transaction_date: { gte: d, lt: nextD },
        },
      }),
      prisma.inventoryTransaction.count({
        where: {
          type: "OUT",
          transaction_date: { gte: d, lt: nextD },
        },
      }),
    ]);

    monthsData.push({
      month: monthLabel,
      in_count: inCount,
      out_count: outCount,
    });
  }

  // Category distribution (exclude legacy MODEM category and empty non-standard categories)
  const categoryDistribution = categories
    .filter((c) => {
      const normalized = c.name.trim().toLowerCase();
      if (normalized === "modem") return false;
      return c.name === "Aktif" || c.name === "Pasif" || c.items.length > 0;
    })
    .map((c) => {
      let totalCatStock = 0;
      c.items.forEach((it) => {
        if (it.stock) {
          totalCatStock += Number(it.stock.available_stock);
        }
      });
      return {
        name: c.name,
        item_count: c.items.length,
        total_stock: totalCatStock,
      };
    });

  return {
    summary: {
      total_item_types: totalItems,
      total_available_stock: totalAvailableStock,
      total_in_use: totalInUse,
      total_pending_return: activeInUseTransactions.length,
      total_consumed: totalConsumed,
      low_stock_count: lowStockItems.length,
    },
    low_stock_items: lowStockItems,
    recent_in: recentIn,
    recent_out: recentOut,
    recent_returns: recentReturns,
    monthly_chart: monthsData,
    category_distribution: categoryDistribution,
  };
}

export interface FinishInUsePayload {
  transaction_id: string;
  completion_date?: Date | string;
  notes?: string;
  user_name?: string;
  created_by?: string;
  clients: FinishClientPayload[];
}

/**
 * Menyelesaikan penggunaan barang di lapangan:
 * - Mencatat penggunaan per Client (bisa >1 client, masing-masing bisa memakai >1 item dari transaksi keluar).
 * - Barang terpakai client langsung menambah `total_consumed` di Stok Inventory & mengurangi `total_in_use`,
 *   disertai rincian client (`InventoryClientUsage`).
 * - Sisa barang yang belum dipakai TIDAK langsung menambah `available_stock`, melainkan tetap berada
 *   di `qty_remaining` berstatus `MENUNGGU_PENGEMBALIAN` agar diproses di menu Pengembalian Barang terlebih dahulu.
 * - Jika seluruh barang habis terpakai client (sisa = 0), status transaksi langsung berubah menjadi `SUDAH_KEMBALI`.
 */
export async function processFinishInUse(payload: FinishInUsePayload) {
  if (!payload.transaction_id) {
    throw new Error("ID transaksi wajib disertakan.");
  }

  return await prisma.$transaction(async (tx) => {
    const outTx = await tx.inventoryTransaction.findUnique({
      where: { id: payload.transaction_id },
      include: {
        details: {
          include: {
            item: {
              include: { stock: true, category: true },
            },
          },
        },
        client_usages: {
          include: { items: true },
        },
        returns: {
          include: { details: true },
        },
      },
    });

    if (!outTx || outTx.type !== "OUT") {
      throw new Error("Transaksi barang keluar tidak ditemukan.");
    }

    if (outTx.status === "SUDAH_KEMBALI" || outTx.status === "MENUNGGU_PENGEMBALIAN") {
      throw new Error(
        outTx.status === "MENUNGGU_PENGEMBALIAN"
          ? "Transaksi ini sudah diselesaikan dan sisa barang sedang menunggu konfirmasi di menu Pengembalian Barang."
          : "Transaksi ini sudah berstatus SUDAH_KEMBALI."
      );
    }

    const clients = Array.isArray(payload.clients) ? payload.clients : [];
    const {
      allocatedByDetail,
      usedSerialsByDetail,
      totalUsedUnits,
      totalPendingReturnUnits,
    } = validateFinishClientAllocations(
      outTx.details,
      clients,
      outTx.client_usages,
      outTx.returns
    );

    const completionDate = payload.completion_date
      ? new Date(payload.completion_date)
      : new Date();

    const activeClientRecords: string[] = [];

    for (const client of clients) {
      const validItems = (client.items || []).filter((i) => Number(i.quantity || 0) > 0);
      if (validItems.length === 0) continue;

      const createdUsage = await tx.inventoryClientUsage.create({
        data: {
          out_transaction_id: outTx.id,
          client_name: client.client_name.trim(),
          client_address: client.client_address.trim(),
          client_phone: client.client_phone?.trim() || null,
          technician_pic: outTx.pic_name || null,
          completion_date: completionDate,
          notes: client.notes?.trim() || payload.notes?.trim() || null,
          created_by: payload.created_by || null,
        },
      });

      activeClientRecords.push(client.client_name.trim());

      for (const itemInput of validItems) {
        const detail = outTx.details.find((d) => d.id === itemInput.transaction_detail_id)!;
        const cleanSns = (itemInput.serial_numbers || []).map((s) => s.trim()).filter(Boolean);

        await tx.inventoryClientUsageItem.create({
          data: {
            client_usage_id: createdUsage.id,
            transaction_detail_id: detail.id,
            item_id: detail.item_id,
            quantity: new Prisma.Decimal(itemInput.quantity),
            unit: detail.unit,
            serial_numbers: cleanSns.length ? JSON.stringify(cleanSns) : null,
          },
        });
      }
    }

    const clientSummaryLabel =
      activeClientRecords.length > 0 ? activeClientRecords.join(", ") : "Tanpa Pemakaian Client";

    for (const detail of outTx.details) {
      const allocated = allocatedByDetail.get(detail.id) || 0;
      const isLegacyConsumed = detail.status === "CONSUMED";

      if (isLegacyConsumed) {
        if (allocated > 0) {
          await tx.inventoryTransactionDetail.update({
            where: { id: detail.id },
            data: {
              qty_used: new Prisma.Decimal(detail.qty_used).add(allocated),
            },
          });
        }
        continue;
      }

      const usedDec = new Prisma.Decimal(allocated);
      const currentRemaining = new Prisma.Decimal(detail.qty_remaining);
      const nextRemaining = Prisma.Decimal.max(0, currentRemaining.minus(usedDec));
      const nextDetailStatus = nextRemaining.isZero()
        ? usedDec.greaterThan(0) || Number(detail.qty_used) > 0
          ? "USED"
          : "COMPLETED"
        : "PENDING_RETURN";

      await tx.inventoryTransactionDetail.update({
        where: { id: detail.id },
        data: {
          qty_used: new Prisma.Decimal(detail.qty_used).add(usedDec),
          qty_remaining: nextRemaining,
          status: nextDetailStatus,
        },
      });

      if (usedDec.greaterThan(0) && detail.item.stock) {
        await tx.inventoryStock.update({
          where: { id: detail.item.stock.id },
          data: {
            total_consumed: new Prisma.Decimal(detail.item.stock.total_consumed).add(usedDec),
            total_in_use: Prisma.Decimal.max(
              0,
              new Prisma.Decimal(detail.item.stock.total_in_use).minus(usedDec)
            ),
          },
        });

        await tx.inventoryMovement.create({
          data: {
            item_id: detail.item_id,
            movement_type: "CONSUMED",
            quantity: usedDec,
            balance_before: detail.item.stock.available_stock,
            balance_after: detail.item.stock.available_stock,
            reference_type: "TRANSACTION",
            reference_id: outTx.id,
            transaction_id: outTx.id,
            performed_by: payload.user_name || outTx.pic_name || "Admin Gudang",
            notes: `Barang terpakai client (${clientSummaryLabel}) dari ${outTx.transaction_number}`,
          },
        });

        const assignedSerials = usedSerialsByDetail.get(detail.id) || [];
        for (const entry of assignedSerials) {
          await tx.inventoryItemUnit.updateMany({
            where: { serial_number: entry.sn },
            data: {
              status: "CONSUMED",
              current_pic: `Client: ${entry.clientName}`,
              current_location: entry.clientAddress,
            },
          });
        }
      }
    }

    const nextTxStatus = totalPendingReturnUnits > 0 ? "MENUNGGU_PENGEMBALIAN" : "SUDAH_KEMBALI";

    await tx.inventoryTransaction.update({
      where: { id: outTx.id },
      data: {
        status: nextTxStatus,
      },
    });

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: outTx.id,
        action: "FINISH_IN_USE",
        user_id: payload.created_by,
        user_name: payload.user_name || outTx.pic_name || "Admin Gudang",
        data_after: JSON.stringify({
          status: nextTxStatus,
          clients: activeClientRecords,
          used_units: totalUsedUnits,
          pending_return_units: totalPendingReturnUnits,
        }),
        reason: `Penyelesaian ${outTx.transaction_number}: ${totalUsedUnits} unit terpakai (${clientSummaryLabel}), ${totalPendingReturnUnits} unit sisa ${totalPendingReturnUnits > 0 ? "masuk antrean Pengembalian Barang" : "selesai"}.`,
      },
    });

    return {
      transaction_id: outTx.id,
      transaction_number: outTx.transaction_number,
      status: nextTxStatus,
      used_count: totalUsedUnits,
      pending_return_count: totalPendingReturnUnits,
      client_count: activeClientRecords.length,
    };
  });
}

export interface InUseQueryParams {
  pic?: string;
  location?: string;
  status?: string | null;
  search?: string;
  page?: number;
  limit?: number;
}

export function parseInUseQueryParams(requestUrl: string): Required<InUseQueryParams> {
  const { searchParams } = new URL(requestUrl);
  const pic = searchParams.get("pic")?.trim() || "";
  const location = searchParams.get("location")?.trim() || "";
  const status = searchParams.get("status")?.trim() || "";
  const search = searchParams.get("search")?.trim() || "";
  const parsedPage = parseInt(searchParams.get("page") || "1", 10);
  const parsedLimit = parseInt(searchParams.get("limit") || "20", 10);
  const page = Number.isFinite(parsedPage) ? Math.max(1, parsedPage) : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.max(1, Math.min(100, parsedLimit)) : 20;
  return { pic, location, status, search, page, limit };
}

/**
 * Shared paginated query for deployed ("Barang Sedang Digunakan") transactions.
 * Reused by both internal dashboard (`/api/inventory/in-use`) and `/request-barang` portal.
 */
export async function queryInventoryInUseTransactions(params: InUseQueryParams) {
  const page = Math.max(1, params.page || 1);
  const limit = Math.max(1, Math.min(100, params.limit || 20));
  const skip = (page - 1) * limit;

  const whereClause: Prisma.InventoryTransactionWhereInput = {
    type: "OUT",
  };

  if (params.status) {
    whereClause.status = params.status;
  } else {
    whereClause.status = {
      in: ["SEDANG_DIGUNAKAN", "SEBAGIAN_KEMBALI", "MENUNGGU_PENGEMBALIAN"],
    };
  }

  if (params.pic) {
    whereClause.pic_name = { contains: params.pic, mode: "insensitive" };
  }

  if (params.location) {
    whereClause.location = { contains: params.location, mode: "insensitive" };
  }

  if (params.search) {
    whereClause.OR = [
      { transaction_number: { contains: params.search, mode: "insensitive" } },
      { pic_name: { contains: params.search, mode: "insensitive" } },
      { location: { contains: params.search, mode: "insensitive" } },
      { purpose: { contains: params.search, mode: "insensitive" } },
      {
        details: {
          some: {
            item: {
              OR: [
                { name: { contains: params.search, mode: "insensitive" } },
                { code: { contains: params.search, mode: "insensitive" } },
              ],
            },
          },
        },
      },
    ];
  }

  const [total, transactions] = await Promise.all([
    prisma.inventoryTransaction.count({ where: whereClause }),
    prisma.inventoryTransaction.findMany({
      where: whereClause,
      include: {
        details: {
          include: {
            item: {
              select: {
                id: true,
                name: true,
                code: true,
                unit: true,
                type: true,
                brand: true,
                model: true,
                storage_location: true,
              },
            },
          },
        },
        returns: {
          select: {
            id: true,
            return_number: true,
            return_date: true,
            pic_name: true,
            details: {
              select: {
                id: true,
                transaction_detail_id: true,
                item_id: true,
                quantity: true,
                condition: true,
                serial_numbers: true,
              },
            },
          },
        },
        client_usages: {
          orderBy: { created_at: "asc" },
          include: {
            items: {
              include: {
                item: {
                  select: {
                    id: true,
                    name: true,
                    code: true,
                    unit: true,
                    type: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: { transaction_date: "desc" },
      skip,
      take: limit,
    }),
  ]);

  return {
    data: transactions,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export interface DeleteTransactionPayload {
  transaction_id: string;
  deleted_by?: string;
  user_name?: string;
}

async function deleteSingleTransactionInTx(
  tx: Prisma.TransactionClient,
  payload: DeleteTransactionPayload & { skipAuditLog?: boolean }
) {
  const existingTx = await tx.inventoryTransaction.findUnique({
    where: { id: payload.transaction_id },
    include: {
      details: {
        include: {
          item: {
            include: { stock: true },
          },
        },
      },
      returns: {
        include: {
          details: true,
        },
      },
      client_usages: {
        include: {
          items: true,
        },
      },
    },
  });

  if (!existingTx) {
    const notFoundErr = new Error("Transaksi tidak ditemukan.") as Error & { statusCode?: number };
    notFoundErr.statusCode = 404;
    throw notFoundErr;
  }

  if (existingTx.type !== "IN" && existingTx.type !== "OUT") {
    throw new Error(
      "Hanya riwayat transaksi Barang Masuk (IN) dan Barang Keluar (OUT) yang dapat dihapus."
    );
  }

  let historyOnlyInPlan: ReturnType<typeof buildStockInHistoryOnlyDeletePlan> | null = null;

  if (existingTx.type === "IN") {
    // History-only removal: Stock balances and Serial Numbers from prior Stock-In
    // transactions must remain intact and deletion must never be blocked.
    historyOnlyInPlan = buildStockInHistoryOnlyDeletePlan(
      existingTx.id,
      existingTx.transaction_number,
      existingTx.details
    );
  } else {
    const plan = computeStockOutDeleteReversal(existingTx.details, existingTx.returns);

    for (const [itemId, adj] of plan.stockUpdatesByItem.entries()) {
      const detailStock = existingTx.details.find((d) => d.item_id === itemId)?.item?.stock;
      if (!detailStock) continue;
      await tx.inventoryStock.update({
        where: { id: adj.stockId },
        data: {
          available_stock: new Prisma.Decimal(detailStock.available_stock).add(adj.addAvailable),
          total_out: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_out).minus(adj.subTotalOut)
          ),
          total_in_use: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_in_use).minus(adj.subTotalInUse)
          ),
          total_returned: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_returned).minus(adj.subTotalReturned)
          ),
          total_consumed: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_consumed).minus(adj.subTotalConsumed)
          ),
          total_damaged: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_damaged).minus(adj.subTotalDamaged)
          ),
          total_lost: Prisma.Decimal.max(
            0,
            new Prisma.Decimal(detailStock.total_lost).minus(adj.subTotalLost)
          ),
        },
      });
    }

    for (const snEntry of plan.serialsToRestoreAvailable) {
      await tx.inventoryItemUnit.updateMany({
        where: {
          item_id: snEntry.itemId,
          serial_number: snEntry.serialNumber,
        },
        data: {
          status: "AVAILABLE",
          condition: "BAIK",
          current_pic: null,
          current_location: snEntry.storageLocation,
        },
      });
    }

    const returnIds = existingTx.returns.map((r) => r.id);
    if (returnIds.length > 0) {
      await tx.inventoryMovement.deleteMany({
        where: {
          reference_type: "RETURN",
          reference_id: { in: returnIds },
        },
      });
      await tx.inventoryReturnDetail.deleteMany({
        where: { return_id: { in: returnIds } },
      });
      await tx.inventoryReturn.deleteMany({
        where: { id: { in: returnIds } },
      });
    }
  }

  await tx.inventoryMovement.deleteMany({
    where: {
      OR: [{ transaction_id: existingTx.id }, { reference_id: existingTx.id }],
    },
  });

  await tx.inventoryTransaction.delete({
    where: { id: existingTx.id },
  });

  if (!payload.skipAuditLog) {
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: existingTx.id,
        action: "DELETE",
        user_id: payload.deleted_by || null,
        user_name: payload.user_name || "Administrator",
        data_before: JSON.stringify(
          historyOnlyInPlan
            ? {
                id: existingTx.id,
                transaction_number: existingTx.transaction_number,
                type: existingTx.type,
                preserve_stock_and_serials: historyOnlyInPlan.preserveStockAndSerials,
                unaffected_item_ids: historyOnlyInPlan.unaffectedItemIds,
                preserved_serial_numbers: historyOnlyInPlan.preservedSerialNumbers,
              }
            : existingTx
        ),
        reason:
          existingTx.type === "IN"
            ? `Penghapusan riwayat transaksi Barang Masuk (${existingTx.transaction_number}) oleh Administrator (tanpa mengubah saldo Stok Inventory dan Serial Number)`
            : `Penghapusan riwayat transaksi ${existingTx.type} (${existingTx.transaction_number}) oleh Administrator`,
      },
    });
  }

  return {
    id: existingTx.id,
    transaction_number: existingTx.transaction_number,
    type: existingTx.type,
  };
}

/**
 * Deletes an IN (history-only, keeping InventoryStock & InventoryItemUnit intact)
 * or OUT (reversing InventoryStock balances, InventoryItemUnit states, linked returns/client usages)
 * transaction atomically (Administrator-only via API guard), recording an audit snapshot.
 */
export async function deleteInventoryTransaction(payload: DeleteTransactionPayload) {
  if (!payload.transaction_id) {
    throw new Error("ID transaksi wajib disertakan.");
  }

  return await prisma.$transaction((tx) => deleteSingleTransactionInTx(tx, payload));
}

export interface BulkDeleteTransactionPayload {
  type: "IN" | "OUT";
  mode: "selected" | "all";
  ids?: string[];
  deleted_by?: string;
  user_name?: string;
}

/**
 * Deletes multiple selected transactions or all transactions of type IN/OUT atomically
 * inside a single database transaction.
 * For IN: deletes history only without modifying stock balances or Serial Numbers.
 * For OUT: reverses stock & SN state newest-first cleanly.
 */
export async function deleteBulkInventoryTransactions(payload: BulkDeleteTransactionPayload) {
  if (payload.type !== "IN" && payload.type !== "OUT") {
    throw new Error("Tipe transaksi tidak valid. Hanya IN atau OUT yang dapat dihapus.");
  }

  const cleanIds = Array.isArray(payload.ids)
    ? Array.from(new Set(payload.ids.map((s) => String(s).trim()).filter(Boolean)))
    : [];

  if (payload.mode === "selected" && cleanIds.length === 0) {
    throw new Error("Pilih minimal 1 transaksi untuk dihapus.");
  }

  return await prisma.$transaction(
    async (tx) => {
      const targetTxs = await tx.inventoryTransaction.findMany({
        where:
          payload.mode === "all"
            ? { type: payload.type }
            : { type: payload.type, id: { in: cleanIds } },
        select: { id: true, transaction_number: true },
        orderBy: [{ transaction_date: "desc" }, { created_at: "desc" }],
      });

      if (targetTxs.length === 0) {
        const notFoundErr = new Error(
          "Tidak ada riwayat transaksi yang ditemukan untuk dihapus."
        ) as Error & { statusCode?: number };
        notFoundErr.statusCode = 404;
        throw notFoundErr;
      }

      const deletedList: Array<{ id: string; transaction_number: string; type: string }> = [];
      if (payload.type === "IN") {
        const targetIds = targetTxs.map((t) => t.id);
        await tx.inventoryMovement.deleteMany({
          where: {
            OR: [{ transaction_id: { in: targetIds } }, { reference_id: { in: targetIds } }],
          },
        });
        await tx.inventoryTransaction.deleteMany({
          where: {
            id: { in: targetIds },
            type: "IN",
          },
        });
        for (const t of targetTxs) {
          deletedList.push({
            id: t.id,
            transaction_number: t.transaction_number,
            type: "IN",
          });
        }
      } else {
        for (const target of targetTxs) {
          const res = await deleteSingleTransactionInTx(tx, {
            transaction_id: target.id,
            deleted_by: payload.deleted_by,
            user_name: payload.user_name,
            skipAuditLog: true,
          });
          deletedList.push(res);
        }
      }

      const bulkReason =
        payload.type === "IN"
          ? payload.mode === "all"
            ? `Penghapusan keseluruhan riwayat transaksi Barang Masuk (${deletedList.length} transaksi) oleh Administrator (tanpa mengubah saldo Stok Inventory dan Serial Number)`
            : `Penghapusan massal ${deletedList.length} riwayat transaksi Barang Masuk terpilih oleh Administrator (tanpa mengubah saldo Stok Inventory dan Serial Number)`
          : payload.mode === "all"
            ? `Penghapusan keseluruhan riwayat transaksi ${payload.type} (${deletedList.length} transaksi) oleh Administrator`
            : `Penghapusan massal ${deletedList.length} transaksi ${payload.type} terpilih oleh Administrator`;

      await tx.inventoryAuditLog.create({
        data: {
          entity_type: "TRANSACTION",
          entity_id: `BULK_${payload.type}`,
          action: "BULK_DELETE",
          user_id: payload.deleted_by || null,
          user_name: payload.user_name || "Administrator",
          data_before: JSON.stringify({
            type: payload.type,
            mode: payload.mode,
            count: deletedList.length,
            preserve_stock_and_serials: payload.type === "IN",
            transactions: deletedList.map((d) => d.transaction_number),
          }),
          reason: bulkReason,
        },
      });

      return {
        type: payload.type,
        mode: payload.mode,
        count: deletedList.length,
        deleted_numbers: deletedList.map((d) => d.transaction_number),
      };
    },
    { maxWait: 10000, timeout: 60000 }
  );
}

// ============================================================================
// PUBLIC INVENTORY REQUESTS (NO LOGIN SUBMISSION + WAREHOUSE/ADMIN ACC)
// ============================================================================

export async function getPublicInventoryCatalog() {
  const items = await prisma.inventoryItem.findMany({
    where: { is_active: true },
    orderBy: [{ name: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      unit: true,
      type: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });

  return items.map((item) => ({
    id: item.id,
    code: item.code,
    name: item.name,
    unit: item.unit,
    type: item.type,
    category_name: item.category?.name || null,
  }));
}

export async function createPublicInventoryRequest(
  rawPayload: unknown,
  ipAddress?: string | null
) {
  const validated = validatePublicInventoryRequestInput(rawPayload);
  if (!validated.ok) {
    const err = new Error(validated.error) as Error & {
      statusCode?: number;
      field?: string;
    };
    err.statusCode = 400;
    err.field = validated.field;
    throw err;
  }

  const data = validated.data;

  return await prisma.$transaction(async (tx) => {
    const itemIds = data.items.map((row) => row.item_id);
    const catalogItems = await tx.inventoryItem.findMany({
      where: { id: { in: itemIds }, is_active: true },
      select: { id: true, name: true, code: true, unit: true },
    });

    const itemMap = new Map(catalogItems.map((it) => [it.id, it]));
    for (const row of data.items) {
      if (!itemMap.has(row.item_id)) {
        const missingErr = new Error(
          "Salah satu barang yang dipilih tidak ditemukan atau sedang nonaktif."
        ) as Error & { statusCode?: number };
        missingErr.statusCode = 400;
        throw missingErr;
      }
    }

    const requestNumber = await generateRequestNumber(tx);

    const created = await tx.inventoryRequest.create({
      data: {
        request_number: requestNumber,
        pic_name: data.pic_name,
        pic_phone: data.pic_phone,
        request_date: data.request_date,
        work_types: JSON.stringify(data.work_types),
        work_type_other: data.work_type_other,
        pickup_location: data.pickup_location,
        notes: data.notes,
        status: "PENDING",
        items: {
          create: data.items.map((row) => {
            const master = itemMap.get(row.item_id)!;
            return {
              item_id: master.id,
              quantity: new Prisma.Decimal(row.quantity),
              unit: master.unit,
              notes: row.notes,
            };
          }),
        },
      },
      include: {
        items: {
          include: {
            item: {
              select: { id: true, code: true, name: true, unit: true, type: true },
            },
          },
        },
      },
    });

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "REQUEST",
        entity_id: created.id,
        action: "CREATE",
        user_id: null,
        user_name: `${data.pic_name} (Form Publik)`,
        data_after: JSON.stringify({
          request_number: created.request_number,
          pic_name: created.pic_name,
          pickup_location: created.pickup_location,
          work_types: data.work_types,
          work_type_other: data.work_type_other,
          items_count: created.items.length,
        }),
        reason: `Pengajuan Form Request Tanpa Login (${formatWorkTypeLabel(
          data.work_types,
          data.work_type_other
        )})`,
        ip_address: ipAddress || null,
      },
    });

    return {
      ...created,
      work_types_parsed: parseWorkTypes(created.work_types),
      work_type_label: formatWorkTypeLabel(created.work_types, created.work_type_other),
    };
  });
}

export async function listInventoryRequests(filters?: {
  status?: string;
  search?: string;
  limit?: number;
}) {
  const statusFilter = filters?.status?.trim().toUpperCase();
  const search = filters?.search?.trim();
  const take = Math.min(Math.max(filters?.limit || 100, 1), 250);

  const where: Prisma.InventoryRequestWhereInput = {};
  if (statusFilter && ["PENDING", "APPROVED", "REJECTED"].includes(statusFilter)) {
    where.status = statusFilter;
  }
  if (search) {
    where.OR = [
      { request_number: { contains: search, mode: "insensitive" } },
      { pic_name: { contains: search, mode: "insensitive" } },
      { pickup_location: { contains: search, mode: "insensitive" } },
      { work_types: { contains: search, mode: "insensitive" } },
      { work_type_other: { contains: search, mode: "insensitive" } },
    ];
  }

  const [requests, pendingCount] = await Promise.all([
    prisma.inventoryRequest.findMany({
      where,
      take,
      orderBy: [{ created_at: "desc" }],
      include: {
        items: {
          include: {
            item: {
              select: {
                id: true,
                code: true,
                name: true,
                unit: true,
                type: true,
                category: { select: { name: true } },
                stock: { select: { available_stock: true } },
              },
            },
          },
        },
        out_transaction: {
          select: {
            id: true,
            transaction_number: true,
            status: true,
            transaction_date: true,
          },
        },
      },
    }),
    prisma.inventoryRequest.count({ where: { status: "PENDING" } }),
  ]);

  return {
    pendingCount,
    requests: requests.map((req) => ({
      ...req,
      work_types_parsed: parseWorkTypes(req.work_types),
      work_type_label: formatWorkTypeLabel(req.work_types, req.work_type_other),
    })),
  };
}

export async function rejectInventoryRequest(payload: {
  request_id: string;
  reason?: string | null;
  rejected_by?: string | null;
  user_name?: string | null;
}) {
  const reqId = payload.request_id?.trim();
  if (!reqId) {
    throw new Error("ID request tidak valid.");
  }

  const reason = payload.reason?.trim() || "Ditolak oleh petugas gudang";
  const actorName = payload.user_name?.trim() || "Admin Gudang";

  return await prisma.$transaction(async (tx) => {
    const existing = await tx.inventoryRequest.findUnique({
      where: { id: reqId },
      select: { id: true, request_number: true, status: true },
    });
    if (!existing) {
      const notFound = new Error("Data request barang tidak ditemukan.") as Error & {
        statusCode?: number;
      };
      notFound.statusCode = 404;
      throw notFound;
    }
    if (existing.status !== "PENDING") {
      throw new Error(
        `Request ${existing.request_number} tidak dapat ditolak karena sudah berstatus '${existing.status}'.`
      );
    }

    const res = await tx.inventoryRequest.updateMany({
      where: { id: reqId, status: "PENDING" },
      data: {
        status: "REJECTED",
        rejected_by: payload.rejected_by || null,
        rejected_by_name: actorName,
        rejected_at: new Date(),
        rejected_reason: reason,
      },
    });

    if (res.count !== 1) {
      throw new Error(`Request ${existing.request_number} sudah diproses oleh petugas lain.`);
    }

    const updated = await tx.inventoryRequest.findUnique({ where: { id: reqId } });

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "REQUEST",
        entity_id: reqId,
        action: "REJECT",
        user_id: payload.rejected_by || null,
        user_name: actorName,
        data_after: JSON.stringify({
          request_number: existing.request_number,
          status: "REJECTED",
          rejected_reason: reason,
        }),
        reason: `Penolakan Request ${existing.request_number}: ${reason}`,
      },
    });

    return updated;
  });
}
