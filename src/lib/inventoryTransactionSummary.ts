export interface OutTransactionDetailInput {
  id?: string;
  item_id?: string;
  quantity: unknown;
  qty_used?: unknown;
  qty_returned?: unknown;
  status?: string | null;
  unit?: string | null;
  item?: {
    id: string;
    name?: string | null;
    code?: string | null;
    unit?: string | null;
    type?: string | null;
    stock?: {
      total_in?: unknown;
    } | null;
  } | null;
}

export interface OutTransactionReturnInput {
  details?: Array<{
    quantity: unknown;
  }>;
}

export interface LinkedLoanInput {
  permit_number?: string | null;
  details?: Array<{
    quantity: unknown;
  }>;
}

export interface OutTransactionClientUsageInput {
  items?: Array<{
    transaction_detail_id?: string;
    item_id?: string;
    quantity: unknown;
  }>;
}

export interface OutTransactionInput {
  transaction_number?: string;
  details?: OutTransactionDetailInput[];
  returns?: OutTransactionReturnInput[];
  client_usages?: OutTransactionClientUsageInput[];
}

export interface OutTransactionSummary {
  barang_masuk: number;
  barang_keluar: number;
  barang_terpakai: number;
  barang_kembali: number;
  unit: string;
  items_tooltip: string;
}

/**
 * Computes consistent warehouse-flow metrics for an OUT transaction:
 * - barang_masuk: total stock IN across unique items involved in this transaction
 * - barang_keluar: total quantity issued in this OUT transaction
 * - barang_terpakai: consumable quantities + reusable quantities loaned to clients
 * - barang_kembali: quantities returned to warehouse stock via InventoryReturn
 */
export function computeOutTransactionSummary(
  tx: OutTransactionInput,
  linkedLoans: LinkedLoanInput[] = []
): OutTransactionSummary {
  const details = Array.isArray(tx.details) ? tx.details : [];
  const returns = Array.isArray(tx.returns) ? tx.returns : [];

  const seenMasukItemIds = new Set<string>();
  const uniqueUnits = new Set<string>();
  const tooltipParts: string[] = [];

  let barangMasuk = 0;
  let barangKeluar = 0;
  let consumableOut = 0;
  let reusableUsedQty = 0;
  let detailQtyReturned = 0;

  const consumableDetailIds = new Set<string>();

  for (const d of details) {
    const qty = Number(d.quantity || 0);
    const unit = d.unit || d.item?.unit || "";

    barangKeluar += qty;
    detailQtyReturned += Number(d.qty_returned || 0);

    if (unit) uniqueUnits.add(unit);

    const itemId = d.item?.id || d.item_id;
    if (itemId && !seenMasukItemIds.has(itemId)) {
      seenMasukItemIds.add(itemId);
      barangMasuk += Number(d.item?.stock?.total_in || 0);
    }

    if (d.item?.type === "CONSUMABLE" || d.status === "CONSUMED") {
      consumableOut += qty;
      if (d.id) consumableDetailIds.add(d.id);
    } else {
      reusableUsedQty += Number(d.qty_used || 0);
    }

    if (d.item?.name) {
      tooltipParts.push(`${d.item.name} (${qty} ${unit || "Unit"})`);
    }
  }

  // Fallback for client_usages on reusable items when qty_used isn't populated on detail
  let clientUsageReusableQty = 0;
  for (const usage of Array.isArray(tx.client_usages) ? tx.client_usages : []) {
    for (const ui of usage.items || []) {
      if (ui.transaction_detail_id && consumableDetailIds.has(ui.transaction_detail_id)) {
        continue;
      }
      clientUsageReusableQty += Number(ui.quantity || 0);
    }
  }

  let returnsQty = 0;
  for (const ret of returns) {
    for (const rd of ret.details || []) {
      returnsQty += Number(rd.quantity || 0);
    }
  }

  let loanQty = 0;
  for (const loan of linkedLoans) {
    for (const ld of loan.details || []) {
      loanQty += Number(ld.quantity || 0);
    }
  }

  const effectiveReturned =
    returns.length === 0 &&
    linkedLoans.length === 0 &&
    reusableUsedQty === 0 &&
    clientUsageReusableQty === 0 &&
    consumableOut === 0 &&
    detailQtyReturned > 0
      ? detailQtyReturned
      : returnsQty;

  const inferredLoanQty = Math.max(0, detailQtyReturned - effectiveReturned);
  const reusableTerpakai = Math.max(reusableUsedQty, clientUsageReusableQty, loanQty, inferredLoanQty);
  const barangTerpakai = consumableOut + reusableTerpakai;

  return {
    barang_masuk: barangMasuk,
    barang_keluar: barangKeluar,
    barang_terpakai: barangTerpakai,
    barang_kembali: effectiveReturned,
    unit: uniqueUnits.size === 1 ? Array.from(uniqueUnits)[0] : "",
    items_tooltip: tooltipParts.join(", "),
  };
}
