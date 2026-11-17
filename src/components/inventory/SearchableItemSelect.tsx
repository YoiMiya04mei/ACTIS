"use client";

import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Search, X } from "lucide-react";
import {
  filterSelectableInventoryItems,
  formatInventoryTriggerLabel,
  getItemAvailableStock,
  getItemCategoryLabel,
  type SearchableItemCandidate,
} from "@/lib/inventoryItemSearch";

interface SearchableItemSelectProps {
  id?: string;
  ariaLabel?: string;
  value: string;
  items: SearchableItemCandidate[];
  placeholder?: string;
  emptyItemsPlaceholder?: string;
  searchPlaceholder?: string;
  mode?: "bracket" | "parenthesis";
  showUnit?: boolean;
  showCategory?: boolean;
  showStock?: boolean;
  disableOutOfStock?: boolean;
  disabled?: boolean;
  triggerClassName?: string;
  onOpen?: () => void;
  onChange: (itemId: string) => void;
}

interface FloatingCoords {
  top?: number;
  bottom?: number;
  left: number;
  width: number;
}

export function SearchableItemSelect({
  id,
  ariaLabel,
  value,
  items,
  placeholder = "-- Pilih Barang --",
  emptyItemsPlaceholder = "-- Tidak ada barang --",
  searchPlaceholder = "Cari kode atau nama barang...",
  mode = "bracket",
  showUnit = false,
  showCategory = false,
  showStock = false,
  disableOutOfStock = false,
  disabled = false,
  triggerClassName = "",
  onOpen,
  onChange,
}: SearchableItemSelectProps) {
  const listboxId = useId();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [coords, setCoords] = useState<FloatingCoords | null>(null);

  const selectedItem = useMemo(
    () => items.find((it) => it.id === value) || null,
    [items, value]
  );

  const filteredItems = useMemo(
    () => filterSelectableInventoryItems(items, query),
    [items, query]
  );

  const isOptionDisabled = (item: SearchableItemCandidate) => {
    if (!disableOutOfStock) return false;
    return getItemAvailableStock(item) <= 0;
  };

  const computePosition = () => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const minPanelWidth = Math.max(rect.width, 320);
    const maxWidth = Math.min(minPanelWidth, window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - maxWidth - 8));
    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    if (spaceBelow < 270 && spaceAbove > spaceBelow) {
      setCoords({
        bottom: window.innerHeight - rect.top + 6,
        left,
        width: maxWidth,
      });
    } else {
      setCoords({
        top: rect.bottom + 6,
        left,
        width: maxWidth,
      });
    }
  };

  const closeDropdown = (restoreFocus = false) => {
    setOpen(false);
    setQuery("");
    setActiveIndex(-1);
    if (restoreFocus) {
      requestAnimationFrame(() => triggerRef.current?.focus());
    }
  };

  const openDropdown = () => {
    if (disabled) return;
    onOpen?.();
    computePosition();
    setOpen(true);

    const selectedIdx = items.findIndex((it) => it.id === value && !isOptionDisabled(it));
    if (selectedIdx >= 0) {
      setActiveIndex(selectedIdx);
    } else {
      setActiveIndex(items.findIndex((it) => !isOptionDisabled(it)));
    }
  };

  useEffect(() => {
    if (!open) return;

    const rafId = requestAnimationFrame(() => {
      computePosition();
      searchInputRef.current?.focus();
    });

    const handleScrollOrResize = () => computePosition();
    const handlePointerDown = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) return;
      if (triggerRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      closeDropdown(false);
    };

    window.addEventListener("scroll", handleScrollOrResize, true);
    window.addEventListener("resize", handleScrollOrResize);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", handleScrollOrResize, true);
      window.removeEventListener("resize", handleScrollOrResize);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, [open]);

  // Reset highlight cleanly when search query narrows list
  useEffect(() => {
    if (!open) return;
    const firstEnabled = filteredItems.findIndex((it) => !isOptionDisabled(it));
    setActiveIndex(firstEnabled);
  }, [query, open, filteredItems.length]);

  // Keep highlighted option visible when navigating via Arrow keys
  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const moveHighlight = (direction: 1 | -1) => {
    if (filteredItems.length === 0) return;
    let cursor = activeIndex;
    for (let step = 0; step < filteredItems.length; step++) {
      cursor =
        cursor < 0
          ? direction === 1
            ? 0
            : filteredItems.length - 1
          : (cursor + direction + filteredItems.length) % filteredItems.length;
      if (!isOptionDisabled(filteredItems[cursor])) {
        setActiveIndex(cursor);
        return;
      }
    }
  };

  const handleSelectItem = (item: SearchableItemCandidate) => {
    if (isOptionDisabled(item)) return;
    onChange(item.id);
    closeDropdown(true);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveHighlight(1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveHighlight(-1);
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      const candidate = filteredItems[activeIndex];
      if (candidate && !isOptionDisabled(candidate)) {
        handleSelectItem(candidate);
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeDropdown(true);
    } else if (e.key === "Tab") {
      closeDropdown(false);
    }
  };

  const handleTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      openDropdown();
    }
  };

  const displayLabel = selectedItem
    ? formatInventoryTriggerLabel(selectedItem, {
        mode,
        showUnit,
        showCategory,
        showStock,
      })
    : items.length === 0
      ? emptyItemsPlaceholder
      : placeholder;

  const activeDescendantId =
    activeIndex >= 0 && filteredItems[activeIndex]
      ? `${listboxId}-opt-${filteredItems[activeIndex].id}`
      : undefined;

  return (
    <>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        onClick={() => (open ? closeDropdown(false) : openDropdown())}
        onKeyDown={handleTriggerKeyDown}
        className={`w-full flex items-center justify-between gap-2 text-left rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 py-2 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 disabled:opacity-50 cursor-pointer ${triggerClassName}`}
      >
        <span
          className={`truncate ${
            selectedItem
              ? "font-medium text-slate-900 dark:text-slate-100"
              : "text-slate-500 dark:text-slate-400"
          }`}
        >
          {displayLabel}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${
            open ? "rotate-180 text-blue-600" : ""
          }`}
        />
      </button>

      {open &&
        coords &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={panelRef}
            style={{
              position: "fixed",
              left: `${coords.left}px`,
              width: `${coords.width}px`,
              ...(coords.top !== undefined ? { top: `${coords.top}px` } : {}),
              ...(coords.bottom !== undefined ? { bottom: `${coords.bottom}px` } : {}),
            }}
            className="z-[9999] rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Search Box Header */}
            <div className="p-2 border-b border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/50 space-y-1.5">
              <div className="relative flex items-center">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
                <input
                  ref={searchInputRef}
                  type="search"
                  role="combobox"
                  aria-expanded={open}
                  aria-controls={listboxId}
                  aria-activedescendant={activeDescendantId}
                  aria-label="Cari barang berdasarkan nama atau kode"
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={searchPlaceholder}
                  className="w-full pl-8 pr-7 py-1.5 text-sm sm:text-xs rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
                />
                {query && (
                  <button
                    type="button"
                    aria-label="Hapus kata pencarian"
                    onClick={() => {
                      setQuery("");
                      searchInputRef.current?.focus();
                    }}
                    className="absolute right-2 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div
                aria-live="polite"
                className="flex items-center justify-between px-0.5 text-[10px] text-slate-500 dark:text-slate-400"
              >
                <span>
                  {filteredItems.length} dari {items.length} barang
                </span>
                {value && (
                  <button
                    type="button"
                    onClick={() => {
                      onChange("");
                      closeDropdown(true);
                    }}
                    className="font-semibold text-rose-600 hover:underline cursor-pointer"
                  >
                    Reset pilihan
                  </button>
                )}
              </div>
            </div>

            {/* Results Listbox */}
            <div
              id={listboxId}
              role="listbox"
              aria-label="Daftar pilihan barang"
              className="max-h-60 overflow-y-auto divide-y divide-slate-100/80 dark:divide-slate-800/80 p-1"
            >
              {filteredItems.length === 0 ? (
                <div className="py-6 px-3 text-center text-xs text-slate-500 dark:text-slate-400">
                  Tidak ada barang yang cocok dengan &ldquo;{query}&rdquo;.
                </div>
              ) : (
                filteredItems.map((it, idx) => {
                  const isSelected = it.id === value;
                  const isDisabled = isOptionDisabled(it);
                  const isHighlighted = idx === activeIndex;
                  const cat = getItemCategoryLabel(it);
                  const avail = getItemAvailableStock(it);

                  return (
                    <button
                      key={it.id}
                      ref={(el) => {
                        optionRefs.current[idx] = el;
                      }}
                      id={`${listboxId}-opt-${it.id}`}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      disabled={isDisabled}
                      onMouseEnter={() => {
                        if (!isDisabled) setActiveIndex(idx);
                      }}
                      onClick={() => handleSelectItem(it)}
                      className={`w-full text-left px-2.5 py-2 rounded-lg flex items-center justify-between gap-2 transition text-xs ${
                        isDisabled
                          ? "opacity-45 cursor-not-allowed bg-slate-50/40 dark:bg-slate-900"
                          : isSelected
                            ? "bg-blue-50 dark:bg-blue-950/60 text-blue-900 dark:text-blue-100 font-semibold cursor-pointer"
                            : isHighlighted
                              ? "bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 cursor-pointer"
                              : "text-slate-800 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/60 cursor-pointer"
                      }`}
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 shrink-0">
                            {it.code}
                          </span>
                          <span className="font-bold truncate">{it.name}</span>
                        </div>

                        {(showUnit || showCategory || showStock) && (
                          <div className="flex flex-wrap items-center gap-1.5 text-[10px] text-slate-500 dark:text-slate-400">
                            {showStock && (
                              <span
                                className={`font-semibold ${
                                  avail <= 0
                                    ? "text-rose-600 dark:text-rose-400"
                                    : "text-emerald-700 dark:text-emerald-400"
                                }`}
                              >
                                Stok: {avail}
                                {it.unit ? ` ${it.unit}` : ""}
                              </span>
                            )}
                            {!showStock && showUnit && it.unit && (
                              <span>Satuan: {it.unit}</span>
                            )}
                            {showCategory && cat && (
                              <span
                                className={`px-1.5 py-0.2 rounded font-bold ${
                                  cat.toLowerCase() === "aktif"
                                    ? "bg-blue-100/80 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                    : "bg-amber-100/80 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300"
                                }`}
                              >
                                {cat}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
