import React, { useState } from 'react';
import {
  Settings,
  Database,
  Server,
  Shield,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
} from 'lucide-react';
import { storageService } from '@/services/storageService';
import type { ToastMessage } from '@/components/tools/Toast';
import { useDialog } from '@/context/DialogContext';


interface SettingsPageProps {
  addToast: (type: ToastMessage['type'], title: string, message?: string) => void;
  onRefreshData?: () => void;
}

export const SettingsPage: React.FC<SettingsPageProps> = ({
  addToast,
  onRefreshData,
}) => {
  const { confirm: confirmDialog } = useDialog();
  const [activeRole, setActiveRole] = useState<'NOC' | 'Customer Service' | 'Admin'>('NOC');

  // Export all RFO and Template data to JSON file
  const handleExportBackup = async () => {
    try {
      const rfos = await storageService.getAllRFOs();
      const template = await storageService.getTemplate();
      const backupData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        company: 'PT Jembatan Data Pangrango',
        rfos,
        template,
      };

      const blob = new Blob([JSON.stringify(backupData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `JDP_RFO_Backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      addToast('success', 'Backup Berhasil', 'Seluruh data RFO diekspor ke file JSON.');
    } catch {
      addToast('error', 'Gagal', 'Gagal membuat file backup.');
    }
  };

  // Import JSON backup
  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        if (parsed.rfos && Array.isArray(parsed.rfos)) {
          for (const rfo of parsed.rfos) {
            await storageService.saveRFO(rfo);
          }
          if (parsed.template) {
            await storageService.saveTemplate(parsed.template);
          }
          addToast(
            'success',
            'Impor Sukses',
            `Berhasil memuat ${parsed.rfos.length} data arsip RFO.`
          );
          if (onRefreshData) onRefreshData();
        } else {
          addToast('error', 'Format Tidak Sesuai', 'File JSON tidak memiliki struktur RFO valid.');
        }
      } catch {
        addToast('error', 'Gagal', 'File JSON rusak atau tidak terbaca.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Clear data
  const handleClearAll = async () => {
    if (
      await confirmDialog(
        'PERINGATAN: Seluruh arsip RFO dan draft di browser ini akan dihapus permanen. Lanjutkan?'
      )
    ) {
      localStorage.clear();
      addToast('info', 'Storage Dibersihkan', 'Seluruh data lokal telah dikosongkan.');
      if (onRefreshData) onRefreshData();
      window.location.reload();
    }
  };

  return (
    <div className="flex-1 p-3 sm:p-4 lg:p-6 space-y-4 sm:space-y-6 overflow-y-auto max-w-5xl bg-slate-50">
      {/* Top Banner */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs">
        <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          Pengaturan Sistem & Kesiapan Backend
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Arsitektur modular siap integrasi ke PostgreSQL/MySQL REST API dan Multi-role Access.
        </p>
      </div>

      {/* Role Simulation */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Simulasi Role Pengguna</h3>
          </div>
          <span className="text-xs font-mono text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 font-semibold">
            Current: {activeRole}
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Aplikasi dirancang dengan isolasi hak akses antara tim NOC (teknis/insiden), Customer Service (distribusi pelanggan), dan Administrator (konfigurasi template).
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
          {(['NOC', 'Customer Service', 'Admin'] as const).map((role) => (
            <button
              key={role}
              onClick={() => {
                setActiveRole(role);
                addToast('info', 'Role Diubah', `Beralih ke mode profil ${role}.`);
              }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer ${
                activeRole === role
                  ? 'bg-blue-50 border-blue-600 text-blue-900 font-semibold ring-2 ring-blue-500/20'
                  : 'bg-slate-50 hover:bg-slate-100/80 border-slate-200 text-slate-700'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-bold">{role}</span>
                {activeRole === role && <CheckCircle2 className="w-4 h-4 text-blue-600" />}
              </div>
              <p className="text-[11px] text-slate-500">
                {role === 'NOC' && 'Akses penuh input gangguan & durasi insiden.'}
                {role === 'Customer Service' && 'Akses copy text, kirim WhatsApp, & cetak PDF.'}
                {role === 'Admin' && 'Akses ubah template kop surat & kelola database.'}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Future Backend & Architecture Readiness */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Server className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900">Backend & Database Abstraction</h3>
          </div>
          <span className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-semibold">
            Storage: IStorageProvider (Decoupled)
          </span>
        </div>

        <p className="text-xs text-slate-600 leading-relaxed">
          Seluruh interaksi data menggunakan abstraction layer <code className="text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-semibold">storageService.ts</code>. Untuk menghubungkan ke backend PostgreSQL atau MySQL, cukup buat implementasi <code className="text-blue-700 font-mono bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200 font-semibold">ApiStorageProvider</code> tanpa perlu memodifikasi komponen antarmuka.
        </p>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-700 space-y-1 shadow-inner overflow-x-auto no-scrollbar">
          <div className="text-slate-400 font-medium">// REST API Endpoints Contract Ready:</div>
          <div><span className="text-emerald-600 font-bold">GET</span>    /api/v1/rfos                 <span className="text-slate-400">// List & search history</span></div>
          <div><span className="text-blue-600 font-bold">POST</span>   /api/v1/rfos                 <span className="text-slate-400">// Save new RFO</span></div>
          <div><span className="text-amber-600 font-bold">PUT</span>    /api/v1/rfos/:id             <span className="text-slate-400">// Update existing RFO</span></div>
          <div><span className="text-rose-600 font-bold">DELETE</span> /api/v1/rfos/:id             <span className="text-slate-400">// Delete archive</span></div>
          <div><span className="text-emerald-600 font-bold">GET</span>    /api/v1/template             <span className="text-slate-400">// Fetch company template</span></div>
          <div><span className="text-blue-600 font-bold">POST</span>   /api/v1/template             <span className="text-slate-400">// Update template</span></div>
        </div>
      </div>

      {/* Backup & Data Management */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Database className="w-4 h-4 text-emerald-600" />
          <h3 className="text-sm font-bold text-slate-900">Manajemen Data & Backup</h3>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3">
          <button
            onClick={handleExportBackup}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-blue-600" />
            <span>Ekspor Backup JSON</span>
          </button>

          <label className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold border border-slate-300 shadow-xs transition-colors cursor-pointer">
            <Upload className="w-4 h-4 text-emerald-600" />
            <span>Impor Data Backup</span>
            <input
              type="file"
              accept=".json"
              onChange={handleImportBackup}
              className="hidden"
            />
          </label>

          <button
            onClick={handleClearAll}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold border border-rose-200 shadow-xs transition-colors sm:ml-auto cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Bersihkan Semua Data Lokal</span>
          </button>
        </div>
      </div>
    </div>
  );
};
