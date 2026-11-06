import Link from "next/link";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="py-20 text-center space-y-4 max-w-md mx-auto">
      <div className="w-12 h-12 rounded-2xl bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
        <AlertTriangle className="w-6 h-6" />
      </div>
      <h2 className="text-xl font-black text-slate-900">404 - Halaman Tidak Ditemukan</h2>
      <p className="text-xs text-slate-500">
        Halaman yang Anda tuju tidak tersedia atau telah dipindahkan.
      </p>
      <div>
        <Link
          href="/queue"
          className="inline-flex items-center px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
          Kembali ke Board Antrean
        </Link>
      </div>
    </div>
  );
}

