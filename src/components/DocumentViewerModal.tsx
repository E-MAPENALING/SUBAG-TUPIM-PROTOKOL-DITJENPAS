import React from 'react';
import { X, Download, ExternalLink, FileText, Image as ImageIcon, ZoomIn, ZoomOut } from 'lucide-react';
import { DocumentAttachment } from '../types/agenda';

interface DocumentViewerModalProps {
  document: DocumentAttachment | null;
  onClose: () => void;
}

export const DocumentViewerModal: React.FC<DocumentViewerModalProps> = ({ document: doc, onClose }) => {
  const [zoomLevel, setZoomLevel] = React.useState<number>(100);

  if (!doc) return null;

  const isPdf = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
  const isImage = doc.type.startsWith('image/') || /\.(png|jpe?g|webp|svg|gif)$/i.test(doc.name);

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleDownload = () => {
    const link = window.document.createElement('a');
    link.href = doc.dataUrl;
    link.download = doc.name;
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
  };

  const handleOpenInNewTab = () => {
    const newWindow = window.open();
    if (newWindow) {
      if (isPdf) {
        newWindow.document.write(
          `<title>${doc.name}</title><iframe src="${doc.dataUrl}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
        );
      } else {
        newWindow.document.write(
          `<title>${doc.name}</title><body style="margin:0; background:#0f172a; display:flex; justify-content:center; align-items:center; min-height:100vh;"><img src="${doc.dataUrl}" style="max-width:90%; max-height:90vh; object-fit:contain; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5);" /></body>`
        );
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="relative w-full max-w-5xl h-[90vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white border-b border-slate-800">
          <div className="flex items-center gap-3 min-w-0 pr-4">
            <div className={`p-2 rounded-lg ${isPdf ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
              {isPdf ? <FileText className="w-5 h-5" /> : <ImageIcon className="w-5 h-5" />}
            </div>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm sm:text-base text-slate-100 truncate">{doc.name}</h3>
              <p className="text-xs text-slate-400">
                {formatFileSize(doc.size)} • Diunggah {new Date(doc.uploadedAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {isImage && (
              <div className="hidden sm:flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 text-xs text-slate-300">
                <button
                  onClick={() => setZoomLevel(prev => Math.max(50, prev - 25))}
                  className="p-1 hover:text-white transition"
                  title="Perkecil"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="w-12 text-center font-mono">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(prev => Math.min(250, prev + 25))}
                  className="p-1 hover:text-white transition"
                  title="Perbesar"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            )}

            <button
              onClick={handleOpenInNewTab}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              title="Buka Tab Baru"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Tab Baru</span>
            </button>

            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 hover:bg-blue-500 text-white transition shadow-sm"
              title="Unduh Berkas"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Unduh</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Tutup Preview"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Viewer */}
        <div className="flex-1 bg-slate-100 overflow-auto p-4 flex items-center justify-center">
          {isPdf ? (
            <div className="w-full h-full bg-white rounded-xl shadow-inner border border-slate-300 overflow-hidden flex flex-col">
              <iframe
                src={`${doc.dataUrl}#toolbar=1`}
                className="w-full h-full border-0"
                title={doc.name}
              />
            </div>
          ) : isImage ? (
            <div className="max-w-full max-h-full overflow-auto flex items-center justify-center p-4">
              <img
                src={doc.dataUrl}
                alt={doc.name}
                style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'center center' }}
                className="max-h-[75vh] w-auto object-contain rounded-lg shadow-lg border border-slate-200 transition-transform duration-150"
              />
            </div>
          ) : (
            <div className="text-center p-8 bg-white rounded-2xl shadow border border-slate-200 max-w-md">
              <FileText className="w-16 h-16 mx-auto text-slate-400 mb-3" />
              <h4 className="font-semibold text-slate-800 mb-1">{doc.name}</h4>
              <p className="text-sm text-slate-500 mb-4">
                Pratinjau langsung tidak tersedia untuk format berkas ini. Silakan unduh berkas untuk membukanya.
              </p>
              <button
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition"
              >
                <Download className="w-4 h-4" />
                Unduh Dokumen Sekarang
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
