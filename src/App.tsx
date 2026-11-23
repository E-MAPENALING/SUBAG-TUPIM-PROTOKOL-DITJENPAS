import React, { useState, useEffect, useMemo } from 'react';
import { 
  AgendaItem, ViewMode, FilterState, DocumentAttachment, 
  AgendaCategory, LeaderRole, AgendaStatus, DailyJournalEntry, HolidayDutyEntry 
} from './types/agenda';
import { INITIAL_AGENDAS } from './data/initialAgendas';
import { INITIAL_JOURNALS, INITIAL_HOLIDAY_DUTIES } from './data/initialJournalAndDuty';
import { 
  getAllAgendasFromDB, saveAgendasToDB, saveSingleAgendaToDB, deleteAgendaFromDB,
  getAllJournalsFromDB, saveJournalsToDB, deleteJournalFromDB,
  getAllHolidayDutiesFromDB, saveHolidayDutiesToDB, deleteHolidayDutyFromDB
} from './utils/indexedDb';
import { 
  getNotificationPermission, requestNotificationPermission, 
  sendDesktopNotification, checkAgendaAlert, ActiveAlert 
} from './utils/notifications';
import { playExecutiveChime } from './utils/audioAlarm';
import { downloadMonthlyIcsFile } from './utils/calendarSync';

import { Header } from './components/Header';
import { MonthSelector } from './components/MonthSelector';
import { FilterBar } from './components/FilterBar';
import { CalendarMonthView } from './components/CalendarMonthView';
import { AgendaListView } from './components/AgendaListView';
import { DailyJournalView } from './components/DailyJournalView';
import { HolidayDutyView } from './components/HolidayDutyView';
import { ExecutiveDashboardView } from './components/ExecutiveDashboardView';
import { OfficialPrintView } from './components/OfficialPrintView';
import { AgendaModal } from './components/AgendaModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { ActiveReminderBanner } from './components/ActiveReminderBanner';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function App() {
  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [journals, setJournals] = useState<DailyJournalEntry[]>([]);
  const [holidayDuties, setHolidayDuties] = useState<HolidayDutyEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Selected date navigation (Defaults to current date: Nov 2026)
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Views & Modals
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [agendaToEdit, setAgendaToEdit] = useState<AgendaItem | null>(null);
  const [targetDateForNew, setTargetDateForNew] = useState<string>('');
  
  // Document Viewer
  const [previewingDoc, setPreviewingDoc] = useState<DocumentAttachment | null>(null);

  // Notification & Alerts
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default');
  const [activeAlerts, setActiveAlerts] = useState<ActiveAlert[]>([]);
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(new Set());

  // Filter State
  const [filter, setFilter] = useState<FilterState>({
    searchQuery: '',
    category: '',
    priority: '',
    status: '',
    leader: ''
  });

  // Load Agendas, Journals, and Holiday Duties from IndexedDB on initial mount
  useEffect(() => {
    async function initData() {
      try {
        const [storedAgendas, storedJournals, storedDuties] = await Promise.all([
          getAllAgendasFromDB(),
          getAllJournalsFromDB(),
          getAllHolidayDutiesFromDB()
        ]);

        if (storedAgendas && storedAgendas.length > 0) {
          setAgendas(storedAgendas);
        } else {
          setAgendas(INITIAL_AGENDAS);
          await saveAgendasToDB(INITIAL_AGENDAS);
        }

        if (storedJournals && storedJournals.length > 0) {
          setJournals(storedJournals);
        } else {
          setJournals(INITIAL_JOURNALS);
          await saveJournalsToDB(INITIAL_JOURNALS);
        }

        if (storedDuties && storedDuties.length > 0) {
          setHolidayDuties(storedDuties);
        } else {
          setHolidayDuties(INITIAL_HOLIDAY_DUTIES);
          await saveHolidayDutiesToDB(INITIAL_HOLIDAY_DUTIES);
        }
      } catch (err) {
        console.error('Database load error:', err);
        setAgendas(INITIAL_AGENDAS);
        setJournals(INITIAL_JOURNALS);
        setHolidayDuties(INITIAL_HOLIDAY_DUTIES);
      } finally {
        setIsLoaded(true);
      }
    }

    initData();
    setNotificationPermission(getNotificationPermission());
  }, []);

  // Background reminder periodic checker (Runs every 10 seconds)
  useEffect(() => {
    if (!isLoaded || agendas.length === 0) return;

    const checkReminders = () => {
      const now = new Date();
      const currentActive: ActiveAlert[] = [];

      for (const agenda of agendas) {
        if (dismissedAlertIds.has(agenda.id)) continue;

        const alert = checkAgendaAlert(agenda, now);
        if (alert) {
          currentActive.push(alert);

          // If sound is enabled and not already notified this minute
          if (agenda.reminder.soundEnabled && !agenda.reminder.triggered) {
            playExecutiveChime();
            sendDesktopNotification(agenda);

            // Mark as triggered so it doesn't repeatedly ring every 10s
            const updatedAgenda = {
              ...agenda,
              reminder: { ...agenda.reminder, triggered: true, lastNotified: now.toISOString() }
            };
            saveSingleAgendaToDB(updatedAgenda);
          }
        }
      }

      setActiveAlerts(currentActive);
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [agendas, isLoaded, dismissedAlertIds]);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      playExecutiveChime();
    }
  };

  // Extract all categories and leaders for filters
  const categories = useMemo(() => {
    const set = new Set<AgendaCategory>();
    agendas.forEach((a) => set.add(a.category));
    return Array.from(set);
  }, [agendas]);

  const leaders = useMemo(() => {
    const set = new Set<LeaderRole>();
    agendas.forEach((a) => set.add(a.leader));
    return Array.from(set);
  }, [agendas]);

  // Agendas in Selected Month
  const monthPrefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

  const monthAgendas = useMemo(() => {
    return agendas.filter((a) => a.date.startsWith(monthPrefix));
  }, [agendas, monthPrefix]);

  const monthJournals = useMemo(() => {
    return journals.filter((j) => j.date.startsWith(monthPrefix));
  }, [journals, monthPrefix]);

  const monthHolidayDuties = useMemo(() => {
    return holidayDuties.filter((d) => d.date.startsWith(monthPrefix));
  }, [holidayDuties, monthPrefix]);

  // Filtered Agendas
  const filteredMonthAgendas = useMemo(() => {
    return monthAgendas.filter((item) => {
      if (filter.searchQuery) {
        const query = filter.searchQuery.toLowerCase();
        const inTitle = item.title.toLowerCase().includes(query);
        const inLeader = item.leaderName.toLowerCase().includes(query);
        const inLocation = item.location.toLowerCase().includes(query);
        const inNotes = item.notes?.toLowerCase().includes(query) || false;
        const inDocs = item.documents?.some((d) => d.name.toLowerCase().includes(query)) || false;
        if (!inTitle && !inLeader && !inLocation && !inNotes && !inDocs) return false;
      }
      if (filter.category && item.category !== filter.category) return false;
      if (filter.priority && item.priority !== filter.priority) return false;
      if (filter.status && item.status !== filter.status) return false;
      if (filter.leader && item.leader !== filter.leader) return false;

      return true;
    });
  }, [monthAgendas, filter]);

  // Stats for the month
  const stats = useMemo(() => {
    const total = monthAgendas.length;
    const vip = monthAgendas.filter((a) => a.priority === 'VIP').length;
    const completed = monthAgendas.filter((a) => a.status === 'Selesai').length;
    const upcoming = monthAgendas.filter((a) => a.status === 'Terjadwal' || a.status === 'Berlangsung').length;
    return { total, vip, completed, upcoming };
  }, [monthAgendas]);

  // Handlers
  const handleSaveAgenda = async (savedItem: AgendaItem) => {
    const index = agendas.findIndex((a) => a.id === savedItem.id);
    let updated: AgendaItem[];
    if (index >= 0) {
      updated = [...agendas];
      updated[index] = savedItem;
    } else {
      updated = [savedItem, ...agendas];
    }
    setAgendas(updated);
    await saveAgendasToDB(updated);
    setIsModalOpen(false);
    setAgendaToEdit(null);
  };

  const handleDeleteAgenda = async (id: string) => {
    const updated = agendas.filter((a) => a.id !== id);
    setAgendas(updated);
    await deleteAgendaFromDB(id);
  };

  const handleStatusChange = async (id: string, newStatus: AgendaStatus) => {
    const updated = agendas.map((a) => (a.id === id ? { ...a, status: newStatus } : a));
    setAgendas(updated);
    const target = updated.find((a) => a.id === id);
    if (target) await saveSingleAgendaToDB(target);
  };

  const handleSnooze = (agendaId: string, minutes: number) => {
    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    const updated = agendas.map((a) =>
      a.id === agendaId ? { ...a, reminder: { ...a.reminder, snoozedUntil: snoozeUntil } } : a
    );
    setAgendas(updated);
    const target = updated.find((a) => a.id === agendaId);
    if (target) saveSingleAgendaToDB(target);
    setActiveAlerts((prev) => prev.filter((item) => item.agenda.id !== agendaId));
  };

  const handleDismissAlert = (agendaId: string) => {
    setDismissedAlertIds((prev) => new Set([...prev, agendaId]));
    setActiveAlerts((prev) => prev.filter((item) => item.agenda.id !== agendaId));
  };

  const handleExportMonthIcs = () => {
    downloadMonthlyIcsFile(filteredMonthAgendas, MONTH_NAMES[selectedMonth], selectedYear);
  };

  const handleJumpToToday = () => {
    setSelectedMonth(today.getMonth());
    setSelectedYear(today.getFullYear());
  };

  const handleOpenNewModal = (dateStr?: string) => {
    setAgendaToEdit(null);
    setTargetDateForNew(dateStr || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (agenda: AgendaItem) => {
    setAgendaToEdit(agenda);
    setIsModalOpen(true);
  };

  // Daily Journal handlers
  const handleSaveJournal = async (entry: DailyJournalEntry) => {
    const idx = journals.findIndex((j) => j.id === entry.id);
    const updated =
      idx >= 0
        ? journals.map((j) => (j.id === entry.id ? entry : j))
        : [entry, ...journals];
    setJournals(updated);
    await saveJournalsToDB(updated);
  };

  const handleDeleteJournal = async (id: string) => {
    const updated = journals.filter((j) => j.id !== id);
    setJournals(updated);
    await deleteJournalFromDB(id);
  };

  // Holiday Duty handlers
  const handleSaveHolidayDuty = async (duty: HolidayDutyEntry) => {
    const idx = holidayDuties.findIndex((d) => d.id === duty.id);
    const updated =
      idx >= 0
        ? holidayDuties.map((d) => (d.id === duty.id ? duty : d))
        : [...holidayDuties, duty];
    setHolidayDuties(updated);
    await saveHolidayDutiesToDB(updated);
  };

  const handleBatchAddHolidayDuties = async (newDuties: HolidayDutyEntry[]) => {
    const updated = [...holidayDuties, ...newDuties];
    setHolidayDuties(updated);
    await saveHolidayDutiesToDB(updated);
  };

  const handleDeleteHolidayDuty = async (id: string) => {
    const updated = holidayDuties.filter((d) => d.id !== id);
    setHolidayDuties(updated);
    await deleteHolidayDutyFromDB(id);
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col font-sans">
      {/* Active Floating Reminder Alerts */}
      <ActiveReminderBanner
        alerts={activeAlerts}
        onDismiss={handleDismissAlert}
        onSnooze={handleSnooze}
        onOpenAgenda={(id) => {
          const item = agendas.find((a) => a.id === id);
          if (item) handleOpenEditModal(item);
        }}
      />

      {/* Main Header */}
      <Header
        activeView={viewMode}
        onViewChange={setViewMode}
        onOpenNewModal={() => handleOpenNewModal()}
        onExportMonthIcs={handleExportMonthIcs}
        notificationPermission={notificationPermission}
        onRequestNotificationPermission={handleRequestPermission}
        selectedMonthName={MONTH_NAMES[selectedMonth]}
        selectedYear={selectedYear}
        totalAgendasThisMonth={stats.total}
        totalJournalsThisMonth={monthJournals.length}
        totalDutiesThisMonth={monthHolidayDuties.length}
      />

      {/* Main App Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {viewMode !== 'print' && (
          <>
            {/* Month & Year Navigation + Stats */}
            <MonthSelector
              currentDate={today}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
              onJumpToToday={handleJumpToToday}
              stats={stats}
            />

            {/* Filter and Search Bar */}
            {(viewMode === 'calendar' || viewMode === 'list') && (
              <FilterBar
                filter={filter}
                onFilterChange={setFilter}
                onReset={() =>
                  setFilter({
                    searchQuery: '',
                    category: '',
                    priority: '',
                    status: '',
                    leader: ''
                  })
                }
                categories={categories}
                leaders={leaders}
              />
            )}
          </>
        )}

        {/* View Switcher Output */}
        {viewMode === 'calendar' && (
          <CalendarMonthView
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            agendas={filteredMonthAgendas}
            holidayDuties={monthHolidayDuties}
            onSelectAgenda={handleOpenEditModal}
            onAddAgendaForDate={(dateStr) => handleOpenNewModal(dateStr)}
            onPreviewDocument={(doc) => setPreviewingDoc(doc)}
            onOpenHolidayDutyTab={() => setViewMode('piket')}
          />
        )}

        {viewMode === 'list' && (
          <AgendaListView
            agendas={filteredMonthAgendas}
            onEditAgenda={handleOpenEditModal}
            onDeleteAgenda={handleDeleteAgenda}
            onStatusChange={handleStatusChange}
            onPreviewDocument={(doc) => setPreviewingDoc(doc)}
            onAddNew={() => handleOpenNewModal()}
          />
        )}

        {viewMode === 'journal' && (
          <DailyJournalView
            journals={monthJournals}
            monthAgendas={monthAgendas}
            selectedMonthName={MONTH_NAMES[selectedMonth]}
            selectedYear={selectedYear}
            selectedMonth={selectedMonth}
            onSaveJournal={handleSaveJournal}
            onDeleteJournal={handleDeleteJournal}
            onPreviewDocument={(doc) => setPreviewingDoc(doc)}
          />
        )}

        {viewMode === 'piket' && (
          <HolidayDutyView
            duties={monthHolidayDuties}
            selectedMonth={selectedMonth}
            selectedYear={selectedYear}
            selectedMonthName={MONTH_NAMES[selectedMonth]}
            onSaveDuty={handleSaveHolidayDuty}
            onDeleteDuty={handleDeleteHolidayDuty}
            onBatchAddDuties={handleBatchAddHolidayDuties}
          />
        )}

        {viewMode === 'dashboard' && (
          <ExecutiveDashboardView
            agendas={monthAgendas}
            selectedMonthName={MONTH_NAMES[selectedMonth]}
            selectedYear={selectedYear}
            onSelectAgenda={handleOpenEditModal}
            onPreviewDocument={(doc) => setPreviewingDoc(doc)}
          />
        )}

        {viewMode === 'print' && (
          <OfficialPrintView
            agendas={filteredMonthAgendas}
            journals={monthJournals}
            holidayDuties={monthHolidayDuties}
            selectedMonthName={MONTH_NAMES[selectedMonth]}
            selectedYear={selectedYear}
            onBackToCalendar={() => setViewMode('calendar')}
          />
        )}
      </main>

      {/* Add / Edit Agenda Modal */}
      {isModalOpen && (
        <AgendaModal
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setAgendaToEdit(null);
          }}
          onSave={handleSaveAgenda}
          agendaToEdit={agendaToEdit}
          initialDate={targetDateForNew}
        />
      )}

      {/* Document Viewer Modal (PDF & Images) */}
      <DocumentViewerModal
        document={previewingDoc}
        onClose={() => setPreviewingDoc(null)}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-700">
            SUBAG TU PIM &amp; PROTOKOL DITJENPAS • Manajemen Agenda, Jurnal Harian &amp; Piket Protokol
          </p>
          <p className="text-slate-400">
            Dilengkapi Pengingat Otomatis • Sinkronisasi Google Calendar & .ICS • Unggah Berkas PDF & Gambar
          </p>
        </div>
      </footer>
    </div>
  );
}
