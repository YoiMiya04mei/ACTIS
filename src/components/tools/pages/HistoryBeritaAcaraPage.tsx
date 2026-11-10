import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Eye,
  Edit3,
  Copy,
  Trash2,
  FileDown,
  Printer,
  MessageSquare,
  Calendar,
  MapPin,
  Users,
  X,
  PlusCircle,
  FileText,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import type { BeritaAcaraDocument, BeritaAcaraTemplate } from '@/types/beritaAcara';
import type { RFOTemplate, ActiveTab } from '@/types/rfo';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { BeritaAcaraPaperDocument } from '@/components/tools/BeritaAcaraPaperDocument';
import { beritaAcaraStorage } from '@/services/beritaAcaraStorage';
import {
  formatBeritaAcaraExecutionDate,
  generateBeritaAcaraWhatsAppText,
  generateBeritaAcaraFileName,
} from '@/utils/beritaAcaraUtils';
import { formatIndonesianDate } from '@/utils/suratTugasUtils';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface HistoryBeritaAcaraPageProps {
  template: RFOTemplate;
  beritaAcaraTemplate?: BeritaAcaraTemplate;
  setActiveTab: (tab: ActiveTab) => void;
  onEditBeritaAcara: (doc: BeritaAcaraDocument) => void;
  onDuplicateBeritaAcara: (doc: BeritaAcaraDocument) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
}

export const HistoryBeritaAcaraPage: React.FC<HistoryBeritaAcaraPageProps> = ({
  template,
  beritaAcaraTemplate,
  setActiveTab,
  onEditBeritaAcara,
  onDuplicateBeritaAcara,
  addToast,
  currentUser: _currentUser,
}) => {
  const [documents, setDocuments] = useState<BeritaAcaraDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  // Modal View state
  const [selectedDoc, setSelectedDoc] = useState<BeritaAcaraDocument | null>(null);
  const [modalZoom, setModalZoom] = useState<number>(85);
  const [modalPageTab, setModalPageTab] = useState<'all' | number>('all');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const list = await beritaAcaraStorage.getAllBeritaAcara();
      setDocuments(list);
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal Memuat Data', 'Tidak dapat mengambil arsip Berita Acara.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered documents
  const filteredList = useMemo(() => {
    return documents.filter((item) => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        q === '' ||
        item.letterNumber.toLowerCase().includes(q) ||
        item.visitLocation.toLowerCase().includes(q) ||
        (item.purpose && item.purpose.toLowerCase().includes(q)) ||
        (item.createdByName && item.createdByName.toLowerCase().includes(q)) ||
        item.personnel.some((p) => p.name.toLowerCase().includes(q));

      // Filter strictly by Tanggal Pembuatan Berita Acara
      const matchesDate =
        !filterDate ||
        item.createdDate === filterDate ||
        (item.createdAt && item.createdAt.slice(0, 10) === filterDate);

      return matchesSearch && matchesDate;
    });
  }, [documents, searchQuery, filterDate]);

  // Statistics
  const stats = useMemo(() => {
    const total = documents.length;
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const thisMonth = documents.filter((d) => d.createdDate.startsWith(currentMonth)).length;
    const todayStr = now.toISOString().slice(0, 10);
    const todayCount = documents.filter((d) => d.createdDate === todayStr).length;

    return { total, thisMonth, todayCount };
  }, [documents]);

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      const success = await beritaAcaraStorage.deleteBeritaAcara(id);
      if (success) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        addToast('success', 'Berita Acara Dihapus', 'Dokumen telah dihapus dari sistem.');
      } else {
        addToast('error', 'Gagal', 'Dokumen tidak ditemukan.');
      }
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal', 'Terjadi kesalahan sistem saat menghapus.');
    } finally {
      setDeleteConfirmId(null);
    }
  };

  // Export PDF directly from history
  const handleDownloadPDF = async (doc: BeritaAcaraDocument) => {
    setDownloadingId(doc.id);
    setSelectedDoc(doc);
    setModalPageTab('all');

    setTimeout(async () => {
      const pageElements = document.querySelectorAll('#history-berita-acara-modal-doc .berita-acara-page');
      if (pageElements.length === 0) {
        addToast('error', 'Gagal', 'Gagal merender dokumen untuk unduhan PDF.');
        setDownloadingId(null);
        return;
      }

      try {
        const filename = generateBeritaAcaraFileName(doc.letterNumber, doc.purpose, doc.visitLocation);
        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        const pageWidth = 210;
        const pageHeight = 297;

        for (let i = 0; i < pageElements.length; i++) {
          const el = pageElements[i] as HTMLElement;
          if (i > 0) pdf.addPage('a4', 'portrait');

          const canvas = await html2canvas(el, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: 1200,
          });

          const imgData = canvas.toDataURL('image/jpeg', 0.98);
          const contentHeight = (canvas.height * pageWidth) / canvas.width;
          pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(contentHeight, pageHeight));
        }

        pdf.save(filename);
        addToast('success', 'PDF Berhasil Diunduh', `File tersimpan: ${filename}`);
      } catch (err) {
        console.error('PDF error:', err);
        addToast('error', 'Gagal Ekspor PDF', 'Terjadi kesalahan saat memproses rendering.');
      } finally {
        setDownloadingId(null);
      }
    }, 250);
  };

  const handleCopyWhatsApp = async (doc: BeritaAcaraDocument) => {
    const text = generateBeritaAcaraWhatsAppText(doc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks WhatsApp Disalin', 'Pesan Berita Acara siap dikirim via WhatsApp.');
    } catch {
      addToast('error', 'Gagal', 'Izin clipboard browser ditolak.');
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-slate-50">
      {/* Top Banner & KPI Summary Cards */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            Arsip & Riwayat Berita Acara
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Daftar resmi Berita Acara visit data center, penugasan teknis, dan dokumentasi foto terlampir
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveTab('create-ba')}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs transition-all cursor-pointer active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Buat Berita Acara</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Total Berita Acara
            </p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{stats.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-600">
            <FileText className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Bulan Ini
            </p>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{stats.thisMonth}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-4 flex items-center justify-between shadow-xs">
          <div>
            <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Hari Ini
            </p>
            <p className="text-2xl font-bold text-cyan-600 mt-1">{stats.todayCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600">
            <Users className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col sm:flex-row items-center gap-3 shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari nomor Berita Acara, lokasi visit, kepentingan, atau nama tim..."
            className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div
            className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-700 hover:border-blue-400 transition-colors"
            title="Cari berdasarkan Tanggal Pembuatan Berita Acara"
          >
            <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px] font-semibold text-slate-500 hidden sm:inline">
              Tgl Surat:
            </span>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              aria-label="Cari berdasarkan tanggal pembuatan surat"
              title="Cari berdasarkan tanggal pembuatan surat"
              className="bg-transparent text-slate-700 focus:outline-none cursor-pointer text-xs"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-slate-400 hover:text-slate-600 ml-1 cursor-pointer p-0.5 rounded hover:bg-slate-200"
                title="Hapus Filter Tanggal"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
        {loading ? (
          <div className="p-8 text-center text-slate-500 text-xs">Memuat arsip Berita Acara...</div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
              <FileText className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-800">Belum Ada Berita Acara</p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || filterDate
                ? 'Tidak ditemukan dokumen yang cocok dengan kata kunci atau filter tanggal.'
                : 'Belum ada dokumen Berita Acara yang diterbitkan. Buat dokumen pertama Anda sekarang.'}
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('create-ba')}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs inline-flex items-center gap-2 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Buat Berita Acara Baru</span>
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-600">
                  <th className="py-3 px-4 font-semibold text-slate-700">Nomor Berita Acara</th>
                  <th className="py-3 px-4 font-semibold text-slate-700">Lokasi Visit & Kepentingan</th>
                  <th className="py-3 px-4 font-semibold text-slate-700">Pelaksanaan</th>
                  <th className="py-3 px-4 font-semibold text-slate-700">Tim Bertugas</th>
                  <th className="py-3 px-4 font-semibold text-slate-700">Lampiran</th>
                  <th className="py-3 px-4 font-semibold text-slate-700 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.map((doc) => (
                  <tr key={doc.id} className="hover:bg-slate-50/80 transition-colors">
                    {/* Nomor */}
                    <td className="py-3.5 px-4 font-mono font-bold text-blue-700">
                      <div>{doc.letterNumber}</div>
                      <span className="text-[10px] text-slate-500 font-sans">
                        Terbit: {formatIndonesianDate(doc.createdDate)}
                      </span>
                    </td>

                    {/* Lokasi & Kepentingan */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                        <span>{doc.visitLocation}</span>
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        <span className="text-slate-500 font-medium">Perihal:</span> {doc.purpose}
                      </div>
                    </td>

                    {/* Pelaksanaan */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{formatBeritaAcaraExecutionDate(doc.startDate, doc.endDate)}</span>
                      </div>
                    </td>

                    {/* Tim Bertugas */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-600 shrink-0" />
                        <span>{doc.personnel.length} Petugas</span>
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[160px] mt-0.5">
                        {doc.personnel.map((p) => p.name).join(', ')}
                      </div>
                    </td>

                    {/* Lampiran Foto */}
                    <td className="py-3.5 px-4">
                      {doc.attachments && doc.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                          <ImageIcon className="w-3 h-3 text-amber-600" />
                          <span>{doc.attachments.length} Foto</span>
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-400">Tidak ada</span>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDoc(doc);
                            setModalPageTab('all');
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Lihat Pratinjau Dokumen"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyWhatsApp(doc)}
                          className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 transition-colors cursor-pointer"
                          title="Salin Teks WhatsApp"
                        >
                          <MessageSquare className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadPDF(doc)}
                          disabled={downloadingId === doc.id}
                          className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 transition-colors cursor-pointer disabled:opacity-40"
                          title="Unduh PDF Resmi"
                        >
                          <FileDown className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onDuplicateBeritaAcara(doc)}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                          title="Duplikasi (Nomor Urut Baru)"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onEditBeritaAcara(doc)}
                          className="p-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-700 transition-colors cursor-pointer"
                          title="Edit Berita Acara"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(doc.id)}
                          className="p-1.5 rounded-lg bg-white hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer border border-transparent hover:border-red-200"
                          title="Hapus"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-600" />
              Hapus Berita Acara?
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus Berita Acara ini dari sistem? Tindakan ini tidak dapat
              dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white shadow-xs cursor-pointer"
              >
                Hapus Dokumen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal View Document (Full A4 Paper Viewer with multi-page navigation) */}
      {selectedDoc && (
        <div className="print-modal-backdrop fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-md flex flex-col justify-between p-4 sm:p-6 overflow-hidden">
          {/* Modal Header */}
          <div className="no-print bg-white border border-slate-200 rounded-2xl px-5 py-3.5 flex items-center justify-between gap-4 shrink-0 shadow-lg">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center">
                <FileText className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">{selectedDoc.letterNumber}</h3>
                <p className="text-[11px] text-slate-500">
                  {selectedDoc.purpose} • {selectedDoc.visitLocation}
                </p>
              </div>
            </div>

            {/* Page Tabs */}
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setModalPageTab('all')}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  modalPageTab === 'all' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua Halaman
              </button>
              <button
                type="button"
                onClick={() => setModalPageTab(1)}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  modalPageTab === 1 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Hal 1: Surat
              </button>
              {selectedDoc.attachments &&
                selectedDoc.attachments.length > 0 &&
                Array.from({ length: Math.ceil(selectedDoc.attachments.length / 2) }).map((_, pIdx) => (
                  <button
                    key={pIdx}
                    type="button"
                    onClick={() => setModalPageTab(pIdx + 2)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                      modalPageTab === pIdx + 2 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Hal {pIdx + 2}: Lampiran {pIdx + 1}
                  </button>
                ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              {/* Zoom Controls */}
              <div className="flex items-center bg-slate-100 rounded-lg border border-slate-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setModalZoom((z) => Math.max(50, z - 10))}
                  className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="text-[11px] font-mono px-1.5 text-blue-700 font-semibold">{modalZoom}%</span>
                <button
                  type="button"
                  onClick={() => setModalZoom((z) => Math.min(120, z + 10))}
                  className="p-1 hover:text-slate-900 text-slate-500 cursor-pointer"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                type="button"
                onClick={() => handleDownloadPDF(selectedDoc)}
                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <FileDown className="w-3.5 h-3.5" />
                <span>Unduh PDF</span>
              </button>

              <button
                type="button"
                onClick={() => window.print()}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Cetak</span>
              </button>

              <button
                type="button"
                onClick={() => setSelectedDoc(null)}
                className="p-2 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-slate-700 cursor-pointer ml-2 shadow-xs"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Modal Document Body */}
          <div className="print-modal-body flex-1 overflow-y-auto p-4 flex justify-center my-4 bg-slate-100/70 rounded-2xl">
            <div
              style={{
                transform: `scale(${modalZoom / 100})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease-out',
              }}
              className="print-modal-doc-wrapper shrink-0 mb-12"
            >
              <BeritaAcaraPaperDocument
                id="history-berita-acara-modal-doc"
                doc={selectedDoc}
                template={beritaAcaraTemplate || template}
                imagesPerPage={2}
                previewPageFilter={modalPageTab}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
