"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { Search, ChevronDown, Check, X, Zap, Plus, Server, Trash2 } from "lucide-react";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  required?: boolean;
  className?: string;
  icon?: React.ReactNode;
  allowCreate?: boolean;
  onCreateOption?: (newOption: string) => void;
  createLabel?: string;
  allowDelete?: boolean;
  onDeleteOption?: (optionToDelete: string) => void;
  showCategories?: boolean;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Pilih...",
  required = false,
  className = "",
  icon,
  allowCreate = false,
  onCreateOption,
  createLabel = "Tambah sebagai pilihan baru",
  allowDelete = false,
  onDeleteOption,
  showCategories,
}: SearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<"all" | "mbps" | "gbps">("all");
  const [deletingOpt, setDeletingOpt] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-detect if options look like bandwidth options (Mbps & G)
  const isBandwidthList = useMemo(() => {
    return options.some((o) => o.endsWith("Mbps") || o.endsWith("G"));
  }, [options]);

  const hasMultipleBandwidthCategories = useMemo(() => {
    return options.some((o) => o.endsWith("Mbps")) && options.some((o) => o.endsWith("G"));
  }, [options]);

  const shouldShowCategories = showCategories ?? hasMultipleBandwidthCategories;

  // Close when clicked outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setDeletingOpt(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    } else {
      setSearch("");
      setDeletingOpt(null);
    }
  }, [isOpen]);

  // Filter options based on search query and category
  const filteredOptions = useMemo(() => {
    let list = options;

    if (shouldShowCategories) {
      if (activeCategory === "mbps") {
        list = list.filter((opt) => opt.endsWith("Mbps"));
      } else if (activeCategory === "gbps") {
        list = list.filter((opt) => opt.endsWith("G"));
      }
    }

    if (!search.trim()) return list;

    const cleanSearch = search.trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
    return list.filter((opt) => {
      const normalizedOpt = opt.toLowerCase().replace(",", ".").replace(/\s+/g, "");
      return normalizedOpt.includes(cleanSearch);
    });
  }, [options, search, activeCategory, shouldShowCategories]);

  const hasExactMatch = useMemo(() => {
    if (!search.trim()) return true;
    const cleanSearch = search.trim().toLowerCase().replace(",", ".").replace(/\s+/g, "");
    return options.some((o) => o.toLowerCase().replace(",", ".").replace(/\s+/g, "") === cleanSearch);
  }, [options, search]);

  const handleSelect = (opt: string) => {
    onChange(opt);
    setIsOpen(false);
    setDeletingOpt(null);
  };

  const handleCreate = (newOpt: string) => {
    const trimmed = newOpt.trim();
    if (!trimmed) return;
    if (onCreateOption) {
      onCreateOption(trimmed);
    }
    onChange(trimmed);
    setIsOpen(false);
    setDeletingOpt(null);
  };

  const handleDelete = (e: React.MouseEvent, opt: string) => {
    e.stopPropagation();
    if (onDeleteOption) {
      onDeleteOption(opt);
      if (value === opt) {
        onChange("");
      }
    }
    setDeletingOpt(null);
  };

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {/* Hidden input for HTML5 form validation */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          readOnly
          className="sr-only"
          tabIndex={-1}
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full px-3.5 py-2.5 rounded-xl border text-sm flex items-center justify-between text-left transition focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-slate-800 ${
          isOpen
            ? "border-blue-500 ring-2 ring-blue-500/20 shadow-xs"
            : "border-slate-300 dark:border-slate-700 hover:border-slate-400 dark:hover:border-slate-600"
        }`}
      >
        <div className="flex items-center space-x-2 truncate">
          {icon ? (
            icon
          ) : isBandwidthList ? (
            <Zap className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          ) : (
            <Server className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
          )}

          {value ? (
            <span className="font-bold text-slate-900 dark:text-slate-100 tracking-wide truncate">{value}</span>
          ) : (
            <span className="text-slate-400 dark:text-slate-500 truncate">{placeholder}</span>
          )}
        </div>

        <div className="flex items-center space-x-1 shrink-0 text-slate-400 dark:text-slate-500 ml-2">
          {value && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-600 dark:hover:text-slate-300"
              title="Hapus pilihan"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown
            className={`w-4 h-4 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-blue-600 dark:text-blue-400" : ""
            }`}
          />
        </div>
      </button>

      {/* Floating Dropdown Card */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-2xl p-2.5 animate-scaleUp">
          {/* Search Box */}
          <div className="relative mb-2">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400 dark:text-slate-500">
              <Search className="w-4 h-4" />
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Ketik untuk mencari..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white dark:focus:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 transition"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (filteredOptions.length > 0) {
                    handleSelect(filteredOptions[0]);
                  } else if (allowCreate && search.trim()) {
                    handleCreate(search);
                  }
                } else if (e.key === "Escape") {
                  setIsOpen(false);
                }
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Optional Category Quick Filter Chips (for bandwidth) */}
          {shouldShowCategories && (
            <div className="flex items-center space-x-1.5 pb-2 mb-1.5 border-b border-slate-100 dark:border-slate-800 overflow-x-auto">
              <button
                type="button"
                onClick={() => setActiveCategory("all")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                  activeCategory === "all"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Semua ({options.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("mbps")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                  activeCategory === "mbps"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Mbps (50 - 950)
              </button>
              <button
                type="button"
                onClick={() => setActiveCategory("gbps")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition shrink-0 ${
                  activeCategory === "gbps"
                    ? "bg-blue-600 text-white"
                    : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                }`}
              >
                Gbps (1G - 10G)
              </button>
            </div>
          )}

          {/* Action: Add new custom option if not matched and allowCreate is true */}
          {allowCreate && search.trim().length > 0 && !hasExactMatch && (
            <div className="mb-2 pb-2 border-b border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => handleCreate(search)}
                className="w-full flex items-center space-x-2 px-3 py-2 rounded-xl bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-800 hover:from-blue-100 hover:to-indigo-100 dark:hover:from-blue-900/50 dark:hover:to-indigo-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold transition cursor-pointer text-left"
              >
                <Plus className="w-4 h-4 shrink-0 text-blue-600 dark:text-blue-400" />
                <span className="truncate">
                  + Tambah & Simpan: &ldquo;{search.trim()}&rdquo;
                </span>
              </button>
            </div>
          )}

          {/* Options List */}
          <div className="max-h-56 overflow-y-auto space-y-0.5 pr-1 scrollbar-thin">
            {filteredOptions.map((opt) => {
              const isSelected = value === opt;
              const isConfirmingDelete = deletingOpt === opt;

              return (
                <div
                  key={opt}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs sm:text-sm font-semibold transition group ${
                    isSelected
                      ? "bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-bold border border-blue-200/80 dark:border-blue-800"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {/* Left: Option text and icon */}
                  <button
                    type="button"
                    onClick={() => handleSelect(opt)}
                    className="flex-1 flex items-center space-x-2 truncate text-left"
                  >
                    {isBandwidthList ? (
                      <span
                        className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded shrink-0 ${
                          opt.endsWith("G")
                            ? "bg-purple-100 dark:bg-purple-950/70 text-purple-700 dark:text-purple-300"
                            : "bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300"
                        }`}
                      >
                        {opt.endsWith("G") ? "GBPS" : "MBPS"}
                      </span>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
                    )}
                    <span className="truncate">{opt}</span>
                  </button>

                  {/* Right: Selected checkmark or Delete action (Admin only) */}
                  <div className="flex items-center space-x-1 shrink-0 ml-2">
                    {isSelected && !isConfirmingDelete && (
                      <Check className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
                    )}

                    {/* Inline Delete Confirmation if triggered */}
                    {isConfirmingDelete ? (
                      <div className="flex items-center space-x-1 animate-fadeIn">
                        <span className="text-[10px] text-rose-600 dark:text-rose-400 font-bold">Hapus?</span>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(e, opt)}
                          className="px-2 py-0.5 rounded-md bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-extrabold transition cursor-pointer"
                          title="Konfirmasi hapus"
                        >
                          Ya
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingOpt(null);
                          }}
                          className="px-2 py-0.5 rounded-md bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-[10px] font-bold transition cursor-pointer"
                          title="Batal"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      allowDelete &&
                      onDeleteOption && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingOpt(opt);
                          }}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition cursor-pointer"
                          title={`Hapus "${opt}" dari daftar`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )
                    )}
                  </div>
                </div>
              );
            })}

            {filteredOptions.length === 0 && (
              <div className="py-4 text-center">
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Tidak ditemukan pilihan cocok dengan &ldquo;{search}&rdquo;.
                </p>
                {allowCreate && search.trim() && (
                  <button
                    type="button"
                    onClick={() => handleCreate(search)}
                    className="mt-2 inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-xs transition"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    Tambah & Simpan &ldquo;{search.trim()}&rdquo;
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
