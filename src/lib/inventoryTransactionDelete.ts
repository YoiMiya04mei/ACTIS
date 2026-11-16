import { parseSerialList } from "./inventoryClientFinish";

export interface DeleteDetailInput {
  id: string;
  item_id: string;
  quantity: unknown;
  qty_used?: unknown;
  qty_returned?: unknown;
  qty_remaining?: unknown;
  unit: string;
  status?: string | null;
  unit_serial_numbers?: string | null;
  item?: {
    id: string;
    name: string;
    type: string;
    storage_location?: string | null;
    stock?: {
      id: string;
      available_stock: unknown;
      total_in: unknown;
      total_out: unknown;
      total_in_use: unknown;
      total_returned: unknown;
      total_consumed: unknown;
      total_damaged: unknown;
      total_lost: unknown;
    } | null;
  } | null;
}

export interface DeleteReturnInput {
  id: string;
  details?: Array<{
    transaction_detail_id: string;
    item_id: string;
    quantity: unknown;
    condition: string;
    serial_numbers?: string | null;
  }>;
}

export interface ExistingItemUnitState {
  serial_number: string;
  item_id: string;
  status: string;
}

export interface StockInReversalPlan {
  stockDecrementsByItem: Map<
    string,
    {
      stockId: string;
      decrementTotalIn: number;
      decrementAvailable: number;
    }
  >;
  serialsToDelete: Array<{ itemId: string; serialNumber: string }>;
}

export interface StockOutReversalPlan {
  stockUpdatesByItem: Map<
    string,
    {
      stockId: string;
      addAvailable: number;
      subTotalOut: number;
      subTotalInUse: number;
      subTotalReturned: number;
      subTotalConsumed: number;
      subTotalDamaged: number;
      subTotalLost: number;
    }
  >;
  serialsToRestoreAvailable: Array<{
    itemId: string;
    serialNumber: string;
    storageLocation: string;
  }>;
}

/**
 * Computes and validates stock & SN reversals before deleting an IN transaction.
 * Rejects deletion if available stock is lower than incoming quantity or if any
 * incoming SN unit is currently in-use/consumed/damaged/lost elsewhere.
 */
export function computeStockInDeleteReversal(
  details: DeleteDetailInput[],
  existingUnitsBySn: Map<string, ExistingItemUnitState>
): StockInReversalPlan {
  const stockDecrementsByItem = new Map<
    string,
    { stockId: string; decrementTotalIn: number; decrementAvailable: number }
  >();
  const serialsToDelete: Array<{ itemId: string; serialNumber: string }> = [];

  for (const detail of details) {
    const qty = Number(detail.quantity || 0);
    const itemName = detail.item?.name || detail.item_id;
    const stock = detail.item?.stock;

    if (stock && qty > 0) {
      const prev = stockDecrementsByItem.get(detail.item_id) || {
        stockId: stock.id,
        decrementTotalIn: 0,
        decrementAvailable: 0,
      };
      const nextDec = prev.decrementAvailable + qty;
      const available = Number(stock.available_stock || 0);
      if (available < nextDec) {
        throw new Error(
          `Transaksi Masuk tidak dapat dihapus karena stok tersedia '${itemName}' (${available} ${detail.unit}) lebih kecil dari kuantitas masuk (${nextDec} ${detail.unit}) — sebagian stok sudah digunakan.`
        );
      }
      stockDecrementsByItem.set(detail.item_id, {
        stockId: stock.id,
        decrementTotalIn: prev.decrementTotalIn + qty,
        decrementAvailable: nextDec,
      });
    }

    const sns = parseSerialList(detail.unit_serial_numbers);
    for (const sn of sns) {
      const existing = existingUnitsBySn.get(sn);
      if (existing && existing.item_id === detail.item_id && existing.status !== "AVAILABLE") {
        throw new Error(
          `Transaksi Masuk tidak dapat dihapus karena Serial Number '${sn}' pada '${itemName}' sedang berstatus '${existing.status}' (terpakai transaksi lain). Hapus transaksi keluar terkait terlebih dahulu.`
        );
      }
      serialsToDelete.push({ itemId: detail.item_id, serialNumber: sn });
    }
  }

  return { stockDecrementsByItem, serialsToDelete };
}

/**
 * Computes stock counter & SN reversals before deleting an OUT transaction,
 * accounting for consumables, client-consumed reusable units, and any recorded returns.
 */
export function computeStockOutDeleteReversal(
  details: DeleteDetailInput[],
  returns: DeleteReturnInput[] = []
): StockOutReversalPlan {
  const stockUpdatesByItem = new Map<
    string,
    {
      stockId: string;
      addAvailable: number;
      subTotalOut: number;
      subTotalInUse: number;
      subTotalReturned: number;
      subTotalConsumed: number;
      subTotalDamaged: number;
      subTotalLost: number;
    }
  >();

  const serialMap = new Map<
    string,
    { itemId: string; serialNumber: string; storageLocation: string }
  >();

  const hasReturnRecords = returns.length > 0;

  for (const detail of details) {
    const qtyOut = Number(detail.quantity || 0);
    const isConsumable = detail.item?.type === "CONSUMABLE" || detail.status === "CONSUMED";
    const stock = detail.item?.stock;

    let retGood = 0;
    let retDamaged = 0;
    let retLost = 0;
    const goodReturnedSns = new Set<string>();

    if (hasReturnRecords) {
      for (const ret of returns) {
        for (const rd of ret.details || []) {
          if (rd.transaction_detail_id !== detail.id) continue;
          const rQty = Number(rd.quantity || 0);
          if (rd.condition === "BAIK") {
            retGood += rQty;
            for (const sn of parseSerialList(rd.serial_numbers)) {
              goodReturnedSns.add(sn);
            }
          } else if (rd.condition === "RUSAK_RINGAN" || rd.condition === "RUSAK_BERAT") {
            retDamaged += rQty;
          } else if (rd.condition === "HILANG") {
            retLost += rQty;
          }
        }
      }
    } else if (!isConsumable && Number(detail.qty_returned || 0) > 0) {
      // Legacy fallback when return detail rows aren't present
      retGood = Number(detail.qty_returned || 0);
    }

    const usedQty = Number(detail.qty_used || 0);
    const inUseQty = isConsumable ? 0 : Number(detail.qty_remaining || 0);

    if (stock && qtyOut > 0) {
      const prev = stockUpdatesByItem.get(detail.item_id) || {
        stockId: stock.id,
        addAvailable: 0,
        subTotalOut: 0,
        subTotalInUse: 0,
        subTotalReturned: 0,
        subTotalConsumed: 0,
        subTotalDamaged: 0,
        subTotalLost: 0,
      };

      if (isConsumable) {
        stockUpdatesByItem.set(detail.item_id, {
          stockId: stock.id,
          addAvailable: prev.addAvailable + qtyOut,
          subTotalOut: prev.subTotalOut + qtyOut,
          subTotalInUse: prev.subTotalInUse,
          subTotalReturned: prev.subTotalReturned,
          subTotalConsumed: prev.subTotalConsumed + qtyOut,
          subTotalDamaged: prev.subTotalDamaged,
          subTotalLost: prev.subTotalLost,
        });
      } else {
        const netMissingFromAvailable = Math.max(0, qtyOut - retGood);
        stockUpdatesByItem.set(detail.item_id, {
          stockId: stock.id,
          addAvailable: prev.addAvailable + netMissingFromAvailable,
          subTotalOut: prev.subTotalOut + qtyOut,
          subTotalInUse: prev.subTotalInUse + inUseQty,
          subTotalReturned: prev.subTotalReturned + retGood,
          subTotalConsumed: prev.subTotalConsumed + usedQty,
          subTotalDamaged: prev.subTotalDamaged + retDamaged,
          subTotalLost: prev.subTotalLost + retLost,
        });
      }
    }

    const detailSns = parseSerialList(detail.unit_serial_numbers);
    const storageLocation = detail.item?.storage_location || "Gudang Utama";
    for (const sn of detailSns) {
      // Skip SNs already returned in BAIK condition so we never overwrite a newer OUT transaction
      if (goodReturnedSns.has(sn)) continue;
      serialMap.set(`${detail.item_id}::${sn}`, {
        itemId: detail.item_id,
        serialNumber: sn,
        storageLocation,
      });
    }
  }

  return {
    stockUpdatesByItem,
    serialsToRestoreAvailable: Array.from(serialMap.values()),
  };
}
