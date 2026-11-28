import React from 'react';
import { motion } from 'motion/react';
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
  logoUrl: string;
  onOpenLogoModal: () => void;
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
  isAuthLoading,
  logoUrl,
  onOpenLogoModal
}) => {
  const [logoFailed, setLogoFailed] = React.useState(false);

  React.useEffect(() => {
    setLogoFailed(false);
  }, [logoUrl]);

  return (
    <>
      <header className="bg-slate-900 text-white border-b border-slate-800 shadow-lg no-print">
        {/* Top Branding Bar */}
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* App Title & Identity */}
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={onOpenLogoModal}
                className="group relative w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-md shadow-amber-500/20 flex items-center justify-center shrink-0 hover:scale-105 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                title="Klik untuk melihat atau mengganti logo aplikasi"
              >
                <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center overflow-hidden p-0.5">
                  {!logoFailed ? (
                    <img
                      src={logoUrl}
                      alt="Logo SUBAG TU PIM & PROTOKOL DITJENPAS"
                      referrerPolicy="no-referrer"
                      onError={() => setLogoFailed(true)}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="w-full h-full bg-slate-950 rounded-[12px] flex items-center justify-center text-amber-400">
                      <Shield className="w-6 h-6" />
                    </div>
                  )}
                </div>
              </button>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <h1 className="text-sm sm:text-lg lg:text-xl font-extrabold tracking-tight text-white truncate">
                    SUBAG TU PIM &amp; PROTOKOL DITJENPAS
                  </h1>
                  <span className="inline-flex items-center gap-1 text-[10px] sm:text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 shrink-0">
                    <Sparkles className="w-3 h-3" /> Protokol Eksekutif
                  </span>
                </div>
                <p className="text-[11px] sm:text-xs text-slate-400 truncate">
                  Sistem Penjadwalan Bulanan, Pengingat Otomatis &amp; Cloud Bersama HP &harr; PC
                </p>
              </div>
            </div>
          </div>

          {/* Top Right Actions — clean consistent toolbar across PC & HP */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
            {/* Google Account Cloud Sync Action */}
            {userEmail ? (
              <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <button
                  onClick={onOpenSyncModal}
                  className="text-emerald-200 hover:text-white font-medium truncate max-w-[125px] sm:max-w-[170px] transition"
                  title={`Database Cloud Bersama Aktif: ${userEmail}`}
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
                title="Masuk Google agar data otomatis sama di semua komputer dan HP"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{isAuthLoading ? 'Memproses...' : 'Masuk Google'}</span>
              </button>
            )}

            {/* Notification Permission Indicator / Button */}
            {notificationPermission === 'granted' ? (
              <button
                onClick={() => playExecutiveChime()}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-medium hover:bg-emerald-500/25 transition"
                title="Pengingat Browser Aktif. Klik untuk uji suara lonceng"
              >
                <BellRing className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden xl:inline">Pengingat Aktif</span>
                <Volume2 className="w-3 h-3 text-emerald-400/80" />
              </button>
            ) : (
              <button
                onClick={onRequestNotificationPermission}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/40 text-xs font-semibold hover:bg-amber-500/30 transition"
                title="Izinkan notifikasi desktop agar pengingat agenda berbunyi"
              >
                <Bell className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Pengingat</span>
              </button>
            )}

            {/* Manual Cloud Sync Button */}
            <button
              onClick={onManualSync}
              disabled={isSyncing}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 disabled:opacity-60 text-slate-200 border border-slate-700 text-xs font-medium transition"
              title="Sinkronkan ulang data cloud sekarang"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-teal-400 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Sinkron...' : 'Sinkronkan'}</span>
            </button>

            {/* HP <-> Komputer Sync & Transfer Modal Button */}
            <button
              onClick={onOpenSyncModal}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
              title="Pengaturan sinkronisasi cloud & cadangan HP dan Komputer"
            >
              <Smartphone className="w-3.5 h-3.5 text-amber-400" />
              <span>HP &harr; PC</span>
            </button>

            {/* Sync All Month's Agendas to Calendar (.ICS) */}
            <button
              onClick={onExportMonthIcs}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition"
              title={`Unduh seluruh agenda ${selectedMonthName} ${selectedYear} ke kalender`}
            >
              <Download className="w-3.5 h-3.5 text-blue-400" />
              <span>.ICS</span>
            </button>

            {/* Add Agenda Button */}
            <button
              onClick={onOpenNewModal}
              className="inline-flex items-center gap-1.5 px-3.5 sm:px-4 py-1.5 sm:py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs sm:text-sm font-semibold shadow-md shadow-blue-500/25 hover:shadow-lg transition transform active:scale-95 ml-auto sm:ml-0"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Agenda</span>
            </button>
          </div>
        </div>
      </header>

      {/* Navigation View Switcher Bar — stays cleanly pinned at top on both HP & Komputer */}
      <nav className="bg-slate-950/95 backdrop-blur-sm text-white border-b border-slate-800 sticky top-0 z-40 shadow-md no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between overflow-x-auto no-scrollbar py-2 gap-3">
          {/* View Tabs */}
          <div role="tablist" aria-label="Navigasi tampilan agenda" className="flex items-center gap-1 sm:gap-2">
            {(
              [
                {
                  id: 'calendar' as ViewMode,
                  label: 'Kalender Bulanan',
                  icon: CalendarIcon,
                  activeBg: 'bg-blue-600',
                  activeBadgeBg: 'bg-blue-800 text-blue-200',
                  count: undefined
                },
                {
                  id: 'list' as ViewMode,
                  label: 'Daftar Agenda',
                  icon: ListOrdered,
                  activeBg: 'bg-blue-600',
                  activeBadgeBg: 'bg-blue-800 text-blue-200',
                  count: totalAgendasThisMonth
                },
                {
                  id: 'journal' as ViewMode,
                  label: 'Jurnal Harian',
                  icon: BookOpen,
                  activeBg: 'bg-indigo-600',
                  activeBadgeBg: 'bg-indigo-800 text-indigo-200',
                  count: totalJournalsThisMonth
                },
                {
                  id: 'piket' as ViewMode,
                  label: 'Piket Hari Libur',
                  icon: ShieldCheck,
                  activeBg: 'bg-teal-600',
                  activeBadgeBg: 'bg-teal-800 text-teal-200',
                  count: totalDutiesThisMonth
                },
                {
                  id: 'dashboard' as ViewMode,
                  label: 'Dashboard',
                  icon: BarChart3,
                  activeBg: 'bg-blue-600',
                  activeBadgeBg: 'bg-blue-800 text-blue-200',
                  count: undefined
                },
                {
                  id: 'print' as ViewMode,
                  label: 'Cetak Resmi',
                  icon: Printer,
                  activeBg: 'bg-blue-600',
                  activeBadgeBg: 'bg-blue-800 text-blue-200',
                  count: undefined
                }
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => onViewChange(tab.id)}
                  className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                    isActive
                      ? 'text-white'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="activeViewTabIndicator"
                      aria-hidden="true"
                      transition={{ type: 'spring', stiffness: 520, damping: 38 }}
                      className={`absolute inset-0 rounded-xl shadow-sm ${tab.activeBg}`}
                    />
                  )}
                  <Icon className="relative z-10 w-4 h-4 shrink-0" />
                  <span className="relative z-10">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span
                      className={`relative z-10 px-1.5 py-0.2 rounded-full text-[10px] transition-colors ${
                        isActive ? tab.activeBadgeBg : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Current Periode Pill */}
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 pl-4 border-l border-slate-800">
            <span>Periode Aktif:</span>
            <span className="font-bold text-amber-300">{selectedMonthName} {selectedYear}</span>
          </div>
        </div>
      </nav>
    </>
  );
};
