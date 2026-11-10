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
} from 'lucide-react';
import type { SuratTugasDocument } from '@/types/suratTugas';
import type { RFOTemplate, ActiveTab } from '@/types/rfo';
import type { UserAccount } from '@/types/auth';
import type { ToastMessage } from '@/components/tools/Toast';
import { SuratTugasPaperDocument } from '@/components/tools/SuratTugasPaperDocument';
import { suratTugasStorage } from '@/services/suratTugasStorage';
import {
  formatIndonesianDate,
  formatSuratTugasExecutionDate,
  generateSuratTugasWhatsAppText,
  generateSuratTugasFileName,
} from '@/utils/suratTugasUtils';
import html2canvas from 'html2canvas-pro';
import jsPDF from 'jspdf';

interface HistorySuratTugasPageProps {
  template: RFOTemplate;
  setActiveTab: (tab: ActiveTab) => void;
  onEditSuratTugas: (doc: SuratTugasDocument) => void;
  onDuplicateSuratTugas: (doc: SuratTugasDocument) => void;
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  currentUser?: UserAccount | null;
}

export const HistorySuratTugasPage: React.FC<HistorySuratTugasPageProps> = ({
  template,
  setActiveTab,
  onEditSuratTugas,
  onDuplicateSuratTugas,
  addToast,
  currentUser: _currentUser,
}) => {
  const [documents, setDocuments] = useState<SuratTugasDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterDate, setFilterDate] = useState<string>('');

  // Modal View state
  const [selectedDoc, setSelectedDoc] = useState<SuratTugasDocument | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setLoading(true);
    try {
      const list = await suratTugasStorage.getAllSuratTugas();
      setDocuments(list);
    } catch (e) {
      console.error(e);
      addToast('error', 'Gagal Memuat Data', 'Tidak dapat mengambil data arsip Surat Tugas.');
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
        (item.createdByName && item.createdByName.toLowerCase().includes(q)) ||
        item.personnel.some(
          (p) => p.name.toLowerCase().includes(q) || p.phone.toLowerCase().includes(q)
        );

      // Filter strictly by Tanggal Pembuatan Surat Tugas
      const matchesDate =
        !filterDate ||
        item.createdDate === filterDate ||
        (item.createdAt && item.createdAt.slice(0, 10) === filterDate);

      return matchesSearch && matchesDate;
    });
  }, [documents, searchQuery, filterDate]);

  // Delete handler
  const handleDelete = async (id: string) => {
    try {
      const success = await suratTugasStorage.deleteSuratTugas(id);
      if (success) {
        setDocuments((prev) => prev.filter((d) => d.id !== id));
        addToast('success', 'Surat Tugas Dihapus', `Dokumen telah dihapus dari sistem.`);
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
  const handleDownloadPDF = async (doc: SuratTugasDocument) => {
    setDownloadingId(doc.id);
    setSelectedDoc(doc);

    // Wait for modal DOM to render
    setTimeout(async () => {
      const element = document.getElementById('history-surat-tugas-modal-doc');
      if (!element) {
        addToast('error', 'Gagal', 'Gagal merender dokumen untuk unduhan PDF.');
        setDownloadingId(null);
        return;
      }

      try {
        const filename = generateSuratTugasFileName(doc.letterNumber, doc.visitLocation);
        const canvas = await html2canvas(element, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          windowWidth: 1200,
        });

        const pdf = new jsPDF({
          orientation: 'portrait',
          unit: 'mm',
          format: 'a4',
          compress: true,
        });

        const pageWidth = 210;
        const pageHeight = 297;
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const contentHeight = (canvas.height * pageWidth) / canvas.width;

        pdf.addImage(imgData, 'JPEG', 0, 0, pageWidth, Math.min(contentHeight, pageHeight));
        pdf.save(filename);

        addToast('success', 'PDF Terunduh', `File tersimpan: ${filename}`);
      } catch (err) {
        console.error(err);
        addToast('error', 'Gagal Unduh PDF', 'Terjadi kesalahan saat memproses rendering.');
      } finally {
        setDownloadingId(null);
      }
    }, 200);
  };

  const handleCopyWhatsApp = async (doc: SuratTugasDocument) => {
    const text = generateSuratTugasWhatsAppText(doc, template?.companyName);
    try {
      await navigator.clipboard.writeText(text);
      addToast('success', 'Teks WhatsApp Disalin', 'Pesan siap dikirim.');
    } catch {
      addToast('error', 'Gagal', 'Clipboard akses ditolak.');
    }
  };

  return (
    <div className="flex-1 p-4 lg:p-6 space-y-6 overflow-y-auto bg-slate-50">
      {/* Top Banner with Quick Actions */}
      <div className="rounded-2xl bg-white border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
              Arsip & Riwayat
            </span>
            <span className="text-xs text-slate-500 font-mono">
              Surat Tugas Visit PT JDP
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
            Riwayat Surat Tugas
          </h1>
          <p className="text-xs text-slate-500 mt-1 max-w-xl">
            Kelola, cetak ulang, ekspor PDF, atau salin penugasan visit resmi yang telah diterbitkan.
          </p>
        </div>

        <button
          onClick={() => setActiveTab('create-st')}
          className="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold flex items-center gap-2 shadow-xs shrink-0 self-start sm:self-auto transition-all cursor-pointer"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Buat Surat Tugas Baru</span>
        </button>
      </div>

      {/* Search & Filters */}
      <div className="p-4 rounded-xl bg-white border border-slate-200 shadow-xs flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari berdasarkan nomor surat (ST/120/...), lokasi visit, nama personil..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 bg-slate-50 border border-slate-300 px-3 py-1.5 rounded-lg text-xs text-slate-700 hover:border-blue-400 transition-colors"
            title="Cari berdasarkan Tanggal Pembuatan Surat Tugas"
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
              className="bg-transparent text-xs text-slate-700 focus:outline-none cursor-pointer"
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

          <span className="text-xs text-slate-500 shrink-0">
            Total: <span className="text-blue-600 font-bold">{filteredList.length}</span> surat
          </span>
        </div>
      </div>

      {/* Document List */}
      {loading ? (
        <div className="p-12 flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500">Memuat arsip surat tugas...</p>
        </div>
      ) : filteredList.length === 0 ? (
        <div className="p-12 rounded-xl bg-white border border-slate-200 text-center space-y-3 shadow-xs">
          <FileText className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            Tidak Ada Surat Tugas Ditemukan
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            {searchQuery || filterDate
              ? 'Tidak ada dokumen yang cocok dengan kata kunci atau filter yang Anda pilih.'
              : 'Belum ada arsip surat tugas yang dibuat.'}
          </p>
          {(searchQuery || filterDate) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setFilterDate('');
              }}
              className="text-xs text-blue-600 hover:underline font-medium"
            >
              Reset Filter Pencarian
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredList.map((doc) => {
            const execDate = formatSuratTugasExecutionDate(doc.startDate, doc.endDate);
            const letterDate = formatIndonesianDate(doc.createdDate);

            return (
              <div
                key={doc.id}
                className="p-4 rounded-xl bg-white border border-slate-200 hover:border-blue-400 hover:shadow-md transition-all flex flex-col justify-between space-y-3 group shadow-xs"
              >
                <div>
                  {/* Top Header Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-mono text-xs font-bold tracking-wide">
                      {doc.letterNumber}
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                      {doc.letterLocation || 'Sukabumi'}, {letterDate}
                    </span>
                  </div>

                  {/* Visit Location */}
                  <div className="mt-2.5 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                      <span className="font-medium text-slate-700">Lokasi Visit:</span>
                    </div>
                    <p className="text-sm font-bold text-slate-900 pl-5 truncate" title={doc.visitLocation}>
                      {doc.visitLocation}
                    </p>
                  </div>

                  {/* Execution Date */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                      <span className="font-medium text-slate-700">Pelaksanaan:</span>
                    </div>
                    <p className="text-xs text-slate-700 pl-5 font-mono">{execDate}</p>
                  </div>

                  {/* Personnel List */}
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Users className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span className="font-medium text-slate-700">
                        Petugas ({doc.personnel.length}):
                      </span>
                    </div>
                    <div className="pl-5 space-y-0.5">
                      {doc.personnel.map((p, idx) => (
                        <p key={p.id || idx} className="text-xs text-slate-700 truncate">
                          <span className="font-medium text-slate-900">{p.name}</span>{' '}
                          <span className="text-slate-500 font-mono text-[11px]">({p.phone})</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedDoc(doc)}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Lihat Pratinjau Dokumen"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDownloadPDF(doc)}
                      disabled={downloadingId === doc.id}
                      className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 hover:text-slate-900 transition-colors cursor-pointer"
                      title="Unduh PDF Resmi"
                    >
                      {downloadingId === doc.id ? (
                        <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                      ) : (
                        <FileDown className="w-4 h-4" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyWhatsApp(doc)}
                      className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-600 hover:text-emerald-700 transition-colors cursor-pointer"
                      title="Salin Teks WhatsApp"
                    >
                      <MessageSquare className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateSuratTugas(doc)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                      title="Duplikasi surat ini dengan nomor otomatis berikutnya"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>Duplikasi</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEditSuratTugas(doc)}
                      className="px-2.5 py-1 text-xs rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 flex items-center gap-1 transition-colors font-medium cursor-pointer"
                      title="Edit Dokumen"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmId(doc.id)}
                      className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      title="Hapus Surat Tugas"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL 1: Detail Preview Modal */}
      {selectedDoc && (
        <div className="print-modal-backdrop fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="print-modal-container bg-white border border-slate-200 rounded-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Modal Header */}
            <div className="no-print p-4 bg-white border-b border-slate-200 flex items-center justify-between">
              <div>
                <span className="text-xs text-slate-500">Pratinjau Dokumen Resmi</span>
                <h3 className="text-base font-bold text-slate-900 font-mono">
                  {selectedDoc.letterNumber}
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs font-medium text-slate-700 border border-slate-200 flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Cetak</span>
                </button>

                <button
                  onClick={() => handleDownloadPDF(selectedDoc)}
                  disabled={downloadingId === selectedDoc.id}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-xs font-bold text-white flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Unduh PDF</span>
                </button>

                <button
                  onClick={() => setSelectedDoc(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Body with Paper Document */}
            <div className="print-modal-body flex-1 overflow-y-auto p-4 lg:p-6 bg-slate-100/70 flex justify-center">
              <div className="print-modal-doc-wrapper w-full max-w-[210mm]">
                <SuratTugasPaperDocument
                  id="history-surat-tugas-modal-doc"
                  doc={selectedDoc}
                  template={template}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="no-print fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 max-w-sm w-full space-y-4 shadow-xl">
            <h3 className="text-base font-bold text-slate-900">Hapus Surat Tugas?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Apakah Anda yakin ingin menghapus arsip surat tugas ini? Dokumen yang telah dihapus tidak dapat dipulihkan kembali.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmId(null)}
                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-xs text-slate-700 border border-slate-200 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => handleDelete(deleteConfirmId)}
                className="px-4 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-xs font-bold text-white shadow-xs cursor-pointer"
              >
                Hapus Permanen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
