export interface SearchableItemCandidate {
  id: string;
  code: string;
  name: string;
  unit?: string;
  category?: { name?: string | null } | null;
  category_name?: string | null;
  stock?: { available_stock: number | string } | null;
}

export function getItemCategoryLabel(item: SearchableItemCandidate): string {
  return (item.category?.name || item.category_name || "").trim();
}

export function getItemAvailableStock(item: SearchableItemCandidate): number {
  if (!item.stock || item.stock.available_stock === undefined || item.stock.available_stock === null) {
    return 0;
  }
  const n = Number(item.stock.available_stock);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Multi-token case-insensitive filtering by item code, name, or category.
 * E.g. query "htb 2fo" matches "[HTB-0003] HTB 2FO 4 LAN".
 */
export function filterSelectableInventoryItems<T extends SearchableItemCandidate>(
  items: T[],
  rawQuery: string
): T[] {
  const tokens = rawQuery
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);

  if (tokens.length === 0) return items;

  return items.filter((item) => {
    const haystack = `${item.code || ""} ${item.name || ""} ${getItemCategoryLabel(item)}`.toLowerCase();
    return tokens.every((token) => haystack.includes(token));
  });
}

export function formatInventoryTriggerLabel(
  item: SearchableItemCandidate,
  opts: {
    mode?: "bracket" | "parenthesis";
    showUnit?: boolean;
    showCategory?: boolean;
    showStock?: boolean;
  } = {}
): string {
  const mode = opts.mode || "bracket";
  const cat = getItemCategoryLabel(item);
  const avail = getItemAvailableStock(item);

  if (mode === "parenthesis") {
    return `${item.name} (${item.code})`;
  }

  let base = `[${item.code}] ${item.name}`;
  if (opts.showStock) {
    base += ` • Stok: ${avail}${item.unit ? ` ${item.unit}` : ""}`;
  } else if (opts.showUnit && item.unit) {
    base += ` (${item.unit})`;
  }
  if (opts.showCategory && cat) {
    base += ` [${cat}]`;
  }
  return base;
}
