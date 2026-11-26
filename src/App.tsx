import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { Cloud, LogIn } from 'lucide-react';
import {
  AgendaItem,
  ViewMode,
  FilterState,
  DocumentAttachment,
  AgendaCategory,
  LeaderRole,
  AgendaStatus,
  DailyJournalEntry,
  HolidayDutyEntry
} from './types/agenda';
import { INITIAL_AGENDAS } from './data/initialAgendas';
import { INITIAL_JOURNALS, INITIAL_HOLIDAY_DUTIES } from './data/initialJournalAndDuty';
import {
  getAllAgendasFromDB,
  saveAgendasToDB,
  saveSingleAgendaToDB,
  deleteAgendaFromDB,
  getAllJournalsFromDB,
  saveJournalsToDB,
  saveSingleJournalToDB,
  deleteJournalFromDB,
  getAllHolidayDutiesFromDB,
  saveHolidayDutiesToDB,
  saveSingleHolidayDutyToDB,
  deleteHolidayDutyFromDB,
  getCachedAttachmentDataUrl
} from './utils/indexedDb';
import { auth, signInWithGoogle, signOutUser } from './firebase';
import {
  ensureUserProfile,
  subscribeUserCollections,
  fetchAllUserCollectionsOnce,
  saveAgendaToFirestore,
  updateAgendaStatusInFirestore,
  updateAgendaReminderInFirestore,
  deleteAgendaFromFirestore,
  saveJournalToFirestore,
  deleteJournalFromFirestore,
  saveHolidayDutyToFirestore,
  batchAddHolidayDutiesToFirestore,
  deleteHolidayDutyFromFirestore,
  uploadDatasetToFirestore,
  fetchAttachmentDataUrl
} from './utils/firestoreSync';
import {
  getNotificationPermission,
  requestNotificationPermission,
  sendDesktopNotification,
  checkAgendaAlert,
  ActiveAlert
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
import { SyncDeviceModal } from './components/SyncDeviceModal';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [agendas, setAgendas] = useState<AgendaItem[]>([]);
  const [journals, setJournals] = useState<DailyJournalEntry[]>([]);
  const [holidayDuties, setHolidayDuties] = useState<HolidayDutyEntry[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Selected date navigation
  const today = useMemo(() => new Date(), []);
  const [selectedMonth, setSelectedMonth] = useState<number>(today.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(today.getFullYear());

  // Views & Modals
  const [viewMode, setViewMode] = useState<ViewMode>('calendar');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [agendaToEdit, setAgendaToEdit] = useState<AgendaItem | null>(null);
  const [targetDateForNew, setTargetDateForNew] = useState<string>('');

  // Document Viewer (with lazy cloud chunk loading)
  const [previewingDoc, setPreviewingDoc] = useState<DocumentAttachment | null>(null);
  const [isLoadingDoc, setIsLoadingDoc] = useState(false);

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

  const triggeredReminderIdsRef = useRef<Set<string>>(new Set());

  // Propagate fatal Firestore errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // Listen to Firebase Authentication state
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
    });
    return () => unsubAuth();
  }, []);

  // Load local cache when signed out OR attach real-time Firestore sync when signed in
  useEffect(() => {
    if (!authReady) return;

    let active = true;
    let unsubscribeFirestore: (() => void) | null = null;

    async function loadLocalFallback() {
      let localAgendas: AgendaItem[] = [];
      let localJournals: DailyJournalEntry[] = [];
      let localDuties: HolidayDutyEntry[] = [];
      try {
        [localAgendas, localJournals, localDuties] = await Promise.all([
          getAllAgendasFromDB(),
          getAllJournalsFromDB(),
          getAllHolidayDutiesFromDB()
        ]);
      } catch {
        // ignore IndexedDB errors
      }
      if (!active) return;

      const hasLocalData =
        localAgendas.length > 0 || localJournals.length > 0 || localDuties.length > 0;
      const hasSyncedBefore = (() => {
        try {
          return localStorage.getItem('subag_tu_pim_cloud_synced') === '1';
        } catch {
          return false;
        }
      })();

      if (hasLocalData || hasSyncedBefore) {
        setAgendas(localAgendas);
        setJournals(localJournals);
        setHolidayDuties(localDuties);
      } else {
        setAgendas(INITIAL_AGENDAS);
        setJournals(INITIAL_JOURNALS);
        setHolidayDuties(INITIAL_HOLIDAY_DUTIES);
      }
      setIsLoaded(true);
    }

    async function initCloudSync(signedInUser: User) {
      setIsSyncing(true);
      try {
        const { isNewProfile } = await ensureUserProfile(signedInUser);
        if (!active) return;

        // First-time cloud setup: preserve existing local IndexedDB records (or seed starter data once)
        if (isNewProfile) {
          let localAgendas: AgendaItem[] = [];
          let localJournals: DailyJournalEntry[] = [];
          let localDuties: HolidayDutyEntry[] = [];
          try {
            [localAgendas, localJournals, localDuties] = await Promise.all([
              getAllAgendasFromDB(),
              getAllJournalsFromDB(),
              getAllHolidayDutiesFromDB()
            ]);
          } catch {
            // ignore IndexedDB errors
          }

          if (localAgendas.length > 0 || localJournals.length > 0 || localDuties.length > 0) {
            await uploadDatasetToFirestore(signedInUser.uid, {
              agendas: localAgendas,
              journals: localJournals,
              holidayDuties: localDuties
            });
          } else {
            await uploadDatasetToFirestore(signedInUser.uid, {
              agendas: INITIAL_AGENDAS,
              journals: INITIAL_JOURNALS,
              holidayDuties: INITIAL_HOLIDAY_DUTIES
            });
          }
        }

        if (!active) return;

        try {
          localStorage.setItem('subag_tu_pim_cloud_synced', '1');
        } catch {
          // ignore storage quota
        }

        unsubscribeFirestore = subscribeUserCollections(signedInUser.uid, {
          onAgendas: (cloudAgendas) => {
            if (!active) return;
            setAgendas(cloudAgendas);
            setIsLoaded(true);
            void saveAgendasToDB(cloudAgendas);
          },
          onJournals: (cloudJournals) => {
            if (!active) return;
            setJournals(cloudJournals);
            void saveJournalsToDB(cloudJournals);
          },
          onHolidayDuties: (cloudDuties) => {
            if (!active) return;
            setHolidayDuties(cloudDuties);
            void saveHolidayDutiesToDB(cloudDuties);
          },
          onError: (err) => {
            if (!active) return;
            setFatalError(err);
          }
        });
      } catch (err) {
        if (!active) return;
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (active) {
          setIsSyncing(false);
        }
      }
    }

    if (user && user.emailVerified) {
      void initCloudSync(user);
    } else {
      void loadLocalFallback();
    }

    return () => {
      active = false;
      if (unsubscribeFirestore) {
        unsubscribeFirestore();
      }
    };
  }, [authReady, user]);

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

          const triggerKey = `${agenda.id}:${agenda.date}:${agenda.startTime}`;
          if (
            agenda.reminder.soundEnabled &&
            !agenda.reminder.triggered &&
            !triggeredReminderIdsRef.current.has(triggerKey)
          ) {
            triggeredReminderIdsRef.current.add(triggerKey);
            playExecutiveChime();
            sendDesktopNotification(agenda);

            const updatedReminder = {
              ...agenda.reminder,
              triggered: true,
              lastNotified: now.toISOString()
            };
            const updatedAgenda = { ...agenda, reminder: updatedReminder };
            void saveSingleAgendaToDB(updatedAgenda);
            if (user && user.emailVerified) {
              updateAgendaReminderInFirestore(user.uid, agenda.id, updatedReminder).catch((err) => {
                console.warn('Gagal memperbarui status pengingat di cloud:', err);
              });
            }
          }
        }
      }

      setActiveAlerts(currentActive);
    };

    checkReminders();
    const interval = setInterval(checkReminders, 10000);
    return () => clearInterval(interval);
  }, [agendas, isLoaded, dismissedAlertIds, user]);

  const handleSignInGoogle = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthNotice(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string })?.code || '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') {
        setAuthNotice('Gagal masuk dengan Google. Pastikan pop-up diizinkan lalu coba kembali.');
      }
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOutUser();
  }, []);

  const handleRequestPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotificationPermission(perm);
    if (perm === 'granted') {
      playExecutiveChime();
    }
  };

  // Lazy-load PDF / Image attachment chunks from Firestore when previewing on another device
  const handlePreviewDocument = useCallback(
    async (docItem: DocumentAttachment) => {
      if (docItem.dataUrl && docItem.dataUrl.length > 0) {
        setPreviewingDoc(docItem);
        setIsLoadingDoc(false);
        return;
      }

      setPreviewingDoc(docItem);
      setIsLoadingDoc(true);
      try {
        let resolvedUrl = '';
        if (user && user.emailVerified) {
          resolvedUrl = await fetchAttachmentDataUrl(user.uid, docItem);
        } else {
          resolvedUrl = (await getCachedAttachmentDataUrl(docItem.id)) || '';
        }
        setPreviewingDoc((current) =>
          current && current.id === docItem.id
            ? { ...current, dataUrl: resolvedUrl }
            : current
        );
      } catch (err) {
        console.error('Gagal memuat lampiran dari cloud:', err);
      } finally {
        setIsLoadingDoc(false);
      }
    },
    [user]
  );

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

  // Manual Cloud Sync refresh
  const handleManualSync = async (): Promise<{ ok: boolean; message: string }> => {
    if (!user || !user.emailVerified) {
      setIsSyncModalOpen(true);
      return {
        ok: false,
        message: 'Silakan masuk dengan akun Google terlebih dahulu agar data tersinkronisasi antara HP dan Komputer.'
      };
    }

    setIsSyncing(true);
    try {
      const snapshot = await fetchAllUserCollectionsOnce(user.uid);
      setAgendas(snapshot.agendas);
      setJournals(snapshot.journals);
      setHolidayDuties(snapshot.holidayDuties);
      await Promise.all([
        saveAgendasToDB(snapshot.agendas),
        saveJournalsToDB(snapshot.journals),
        saveHolidayDutiesToDB(snapshot.holidayDuties)
      ]);
      return {
        ok: true,
        message: `Data cloud terbaru berhasil dimuat (${snapshot.agendas.length} agenda, ${snapshot.journals.length} jurnal, ${snapshot.holidayDuties.length} piket).`
      };
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return {
        ok: false,
        message: 'Gagal menarik data dari cloud. Periksa koneksi internet Anda.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // Explicit push of current device dataset into cloud
  const handleUploadLocalToCloud = async (): Promise<{ ok: boolean; message: string }> => {
    if (!user || !user.emailVerified) {
      return {
        ok: false,
        message: 'Silakan masuk dengan akun Google terlebih dahulu.'
      };
    }
    setIsSyncing(true);
    try {
      await uploadDatasetToFirestore(user.uid, {
        agendas,
        journals,
        holidayDuties
      });
      return {
        ok: true,
        message: `Seluruh data perangkat ini (${agendas.length} agenda, ${journals.length} jurnal, ${holidayDuties.length} piket) berhasil diunggah ke cloud.`
      };
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return {
        ok: false,
        message: 'Gagal mengunggah data lokal ke cloud.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // Explicit JSON backup import (writes to Firestore if signed in, otherwise local IndexedDB)
  const handleImportBackup = async (data: {
    agendas: AgendaItem[];
    journals: DailyJournalEntry[];
    holidayDuties: HolidayDutyEntry[];
  }): Promise<{ ok: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      if (user && user.emailVerified) {
        await uploadDatasetToFirestore(user.uid, data);
        return {
          ok: true,
          message: `Data berhasil diimpor ke database cloud (${data.agendas.length} agenda, ${data.journals.length} jurnal, ${data.holidayDuties.length} piket) dan otomatis tersinkron ke semua perangkat.`
        };
      }

      setAgendas(data.agendas);
      setJournals(data.journals);
      setHolidayDuties(data.holidayDuties);
      await Promise.all([
        saveAgendasToDB(data.agendas),
        saveJournalsToDB(data.journals),
        saveHolidayDutiesToDB(data.holidayDuties)
      ]);
      return {
        ok: true,
        message: 'Data berhasil diimpor secara lokal. Masuk dengan akun Google agar data otomatis tersinkron ke HP dan Komputer.'
      };
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return {
        ok: false,
        message: 'Terjadi kendala saat mengimpor data.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // CRUD Handlers — write directly to Firestore when signed in (with optimistic UI + IndexedDB cache)
  const handleSaveAgenda = async (savedItem: AgendaItem) => {
    setAgendas((prev) => {
      const exists = prev.some((a) => a.id === savedItem.id);
      return exists ? prev.map((a) => (a.id === savedItem.id ? savedItem : a)) : [savedItem, ...prev];
    });
    await saveSingleAgendaToDB(savedItem);
    setIsModalOpen(false);
    setAgendaToEdit(null);

    if (user && user.emailVerified) {
      try {
        await saveAgendaToFirestore(user.uid, savedItem);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    const target = agendas.find((a) => a.id === id);
    setAgendas((prev) => prev.filter((a) => a.id !== id));
    await deleteAgendaFromDB(id);
    if (user && user.emailVerified) {
      try {
        await deleteAgendaFromFirestore(user.uid, id, target?.documents);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleStatusChange = async (id: string, newStatus: AgendaStatus) => {
    const target = agendas.find((a) => a.id === id);
    if (!target) return;
    const updatedItem: AgendaItem = {
      ...target,
      status: newStatus,
      updatedAt: new Date().toISOString()
    };
    setAgendas((prev) => prev.map((a) => (a.id === id ? updatedItem : a)));
    await saveSingleAgendaToDB(updatedItem);

    if (user && user.emailVerified) {
      try {
        await updateAgendaStatusInFirestore(user.uid, id, newStatus);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleSnooze = (agendaId: string, minutes: number) => {
    const snoozeUntil = Date.now() + minutes * 60 * 1000;
    const target = agendas.find((a) => a.id === agendaId);
    if (!target) return;

    const updatedReminder = { ...target.reminder, snoozedUntil: snoozeUntil };
    const updatedItem = { ...target, reminder: updatedReminder };

    setAgendas((prev) => prev.map((a) => (a.id === agendaId ? updatedItem : a)));
    void saveSingleAgendaToDB(updatedItem);
    setActiveAlerts((prev) => prev.filter((item) => item.agenda.id !== agendaId));

    if (user && user.emailVerified) {
      updateAgendaReminderInFirestore(user.uid, agendaId, updatedReminder).catch((err) => {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      });
    }
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
    setJournals((prev) => {
      const exists = prev.some((j) => j.id === entry.id);
      return exists ? prev.map((j) => (j.id === entry.id ? entry : j)) : [entry, ...prev];
    });
    await saveSingleJournalToDB(entry);

    if (user && user.emailVerified) {
      try {
        await saveJournalToFirestore(user.uid, entry);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const target = journals.find((j) => j.id === id);
    setJournals((prev) => prev.filter((j) => j.id !== id));
    await deleteJournalFromDB(id);
    if (user && user.emailVerified) {
      try {
        await deleteJournalFromFirestore(user.uid, id, target?.documents);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  // Holiday Duty handlers
  const handleSaveHolidayDuty = async (duty: HolidayDutyEntry) => {
    setHolidayDuties((prev) => {
      const exists = prev.some((d) => d.id === duty.id);
      return exists ? prev.map((d) => (d.id === duty.id ? duty : d)) : [...prev, duty];
    });
    await saveSingleHolidayDutyToDB(duty);

    if (user && user.emailVerified) {
      try {
        await saveHolidayDutyToFirestore(user.uid, duty);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleBatchAddHolidayDuties = async (newDuties: HolidayDutyEntry[]) => {
    const updated = [...holidayDuties, ...newDuties];
    setHolidayDuties(updated);
    await saveHolidayDutiesToDB(updated);

    if (user && user.emailVerified) {
      try {
        await batchAddHolidayDutiesToFirestore(user.uid, newDuties);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteHolidayDuty = async (id: string) => {
    setHolidayDuties((prev) => prev.filter((d) => d.id !== id));
    await deleteHolidayDutyFromDB(id);

    if (user && user.emailVerified) {
      try {
        await deleteHolidayDutyFromFirestore(user.uid, id);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
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
        onManualSync={() => {
          void handleManualSync();
        }}
        onOpenSyncModal={() => setIsSyncModalOpen(true)}
        isSyncing={isSyncing}
        userEmail={user?.email || null}
        userDisplayName={user?.displayName || null}
        onSignInGoogle={() => {
          void handleSignInGoogle().catch(() => {});
        }}
        onSignOut={() => {
          void handleSignOut();
        }}
        isAuthLoading={isAuthLoading}
      />

      {/* Main App Content Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Cloud Sync Prompt Banner when user is not yet signed in */}
        {authReady && !user && viewMode !== 'print' && (
          <div className="mb-5 p-4 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-800 text-white border border-slate-700 shadow-md flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 no-print">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-400/30 shrink-0">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-white">
                  Aktifkan Sinkronisasi Real-Time HP &amp; Komputer
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Masuk menggunakan <strong>akun Google yang sama</strong> di HP dan Komputer agar seluruh agenda, jurnal harian, piket, dan lampiran otomatis sama setiap saat.
                </p>
                {authNotice && (
                  <p className="text-xs text-amber-300 mt-1 font-medium">{authNotice}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void handleSignInGoogle().catch(() => {});
              }}
              disabled={isAuthLoading}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-slate-950 text-xs sm:text-sm font-bold shadow-sm transition shrink-0"
            >
              <LogIn className="w-4 h-4" />
              <span>{isAuthLoading ? 'Membuka Google...' : 'Masuk dengan Google'}</span>
            </button>
          </div>
        )}

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
            onPreviewDocument={(doc) => {
              void handlePreviewDocument(doc);
            }}
            onOpenHolidayDutyTab={() => setViewMode('piket')}
          />
        )}

        {viewMode === 'list' && (
          <AgendaListView
            agendas={filteredMonthAgendas}
            onEditAgenda={handleOpenEditModal}
            onDeleteAgenda={handleDeleteAgenda}
            onStatusChange={handleStatusChange}
            onPreviewDocument={(doc) => {
              void handlePreviewDocument(doc);
            }}
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
            onPreviewDocument={(doc) => {
              void handlePreviewDocument(doc);
            }}
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
            onPreviewDocument={(doc) => {
              void handlePreviewDocument(doc);
            }}
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
          onDelete={(id) => {
            void handleDeleteAgenda(id);
            setIsModalOpen(false);
            setAgendaToEdit(null);
          }}
          agendaToEdit={agendaToEdit}
          initialDate={targetDateForNew}
        />
      )}

      {/* Document Viewer Modal (PDF & Images) */}
      <DocumentViewerModal
        document={previewingDoc}
        isLoading={isLoadingDoc}
        onClose={() => {
          setPreviewingDoc(null);
          setIsLoadingDoc(false);
        }}
      />

      {/* HP <-> Komputer Cloud Sync & Backup Transfer Modal */}
      <SyncDeviceModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        agendas={agendas}
        journals={journals}
        holidayDuties={holidayDuties}
        isSyncing={isSyncing}
        userEmail={user?.email || null}
        userDisplayName={user?.displayName || null}
        isAuthLoading={isAuthLoading}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
        onManualSync={handleManualSync}
        onUploadLocalToCloud={handleUploadLocalToCloud}
        onImportBackup={handleImportBackup}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="font-medium text-slate-700">
            SUBAG TU PIM &amp; PROTOKOL DITJENPAS • Manajemen Agenda, Jurnal Harian &amp; Piket Protokol
          </p>
          <p className="text-slate-400">
            Sinkronisasi Cloud Real-Time HP &amp; Komputer • Pengingat Otomatis • Unggah Berkas PDF &amp; Gambar
          </p>
        </div>
      </footer>
    </div>
  );
}
