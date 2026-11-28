import React, { useState } from 'react';
import { Printer, ArrowLeft, Download, Shield, FileDown, Loader2 } from 'lucide-react';
import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';
import { formatDateIndo, downloadMonthlyIcsFile } from '../utils/calendarSync';
import { downloadMonthlyReportPdf } from '../utils/pdfExport';
import { resolveLogoDataUrlForPdf } from '../utils/appLogo';

interface OfficialPrintViewProps {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  selectedMonthName: string;
  selectedYear: number;
  logoUrl: string;
  onBackToCalendar: () => void;
}

export const OfficialPrintView: React.FC<OfficialPrintViewProps> = ({
  agendas,
  journals,
  holidayDuties,
  selectedMonthName,
  selectedYear,
  logoUrl,
  onBackToCalendar
}) => {
  const [includePiket, setIncludePiket] = useState(true);
  const [includeJournal, setIncludeJournal] = useState(true);
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [logoFailed, setLogoFailed] = useState(false);

  // Sort agendas by date and start time
  const sortedAgendas = [...agendas].sort((a, b) =>
    (a.date + a.startTime).localeCompare(b.date + b.startTime)
  );

  const sortedDuties = [...holidayDuties].sort((a, b) => a.date.localeCompare(b.date));
  const sortedJournals = [...journals].sort((a, b) =>
    (a.date + a.time).localeCompare(b.date + b.time)
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    setIsDownloadingPdf(true);
    try {
      const logoDataUrl = await resolveLogoDataUrlForPdf(logoUrl);
      downloadMonthlyReportPdf({
        agendas: sortedAgendas,
        journals: sortedJournals,
        holidayDuties: sortedDuties,
        selectedMonthName,
        selectedYear,
        includePiket,
        includeJournal,
        logoDataUrl
      });
    } catch (err) {
      console.error('Gagal membuat PDF laporan bulanan:', err);
    } finally {
      setTimeout(() => setIsDownloadingPdf(false), 300);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Action Bar (Hidden on print) */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3 no-print">
        <button
          onClick={onBackToCalendar}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Kalender</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includePiket}
              onChange={(e) => setIncludePiket(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Sertakan Piket Libur ({sortedDuties.length})</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeJournal}
              onChange={(e) => setIncludeJournal(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Sertakan Jurnal Harian ({sortedJournals.length})</span>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => downloadMonthlyIcsFile(agendas, selectedMonthName, selectedYear)}
            className="inline-flex items-center gap-2 px-3.5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-semibold shadow-xs transition"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor Kalender (.ics)</span>
          </button>

          <button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition"
          >
            {isDownloadingPdf ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileDown className="w-4 h-4" />
            )}
            <span>{isDownloadingPdf ? 'Menyiapkan PDF...' : 'Download Laporan Bulanan'}</span>
          </button>

          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs sm:text-sm font-semibold shadow-md transition"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak Lembar</span>
          </button>
        </div>
      </div>

      {/* Printable Paper Canvas */}
      <div className="bg-white p-6 sm:p-10 rounded-2xl border border-slate-200 shadow-md print:border-0 print:shadow-none print:p-0 max-w-5xl mx-auto">
        {/* Official Kop Header */}
        <div className="border-b-2 border-slate-900 pb-4 mb-6 text-center relative">
          <div className="flex items-center justify-center gap-4 mb-2">
            {!logoFailed ? (
              <img
                src={logoUrl}
                alt="Logo SUBAG TU PIM & PROTOKOL DITJENPAS"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
                className="w-16 h-16 object-contain shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full border-2 border-slate-900 flex items-center justify-center p-2 text-slate-900 shrink-0">
                <Shield className="w-7 h-7" />
              </div>
            )}
            <div>
              <h2 className="text-sm sm:text-base font-extrabold uppercase tracking-widest text-slate-900">
                SUBAG TU PIM &amp; PROTOKOL DITJENPAS
              </h2>
              <h1 className="text-base sm:text-lg font-black uppercase text-slate-950">
                AGENDA KEGIATAN RESMI PIMPINAN
              </h1>
              <p className="text-xs text-slate-700 font-medium">
                Direktorat Jenderal Pemasyarakatan • Subbagian Tata Usaha Pimpinan dan Protokol
              </p>
            </div>
          </div>
          <div className="w-full h-0.5 bg-slate-900 mt-2"></div>
        </div>

        {/* Title & Periode */}
        <div className="text-center my-4">
          <h3 className="text-sm sm:text-base font-extrabold uppercase text-slate-900 underline underline-offset-4">
            JADWAL DAN AGENDA KEGIATAN BULAN {selectedMonthName.toUpperCase()} {selectedYear}
          </h3>
          <p className="text-xs text-slate-600 mt-1 font-medium">
            Status Pemutakhiran: {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        {/* Official Agenda Table */}
        <div className="overflow-x-auto mt-6">
          <table className="w-full text-left text-xs border-collapse border border-slate-400">
            <thead>
              <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-center border-b border-slate-400">
                <th className="border border-slate-400 p-2 w-10">No</th>
                <th className="border border-slate-400 p-2 w-32">Hari / Tanggal</th>
                <th className="border border-slate-400 p-2 w-24">Waktu</th>
                <th className="border border-slate-400 p-2">Nama Acara / Kegiatan</th>
                <th className="border border-slate-400 p-2 w-44">Tempat / Lokasi</th>
                <th className="border border-slate-400 p-2 w-44">Pimpinan & Pendamping</th>
                <th className="border border-slate-400 p-2 w-28">Pakaian</th>
                <th className="border border-slate-400 p-2 w-28">Keterangan</th>
              </tr>
            </thead>
            <tbody>
              {sortedAgendas.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500 italic">
                    Belum ada agenda pimpinan yang tercatat untuk bulan {selectedMonthName} {selectedYear}.
                  </td>
                </tr>
              ) : (
                sortedAgendas.map((item, index) => (
                  <tr key={item.id} className="border-b border-slate-300 hover:bg-slate-50">
                    <td className="border border-slate-400 p-2 text-center font-bold">{index + 1}</td>
                    <td className="border border-slate-400 p-2 font-semibold text-slate-900">
                      {formatDateIndo(item.date)}
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-mono font-bold text-slate-800">
                      {item.startTime} - {item.endTime} WIB
                    </td>
                    <td className="border border-slate-400 p-2">
                      <div className="font-bold text-slate-950">{item.title}</div>
                      <div className="text-[11px] text-slate-600 mt-0.5">Kategori: {item.category}</div>
                      {item.virtualMeetingUrl && (
                        <div className="text-[10px] text-blue-700 italic">Virtual: {item.virtualMeetingUrl}</div>
                      )}
                    </td>
                    <td className="border border-slate-400 p-2 text-slate-800">
                      {item.location}
                    </td>
                    <td className="border border-slate-400 p-2">
                      <div className="font-bold text-slate-900">{item.leader}</div>
                      <div className="text-[11px] text-slate-700">{item.leaderName}</div>
                      {item.companions && (
                        <div className="text-[10px] text-slate-500 mt-1">Pendamping: {item.companions}</div>
                      )}
                    </td>
                    <td className="border border-slate-400 p-2 text-center font-medium">
                      {item.dressCode || '-'}
                    </td>
                    <td className="border border-slate-400 p-2 text-[11px]">
                      <div className="font-bold">{item.status}</div>
                      {item.documents && item.documents.length > 0 && (
                        <div className="text-[10px] text-purple-700 mt-0.5">
                          {item.documents.length} dokumen lampiran
                        </div>
                      )}
                      {item.notes && (
                        <div className="text-[10px] text-slate-500 italic mt-0.5">{item.notes}</div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Lampiran: Petugas Protokol Piket Hari Libur */}
        {includePiket && (
          <div className="mt-8 break-inside-avoid">
            <h4 className="text-xs sm:text-sm font-extrabold uppercase text-slate-900 mb-2">
              LAMPIRAN I: DAFTAR PETUGAS PROTOKOL PIKET HARI LIBUR — {selectedMonthName.toUpperCase()} {selectedYear}
            </h4>
            <table className="w-full text-left text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-center border-b border-slate-400">
                  <th className="border border-slate-400 p-2 w-10">No</th>
                  <th className="border border-slate-400 p-2 w-36">Hari / Tanggal</th>
                  <th className="border border-slate-400 p-2 w-36">Keterangan Libur</th>
                  <th className="border border-slate-400 p-2 w-32">Shift</th>
                  <th className="border border-slate-400 p-2 w-40">Koordinator Piket</th>
                  <th className="border border-slate-400 p-2">Nama Petugas Protokol Piket</th>
                </tr>
              </thead>
              <tbody>
                {sortedDuties.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-4 text-center text-slate-500 italic">
                      Belum ada jadwal petugas protokol piket hari libur pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  sortedDuties.map((duty, idx) => (
                    <tr key={duty.id} className="border-b border-slate-300">
                      <td className="border border-slate-400 p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-400 p-2 font-semibold">{formatDateIndo(duty.date)}</td>
                      <td className="border border-slate-400 p-2">
                        <div className="font-semibold">{duty.holidayName}</div>
                        <div className="text-[10px] text-slate-600">{duty.dayType}</div>
                      </td>
                      <td className="border border-slate-400 p-2 text-center">{duty.shift}</td>
                      <td className="border border-slate-400 p-2">
                        <div className="font-bold">{duty.coordinatorName}</div>
                        {duty.coordinatorPhone && <div className="text-[10px] text-slate-600">{duty.coordinatorPhone}</div>}
                      </td>
                      <td className="border border-slate-400 p-2">
                        <ul className="space-y-0.5">
                          {duty.officers.map((off) => (
                            <li key={off.id}>
                              <strong>{off.name}</strong> ({off.role}){off.phone ? ` — ${off.phone}` : ''}
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Lampiran: Jurnal Harian Kegiatan */}
        {includeJournal && (
          <div className="mt-8 break-inside-avoid">
            <h4 className="text-xs sm:text-sm font-extrabold uppercase text-slate-900 mb-2">
              LAMPIRAN II: JURNAL HARIAN KEGIATAN PIMPINAN — {selectedMonthName.toUpperCase()} {selectedYear}
            </h4>
            <table className="w-full text-left text-xs border-collapse border border-slate-400">
              <thead>
                <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-center border-b border-slate-400">
                  <th className="border border-slate-400 p-2 w-10">No</th>
                  <th className="border border-slate-400 p-2 w-32">Tanggal & Jam</th>
                  <th className="border border-slate-400 p-2 w-44">Kegiatan & Pelapor</th>
                  <th className="border border-slate-400 p-2">Uraian Pelaksanaan & Tindak Lanjut</th>
                  <th className="border border-slate-400 p-2 w-28">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedJournals.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-slate-500 italic">
                      Belum ada catatan jurnal harian kegiatan pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  sortedJournals.map((entry, idx) => (
                    <tr key={entry.id} className="border-b border-slate-300">
                      <td className="border border-slate-400 p-2 text-center font-bold">{idx + 1}</td>
                      <td className="border border-slate-400 p-2">
                        <div className="font-semibold">{formatDateIndo(entry.date)}</div>
                        <div className="text-[10px] font-mono">{entry.time} WIB</div>
                      </td>
                      <td className="border border-slate-400 p-2">
                        <div className="font-bold">{entry.title}</div>
                        <div className="text-[10px] text-slate-600 mt-0.5">
                          Pelapor: {entry.reporterName} ({entry.reporterRole})
                        </div>
                      </td>
                      <td className="border border-slate-400 p-2">
                        <div>{entry.summary}</div>
                        {entry.followUp && (
                          <div className="mt-1 text-[11px] font-semibold text-slate-800">
                            Tindak Lanjut: {entry.followUp}
                          </div>
                        )}
                      </td>
                      <td className="border border-slate-400 p-2 text-center font-semibold">{entry.outcome}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
};
