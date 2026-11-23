import React from 'react';
import { ChevronLeft, ChevronRight, Calendar, Star, Clock } from 'lucide-react';

interface MonthSelectorProps {
  currentDate: Date;
  selectedMonth: number; // 0 - 11
  selectedYear: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
  onJumpToToday: () => void;
  stats: {
    total: number;
    vip: number;
    completed: number;
    upcoming: number;
  };
}

const MONTH_NAMES_ID = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export const MonthSelector: React.FC<MonthSelectorProps> = ({
  currentDate,
  selectedMonth,
  selectedYear,
  onMonthChange,
  onYearChange,
  onJumpToToday,
  stats
}) => {
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      onMonthChange(11);
      onYearChange(selectedYear - 1);
    } else {
      onMonthChange(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      onMonthChange(0);
      onYearChange(selectedYear + 1);
    } else {
      onMonthChange(selectedMonth + 1);
    }
  };

  const isCurrentMonthAndYear =
    currentDate.getMonth() === selectedMonth &&
    currentDate.getFullYear() === selectedYear;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 sm:p-5 mb-6 no-print">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        {/* Navigation & Title */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition"
              title="Bulan Sebelumnya"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="px-3 py-1 text-center min-w-[170px]">
              <span className="text-base sm:text-lg font-bold text-slate-900">
                {MONTH_NAMES_ID[selectedMonth]} {selectedYear}
              </span>
            </div>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg text-slate-700 hover:text-slate-900 hover:bg-white hover:shadow-xs transition"
              title="Bulan Berikutnya"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {!isCurrentMonthAndYear && (
            <button
              onClick={onJumpToToday}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold rounded-xl border border-blue-200 transition"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Kembali ke Bulan Ini</span>
            </button>
          )}

          {/* Quick Month Selector Dropdowns */}
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => onMonthChange(Number(e.target.value))}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {MONTH_NAMES_ID.map((name, idx) => (
                <option key={idx} value={idx}>{name}</option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => onYearChange(Number(e.target.value))}
              className="text-xs font-semibold bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {[2024, 2025, 2026, 2027, 2028].map((yr) => (
                <option key={yr} value={yr}>{yr}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Monthly Stats Chips */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700">
            <span className="w-2 h-2 rounded-full bg-blue-600"></span>
            <span>Total Agenda:</span>
            <span className="font-bold text-slate-900">{stats.total}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
            <Star className="w-3.5 h-3.5 text-red-500 fill-red-500" />
            <span>VIP / Prioritas:</span>
            <span className="font-bold text-red-900">{stats.vip}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700">
            <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
            <span>Selesai:</span>
            <span className="font-bold text-emerald-900">{stats.completed}</span>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-700">
            <Clock className="w-3.5 h-3.5 text-amber-600" />
            <span>Mendatang:</span>
            <span className="font-bold text-amber-900">{stats.upcoming}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
