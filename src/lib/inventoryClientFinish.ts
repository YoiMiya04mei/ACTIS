export interface FinishDetailInputSummary {
  id: string;
  item_id: string;
  quantity: unknown;
  qty_used?: unknown;
  qty_returned?: unknown;
  qty_remaining: unknown;
  unit: string;
  status?: string | null;
  unit_serial_numbers?: string | null;
  item?: {
    id: string;
    name: string;
    code?: string | null;
    type: string;
    unit?: string | null;
  } | null;
}

export interface FinishClientItemPayload {
  transaction_detail_id: string;
  quantity: number | string;
  serial_numbers?: string[];
}

export interface FinishClientPayload {
  client_name: string;
  client_address: string;
  client_phone?: string;
  notes?: string;
  items: FinishClientItemPayload[];
}

export function parseSerialList(raw?: string | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((s) => String(s).trim()).filter(Boolean);
    }
  } catch {
    // ignore malformed json
  }
  return [];
}

/**
 * Computes remaining un-consumed and un-returned serial numbers for a transaction detail.
 */
export function computeRemainingSerialsForDetail(
  detail: { id: string; unit_serial_numbers?: string | null },
  clientUsages: Array<{ items?: Array<{ transaction_detail_id: string; serial_numbers?: string | null }> }> = [],
  returns: Array<{ details?: Array<{ transaction_detail_id: string; serial_numbers?: string | null }> }> = []
): string[] {
  const original = parseSerialList(detail.unit_serial_numbers);
  if (original.length === 0) return [];

  const consumedOrReturned = new Set<string>();
  for (const usage of clientUsages) {
    for (const ui of usage.items || []) {
      if (ui.transaction_detail_id === detail.id) {
        for (const sn of parseSerialList(ui.serial_numbers)) {
          consumedOrReturned.add(sn);
        }
      }
    }
  }
  for (const ret of returns) {
    for (const rd of ret.details || []) {
      if (rd.transaction_detail_id === detail.id) {
        for (const sn of parseSerialList(rd.serial_numbers)) {
          consumedOrReturned.add(sn);
        }
      }
    }
  }

  return original.filter((sn) => !consumedOrReturned.has(sn));
}

export interface ValidatedClientAllocation {
  allocatedByDetail: Map<string, number>;
  usedSerialsByDetail: Map<string, Array<{ sn: string; clientName: string; clientAddress: string }>>;
  totalUsedUnits: number;
  totalPendingReturnUnits: number;
}

/**
 * Validates multi-client, multi-item allocations against an OUT transaction's details.
 */
export function validateFinishClientAllocations(
  details: FinishDetailInputSummary[],
  clients: FinishClientPayload[],
  existingClientUsages: Array<{ items?: Array<{ transaction_detail_id: string; serial_numbers?: string | null }> }> = [],
  existingReturns: Array<{ details?: Array<{ transaction_detail_id: string; serial_numbers?: string | null }> }> = []
): ValidatedClientAllocation {
  const detailMap = new Map(details.map((d) => [d.id, d]));
  const allocatedByDetail = new Map<string, number>();
  const usedSerialsByDetail = new Map<
    string,
    Array<{ sn: string; clientName: string; clientAddress: string }>
  >();
  const globalSeenSerials = new Map<string, Set<string>>();

  let totalUsedUnits = 0;

  for (let cIdx = 0; cIdx < clients.length; cIdx++) {
    const client = clients[cIdx];
    const activeItems = (client.items || []).filter((i) => Number(i.quantity || 0) > 0);
    if (activeItems.length === 0) continue;

    if (!client.client_name?.trim()) {
      throw new Error(`Client #${cIdx + 1}: Nama Client wajib diisi.`);
    }
    if (!client.client_address?.trim()) {
      throw new Error(`Client #${cIdx + 1} (${client.client_name.trim()}): Alamat Client wajib diisi.`);
    }

    for (const itemInput of activeItems) {
      const detail = detailMap.get(itemInput.transaction_detail_id);
      if (!detail) {
        throw new Error(`Detail barang keluar '${itemInput.transaction_detail_id}' tidak ditemukan pada transaksi ini.`);
      }

      const qty = Number(itemInput.quantity);
      if (!Number.isFinite(qty) || qty <= 0) {
        throw new Error(`Kuantitas barang '${detail.item?.name || detail.id}' harus lebih besar dari 0.`);
      }

      const prevAllocated = allocatedByDetail.get(detail.id) || 0;
      const nextAllocated = prevAllocated + qty;
      const isConsumable = detail.item?.type === "CONSUMABLE" || detail.status === "CONSUMED";
      const maxAllocatable = isConsumable
        ? Math.max(0, Number(detail.quantity) - Number(detail.qty_used || 0))
        : Number(detail.qty_remaining);

      if (nextAllocated > maxAllocatable) {
        throw new Error(
          `Total penggunaan barang '${detail.item?.name || detail.id}' (${nextAllocated}) melebihi sisa yang dapat dipakai (${maxAllocatable}).`
        );
      }

      allocatedByDetail.set(detail.id, nextAllocated);
      if (!isConsumable) {
        totalUsedUnits += qty;
      }

      const availableSns = computeRemainingSerialsForDetail(
        detail,
        existingClientUsages,
        existingReturns
      );
      const cleanSns = (itemInput.serial_numbers || []).map((s) => s.trim()).filter(Boolean);

      if (availableSns.length > 0 && cleanSns.length !== qty) {
        throw new Error(
          `Barang '${detail.item?.name || detail.id}' untuk Client '${client.client_name.trim()}' wajib memilih tepat ${qty} Serial Number.`
        );
      }

      if (cleanSns.length > 0) {
        const availableSet = new Set(availableSns);
        let seenForDetail = globalSeenSerials.get(detail.id);
        if (!seenForDetail) {
          seenForDetail = new Set<string>();
          globalSeenSerials.set(detail.id, seenForDetail);
        }

        const listForDetail = usedSerialsByDetail.get(detail.id) || [];
        for (const sn of cleanSns) {
          if (availableSet.size > 0 && !availableSet.has(sn)) {
            throw new Error(
              `Serial Number '${sn}' tidak tersedia pada sisa barang '${detail.item?.name || detail.id}'.`
            );
          }
          if (seenForDetail.has(sn)) {
            throw new Error(
              `Serial Number '${sn}' pada barang '${detail.item?.name || detail.id}' tidak boleh dipakai oleh lebih dari satu client.`
            );
          }
          seenForDetail.add(sn);
          listForDetail.push({
            sn,
            clientName: client.client_name.trim(),
            clientAddress: client.client_address.trim(),
          });
        }
        usedSerialsByDetail.set(detail.id, listForDetail);
      }
    }
  }

  let totalPendingReturnUnits = 0;
  for (const detail of details) {
    const isConsumable = detail.item?.type === "CONSUMABLE" || detail.status === "CONSUMED";
    if (isConsumable) continue;
    const alloc = allocatedByDetail.get(detail.id) || 0;
    const remainingAfter = Math.max(0, Number(detail.qty_remaining) - alloc);
    totalPendingReturnUnits += remainingAfter;
  }

  return {
    allocatedByDetail,
    usedSerialsByDetail,
    totalUsedUnits,
    totalPendingReturnUnits,
  };
}
