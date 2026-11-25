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
  Copy,
  Check
} from 'lucide-react';
import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';

interface SyncDeviceModalProps {
  isOpen: boolean;
  onClose: () => void;
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  isSyncing: boolean;
  onManualSync: () => Promise<{ ok: boolean; message: string }>;
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
  onManualSync,
  onImportBackup
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const handleCopyUrl = async () => {
    if (!currentUrl) return;
    try {
      await navigator.clipboard.writeText(currentUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      setFeedback({ type: 'error', text: 'Gagal menyalin tautan. Salin langsung dari bilah alamat browser.' });
    }
  };

  const handleSyncNow = async () => {
    setFeedback(null);
    const result = await onManualSync();
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
        text: `Berkas data (${agendas.length} agenda, ${journals.length} jurnal, ${holidayDuties.length} piket) berhasil diunduh.`
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
              <h3 className="font-bold text-sm sm:text-base">Sinkronisasi HP &amp; Komputer</h3>
              <p className="text-[11px] text-slate-400">
                Samakan data agenda, jurnal harian, dan piket antar perangkat
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

          {/* 1. Live Server Sync */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h4 className="text-sm font-bold text-slate-900">1. Sinkronisasi Otomatis via Tautan Sama</h4>
                <p className="text-xs text-slate-600 mt-0.5">
                  Buka alamat aplikasi yang sama di HP dan Komputer agar setiap perubahan otomatis tersinkron setiap 3 detik.
                </p>
              </div>
            </div>

            {currentUrl && (
              <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2">
                <span className="text-xs text-slate-600 truncate flex-1 font-mono">{currentUrl}</span>
                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition shrink-0"
                >
                  {copiedUrl ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedUrl ? 'Disalin' : 'Salin Link'}</span>
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleSyncNow}
              disabled={isSyncing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-sm transition"
            >
              <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
              <span>{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan Data Sekarang'}</span>
            </button>
          </div>

          {/* 2. File Export/Import Transfer */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-slate-900">2. Transfer Cepat Berkas Data (.json)</h4>
              <p className="text-xs text-slate-600 mt-0.5">
                Gunakan jika ingin memindahkan data beserta lampiran PDF/gambar secara langsung antara HP dan Komputer (misalnya melalui WhatsApp).
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
            <span>Data tersimpan saat ini:</span>
            <span className="font-semibold text-slate-700">
              {agendas.length} Agenda • {journals.length} Jurnal • {holidayDuties.length} Piket
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
