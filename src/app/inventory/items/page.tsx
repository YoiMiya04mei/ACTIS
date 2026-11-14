"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Boxes,
  PlusCircle,
  Search,
  Filter,
  Download,
  Upload,
  FileSpreadsheet,
  FileText,
  Edit2,
  Trash2,
  Eye,
  RefreshCw,
  X,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Cable,
  Tag,
  MapPin,
  Barcode,
} from "lucide-react";
import { useCurrentUser } from "@/context/UserContext";

interface Item {
  id: string;
  code: string;
  name: string;
  category_id: string;
  category?: { id: string; name: string };
  type: "REUSABLE" | "CONSUMABLE";
  brand?: string | null;
  model?: string | null;
  serial_number?: string | null;
  unit: string;
  min_stock: number;
  storage_location?: string | null;
  description?: string | null;
  image_url?: string | null;
  is_active: boolean;
  stock?: {
    available_stock: number;
    total_in: number;
    total_out: number;
    total_in_use: number;
    total_returned: number;
    total_consumed: number;
    total_damaged: number;
    total_lost: number;
  };
  _count?: {
    units: number;
    transaction_details: number;
  };
}

export default function MasterBarangPage() {
  const { currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "admin" || currentUser?.role === "warehouse_admin";

  const [items, setItems] = useState<Item[]>([]);
  const [categories, setCategories] = useState<Array<{ id: string; name: string }>>([
    { id: "Aktif", name: "Aktif" },
    { id: "Pasif", name: "Pasif" },
  ]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedType, setSelectedType] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("true");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modals
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<any>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [notification, setNotification] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    category_id: "",
    type: "REUSABLE" as "REUSABLE" | "CONSUMABLE",
    brand: "",
    model: "",
    serial_number: "",
    unit: "Unit",
    min_stock: "5",
    storage_location: "Gudang Utama",
    description: "",
    initial_stock: "0",
    serial_numbers_text: "",
  });

  const fetchCategories = async () => {
    try {
      const res = await fetch("/api/inventory/categories");
      const json = await res.json();
      if (json.success) setCategories(json.data);
    } catch {}
  };

  const fetchItems = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    setLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        category_id: selectedCategory,
        type: selectedType,
        is_active: selectedStatus,
        page: String(page),
        limit: "15",
      });

      const res = await fetch(`/api/inventory/items?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        setTotalPages(json.pagination.totalPages || 1);
        setTotalCount(json.pagination.total || 0);
      }
    } catch (err: any) {
      setNotification({ type: "error", message: err.message || "Gagal memuat barang." });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [search, selectedCategory, selectedType, selectedStatus, page]);

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenAdd = () => {
    setEditingItem(null);
    setFormData({
      code: "",
      name: "",
      category_id: categories[0]?.id || "",
      type: "REUSABLE",
      brand: "",
      model: "",
      serial_number: "",
      unit: "Unit",
      min_stock: "5",
      storage_location: "Gudang Utama - Rak A1",
      description: "",
      initial_stock: "0",
      serial_numbers_text: "",
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (item: Item) => {
    setEditingItem(item);
    setFormData({
      code: item.code,
      name: item.name,
      category_id: item.category_id,
      type: item.type,
      brand: item.brand || "",
      model: item.model || "",
      serial_number: item.serial_number || "",
      unit: item.unit,
      min_stock: String(item.min_stock),
      storage_location: item.storage_location || "",
      description: item.description || "",
      initial_stock: "0",
      serial_numbers_text: "",
    });
    setIsAddEditModalOpen(true);
  };

  const handleOpenDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/inventory/items/${id}`);
      const json = await res.json();
      if (json.success) {
        setDetailItem(json.data);
        setIsDetailModalOpen(true);
      }
    } catch {}
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const serials = formData.serial_numbers_text
        ? formData.serial_numbers_text.split("\n").map((s) => s.trim()).filter(Boolean)
        : [];

      const payload = {
        ...formData,
        unit_serial_numbers: serials,
      };

      let res;
      if (editingItem) {
        res = await fetch(`/api/inventory/items/${editingItem.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/inventory/items", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || "Gagal menyimpan barang.");
      }

      setNotification({
        type: "success",
        message: editingItem ? "Barang berhasil diperbarui." : "Barang baru berhasil ditambahkan.",
      });
      setIsAddEditModalOpen(false);
      fetchItems();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    }
  };

  const handleDeleteItem = async (item: Item) => {
    const isSoft = (item._count?.transaction_details || 0) > 0;
    const confirmMsg = isSoft
      ? `Barang '${item.name}' memiliki histori transaksi. Barang akan dinonaktifkan (soft delete). Lanjutkan?`
      : `Hapus permanen barang '${item.name}'?`;

    if (!window.confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error);

      setNotification({ type: "success", message: json.message });
      fetchItems();
    } catch (err: any) {
      setNotification({ type: "error", message: err.message });
    }
  };

  const handleExportCSV = () => {
    window.open("/api/inventory/items/export?format=csv", "_blank");
  };

  const handleExportPDF = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Top Banner & Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800 uppercase tracking-wider">
              Master Data Barang
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Katalog SKU, Perangkat Reusable & Consumable
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-slate-100 tracking-tight mt-1 flex items-center">
            <Boxes className="w-7 h-7 mr-3 text-blue-600 dark:text-blue-400" />
            Master Barang Inventory
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
            Kelola kode barang unik, spesifikasi teknis, satuan, ambang batas minimum, dan lokasi penyimpanan rak.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => fetchItems(true)}
            disabled={refreshing}
            className="p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-blue-600 shadow-sm transition disabled:opacity-50"
            title="Refresh Data"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin text-blue-600" : ""}`} />
          </button>

          <button
            onClick={handleExportCSV}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold shadow-xs transition"
          >
            <Download className="w-4 h-4 mr-1.5 text-emerald-600" />
            Export CSV
          </button>

          <button
            onClick={handleExportPDF}
            className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 text-xs font-bold shadow-xs transition"
          >
            <FileText className="w-4 h-4 mr-1.5 text-rose-600" />
            Export PDF
          </button>

          {isAdmin && (
            <>
              <button
                onClick={() => setIsImportModalOpen(true)}
                className="inline-flex items-center px-3.5 py-2.5 rounded-xl border border-indigo-300 dark:border-indigo-800/70 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 text-xs font-bold shadow-xs transition"
              >
                <Upload className="w-4 h-4 mr-1.5" />
                Import Excel/CSV
              </button>

              <button
                onClick={handleOpenAdd}
                className="inline-flex items-center px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-500/20 transition hover:scale-[1.02]"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                + Tambah Barang
              </button>
            </>
          )}
        </div>
      </div>

      {notification && (
        <div
          className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
            notification.type === "success"
              ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 text-emerald-800 dark:text-emerald-300"
              : "bg-rose-50 dark:bg-rose-950/40 border-rose-200 text-rose-800 dark:text-rose-300"
          }`}
        >
          <div className="flex items-center space-x-2">
            {notification.type === "success" ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0" />
            )}
            <span>{notification.message}</span>
          </div>
          <button onClick={() => setNotification(null)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl p-4 shadow-sm grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {/* Search */}
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
          <input
            type="text"
            placeholder="Cari kode, nama barang, merek, lokasi..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-10 pr-4 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter Kategori */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden"
          >
            <option value="">Semua Kategori (Aktif & Pasif)</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Filter Jenis */}
        <div>
          <select
            value={selectedType}
            onChange={(e) => {
              setSelectedType(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden"
          >
            <option value="">Semua Jenis (Reusable & Consumable)</option>
            <option value="REUSABLE">Reusable (Bisa Kembali)</option>
            <option value="CONSUMABLE">Consumable (Habis Pakai)</option>
          </select>
        </div>

        {/* Filter Status */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="w-full py-2 px-3 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:outline-hidden"
          >
            <option value="">Semua Status</option>
            <option value="true">Status: Aktif</option>
            <option value="false">Status: Nonaktif (Soft Deleted)</option>
          </select>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-700 dark:text-slate-300 uppercase font-bold text-[10px] border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Kode Barang</th>
                <th className="py-3 px-4">Nama Barang & Merek</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Jenis</th>
                <th className="py-3 px-4 text-right">Stok Siap</th>
                <th className="py-3 px-4 text-right">Stok Min</th>
                <th className="py-3 px-4">Lokasi Rak</th>
                <th className="py-3 px-4 text-center">Status</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                    Memuat data master barang...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    Tidak ada barang yang sesuai dengan filter pencarian.
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const avail = item.stock ? Number(item.stock.available_stock) : 0;
                  const isLow = Number(item.min_stock) > 0 && avail <= Number(item.min_stock);

                  return (
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="py-3 px-4 font-mono font-bold text-blue-600 dark:text-blue-400">
                        {item.code}
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-bold text-slate-900 dark:text-slate-100">{item.name}</p>
                        <p className="text-[11px] text-slate-500">
                          {item.brand ? `Merk: ${item.brand}` : ""} {item.model ? `(${item.model})` : ""}
                        </p>
                      </td>
                      <td className="py-3 px-4">
                        {item.category?.name?.toLowerCase() === "aktif" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-xs">
                            Aktif
                          </span>
                        ) : item.category?.name?.toLowerCase() === "pasif" ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 dark:bg-amber-950/70 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 shadow-xs">
                            Pasif
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                            {item.category?.name || "Aktif"}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {item.type === "REUSABLE" ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Reusable
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                            <Cable className="w-3 h-3 mr-1" />
                            Consumable
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`font-black text-sm ${
                            isLow ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                          }`}
                        >
                          {avail.toLocaleString("id-ID")}{" "}
                          <span className="text-[10px] font-medium text-slate-400">{item.unit}</span>
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-slate-500">
                        {item.min_stock} {item.unit}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {item.storage_location ? (
                          <span className="flex items-center">
                            <MapPin className="w-3 h-3 mr-1 text-slate-400" />
                            {item.storage_location}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            item.is_active
                              ? "bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400"
                          }`}
                        >
                          {item.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          <button
                            onClick={() => handleOpenDetail(item.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                            title="Lihat Detail & Unit"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() => handleOpenEdit(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Edit Barang"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteItem(item)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-slate-100 dark:hover:bg-slate-800"
                                title="Hapus / Nonaktifkan"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
          <span>
            Menampilkan {items.length} dari {totalCount} total barang
          </span>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-bold">
              {page} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="px-2.5 py-1 rounded-lg border border-slate-300 dark:border-slate-700 disabled:opacity-40"
            >
              Selanjutnya
            </button>
          </div>
        </div>
      </div>

      {/* MODAL: TAMBAH / EDIT BARANG */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Boxes className="w-5 h-5 mr-2 text-blue-600" />
                {editingItem ? "Edit Data Barang" : "Tambah Master Barang Baru"}
              </h2>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Nama Barang <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Contoh: Routerboard 1100AHx4"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Kode Barang (Opsional / Otomatis)
                  </label>
                  <input
                    type="text"
                    value={formData.code}
                    disabled={!!editingItem}
                    onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                    placeholder="Kosongkan untuk auto-generate (ITM-XXX-0001)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Kategori <span className="text-rose-500">*</span>
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Jenis Barang <span className="text-rose-500">*</span>
                  </label>
                  <select
                    disabled={!!editingItem}
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950 disabled:bg-slate-100 dark:disabled:bg-slate-800"
                  >
                    <option value="REUSABLE">Reusable (Dapat Keluar & Kembali)</option>
                    <option value="CONSUMABLE">Consumable (Habis Pakai Permanen)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Merek / Pabrikan
                  </label>
                  <input
                    type="text"
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Contoh: MikroTik, Cisco, Belden"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Model / Tipe
                  </label>
                  <input
                    type="text"
                    value={formData.model}
                    onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                    placeholder="Contoh: RB1100AHx4 Dude Edition"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Satuan <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  >
                    <option value="Unit">Unit</option>
                    <option value="Pcs">Pcs</option>
                    <option value="Roll">Roll</option>
                    <option value="Meter">Meter</option>
                    <option value="Box">Box</option>
                    <option value="Pack">Pack</option>
                    <option value="Set">Set</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Stok Minimum (Alert Peringatan)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.min_stock}
                    onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Lokasi Penyimpanan (Gudang / Rak)
                  </label>
                  <input
                    type="text"
                    value={formData.storage_location}
                    onChange={(e) => setFormData({ ...formData, storage_location: e.target.value })}
                    placeholder="Contoh: Gudang Utama - Rak A1"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                </div>

                {!editingItem && (
                  <div>
                    <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                      Stok Awal Saat Didaftarkan
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.initial_stock}
                      onChange={(e) => setFormData({ ...formData, initial_stock: e.target.value })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                  Deskripsi / Spesifikasi Tambahan
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Catatan spesifikasi port, daya, garansi, dsb."
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                />
              </div>

              {formData.type === "REUSABLE" && !editingItem && (
                <div>
                  <label className="block font-semibold mb-1 text-slate-700 dark:text-slate-300">
                    Serial Number Unit (Opsional - Pisahkan tiap baris)
                  </label>
                  <textarea
                    rows={3}
                    value={formData.serial_numbers_text}
                    onChange={(e) => setFormData({ ...formData, serial_numbers_text: e.target.value })}
                    placeholder="SN-RB1100-001&#10;SN-RB1100-002"
                    className="w-full font-mono px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-950"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Setiap serial number akan dicatat sebagai unit terpisah untuk pelacakan fisik individual.
                  </p>
                </div>
              )}

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 dark:border-slate-700 hover:bg-slate-50 font-semibold text-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-md shadow-blue-500/20"
                >
                  {editingItem ? "Simpan Perubahan" : "Daftarkan Barang"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DETAIL BARANG */}
      {isDetailModalOpen && detailItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                  {detailItem.code}
                </span>
                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {detailItem.name}
                </h2>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500">Stok Siap Pakai</span>
                <p className="text-lg font-black text-emerald-600 mt-1">
                  {detailItem.stock?.available_stock || 0} {detailItem.unit}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500">Sedang Digunakan</span>
                <p className="text-lg font-black text-amber-600 mt-1">
                  {detailItem.stock?.total_in_use || 0} {detailItem.unit}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500">Rusak / Karantina</span>
                <p className="text-lg font-black text-rose-600 mt-1">
                  {detailItem.stock?.total_damaged || 0} {detailItem.unit}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-800">
                <span className="text-slate-500">Stok Minimum</span>
                <p className="text-lg font-black text-slate-700 dark:text-slate-300 mt-1">
                  {detailItem.min_stock} {detailItem.unit}
                </p>
              </div>
            </div>

            {/* Tracked Units List (If Reusable) */}
            {detailItem.type === "REUSABLE" && (
              <div className="space-y-2">
                <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                  Daftar Unit Serial Number Terlacak ({detailItem.units?.length || 0} Unit)
                </h3>
                {(!detailItem.units || detailItem.units.length === 0) ? (
                  <p className="text-xs text-slate-400 italic">Belum ada serial number unit yang didaftarkan.</p>
                ) : (
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl">
                    {detailItem.units.map((u: any) => (
                      <div key={u.id} className="p-2.5 flex items-center justify-between text-xs">
                        <span className="font-mono font-bold text-slate-800 dark:text-slate-200">
                          {u.serial_number}
                        </span>
                        <div className="flex items-center space-x-2">
                          <span className="text-[11px] text-slate-500">
                            {u.current_pic ? `PIC: ${u.current_pic}` : u.current_location || "Gudang"}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.status === "AVAILABLE"
                                ? "bg-emerald-100 text-emerald-700"
                                : u.status === "IN_USE"
                                ? "bg-amber-100 text-amber-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {u.status}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Recent Movements Log */}
            <div className="space-y-2">
              <h3 className="text-xs font-bold uppercase text-slate-600 dark:text-slate-400">
                Pergerakan Fisik Stok Terakhir (Movements)
              </h3>
              {(!detailItem.movements || detailItem.movements.length === 0) ? (
                <p className="text-xs text-slate-400 italic">Belum ada catatan mutasi.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 border rounded-xl">
                  {detailItem.movements.map((m: any) => (
                    <div key={m.id} className="p-2.5 flex items-center justify-between text-xs">
                      <div>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {m.notes || m.movement_type}
                        </span>
                        <p className="text-[10px] text-slate-400">
                          {new Date(m.created_at).toLocaleString("id-ID")} &bull; Oleh: {m.performed_by}
                        </p>
                      </div>
                      <span
                        className={`font-mono font-bold ${
                          Number(m.quantity) > 0 ? "text-emerald-600" : "text-rose-600"
                        }`}
                      >
                        {Number(m.quantity) > 0 ? `+${m.quantity}` : m.quantity} {detailItem.unit}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsDetailModalOpen(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-semibold text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: IMPORT EXCEL / CSV */}
      {isImportModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 flex items-center">
                <Upload className="w-5 h-5 mr-2 text-indigo-600" />
                Import Data Barang dari CSV / Excel
              </h2>
              <button
                onClick={() => setIsImportModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <p>
                Unggah file CSV dengan kolom header berikut:
              </p>
              <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-xl font-mono text-[11px] overflow-x-auto">
                Nama Barang, Kategori, Jenis, Merek, Model, Satuan, Stok Awal, Stok Minimum, Lokasi Penyimpanan
              </div>
              <p className="text-[11px] text-slate-500">
                * Kolom Jenis diisi <code>REUSABLE</code> atau <code>CONSUMABLE</code>.
              </p>
            </div>

            <input
              type="file"
              accept=".csv"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;

                const text = await file.text();
                const lines = text.split(/\r?\n/).filter(Boolean);
                if (lines.length < 2) {
                  alert("File CSV tidak memiliki data.");
                  return;
                }

                const headers = lines[0].split(",").map((h) => h.replace(/"/g, "").trim());
                const rows = [];

                for (let i = 1; i < lines.length; i++) {
                  const values = lines[i].split(",").map((v) => v.replace(/"/g, "").trim());
                  const obj: Record<string, string> = {};
                  headers.forEach((h, idx) => {
                    obj[h] = values[idx] || "";
                  });
                  rows.push(obj);
                }

                try {
                  const res = await fetch("/api/inventory/items/import", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ items: rows }),
                  });
                  const json = await res.json();
                  if (!res.ok || !json.success) throw new Error(json.error);

                  setNotification({ type: "success", message: json.message });
                  setIsImportModalOpen(false);
                  fetchItems();
                } catch (err: any) {
                  alert("Error impor: " + err.message);
                }
              }}
              className="w-full text-xs file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />

            <div className="flex justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsImportModalOpen(false)}
                className="px-4 py-2 rounded-xl border text-xs font-semibold"
              >
                Batal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

