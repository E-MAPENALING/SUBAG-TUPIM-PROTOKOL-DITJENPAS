import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, User, Paperclip, 
  Share2, Download, ExternalLink, Shirt, Edit2, Trash2, 
  FileText, Image as ImageIcon, Video, Star, Loader2
} from 'lucide-react';
import { AgendaItem, AgendaStatus, DocumentAttachment } from '../types/agenda';
import { generateGoogleCalendarUrl, downloadIcsFile, generateWhatsAppShareText, formatDateIndo } from '../utils/calendarSync';
import { getLocalDateIso } from '../utils/firestoreSync';

interface AgendaListViewProps {
  agendas: AgendaItem[];
  onEditAgenda: (agenda: AgendaItem) => void;
  onDeleteAgenda: (agendaId: string) => void;
  onStatusChange: (agendaId: string, newStatus: AgendaStatus) => void;
  onPreviewDocument: (doc: DocumentAttachment) => void;
  onDownloadDocumentPdf: (doc: DocumentAttachment, context?: { title?: string; subtitle?: string; date?: string }) => Promise<void>;
  onAddNew: () => void;
}

export const AgendaListView: React.FC<AgendaListViewProps> = ({
  agendas,
  onEditAgenda,
  onDeleteAgenda,
  onStatusChange,
  onPreviewDocument,
  onDownloadDocumentPdf,
  onAddNew
}) => {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);
  const todayStr = getLocalDateIso();

  const handleDownloadPdfClick = async (doc: DocumentAttachment, agenda: AgendaItem) => {
    setDownloadingDocId(doc.id);
    try {
      await onDownloadDocumentPdf(doc, {
        title: agenda.title,
        subtitle: `${agenda.leader}: ${agenda.leaderName}`,
        date: agenda.date
      });
    } finally {
      setDownloadingDocId((curr) => (curr === doc.id ? null : curr));
    }
  };

  // Group agendas by date
  const groupedAgendas: { [date: string]: AgendaItem[] } = {};
  agendas.forEach((agenda) => {
    if (!groupedAgendas[agenda.date]) {
      groupedAgendas[agenda.date] = [];
    }
    groupedAgendas[agenda.date].push(agenda);
  });

  // Sort dates chronologically
  const sortedDates = Object.keys(groupedAgendas).sort();

  // Sort agendas within each date by start time
  sortedDates.forEach((date) => {
    groupedAgendas[date].sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  if (agendas.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CalendarIcon className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Belum Ada Agenda Pada Bulan Ini</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-6">
          Tidak ada kegiatan yang sesuai dengan filter pencarian atau belum ada jadwal pimpinan yang ditambahkan.
        </p>
        <button
          onClick={onAddNew}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-semibold shadow-md transition"
        >
          <span>Buat Agenda Sekarang</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {sortedDates.map((dateStr) => {
        const dateItems = groupedAgendas[dateStr];
        const isToday = dateStr === todayStr;

        return (
          <div key={dateStr} className="space-y-3">
            {/* Date Section Header */}
            <div className="flex items-center gap-3 sticky top-[52px] z-20 bg-slate-50/95 backdrop-blur-sm py-2">
              <div className={`p-2 rounded-xl text-xs font-bold ${
                isToday ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-800 text-slate-200'
              }`}>
                <CalendarIcon className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm sm:text-base font-bold text-slate-900">
                    {formatDateIndo(dateStr)}
                  </h3>
                  {isToday && (
                    <span className="px-2 py-0.5 text-[11px] font-bold bg-blue-100 text-blue-700 rounded-full border border-blue-200">
                      Hari Ini
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  {dateItems.length} agenda kegiatan pimpinan
                </p>
              </div>
              <div className="flex-1 border-b border-slate-200 ml-2"></div>
            </div>

            {/* List of Agendas for this date */}
            <div className="space-y-4">
              {dateItems.map((item) => {
                const googleCalUrl = generateGoogleCalendarUrl(item);
                const waUrl = generateWhatsAppShareText(item);
                const isVip = item.priority === 'VIP';

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-2xl p-5 shadow-xs border transition-all hover:shadow-md ${
                      isVip ? 'border-amber-300 ring-1 ring-amber-200 bg-gradient-to-br from-white to-amber-50/20' : 'border-slate-200 hover:border-blue-200'
                    }`}
                  >
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                      {/* Left: Main Details */}
                      <div className="space-y-3 flex-1 min-w-0">
                        {/* Top Meta Badges */}
                        <div className="flex flex-wrap items-center gap-2">
                          {/* Time */}
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-slate-900 text-white">
                            <Clock className="w-3.5 h-3.5 text-amber-400" />
                            {item.startTime} - {item.endTime} WIB
                          </span>

                          {/* Category */}
                          <span className="px-2.5 py-1 rounded-xl text-xs font-semibold bg-blue-50 text-blue-800 border border-blue-200">
                            {item.category}
                          </span>

                          {/* Priority */}
                          {item.priority === 'VIP' ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-red-100 text-red-800 border border-red-200">
                              <Star className="w-3.5 h-3.5 text-red-600 fill-red-600" /> VIP
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-xl text-xs font-medium bg-slate-100 text-slate-700">
                              Prioritas: {item.priority}
                            </span>
                          )}

                          {/* Quick Status Select */}
                          <div className="inline-flex items-center gap-1 ml-auto sm:ml-0">
                            <select
                              value={item.status}
                              onChange={(e) => onStatusChange(item.id, e.target.value as AgendaStatus)}
                              className={`text-xs font-semibold rounded-lg px-2.5 py-1 border focus:outline-none transition ${
                                item.status === 'Selesai'
                                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                  : item.status === 'Berlangsung'
                                  ? 'bg-amber-50 text-amber-800 border-amber-300'
                                  : item.status === 'Ditunda'
                                  ? 'bg-purple-50 text-purple-800 border-purple-300'
                                  : item.status === 'Dibatalkan'
                                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                                  : 'bg-slate-50 text-slate-700 border-slate-300'
                              }`}
                            >
                              <option value="Terjadwal">Terjadwal</option>
                              <option value="Berlangsung">Sedang Berlangsung</option>
                              <option value="Selesai">Selesai</option>
                              <option value="Ditunda">Ditunda</option>
                              <option value="Dibatalkan">Dibatalkan</option>
                            </select>
                          </div>
                        </div>

                        {/* Title */}
                        <h4 className="text-base sm:text-lg font-bold text-slate-900">
                          {item.title}
                        </h4>

                        {/* Details Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs sm:text-sm text-slate-600 bg-slate-50/70 p-3.5 rounded-xl border border-slate-100">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-blue-600 shrink-0" />
                            <div>
                              <span className="font-semibold text-slate-900">{item.leader}:</span>{' '}
                              <span>{item.leaderName}</span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-red-500 shrink-0" />
                            <div className="truncate">
                              <span className="font-semibold text-slate-900">Lokasi:</span>{' '}
                              <span title={item.location}>{item.location}</span>
                            </div>
                          </div>

                          {item.dressCode && (
                            <div className="flex items-center gap-2">
                              <Shirt className="w-4 h-4 text-amber-600 shrink-0" />
                              <div>
                                <span className="font-semibold text-slate-900">Pakaian:</span>{' '}
                                <span>{item.dressCode}</span>
                              </div>
                            </div>
                          )}

                          {item.companions && (
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-slate-900">Pendamping:</span>{' '}
                              <span className="truncate" title={item.companions}>{item.companions}</span>
                            </div>
                          )}
                        </div>

                        {/* Virtual Meeting Link */}
                        {item.virtualMeetingUrl && (
                          <div className="flex items-center gap-2 text-xs bg-indigo-50/80 text-indigo-900 px-3 py-2 rounded-xl border border-indigo-200">
                            <Video className="w-4 h-4 text-indigo-600 shrink-0" />
                            <span className="font-semibold">Tautan Virtual:</span>
                            <a
                              href={item.virtualMeetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-indigo-600 hover:underline truncate max-w-sm flex items-center gap-1"
                            >
                              <span>{item.virtualMeetingUrl}</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                        )}

                        {/* Notes */}
                        {item.notes && (
                          <p className="text-xs text-slate-600 italic bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/50">
                            <strong>Catatan:</strong> {item.notes}
                          </p>
                        )}

                        {/* Attached Documents Section (PDF & Images) */}
                        <div className="pt-1">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 mb-2">
                            <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                            <span>Dokumen Pendukung ({item.documents.length} berkas):</span>
                          </div>

                          {item.documents.length === 0 ? (
                            <span className="text-xs text-slate-400 italic">
                              Tidak ada dokumen terlampir pada kegiatan ini.
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-2.5">
                              {item.documents.map((doc) => {
                                const isPdf = doc.type === 'application/pdf' || doc.name.toLowerCase().endsWith('.pdf');
                                const isImg = doc.type.startsWith('image/');
                                const sizeInKb = (doc.size / 1024).toFixed(0);

                                return (
                                  <div
                                    key={doc.id}
                                    className="flex flex-wrap sm:inline-flex items-center justify-between gap-2 p-2 sm:p-1.5 sm:pr-3 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl transition shadow-2xs group w-full sm:w-auto"
                                  >
                                    {isImg && doc.dataUrl ? (
                                      <img
                                        src={doc.dataUrl}
                                        alt=""
                                        className="w-7 h-7 rounded-lg object-cover border border-slate-200"
                                      />
                                    ) : (
                                      <div className={`p-1.5 rounded-lg ${isPdf ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                        {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                                      </div>
                                    )}

                                    <div className="text-left">
                                      <p className="text-xs font-semibold text-slate-800 truncate max-w-[140px] sm:max-w-[200px]" title={doc.name}>
                                        {doc.name}
                                      </p>
                                      <p className="text-[10px] text-slate-500">
                                        {isPdf ? 'PDF' : 'Gambar'} • {sizeInKb} KB
                                      </p>
                                    </div>

                                    <div className="flex items-center gap-1.5 ml-1 border-l border-slate-200 pl-2">
                                      <button
                                        type="button"
                                        onClick={() => onPreviewDocument(doc)}
                                        className="p-1.5 text-slate-500 hover:text-blue-600 rounded-lg hover:bg-white transition"
                                        title="Pratinjau Berkas"
                                      >
                                        <ExternalLink className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={downloadingDocId === doc.id}
                                        onClick={() => {
                                          void handleDownloadPdfClick(doc, item);
                                        }}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[11px] font-semibold shadow-2xs transition whitespace-nowrap"
                                        title={isPdf ? 'Download PDF' : 'Konversi & Download sebagai PDF'}
                                      >
                                        {downloadingDocId === doc.id ? (
                                          <Loader2 className="w-3 h-3 animate-spin" />
                                        ) : (
                                          <Download className="w-3 h-3" />
                                        )}
                                        <span>{downloadingDocId === doc.id ? 'Mengunduh...' : 'Download PDF'}</span>
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right: Action Buttons */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 lg:flex lg:flex-col items-stretch gap-2 shrink-0 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-slate-100 lg:pl-4 lg:min-w-[165px]">
                        {/* Sync to Google Calendar */}
                        <a
                          href={googleCalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition w-full"
                          title="Buka dan simpan langsung ke Google Calendar"
                        >
                          <CalendarIcon className="w-3.5 h-3.5" />
                          <span>Google Calendar</span>
                        </a>

                        {/* Download .ICS File */}
                        <button
                          onClick={() => downloadIcsFile(item)}
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition w-full"
                          title="Unduh file kalender .ICS untuk Apple / Outlook"
                        >
                          <Download className="w-3.5 h-3.5 text-slate-500" />
                          <span>Unduh .ICS</span>
                        </button>

                        {/* Share WhatsApp */}
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium transition w-full"
                          title="Kirim pengingat format protokol via WhatsApp"
                        >
                          <Share2 className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Kirim WA</span>
                        </a>

                        {/* Edit & Delete row */}
                        <div className="flex items-center gap-2 pt-1 w-full justify-between">
                          {confirmDeleteId === item.id ? (
                            <div className="flex items-center gap-1.5 w-full">
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteAgenda(item.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="flex-1 px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition"
                              >
                                Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition"
                              >
                                Batal
                              </button>
                            </div>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => onEditAgenda(item)}
                                className="flex-1 flex items-center justify-center gap-1 px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-xs font-medium border border-slate-200 transition"
                                title="Ubah Agenda"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Ubah</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                                title="Hapus Agenda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};
