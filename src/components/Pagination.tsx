"use client";

import React, { useState, useRef, useEffect } from "react";
import { ListOrdered, ChevronDown } from "lucide-react";

// ============================================================================
// 1. PAGE SIZE SELECTOR COMPONENT
// ============================================================================
export interface PageSizeSelectorProps {
  value: number;
  onChange: (size: number) => void;
  options?: number[];
  className?: string;
}

export function PageSizeSelector({
  value,
  onChange,
  options = [10, 30, 50, 100],
  className = "",
}: PageSizeSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div
      ref={containerRef}
      className={`relative inline-flex items-center shrink-0 ${className}`}
    >
      <div
        className={`inline-flex items-stretch rounded-xl border bg-white dark:bg-slate-900 shadow-xs transition ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20"
            : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
        }`}
      >
        {/* Left Icon Button (List Ordered Icon) */}
        <div
          className="flex items-center justify-center px-2.5 py-2 bg-slate-50 dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 rounded-l-xl select-none"
          title="Panjang Halaman (Page Length)"
        >
          <ListOrdered className="w-4 h-4 text-slate-600 dark:text-slate-300" />
        </div>

        {/* Dropdown Toggle Button */}
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 rounded-r-xl hover:bg-slate-50 dark:hover:bg-slate-800/80 focus:outline-none transition min-w-[62px] justify-between"
          aria-expanded={isOpen}
          aria-haspopup="listbox"
          title="Pilih Jumlah Data Per Halaman"
        >
          <span className="font-bold text-slate-800 dark:text-slate-100">{value}</span>
          <ChevronDown
            className={`w-3.5 h-3.5 text-slate-500 dark:text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
            }`}
          />
        </button>
      </div>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className="absolute left-0 sm:left-auto sm:right-0 top-full mt-1.5 w-24 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 z-50 animate-fadeIn"
          role="listbox"
        >
          {options.map((opt) => {
            const isSelected = opt === value;
            return (
              <button
                key={opt}
                type="button"
                role="option"
                aria-selected={isSelected}
                onClick={() => {
                  onChange(opt);
                  setIsOpen(false);
                }}
                className={`w-full text-center py-2 text-xs font-bold transition flex items-center justify-center ${
                  isSelected
                    ? "bg-blue-600 text-white"
                    : "text-slate-700 dark:text-slate-300 hover:bg-slate-100/90 dark:hover:bg-slate-800"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============================================================================
// 2. PAGINATION NAVIGATOR COMPONENT
// ============================================================================
export interface PaginationNavigatorProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  className?: string;
  entryLabel?: string;
}

export function PaginationNavigator({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  className = "",
  entryLabel = "entries",
}: PaginationNavigatorProps) {
  // Hitung range data yang sedang ditampilkan
  const startIndex = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(currentPage * pageSize, totalItems);

  // Buat array halaman pintar dengan elipsis (...)
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      const pages: number[] = [];
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
      return pages;
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [
        1,
        "...",
        totalPages - 4,
        totalPages - 3,
        totalPages - 2,
        totalPages - 1,
        totalPages,
      ];
    }

    return [
      1,
      "...",
      currentPage - 1,
      currentPage,
      currentPage + 1,
      "...",
      totalPages,
    ];
  };

  const pageNumbers = getPageNumbers();

  return (
    <div
      className={`flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 pb-2 px-1 text-xs text-slate-600 dark:text-slate-400 ${className}`}
    >
      {/* Kiri: Showing X to Y of Z entries */}
      <div className="font-medium text-slate-600 dark:text-slate-400 select-none text-center sm:text-left">
        Showing{" "}
        <span className="font-bold text-slate-800 dark:text-slate-200">
          {startIndex.toLocaleString()}
        </span>{" "}
        to{" "}
        <span className="font-bold text-slate-800 dark:text-slate-200">
          {endIndex.toLocaleString()}
        </span>{" "}
        of{" "}
        <span className="font-bold text-slate-900 dark:text-slate-100">
          {totalItems.toLocaleString()}
        </span>{" "}
        {entryLabel}
      </div>

      {/* Kanan: Pagination Navigator Group [Previous] [1] [2] ... [Next] */}
      <nav
        aria-label="Pagination"
        className="inline-flex items-center rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-xs overflow-hidden divide-x divide-slate-200 dark:divide-slate-800 select-none"
      >
        {/* Tombol Previous */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1 || totalPages === 0}
          className={`px-3 py-1.5 text-xs font-semibold transition ${
            currentPage <= 1 || totalPages === 0
              ? "text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed pointer-events-none"
              : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-label="Previous Page"
        >
          Previous
        </button>

        {/* Nomor-nomor halaman */}
        {pageNumbers.map((page, idx) => {
          if (page === "...") {
            return (
              <span
                key={`ellipsis-${idx}`}
                className="px-2.5 py-1.5 text-xs text-slate-400 dark:text-slate-500 font-bold bg-slate-50/40 dark:bg-slate-800/40"
              >
                ...
              </span>
            );
          }

          const pageNum = Number(page);
          const isActive = pageNum === currentPage;

          return (
            <button
              key={`page-${pageNum}`}
              type="button"
              onClick={() => onPageChange(pageNum)}
              className={`px-3.5 py-1.5 text-xs font-bold transition min-w-[34px] text-center ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
              aria-current={isActive ? "page" : undefined}
            >
              {pageNum}
            </button>
          );
        })}

        {/* Tombol Next */}
        <button
          type="button"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages || totalPages === 0}
          className={`px-3 py-1.5 text-xs font-semibold transition ${
            currentPage >= totalPages || totalPages === 0
              ? "text-slate-300 dark:text-slate-600 bg-slate-50/50 dark:bg-slate-800/30 cursor-not-allowed pointer-events-none"
              : "text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800"
          }`}
          aria-label="Next Page"
        >
          Next
        </button>
      </nav>
    </div>
  );
}

