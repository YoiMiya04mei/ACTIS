import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

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
  type: "IN" | "OUT" | "ADJ" | "OPN" | "LOAN",
  tx?: Prisma.TransactionClient
): Promise<string> {
  const client = tx || prisma;
  const dateStr = getDateString();
  const prefix = `${type}-${dateStr}-`;

  const count = await client.inventoryTransaction.count({
    where: {
      transaction_number: {
        startsWith: prefix,
      },
    },
  });

  const nextSeq = String(count + 1).padStart(4, "0");
  return `${prefix}${nextSeq}`;
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

  const count = await client.inventoryReturn.count({
    where: {
      return_number: {
        startsWith: prefix,
      },
    },
  });

  const nextSeq = String(count + 1).padStart(4, "0");
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

      if (!item) {
        throw new Error(`Barang dengan ID ${itemInput.item_id} tidak ditemukan.`);
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
  items: StockOutItemInput[];
  created_by?: string;
  user_name?: string;
}

/**
 * Stock Out: Issues stock out of warehouse.
 * Validates available stock atomically.
 * Differentiates Reusable vs Consumable.
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

    let hasReusable = false;

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

      if (!item) {
        throw new Error(`Barang dengan ID ${itemInput.item_id} tidak ditemukan.`);
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
      const isReusable = item.type === "REUSABLE";
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

      if (isReusable) {
        hasReusable = true;
      }

      // Stock update logic
      if (isReusable) {
        // Reusable: increases total_out and total_in_use, reduces available_stock
        await tx.inventoryStock.update({
          where: { id: stock!.id },
          data: {
            total_out: new Prisma.Decimal(stock!.total_out).add(qtyNum),
            total_in_use: new Prisma.Decimal(stock!.total_in_use).add(qtyNum),
            available_stock: balanceAfter,
          },
        });
      } else {
        // Consumable: increases total_out and total_consumed permanently, reduces available_stock
        await tx.inventoryStock.update({
          where: { id: stock!.id },
          data: {
            total_out: new Prisma.Decimal(stock!.total_out).add(qtyNum),
            total_consumed: new Prisma.Decimal(stock!.total_consumed).add(qtyNum),
            available_stock: balanceAfter,
          },
        });
      }

      // Detail status: REUSABLE -> ACTIVE (with qty_remaining = qtyNum), CONSUMABLE -> CONSUMED
      const detailStatus = isReusable ? "ACTIVE" : "CONSUMED";
      const qtyRemaining = isReusable ? qtyNum : new Prisma.Decimal(0);

      const serialNumbersToRecord = isPasif ? [] : (itemInput.serial_numbers || []).map((s) => String(s).trim()).filter(Boolean);

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
          qty_remaining: qtyRemaining,
          status: detailStatus,
          notes: itemInput.notes || null,
        },
      });

      // Update unit serial numbers if applicable
      if ((isReusable || isAktif) && serialNumbersToRecord.length) {
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
          movement_type: isReusable ? "OUT" : "CONSUMED",
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

    // If transaction had only consumable items, overall status is TERPAKAI
    if (!hasReusable) {
      await tx.inventoryTransaction.update({
        where: { id: transaction.id },
        data: { status: "TERPAKAI" },
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
        reason: `Pencatatan Barang Keluar ${txNumber}`,
      },
    });

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
 * Process Return of Reusable Items
 * Supports partial and full returns.
 * Validates condition (only BAIK goes back to available_stock).
 * Consumable items are strictly rejected.
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

      // RULE 2: Barang consumable tidak boleh dikembalikan melalui mekanisme reusable!
      if (item.type !== "REUSABLE") {
        throw new Error(
          `Barang '${item.name}' merupakan barang consumable (habis pakai) dan tidak dapat diproses sebagai pengembalian barang reusable.`
        );
      }

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

      // Create Return Detail Record
      await tx.inventoryReturnDetail.create({
        data: {
          return_id: returnTx.id,
          transaction_detail_id: txDetail.id,
          item_id: item.id,
          quantity: returnQty,
          condition: returnInput.condition,
          serial_numbers: returnInput.serial_numbers?.length
            ? JSON.stringify(returnInput.serial_numbers)
            : null,
          action_taken: returnInput.action_taken || (isGoodCondition ? "Masuk stok siap pakai" : "Karantina / Penanganan khusus"),
          notes: returnInput.notes || null,
        },
      });

      // Update serial units if tracked
      if (returnInput.serial_numbers?.length) {
        for (const sn of returnInput.serial_numbers) {
          const trimmedSn = sn.trim();
          if (!trimmedSn) continue;

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
    reusableCount,
    consumableCount,
    stocks,
    activeInUseTransactions,
    recentIn,
    recentOut,
    recentReturns,
    categories,
  ] = await Promise.all([
    prisma.inventoryItem.count({ where: { is_active: true } }),
    prisma.inventoryItem.count({ where: { is_active: true, type: "REUSABLE" } }),
    prisma.inventoryItem.count({ where: { is_active: true, type: "CONSUMABLE" } }),
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
        item: { type: "REUSABLE" },
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
      include: {
        items: {
          where: { is_active: true },
          include: { stock: true },
        },
      },
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

  // Category distribution
  const categoryDistribution = categories.map((c) => {
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
      total_reusable_items: reusableCount,
      total_consumable_items: consumableCount,
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

// =============================================================================
// FITUR: SELESAIKAN PENGGUNAAN BARANG & ALOKASI BARANG DIPINJAMKAN
// =============================================================================

export interface CompleteAndLoanItemInput {
  transaction_detail_id: string;
  item_id: string;
  qty_loaned: number | string;
  qty_returned: number | string;
  loaned_serials?: string[];
  returned_serials?: string[];
  return_condition?: string;
}

export interface CompleteAndLoanPayload {
  transaction_id: string;
  client_name: string;
  client_phone?: string;
  client_location: string;
  notes?: string;
  completion_date?: Date | string;
  warehouse_officer?: string;
  user_name?: string;
  created_by?: string;
  items: CompleteAndLoanItemInput[];
}

/**
 * Menyelesaikan transaksi barang keluar (OUT):
 * - Sebagian atau seluruh barang yang terpakai di pelanggan dialokasikan menjadi BARANG DIPINJAMKAN (type: "LOAN").
 * - Sisa barang yang tidak terpakai dikembalikan ke gudang (InventoryReturn) dan masuk kembali ke stok inventaris.
 * - Transaksi OUT asal ditandai sebagai SUDAH_KEMBALI (selesai).
 */
export async function processCompleteAndLoan(payload: CompleteAndLoanPayload) {
  if (!payload.transaction_id) {
    throw new Error("ID transaksi wajib disertakan.");
  }
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Daftar alokasi barang tidak boleh kosong.");
  }

  return await prisma.$transaction(async (tx) => {
    const outTx = await tx.inventoryTransaction.findUnique({
      where: { id: payload.transaction_id },
      include: {
        details: {
          include: {
            item: { include: { stock: true } },
          },
        },
      },
    });

    if (!outTx) {
      throw new Error(`Transaksi dengan ID ${payload.transaction_id} tidak ditemukan.`);
    }

    if (outTx.status === "SUDAH_KEMBALI" || outTx.status === "COMPLETED") {
      throw new Error("Transaksi ini sudah selesai atau seluruh barang telah dikembalikan.");
    }

    let totalQtyLoaned = new Prisma.Decimal(0);
    let totalQtyReturned = new Prisma.Decimal(0);

    // 1. Validasi alokasi untuk setiap item
    for (const input of payload.items) {
      const d = outTx.details.find((det) => det.id === input.transaction_detail_id);
      if (!d) {
        throw new Error(`Detail transaksi tidak ditemukan untuk ID ${input.transaction_detail_id}`);
      }

      const qLoaned = new Prisma.Decimal(input.qty_loaned || 0);
      const qReturned = new Prisma.Decimal(input.qty_returned || 0);
      const qRem = new Prisma.Decimal(d.qty_remaining);

      if (qLoaned.lessThan(0) || qReturned.lessThan(0)) {
        throw new Error("Kuantitas tidak boleh bernilai negatif.");
      }

      if (!qLoaned.add(qReturned).equals(qRem)) {
        throw new Error(
          `Untuk barang '${d.item.name}', jumlah dipinjamkan (${qLoaned}) + kembali (${qReturned}) harus tepat sama dengan sisa di teknisi (${qRem}).`
        );
      }

      const loanedSns = (input.loaned_serials || []).map((s) => s.trim()).filter(Boolean);
      const returnedSns = (input.returned_serials || []).map((s) => s.trim()).filter(Boolean);

      if (loanedSns.length > 0 && loanedSns.length !== Number(qLoaned)) {
        throw new Error(
          `Jumlah serial number yang dipinjamkan (${loanedSns.length}) tidak sesuai kuantitas dipinjamkan (${qLoaned}) untuk ${d.item.name}.`
        );
      }
      if (returnedSns.length > 0 && returnedSns.length !== Number(qReturned)) {
        throw new Error(
          `Jumlah serial number yang dikembalikan (${returnedSns.length}) tidak sesuai kuantitas kembali (${qReturned}) untuk ${d.item.name}.`
        );
      }

      totalQtyLoaned = totalQtyLoaned.add(qLoaned);
      totalQtyReturned = totalQtyReturned.add(qReturned);
    }

    if (totalQtyLoaned.greaterThan(0)) {
      if (!payload.client_name?.trim()) {
        throw new Error("Nama Pelanggan wajib diisi jika terdapat barang yang dipinjamkan.");
      }
      if (!payload.client_location?.trim()) {
        throw new Error("Lokasi Pemasangan di Pelanggan wajib diisi jika terdapat barang yang dipinjamkan.");
      }
    }

    const completionDate = payload.completion_date
      ? new Date(payload.completion_date)
      : new Date();

    let loanTx: any = null;

    // 2. Buat Transaksi Barang Dipinjamkan (LOAN) jika ada barang yang dipinjamkan
    if (totalQtyLoaned.greaterThan(0)) {
      const loanTxNumber = await generateTransactionNumber("LOAN", tx);
      loanTx = await tx.inventoryTransaction.create({
        data: {
          transaction_number: loanTxNumber,
          type: "LOAN",
          transaction_date: completionDate,
          pic_name: payload.client_name.trim(),
          pic_phone: payload.client_phone?.trim() || null,
          location: payload.client_location.trim(),
          purpose: `Dipinjamkan ke Pelanggan (Teknisi: ${outTx.pic_name || "-"})`,
          warehouse_officer: payload.warehouse_officer || outTx.warehouse_officer || "Admin Gudang",
          status: "DIPINJAMKAN",
          notes: payload.notes?.trim() || `Pemasangan/Peminjaman dari transaksi ${outTx.transaction_number}`,
          permit_number: outTx.transaction_number,
          created_by: payload.created_by || null,
        },
      });

      for (const input of payload.items) {
        const qLoaned = new Prisma.Decimal(input.qty_loaned || 0);
        if (qLoaned.greaterThan(0)) {
          const d = outTx.details.find((det) => det.id === input.transaction_detail_id)!;
          const loanedSns = (input.loaned_serials || []).map((s) => s.trim()).filter(Boolean);

          await tx.inventoryTransactionDetail.create({
            data: {
              transaction_id: loanTx.id,
              item_id: d.item_id,
              quantity: qLoaned,
              unit: d.unit,
              unit_serial_numbers: loanedSns.length ? JSON.stringify(loanedSns) : null,
              qty_returned: new Prisma.Decimal(0),
              qty_remaining: qLoaned,
              status: "ACTIVE",
              notes: `Dipinjamkan ke Pelanggan: ${payload.client_name.trim()}`,
            },
          });

          // Update status unit menjadi LOANED
          for (const sn of loanedSns) {
            await tx.inventoryItemUnit.updateMany({
              where: { serial_number: sn },
              data: {
                status: "LOANED",
                current_pic: payload.client_name.trim(),
                current_location: payload.client_location.trim(),
              },
            });
          }

          // Catat pergerakan stok peminjaman
          await tx.inventoryMovement.create({
            data: {
              item_id: d.item_id,
              movement_type: "OUT",
              quantity: qLoaned,
              balance_before: d.item.stock?.available_stock || new Prisma.Decimal(0),
              balance_after: d.item.stock?.available_stock || new Prisma.Decimal(0),
              reference_type: "TRANSACTION",
              reference_id: loanTx.id,
              transaction_id: loanTx.id,
              performed_by: payload.user_name || "Admin Gudang",
              notes: `Barang Dipinjamkan (${loanTxNumber}) ke Pelanggan: ${payload.client_name.trim()}`,
            },
          });
        }
      }
    }

    // 3. Buat Pengembalian Barang (RETURN) untuk sisa yang kembali ke gudang
    let returnTx: any = null;
    if (totalQtyReturned.greaterThan(0)) {
      const retNumber = await generateReturnNumber(tx);
      returnTx = await tx.inventoryReturn.create({
        data: {
          return_number: retNumber,
          out_transaction_id: outTx.id,
          pic_name: outTx.pic_name || "Teknisi",
          recipient_officer: payload.warehouse_officer || "Admin Gudang",
          return_date: completionDate,
          notes: `Pengembalian sisa barang tidak terpakai dari ${outTx.transaction_number}`,
          created_by: payload.created_by || null,
        },
      });

      for (const input of payload.items) {
        const qReturned = new Prisma.Decimal(input.qty_returned || 0);
        if (qReturned.greaterThan(0)) {
          const d = outTx.details.find((det) => det.id === input.transaction_detail_id)!;
          const returnedSns = (input.returned_serials || []).map((s) => s.trim()).filter(Boolean);
          const cond = input.return_condition || "BAIK";

          await tx.inventoryReturnDetail.create({
            data: {
              return_id: returnTx.id,
              transaction_detail_id: d.id,
              item_id: d.item_id,
              quantity: qReturned,
              condition: cond,
              serial_numbers: returnedSns.length ? JSON.stringify(returnedSns) : null,
              action_taken: "Dikembalikan ke Stok Gudang",
              notes: "Sisa pemakaian teknisi dikembalikan ke gudang",
            },
          });

          // Kembalikan ke stok siap pakai jika kondisi BAIK
          const stock = d.item.stock;
          const balBefore = stock ? new Prisma.Decimal(stock.available_stock) : new Prisma.Decimal(0);
          const balAfter = cond === "BAIK" ? balBefore.add(qReturned) : balBefore;

          if (stock) {
            await tx.inventoryStock.update({
              where: { id: stock.id },
              data: {
                total_in_use: Prisma.Decimal.max(0, new Prisma.Decimal(stock.total_in_use).sub(qReturned)),
                total_returned: new Prisma.Decimal(stock.total_returned).add(qReturned),
                total_damaged: cond !== "BAIK" ? new Prisma.Decimal(stock.total_damaged).add(qReturned) : stock.total_damaged,
                available_stock: balAfter,
              },
            });
          }

          // Update status unit menjadi AVAILABLE
          for (const sn of returnedSns) {
            await tx.inventoryItemUnit.updateMany({
              where: { serial_number: sn },
              data: {
                status: cond === "BAIK" ? "AVAILABLE" : "DAMAGED",
                condition: cond,
                current_pic: null,
                current_location: d.item.storage_location || "Gudang Utama",
              },
            });
          }

          await tx.inventoryMovement.create({
            data: {
              item_id: d.item_id,
              movement_type: cond === "BAIK" ? "RETURN_GOOD" : "RETURN_DAMAGED",
              quantity: qReturned,
              balance_before: balBefore,
              balance_after: balAfter,
              reference_type: "RETURN",
              reference_id: returnTx.id,
              transaction_id: outTx.id,
              performed_by: payload.user_name || payload.warehouse_officer || "Admin Gudang",
              notes: `Pengembalian Sisa Barang (${retNumber}) dari ${outTx.transaction_number}`,
            },
          });
        }
      }
    }

    // 4. Update transaksi OUT asal: kurangi qty_remaining menjadi 0 dan tandai SUDAH_KEMBALI
    for (const input of payload.items) {
      const d = outTx.details.find((det) => det.id === input.transaction_detail_id)!;
      const qReturned = new Prisma.Decimal(input.qty_returned || 0);
      const qLoaned = new Prisma.Decimal(input.qty_loaned || 0);

      await tx.inventoryTransactionDetail.update({
        where: { id: d.id },
        data: {
          qty_returned: new Prisma.Decimal(d.qty_returned).add(qReturned).add(qLoaned),
          qty_remaining: new Prisma.Decimal(0),
          status: "COMPLETED",
        },
      });
    }

    await tx.inventoryTransaction.update({
      where: { id: outTx.id },
      data: {
        status: "SUDAH_KEMBALI",
      },
    });

    // 5. Catat Audit Log
    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: outTx.id,
        action: "COMPLETE_AND_LOAN",
        user_id: payload.created_by,
        user_name: payload.user_name || payload.warehouse_officer || "Admin Gudang",
        data_after: JSON.stringify({
          loaned_qty: totalQtyLoaned.toString(),
          returned_qty: totalQtyReturned.toString(),
          client_name: payload.client_name,
          loan_transaction: loanTx?.transaction_number || null,
          return_transaction: returnTx?.return_number || null,
        }),
        reason: `Penyelesaian transaksi ${outTx.transaction_number}: ${totalQtyLoaned} unit dipinjamkan ke ${payload.client_name || '-'}, ${totalQtyReturned} unit dikembalikan ke gudang.`,
      },
    });

    return {
      success: true,
      loan_transaction: loanTx,
      return_transaction: returnTx,
      loaned_count: Number(totalQtyLoaned),
      returned_count: Number(totalQtyReturned),
    };
  });
}

/**
 * Menarik kembali barang yang dipinjamkan di pelanggan ke stok gudang
 */
export async function processReturnLoaned(payload: {
  loan_transaction_id: string;
  recipient_officer: string;
  condition?: string;
  notes?: string;
  user_name?: string;
  created_by?: string;
}) {
  return await prisma.$transaction(async (tx) => {
    const loanTx = await tx.inventoryTransaction.findUnique({
      where: { id: payload.loan_transaction_id },
      include: {
        details: {
          include: {
            item: { include: { stock: true } },
          },
        },
      },
    });

    if (!loanTx || loanTx.type !== "LOAN") {
      throw new Error(`Data peminjaman barang tidak ditemukan.`);
    }

    if (loanTx.status === "SUDAH_DITARIK") {
      throw new Error("Barang pinjaman ini sudah ditarik kembali sebelumnya.");
    }

    const cond = payload.condition || "BAIK";

    for (const d of loanTx.details) {
      const q = new Prisma.Decimal(d.quantity);
      let sns: string[] = [];
      if (d.unit_serial_numbers) {
        try {
          sns = JSON.parse(d.unit_serial_numbers);
        } catch {}
      }

      // Restock to warehouse
      const stock = d.item.stock;
      const balBefore = stock ? new Prisma.Decimal(stock.available_stock) : new Prisma.Decimal(0);
      const balAfter = cond === "BAIK" ? balBefore.add(q) : balBefore;

      if (stock) {
        await tx.inventoryStock.update({
          where: { id: stock.id },
          data: {
            total_in_use: Prisma.Decimal.max(0, new Prisma.Decimal(stock.total_in_use).sub(q)),
            total_returned: new Prisma.Decimal(stock.total_returned).add(q),
            total_damaged: cond !== "BAIK" ? new Prisma.Decimal(stock.total_damaged).add(q) : stock.total_damaged,
            available_stock: balAfter,
          },
        });
      }

      for (const sn of sns) {
        await tx.inventoryItemUnit.updateMany({
          where: { serial_number: sn },
          data: {
            status: cond === "BAIK" ? "AVAILABLE" : "DAMAGED",
            condition: cond,
            current_pic: null,
            current_location: d.item.storage_location || "Gudang Utama",
          },
        });
      }

      await tx.inventoryMovement.create({
        data: {
          item_id: d.item_id,
          movement_type: cond === "BAIK" ? "RETURN_GOOD" : "RETURN_DAMAGED",
          quantity: q,
          balance_before: balBefore,
          balance_after: balAfter,
          reference_type: "TRANSACTION",
          reference_id: loanTx.id,
          transaction_id: loanTx.id,
          performed_by: payload.user_name || payload.recipient_officer || "Admin Gudang",
          notes: `Penarikan Barang Dipinjamkan (${loanTx.transaction_number}) dari ${loanTx.pic_name || "Pelanggan"}`,
        },
      });

      await tx.inventoryTransactionDetail.update({
        where: { id: d.id },
        data: {
          qty_returned: q,
          qty_remaining: new Prisma.Decimal(0),
          status: "COMPLETED",
        },
      });
    }

    await tx.inventoryTransaction.update({
      where: { id: loanTx.id },
      data: {
        status: "SUDAH_DITARIK",
      },
    });

    await tx.inventoryAuditLog.create({
      data: {
        entity_type: "TRANSACTION",
        entity_id: loanTx.id,
        action: "RETURN_LOAN",
        user_id: payload.created_by,
        user_name: payload.user_name || payload.recipient_officer || "Admin Gudang",
        data_after: JSON.stringify({ status: "SUDAH_DITARIK", loan_tx: loanTx.transaction_number }),
        reason: `Penarikan perangkat dipinjamkan ${loanTx.transaction_number} dari ${loanTx.pic_name || "Pelanggan"}. Barang kembali ke gudang.`,
      },
    });

    return { success: true, message: `Barang dipinjamkan ${loanTx.transaction_number} berhasil ditarik kembali ke gudang.` };
  });
}
