import React, { useRef, useState } from 'react';
import {
  X,
  RefreshCw,
  Download,
  Upload,
  Smartphone,
  Laptop,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  Cloud
} from 'lucide-react';
import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';

interface SyncDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  isSyncing: boolean;
  userEmail: string | null;
  userDisplayName: string | null;
  isAuthLoading: boolean;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => Promise<void>;
  onManualSync: () => Promise<{ ok: boolean; message: string }>;
  onUploadLocalToCloud: () => Promise<{ ok: boolean; message: string }>;
  onImportBackup: (data: {
    agendas: AgendaItem[];
    journals: DailyJournalEntry[];
    holidayDuties: HolidayDutyEntry[];
  }) => Promise<{ ok: boolean; message: string }>;
}

export const SyncDeviceModal: React.FC<SyncDeviceModalProps> = ({
  isOpen,
  onClose,
  agendas,
  journals,
  holidayDuties,
  isSyncing,
  userEmail,
  userDisplayName,
  isAuthLoading,
  onSignInGoogle,
  onSignOut,
  onManualSync,
  onUploadLocalToCloud,
  onImportBackup
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  if (!isOpen) return null;

  const handleSignIn = async () => {
    setFeedback(null);
    try {
      await onSignInGoogle();
      setFeedback({
        type: 'success',
        text: 'Berhasil masuk akun Google. Data kini tersinkronisasi secara real-time antara HP dan Komputer.'
      });
    } catch {
      setFeedback({
        type: 'error',
        text: 'Login Google dibatalkan atau gagal. Silakan coba lagi.'
      });
    }
  };

  const handleSignOut = async () => {
    setFeedback(null);
    await onSignOut();
    setFeedback({
      type: 'success',
      text: 'Berhasil keluar dari akun Google.'
    });
  };

  const handleSyncNow = async () => {
    setFeedback(null);
    const result = await onManualSync();
    setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
  };

  const handlePushLocal = async () => {
    setFeedback(null);
    const result = await onUploadLocalToCloud();
    setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
  };

  const handleExportJson = () => {
    try {
      const payload = {
        app: 'SUBAG_TU_PIM_DITJENPAS',
        exportedAt: new Date().toISOString(),
        agendas,
        journals,
        holidayDuties
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `Sinkron_Data_SUBAG_TU_PIM_${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setFeedback({
        type: 'success',
        text: `Berkas cadangan (${agendas.length} agenda, ${journals.length} jurnal, ${holidayDuties.length} piket) berhasil diunduh.`
      });
    } catch {
      setFeedback({ type: 'error', text: 'Gagal mengekspor berkas data.' });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);
    setIsImporting(true);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as {
        agendas?: AgendaItem[];
        journals?: DailyJournalEntry[];
        holidayDuties?: HolidayDutyEntry[];
      };
      if (
        !Array.isArray(parsed.agendas) &&
        !Array.isArray(parsed.journals) &&
        !Array.isArray(parsed.holidayDuties)
      ) {
        setFeedback({ type: 'error', text: 'Format berkas tidak valid. Gunakan berkas .json hasil ekspor aplikasi.' });
        return;
      }

      const result = await onImportBackup({
        agendas: Array.isArray(parsed.agendas) ? parsed.agendas : [],
        journals: Array.isArray(parsed.journals) ? parsed.journals : [],
        holidayDuties: Array.isArray(parsed.holidayDuties) ? parsed.holidayDuties : []
      });
      setFeedback({ type: result.ok ? 'success' : 'error', text: result.message });
    } catch {
      setFeedback({ type: 'error', text: 'Berkas JSON rusak atau tidak dapat dibaca.' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1 p-2 rounded-xl bg-teal-500/20 text-teal-300 border border-teal-400/30">
              <Smartphone className="w-4 h-4" />
              <Laptop className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Sinkronisasi Cloud HP &amp; Komputer</h3>
              <p className="text-[11px] text-slate-400">
                Database permanen real-time lintas perangkat
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {feedback && (
            <div
              className={`flex items-start gap-2.5 p-3 rounded-xl text-xs font-medium border ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : 'bg-red-50 text-red-800 border-red-200'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              )}
              <span>{feedback.text}</span>
            </div>
          )}

          {/* 1. Cloud Account Sync */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <div className="p-2 rounded-lg bg-teal-100 text-teal-700 shrink-0 mt-0.5">
                <Cloud className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">1. Sinkronisasi Otomatis Akun Google</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Masuk dengan <strong>akun Google yang sama</strong> di HP dan Komputer agar seluruh agenda, jurnal harian, piket, dan lampiran otomatis sama secara real-time.
                </p>
              </div>
            </div>

            {userEmail ? (
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-emerald-700">Terhubung ke Cloud Real-Time</p>
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {userDisplayName ? `${userDisplayName} (${userEmail})` : userEmail}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold shrink-0 transition"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Keluar</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={handleSyncNow}
                    disabled={isSyncing}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold shadow-sm transition"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                    <span>{isSyncing ? 'Menyinkronkan...' : 'Tarik Data Cloud'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handlePushLocal}
                    disabled={isSyncing}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-100 disabled:opacity-60 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    <Upload className="w-3.5 h-3.5 text-teal-600" />
                    <span>Unggah Data Perangkat Ini</span>
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isAuthLoading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
              >
                <LogIn className="w-4 h-4 text-amber-400" />
                <span>{isAuthLoading ? 'Membuka Login Google...' : 'Masuk dengan Akun Google'}</span>
              </button>
            )}
          </div>

          {/* 2. File Export/Import Backup */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">2. Cadangan &amp; Impor Berkas (.json)</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Simpan arsip cadangan berkala atau impor berkas JSON untuk langsung masuk ke database cloud Anda.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={handleExportJson}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-white hover:bg-slate-100 text-slate-800 border border-slate-300 rounded-xl text-xs font-semibold transition"
              >
                <Download className="w-4 h-4 text-blue-600" />
                <span>Ekspor Data (.json)</span>
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white rounded-xl text-xs font-semibold transition"
              >
                <Upload className="w-4 h-4" />
                <span>{isImporting ? 'Mengimpor...' : 'Impor Data (.json)'}</span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="application/json,.json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>
          </div>

          {/* Current count summary */}
          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>Data aktif saat ini:</span>
            <span className="font-semibold text-slate-700">
              {agendas.length} Agenda • {journals.length} Jurnal • {holidayDuties.length} Piket
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
