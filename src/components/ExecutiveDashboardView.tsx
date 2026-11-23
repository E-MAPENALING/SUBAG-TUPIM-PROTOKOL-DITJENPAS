import React from 'react';
import { 
  BarChart3, Calendar, Clock, Star, CheckCircle2, 
  FileText, User, ArrowUpRight, Shield, Layers
} from 'lucide-react';
import { AgendaItem, DocumentAttachment } from '../types/agenda';
import { formatDateIndo, generateGoogleCalendarUrl } from '../utils/calendarSync';

interface ExecutiveDashboardViewProps {
  agendas: AgendaItem[];
  selectedMonthName: string;
  selectedYear: number;
  onSelectAgenda: (agenda: AgendaItem) => void;
  onPreviewDocument: (doc: DocumentAttachment) => void;
}

export const ExecutiveDashboardView: React.FC<ExecutiveDashboardViewProps> = ({
  agendas,
  selectedMonthName,
  selectedYear,
  onSelectAgenda,
  onPreviewDocument
}) => {
  const total = agendas.length;
  const vipCount = agendas.filter((a) => a.priority === 'VIP').length;
  const completedCount = agendas.filter((a) => a.status === 'Selesai').length;
  const scheduledCount = agendas.filter((a) => a.status === 'Terjadwal' || a.status === 'Berlangsung').length;
  const totalDocuments = agendas.reduce((acc, curr) => acc + (curr.documents?.length || 0), 0);

  // Category distribution
  const categoryCountMap: { [cat: string]: number } = {};
  agendas.forEach((a) => {
    categoryCountMap[a.category] = (categoryCountMap[a.category] || 0) + 1;
  });
  const categoryStats = Object.entries(categoryCountMap).sort((a, b) => b[1] - a[1]);

  // Leader workload breakdown
  const leaderCountMap: { [leader: string]: number } = {};
  agendas.forEach((a) => {
    leaderCountMap[a.leader] = (leaderCountMap[a.leader] || 0) + 1;
  });
  const leaderStats = Object.entries(leaderCountMap).sort((a, b) => b[1] - a[1]);

  // Next upcoming agendas
  const todayStr = new Date().toISOString().slice(0, 10);
  const upcomingAgendas = [...agendas]
    .filter((a) => a.date >= todayStr && a.status !== 'Selesai' && a.status !== 'Dibatalkan')
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime))
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        {/* Total Agenda */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Agenda</span>
            <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900">{total}</span>
            <p className="text-[11px] text-slate-400 mt-0.5">{selectedMonthName} {selectedYear}</p>
          </div>
        </div>

        {/* VIP / Sangat Penting */}
        <div className="bg-white p-4 rounded-2xl border border-red-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-red-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Prioritas VIP</span>
            <div className="p-2 bg-red-50 text-red-600 rounded-xl">
              <Star className="w-4 h-4 fill-red-500" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-red-700">{vipCount}</span>
            <p className="text-[11px] text-red-600/70 mt-0.5">Kegiatan VVIP & Keprotokolan</p>
          </div>
        </div>

        {/* Terjadwal / Mendatang */}
        <div className="bg-white p-4 rounded-2xl border border-amber-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Terjadwal</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-amber-700">{scheduledCount}</span>
            <p className="text-[11px] text-amber-600/70 mt-0.5">Menunggu Pelaksanaan</p>
          </div>
        </div>

        {/* Selesai Dilaksanakan */}
        <div className="bg-white p-4 rounded-2xl border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Terlaksana</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-emerald-700">{completedCount}</span>
            <p className="text-[11px] text-emerald-600/70 mt-0.5">
              {total > 0 ? `${Math.round((completedCount / total) * 100)}% selesai` : '0%'}
            </p>
          </div>
        </div>

        {/* Dokumen Terlampir */}
        <div className="bg-white p-4 rounded-2xl border border-purple-200 shadow-xs flex flex-col justify-between col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Dokumen Pendukung</span>
            <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <div>
            <span className="text-2xl sm:text-3xl font-extrabold text-purple-700">{totalDocuments}</span>
            <p className="text-[11px] text-purple-600/70 mt-0.5">Berkas PDF & Gambar</p>
          </div>
        </div>
      </div>

      {/* Two Column Layout: Upcoming & Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Next Upcoming Agendas (2 Cols) */}
        <div className="lg:col-span-2 bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-blue-600" />
              <h3 className="font-bold text-base text-slate-900">Agenda Mendatang Terdekat</h3>
            </div>
            <span className="text-xs text-slate-500 font-medium">Berdasarkan waktu terdekat</span>
          </div>

          {upcomingAgendas.length === 0 ? (
            <div className="py-8 text-center text-slate-400">
              <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-500 mb-2 opacity-80" />
              <p className="text-sm font-semibold text-slate-700">Semua agenda bulan ini telah selesai</p>
              <p className="text-xs text-slate-500">Tidak ada agenda pimpinan yang menunggu pelaksanaan.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {upcomingAgendas.map((item) => {
                const googleCalUrl = generateGoogleCalendarUrl(item);

                return (
                  <div key={item.id} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 hover:bg-slate-50/70 p-2 rounded-xl transition">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                          {formatDateIndo(item.date)}
                        </span>
                        <span className="text-xs font-mono text-slate-500 font-semibold">
                          {item.startTime} - {item.endTime} WIB
                        </span>
                        {item.priority === 'VIP' && (
                          <span className="text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.2 rounded-md">
                            VIP
                          </span>
                        )}
                      </div>
                      <h4
                        onClick={() => onSelectAgenda(item)}
                        className="font-bold text-sm text-slate-900 hover:text-blue-600 cursor-pointer truncate"
                      >
                        {item.title}
                      </h4>
                      <p className="text-xs text-slate-500 truncate">
                        👤 {item.leader} ({item.leaderName}) • 📍 {item.location}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <a
                        href={googleCalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg text-xs font-semibold border border-blue-200 transition"
                      >
                        Kalender
                      </a>
                      <button
                        onClick={() => onSelectAgenda(item)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
                      >
                        <ArrowUpRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Category Breakdown (1 Col) */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-base text-slate-900">Distribusi Kategori Kegiatan</h3>
          </div>

          <div className="space-y-3">
            {categoryStats.map(([cat, count]) => {
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={cat} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 truncate pr-2">{cat}</span>
                    <span className="font-bold text-slate-900">{count} ({pct}%)</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-600 rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Leaders Distribution */}
          <div className="pt-4 border-t border-slate-100">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-blue-600" />
              <span>Penugasan Pimpinan</span>
            </h4>
            <div className="space-y-2">
              {leaderStats.map(([leader, count]) => (
                <div key={leader} className="flex items-center justify-between text-xs p-2 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-800">{leader}</span>
                  <span className="font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-blue-700">
                    {count} kegiatan
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
