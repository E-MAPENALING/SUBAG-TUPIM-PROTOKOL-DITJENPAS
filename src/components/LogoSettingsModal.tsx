import React, { useRef, useState } from 'react';
import { X, Upload, RotateCcw, CheckCircle2, AlertCircle, Image as ImageIcon } from 'lucide-react';
import { normalizeUploadedLogoFile } from '../utils/appLogo';

interface LogoSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  logoUrl: string;
  isCustomLogo: boolean;
  onUpdateLogo: (newDataUrl: string) => void;
  onResetLogo: () => void;
}

export const LogoSettingsModal: React.FC<LogoSettingsModalProps> = ({
  isOpen,
  onClose,
  logoUrl,
  isCustomLogo,
  onUpdateLogo,
  onResetLogo
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFeedback(null);

    if (!file.type.startsWith('image/')) {
      setFeedback({ type: 'error', text: 'Pilih berkas gambar berformat PNG, JPG, WebP, atau SVG.' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFeedback({ type: 'error', text: 'Ukuran berkas logo maksimal 5 MB.' });
      return;
    }

    setIsProcessing(true);
    try {
      const normalized = await normalizeUploadedLogoFile(file);
      onUpdateLogo(normalized);
      setFeedback({
        type: 'success',
        text: 'Logo berhasil diperbarui dan otomatis diterapkan pada header, kop surat cetak, dan laporan PDF.'
      });
    } catch {
      setFeedback({ type: 'error', text: 'Gagal memproses berkas gambar. Coba gambar lain.' });
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleReset = () => {
    onResetLogo();
    setFeedback({
      type: 'success',
      text: 'Logo dikembalikan ke emblem default SUBAG TU PIM & PROTOKOL DITJENPAS.'
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/75 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-900 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30">
              <ImageIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">Logo Resmi Aplikasi</h3>
              <p className="text-[11px] text-slate-400">
                Tampil pada header, kop cetak resmi, dan laporan PDF
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

          {/* Logo Preview */}
          <div className="flex flex-col items-center justify-center p-6 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
            <div className="w-28 h-28 rounded-2xl bg-white p-2 border border-slate-200 shadow-sm flex items-center justify-center overflow-hidden">
              <img
                src={logoUrl}
                alt="Logo SUBAG TU PIM & PROTOKOL DITJENPAS"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-center">
              <p className="text-xs font-bold text-slate-900">
                SUBAG TU PIM &amp; PROTOKOL DITJENPAS
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                {isCustomLogo ? 'Menggunakan logo kustom yang diunggah' : 'Menggunakan logo resmi bawaan aplikasi'}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessing}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold transition"
            >
              <Upload className="w-4 h-4 text-amber-400" />
              <span>{isProcessing ? 'Memproses Logo...' : 'Unggah Logo Instansi (PNG / JPG)'}</span>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={handleFileChange}
              className="hidden"
            />

            {isCustomLogo && (
              <button
                type="button"
                onClick={handleReset}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Kembalikan Logo Bawaan</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
