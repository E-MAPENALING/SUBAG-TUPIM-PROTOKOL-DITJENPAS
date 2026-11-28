import React, { useState } from 'react';
import { 
  Calendar as CalendarIcon, Clock, MapPin, User, Paperclip, 
  Plus, Star, Share2, Download, ExternalLink, Shirt, ShieldCheck, Phone, Loader2
} from 'lucide-react';
import { AgendaItem, DocumentAttachment, HolidayDutyEntry } from '../types/agenda';
import { generateGoogleCalendarUrl, downloadIcsFile, generateWhatsAppShareText, formatDateIndo } from '../utils/calendarSync';
import { getLocalDateIso } from '../utils/firestoreSync';

interface CalendarMonthViewProps {
  selectedYear: number;
  selectedMonth: number; // 0 - 11
  agendas: AgendaItem[];
  holidayDuties: HolidayDutyEntry[];
  onSelectAgenda: (agenda: AgendaItem) => void;
  onAddAgendaForDate: (dateStr: string) => void;
  onPreviewDocument: (doc: DocumentAttachment) => void;
  onDownloadDocumentPdf: (
    doc: DocumentAttachment,
    context?: { title?: string; subtitle?: string; date?: string }
  ) => Promise<void>;
  onOpenHolidayDutyTab: () => void;
}

const WEEKDAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const CalendarMonthView: React.FC<CalendarMonthViewProps> = ({
  selectedYear,
  selectedMonth,
  agendas,
  holidayDuties,
  onSelectAgenda,
  onAddAgendaForDate,
  onPreviewDocument,
  onDownloadDocumentPdf,
  onOpenHolidayDutyTab
}) => {
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const [downloadingDocId, setDownloadingDocId] = useState<string | null>(null);

  const handleDownloadPdfClick = async (doc: DocumentAttachment, item: AgendaItem) => {
    setDownloadingDocId(doc.id);
    try {
      await onDownloadDocumentPdf(doc, {
        title: item.title,
        subtitle: `${item.leader}: ${item.leaderName} • ${item.location}`,
        date: item.date
      });
    } finally {
      setDownloadingDocId((curr) => (curr === doc.id ? null : curr));
    }
  };

  const todayStr = getLocalDateIso();

  // Calculate days in current month and day of week for 1st day (0 = Sunday in JS, so convert to Mon = 0)
  const firstDayOfMonth = new Date(selectedYear, selectedMonth, 1);
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Convert JS day (0 is Sun) to Monday-based (0 is Mon, 6 is Sun)
  let startDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startDayOfWeek === -1) startDayOfWeek = 6;

  // Previous month trailing days
  const prevMonthDaysCount = new Date(selectedYear, selectedMonth, 0).getDate();
  const prevMonthCells: { day: number; dateStr: string }[] = [];
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDaysCount - i;
    const m = selectedMonth === 0 ? 12 : selectedMonth;
    const y = selectedMonth === 0 ? selectedYear - 1 : selectedYear;
    prevMonthCells.push({
      day: d,
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    });
  }

  // Current month days
  const currentMonthCells: { day: number; dateStr: string }[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const m = String(selectedMonth + 1).padStart(2, '0');
    const dayPadded = String(d).padStart(2, '0');
    currentMonthCells.push({
      day: d,
      dateStr: `${selectedYear}-${m}-${dayPadded}`
    });
  }

  // Next month leading days to complete grid (multiples of 7)
  const totalFilled = prevMonthCells.length + currentMonthCells.length;
  const nextMonthCells: { day: number; dateStr: string }[] = [];
  const remaining = (7 - (totalFilled % 7)) % 7;
  for (let d = 1; d <= remaining; d++) {
    const m = selectedMonth === 11 ? 1 : selectedMonth + 2;
    const y = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    nextMonthCells.push({
      day: d,
      dateStr: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    });
  }

  // Group agendas by dateStr
  const agendaMap = new Map<string, AgendaItem[]>();
  agendas.forEach((agenda) => {
    const list = agendaMap.get(agenda.date) || [];
    list.push(agenda);
    agendaMap.set(agenda.date, list);
  });

  // Sort agendas within each date by startTime
  agendaMap.forEach((list) => {
    list.sort((a, b) => a.startTime.localeCompare(b.startTime));
  });

  // Map holiday duties by dateStr
  const dutyMap = new Map<string, HolidayDutyEntry>();
  holidayDuties.forEach((duty) => {
    dutyMap.set(duty.date, duty);
  });

  // Agendas for currently active selected date
  const activeDate = selectedDayDate || (agendaMap.has(todayStr) || dutyMap.has(todayStr) ? todayStr : (currentMonthCells[0]?.dateStr || ''));
  const activeAgendas = agendaMap.get(activeDate) || [];
  const activeDuty = dutyMap.get(activeDate) || null;

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Rapat Koordinasi':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Audiensi & Tamu VVIP':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'Kunjungan Kerja (Kunker)':
        return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'Seremonial & Protokoler':
        return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Penandatanganan MoU':
        return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      case 'Dinas Luar Daerah':
        return 'bg-rose-100 text-rose-800 border-rose-200';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  return (
    <div className="space-y-6">
      {/* Calendar Grid Container — identical layout on Komputer & HP (smooth horizontal swipe on narrow phones) */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="sm:hidden flex items-center justify-between px-3 py-1.5 bg-slate-800 text-[11px] text-slate-300 border-b border-slate-700">
          <span>Tampilan Kalender Lengkap (Sama dengan Komputer)</span>
          <span className="text-amber-300 font-semibold">Geser &larr;&rarr;</span>
        </div>

        <div className="overflow-x-auto">
          <div className="min-w-[680px]">
            {/* Weekday Header */}
            <div className="grid grid-cols-7 bg-slate-900 text-white text-xs font-semibold py-3 border-b border-slate-800 text-center">
              {WEEKDAYS.map((day, idx) => (
                <div key={day} className={idx >= 5 ? 'text-amber-400' : 'text-slate-200'}>
                  {day}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 bg-slate-100">
              {/* Trailing Prev Month Days */}
              {prevMonthCells.map((cell) => {
                const dayAgendas = agendaMap.get(cell.dateStr) || [];
                return (
                  <div
                    key={`prev-${cell.dateStr}`}
                    onClick={() => setSelectedDayDate(cell.dateStr)}
                    className="bg-slate-50/60 p-2 min-h-[115px] sm:min-h-[125px] opacity-45 cursor-pointer hover:opacity-80 transition flex flex-col"
                  >
                    <span className="text-xs font-medium text-slate-400">{cell.day}</span>
                    {dayAgendas.length > 0 && (
                      <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                        {dayAgendas.length} agenda
                      </span>
                    )}
                  </div>
                );
              })}

              {/* Current Month Days */}
              {currentMonthCells.map((cell) => {
                const dayAgendas = agendaMap.get(cell.dateStr) || [];
                const dayDuty = dutyMap.get(cell.dateStr);
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === activeDate;

                return (
                  <div
                    key={cell.dateStr}
                    onClick={() => setSelectedDayDate(cell.dateStr)}
                    className={`bg-white p-2 sm:p-2.5 min-h-[120px] sm:min-h-[135px] cursor-pointer transition flex flex-col relative group ${
                      isSelected ? 'ring-2 ring-blue-600 ring-inset bg-blue-50/25' : 'hover:bg-slate-50/80'
                    }`}
                  >
                    {/* Cell Header: Date Number & Add Button */}
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className={`inline-flex items-center justify-center text-xs font-bold w-6 h-6 rounded-full transition ${
                          isToday
                            ? 'bg-blue-600 text-white shadow-xs'
                            : isSelected
                            ? 'bg-slate-900 text-white'
                            : 'text-slate-700 group-hover:text-blue-600'
                        }`}
                      >
                        {cell.day}
                      </span>

                      <div className="flex items-center gap-1 opacity-70 sm:opacity-0 group-hover:opacity-100 transition">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddAgendaForDate(cell.dateStr);
                          }}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition"
                          title={`Tambah agenda pada ${cell.day}`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Identical Detailed Event Chips across Phone, Tablet & Desktop */}
                    <div className="flex-1 space-y-1 overflow-hidden">
                      {dayAgendas.slice(0, 3).map((item) => {
                        const isVip = item.priority === 'VIP';
                        return (
                          <div
                            key={item.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectAgenda(item);
                            }}
                            className={`px-1.5 py-0.5 rounded-md text-[11px] font-medium border truncate transition flex items-center justify-between gap-1 shadow-2xs hover:scale-[1.02] ${
                              isVip
                                ? 'bg-red-50 text-red-900 border-red-200 font-semibold'
                                : getCategoryColor(item.category)
                            }`}
                            title={`${item.startTime} - ${item.title} (${item.leader})`}
                          >
                            <div className="flex items-center gap-1 min-w-0 truncate">
                              {isVip && <Star className="w-2.5 h-2.5 text-red-500 fill-red-500 shrink-0" />}
                              <span className="font-mono text-[9px] opacity-75 shrink-0">{item.startTime}</span>
                              <span className="truncate">{item.title}</span>
                            </div>
                            {item.documents && item.documents.length > 0 && (
                              <Paperclip className="w-2.5 h-2.5 text-slate-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}

                      {dayAgendas.length > 3 && (
                        <div className="text-[10px] font-semibold text-blue-600 hover:underline pt-0.5 px-1">
                          +{dayAgendas.length - 3} kegiatan lainnya
                        </div>
                      )}

                      {/* Holiday Protocol Duty Officer Badge */}
                      {dayDuty && (
                        <div
                          className="mt-1 px-1.5 py-0.5 rounded-md text-[10px] font-semibold bg-teal-50 text-teal-800 border border-teal-200 flex items-center gap-1 truncate"
                          title={`Piket Libur (${dayDuty.holidayName}): ${dayDuty.officers.map((o) => o.name).join(', ')}`}
                        >
                          <ShieldCheck className="w-2.5 h-2.5 text-teal-600 shrink-0" />
                          <span className="truncate">
                            Piket: {dayDuty.officers[0]?.name || dayDuty.coordinatorName}
                            {dayDuty.officers.length > 1 ? ` +${dayDuty.officers.length - 1}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Next Month Leading Days */}
              {nextMonthCells.map((cell) => {
                const dayAgendas = agendaMap.get(cell.dateStr) || [];
                return (
                  <div
                    key={`next-${cell.dateStr}`}
                    onClick={() => setSelectedDayDate(cell.dateStr)}
                    className="bg-slate-50/60 p-2 min-h-[115px] sm:min-h-[125px] opacity-45 cursor-pointer hover:opacity-80 transition flex flex-col"
                  >
                    <span className="text-xs font-medium text-slate-400">{cell.day}</span>
                    {dayAgendas.length > 0 && (
                      <span className="text-[10px] text-slate-500 mt-1 font-semibold">
                        {dayAgendas.length} agenda
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Selected Day Agenda Detail Drawer / Sheet */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-3">
          <div>
            <div className="flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base sm:text-lg text-slate-900">
                Agenda {formatDateIndo(activeDate)}
              </h3>
              {activeDate === todayStr && (
                <span className="px-2 py-0.5 text-xs font-bold bg-blue-100 text-blue-700 rounded-full">
                  Hari Ini
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {activeAgendas.length} kegiatan pimpinan tercatat pada tanggal ini
            </p>
          </div>

          <button
            onClick={() => onAddAgendaForDate(activeDate)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold border border-blue-200 transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Kegiatan Tanggal Ini</span>
          </button>
        </div>

        {/* Holiday Duty Officer Banner for Active Date */}
        {activeDuty && (
          <div className="mt-4 mb-2 p-4 rounded-2xl bg-teal-50/80 border border-teal-200 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-700 text-white text-[11px] font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Petugas Protokol Piket Hari Libur
                </span>
                <span className="text-xs font-semibold text-teal-900">{activeDuty.holidayName}</span>
                <span className="text-xs text-teal-700">• {activeDuty.shift}</span>
              </div>
              <p className="text-xs text-teal-900">
                <strong>Koordinator Piket:</strong> {activeDuty.coordinatorName}
                {activeDuty.coordinatorPhone ? ` (${activeDuty.coordinatorPhone})` : ''}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                {activeDuty.officers.map((off) => (
                  <span
                    key={off.id}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white border border-teal-200 text-xs text-slate-800"
                  >
                    <strong className="font-semibold">{off.name}</strong>
                    <span className="text-teal-700 text-[11px]">({off.role})</span>
                    {off.phone && (
                      <a
                        href={`tel:${off.phone.replace(/[^0-9+]/g, '')}`}
                        className="text-teal-600 hover:text-teal-800 ml-0.5"
                        title={`Hubungi ${off.phone}`}
                      >
                        <Phone className="w-3 h-3" />
                      </a>
                    )}
                  </span>
                ))}
              </div>
            </div>

            <button
              onClick={onOpenHolidayDutyTab}
              className="px-3 py-1.5 bg-white hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-xl text-xs font-semibold transition shrink-0"
            >
              Kelola Piket Libur
            </button>
          </div>
        )}

        {/* List of Agendas on Active Date */}
        {activeAgendas.length === 0 ? (
          <div className="text-center py-10">
            <div className="w-12 h-12 bg-slate-100 text-slate-400 rounded-full flex items-center justify-center mx-auto mb-2">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <p className="text-sm font-semibold text-slate-700">Tidak ada agenda pimpinan pada tanggal ini</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Klik tombol "Tambah Kegiatan Tanggal Ini" untuk membuat jadwal baru.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 mt-2">
            {activeAgendas.map((item) => {
              const googleCalUrl = generateGoogleCalendarUrl(item);
              const waUrl = generateWhatsAppShareText(item);

              return (
                <div key={item.id} className="py-4 hover:bg-slate-50/70 rounded-xl px-3 transition space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div className="space-y-1.5 flex-1">
                      {/* Badges */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-slate-900 text-white">
                          <Clock className="w-3 h-3 text-amber-400" />
                          {item.startTime} - {item.endTime} WIB
                        </span>

                        <span className={`px-2 py-0.5 rounded-lg text-xs font-semibold border ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>

                        {item.priority === 'VIP' && (
                          <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-red-100 text-red-800 border border-red-200 flex items-center gap-1">
                            <Star className="w-3 h-3 text-red-600 fill-red-600" /> VIP
                          </span>
                        )}

                        <span className="text-xs px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          Status: <strong className="font-semibold">{item.status}</strong>
                        </span>
                      </div>

                      {/* Title */}
                      <h4 
                        onClick={() => onSelectAgenda(item)}
                        className="font-bold text-base text-slate-900 hover:text-blue-600 cursor-pointer transition"
                      >
                        {item.title}
                      </h4>

                      {/* Leader & Location */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-slate-600 pt-1">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                          <span className="font-medium text-slate-900">{item.leader}:</span>
                          <span className="truncate">{item.leaderName}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{item.location}</span>
                        </div>
                        {item.dressCode && (
                          <div className="flex items-center gap-1.5">
                            <Shirt className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">Pakaian: {item.dressCode}</span>
                          </div>
                        )}
                        {item.companions && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-slate-700">Pendamping:</span>
                            <span className="truncate">{item.companions}</span>
                          </div>
                        )}
                      </div>

                      {/* Attached Documents Quick Actions */}
                      {item.documents && item.documents.length > 0 && (
                        <div className="pt-2 flex flex-wrap items-center gap-2">
                          <span className="text-xs font-semibold text-slate-700 flex items-center gap-1">
                            <Paperclip className="w-3.5 h-3.5 text-purple-600" />
                            Berkas Lampiran:
                          </span>
                          {item.documents.map((doc) => {
                            const isDownloading = downloadingDocId === doc.id;
                            return (
                              <div
                                key={doc.id}
                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-purple-50 border border-purple-200 rounded-lg text-xs"
                              >
                                <button
                                  type="button"
                                  onClick={() => onPreviewDocument(doc)}
                                  className="inline-flex items-center gap-1 text-purple-700 hover:text-purple-900 font-medium transition"
                                  title="Pratinjau Dokumen"
                                >
                                  <span className="truncate max-w-[150px]">{doc.name}</span>
                                  <ExternalLink className="w-3 h-3 text-purple-500 shrink-0" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    void handleDownloadPdfClick(doc, item);
                                  }}
                                  disabled={isDownloading}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-600 hover:bg-red-700 disabled:opacity-60 text-white text-[11px] font-semibold transition shrink-0"
                                  title="Download PDF"
                                >
                                  {isDownloading ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <Download className="w-3 h-3" />
                                  )}
                                  <span>{isDownloading ? 'Memuat...' : 'Download PDF'}</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Quick Sync & Sharing Action Buttons */}
                    <div className="grid grid-cols-3 sm:flex sm:flex-col items-stretch gap-1.5 shrink-0 pt-2 sm:pt-0 w-full sm:w-auto">
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-semibold shadow-xs transition w-full"
                        title="Buka & Simpan Langsung ke Google Calendar"
                      >
                        <CalendarIcon className="w-3.5 h-3.5" />
                        <span>Google Calendar</span>
                      </a>

                      <button
                        onClick={() => downloadIcsFile(item)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-medium transition w-full"
                        title="Unduh file kalender .ICS untuk Apple / Outlook / HP"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>Unduh .ICS</span>
                      </button>

                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-medium transition w-full"
                        title="Bagikan format protokol ke WhatsApp"
                      >
                        <Share2 className="w-3.5 h-3.5" />
                        <span>Kirim WA</span>
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
