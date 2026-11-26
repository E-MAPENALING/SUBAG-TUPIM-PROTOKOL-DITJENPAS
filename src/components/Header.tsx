import React from 'react';
import { 
  Calendar as CalendarIcon, ListOrdered, BarChart3, Printer, 
  Plus, Bell, BellRing, Download, Volume2, Sparkles, Shield,
  BookOpen, ShieldCheck, RefreshCw, Smartphone, LogIn, LogOut
} from 'lucide-react';
import { ViewMode } from '../types/agenda';
import { playExecutiveChime } from '../utils/audioAlarm';

interface HeaderProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onOpenNewModal: () => void;
  onExportMonthIcs: () => void;
  notificationPermission: NotificationPermission;
  onRequestNotificationPermission: () => void;
  selectedMonthName: string;
  selectedYear: number;
  totalAgendasThisMonth: number;
  totalJournalsThisMonth: number;
  totalDutiesThisMonth: number;
  onManualSync: () => void;
  onOpenSyncModal: () => void;
  isSyncing: boolean;
  userEmail: string | null;
  userDisplayName: string | null;
  onSignInGoogle: () => void;
  onSignOut: () => void;
  isAuthLoading: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  onOpenNewModal,
  onExportMonthIcs,
  notificationPermission,
  onRequestNotificationPermission,
  selectedMonthName,
  selectedYear,
  totalAgendasThisMonth,
  totalJournalsThisMonth,
  totalDutiesThisMonth,
  onManualSync,
  onOpenSyncModal,
  isSyncing,
  userEmail,
  userDisplayName,
  onSignInGoogle,
  onSignOut,
  isAuthLoading
}) => {
  return (
    <header className="bg-slate-900 text-white border-b border-slate-800 sticky top-0 z-40 shadow-lg no-print">
      {/* Top Branding Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* App Title & Identity */}
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0">
            <div className="w-full h-full bg-slate-950 rounded-[14px] flex items-center justify-center text-amber-400">
              <Shield className="w-6 h-6" />
            </div>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                SUBAG TU PIM &amp; PROTOKOL DITJENPAS
              </h1>
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="w-3 h-3" /> Protokol Eksekutif
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Sistem Penjadwalan Bulanan, Pengingat Otomatis &amp; Sinkronisasi Cloud HP &harr; PC
            </p>
          </div>
        </div>

        {/* Top Right Actions */}
        <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">
          {/* Google Account Cloud Sync Action */}
          {userEmail ? (
            <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs">
              <button
                onClick={onOpenSyncModal}
                className="text-emerald-200 hover:text-white font-medium truncate max-w-[140px] sm:max-w-[180px] transition"
                title={`Sinkron Cloud aktif: ${userEmail}`}
              >
                {userDisplayName || userEmail}
              </button>
              <button
                onClick={onSignOut}
                className="p-1 rounded-lg text-emerald-300 hover:text-white hover:bg-emerald-500/25 transition"
                title="Keluar dari akun Google"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onSignInGoogle}
              disabled={isAuthLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs font-bold shadow-sm transition"
              title="Masuk Google agar data otomatis sama di HP dan Komputer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isAuthLoading ? 'Memproses...' : 'Masuk Google'}</span>
            </button>
          )}

          {/* Notification Permission Indicator / Button */}
          {notificationPermission === 'granted' ? (
            <button
              onClick={() => playExecutiveChime()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/25 transition"
              title="Pengingat Browser Aktif. Klik untuk uji suara lonceng"
            >
              <BellRing className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden lg:inline">Pengingat Aktif</span>
              <Volume2 className="w-3 h-3 text-emerald-400/80" />
            </button>
          ) : (
            <button
              onClick={onRequestNotificationPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition"
              title="Izinkan notifikasi desktop agar pengingat agenda berbunyi"
            >
              <Bell className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Aktifkan Pengingat</span>
            </button>
          )}

          {/* Manual Cloud Sync Button */}
          <button
            onClick={onManualSync}
            disabled={isSyncing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 border border-slate-700 text-xs font-medium transition"
            title="Sinkronkan ulang data cloud sekarang"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden lg:inline">{isSyncing ? 'Menyinkronkan...' : 'Sinkronkan'}</span>
          </button>

          {/* HP <-> Komputer Sync & Transfer Modal Button */}
          <button
            onClick={onOpenSyncModal}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
            title="Pengaturan sinkronisasi cloud & transfer berkas HP dan Komputer"
          >
            <Smartphone className="w-3.5 h-3.5 text-amber-400" />
            <span>HP &harr; PC</span>
          </button>

          {/* Sync All Month's Agendas to Calendar (.ICS) */}
          <button
            onClick={onExportMonthIcs}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
            title={`Unduh seluruh agenda ${selectedMonthName} ${selectedYear} ke kalender`}
          >
            <Download className="w-3.5 h-3.5 text-blue-400" />
            <span className="hidden lg:inline">Kalender (.ics)</span>
            <span className="lg:hidden">.ICS</span>
          </button>

          {/* Add Agenda Button */}
          <button
            onClick={onOpenNewModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg transition transform active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Agenda</span>
          </button>
        </div>
      </div>

      {/* Navigation View Switcher Bar */}
      <div className="bg-slate-950/60 border-t border-slate-800/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto py-2">
          {/* View Tabs */}
          <div className="flex items-center gap-1 sm:gap-2">
            <button
              onClick={() => onViewChange('calendar')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeView === 'calendar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              <span>Kalender Bulanan</span>
            </button>

            <button
              onClick={() => onViewChange('list')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeView === 'list'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ListOrdered className="w-4 h-4" />
              <span>Daftar Agenda</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeView === 'list' ? 'bg-blue-800 text-blue-200' : 'bg-slate-800 text-slate-300'}`}>
                {totalAgendasThisMonth}
              </span>
            </button>

            <button
              onClick={() => onViewChange('journal')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeView === 'journal'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Jurnal Harian</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeView === 'journal' ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-300'}`}>
                {totalJournalsThisMonth}
              </span>
            </button>

            <button
              onClick={() => onViewChange('piket')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeView === 'piket'
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Piket Hari Libur</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${activeView === 'piket' ? 'bg-teal-800 text-teal-200' : 'bg-slate-800 text-slate-300'}`}>
                {totalDutiesThisMonth}
              </span>
            </button>

            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeView === 'dashboard'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Dashboard</span>
            </button>

            <button
              onClick={() => onViewChange('print')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition whitespace-nowrap ${
                activeView === 'print'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Resmi</span>
            </button>
          </div>

          {/* Current Periode Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 pl-4 border-l border-slate-800">
            <span>Periode Aktif:</span>
            <span className="font-bold text-amber-300">{selectedMonthName} {selectedYear}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
