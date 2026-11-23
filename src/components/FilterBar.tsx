import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { FilterState, AgendaCategory, LeaderRole } from '../types/agenda';

interface FilterBarProps {
  filter: FilterState;
  onFilterChange: (newFilter: FilterState) => void;
  onReset: () => void;
  categories: AgendaCategory[];
  leaders: LeaderRole[];
}

export const FilterBar: React.FC<FilterBarProps> = ({
  filter,
  onFilterChange,
  onReset,
  categories,
  leaders
}) => {
  const isFiltered =
    Boolean(filter.searchQuery) ||
    Boolean(filter.category) ||
    Boolean(filter.priority) ||
    Boolean(filter.status) ||
    Boolean(filter.leader);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-3.5 sm:p-4 mb-6 no-print">
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Search input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={filter.searchQuery}
            onChange={(e) => onFilterChange({ ...filter, searchQuery: e.target.value })}
            placeholder="Cari kegiatan, pimpinan, tempat, berkas dokumen..."
            className="w-full pl-10 pr-4 py-2 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
          />
          {filter.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filter, searchQuery: '' })}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter Dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Category */}
          <select
            value={filter.category}
            onChange={(e) => onFilterChange({ ...filter, category: e.target.value })}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={filter.priority}
            onChange={(e) => onFilterChange({ ...filter, priority: e.target.value })}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Prioritas</option>
            <option value="VIP">VIP / Sangat Penting</option>
            <option value="Tinggi">Tinggi</option>
            <option value="Sedang">Sedang</option>
            <option value="Rutin">Rutin</option>
          </select>

          {/* Status */}
          <select
            value={filter.status}
            onChange={(e) => onFilterChange({ ...filter, status: e.target.value })}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Status</option>
            <option value="Terjadwal">Terjadwal</option>
            <option value="Berlangsung">Sedang Berlangsung</option>
            <option value="Selesai">Selesai</option>
            <option value="Ditunda">Ditunda</option>
            <option value="Dibatalkan">Dibatalkan</option>
          </select>

          {/* Leader */}
          <select
            value={filter.leader}
            onChange={(e) => onFilterChange({ ...filter, leader: e.target.value })}
            className="text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua Pimpinan</option>
            {leaders.map((l) => (
              <option key={l} value={l}>{l}</option>
            ))}
          </select>

          {/* Reset button */}
          {isFiltered && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 px-3 py-2 text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl border border-red-200 transition"
              title="Reset semua filter"
            >
              <X className="w-3.5 h-3.5" />
              <span>Reset</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
