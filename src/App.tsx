import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { AnimatePresence, MotionConfig, motion, type Variants } from 'motion/react';
import {
  LogIn,
  Loader2,
  Smartphone,
  Laptop,
  ShieldCheck,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
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
import {
  auth,
  checkGoogleRedirectResult,
  signInWithGoogle,
  signInWithGoogleRedirect,
  signOutUser
} from './firebase';
import {
  WorkspaceTarget,
  ensureUserProfile,
  verifyWorkspaceAccess,
  subscribeWorkspaceProfile,
  subscribeUserCollections,
  fetchAllUserCollectionsFromServer,
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
  fetchAttachmentDataUrl,
  saveWorkspaceCustomLogo,
  updateWorkspaceSharedEmails
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
import { LogoSettingsModal } from './components/LogoSettingsModal';
import {
  DEFAULT_APP_LOGO,
  getActiveAppLogo,
  getStoredCustomLogo,
  saveCustomLogo,
  resetCustomLogo,
  updateDocumentFavicon
} from './utils/appLogo';

const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

const WORKSPACE_STORAGE_KEY = 'subag_tu_pim_linked_workspace_v1';

const VIEW_ORDER: ViewMode[] = ['calendar', 'list', 'journal', 'piket', 'dashboard', 'print'];

const viewTransitionVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction * 16,
    y: 4
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.19,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction * -16,
    y: -2,
    transition: {
      duration: 0.14,
      ease: [0.4, 0, 1, 1]
    }
  })
};

const INITIAL_AGENDA_IDS = new Set(INITIAL_AGENDAS.map((a) => a.id));
const INITIAL_JOURNAL_IDS = new Set(INITIAL_JOURNALS.map((j) => j.id));
const INITIAL_DUTY_IDS = new Set(INITIAL_HOLIDAY_DUTIES.map((d) => d.id));

function readRequestedWorkspaceId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromUrl = params.get('workspace')?.trim();
    if (fromUrl && /^[a-zA-Z0-9_-]{1,128}$/.test(fromUrl)) {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, fromUrl);
      return fromUrl;
    }
    const stored = localStorage.getItem(WORKSPACE_STORAGE_KEY)?.trim();
    return stored && /^[a-zA-Z0-9_-]{1,128}$/.test(stored) ? stored : null;
  } catch {
    return null;
  }
}

const GUEST_MODE_STORAGE_KEY = 'subag_tu_pim_guest_mode_v1';

function readInitialGuestMode(): boolean {
  try {
    return sessionStorage.getItem(GUEST_MODE_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [guestMode, setGuestMode] = useState<boolean>(() => readInitialGuestMode());
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [authErrorCode, setAuthErrorCode] = useState<string | null>(null);
  const [workspaceNotice, setWorkspaceNotice] = useState<string | null>(null);
  const [fatalError, setFatalError] = useState<Error | null>(null);

  // Active cloud workspace (defaults to signed-in user's own UID, or linked owner UID for multi-account HP/PC sync)
  const [linkedWorkspaceOwnerUid, setLinkedWorkspaceOwnerUid] = useState<string | null>(() =>
    readRequestedWorkspaceId()
  );
  const [activeWorkspaceOwnerEmail, setActiveWorkspaceOwnerEmail] = useState<string | null>(null);
  const [sharedEmails, setSharedEmails] = useState<string[]>([]);

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
  const [viewDirection, setViewDirection] = useState<1 | -1>(1);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleViewChange = useCallback(
    (nextView: ViewMode) => {
      if (nextView === viewMode) return;
      const nextIndex = VIEW_ORDER.indexOf(nextView);
      const currentIndex = VIEW_ORDER.indexOf(viewMode);
      setViewDirection(nextIndex >= currentIndex ? 1 : -1);
      setViewMode(nextView);
    },
    [viewMode]
  );
  const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);
  const [isLogoModalOpen, setIsLogoModalOpen] = useState(false);
  const [logoUrl, setLogoUrl] = useState<string>(() => getActiveAppLogo());
  const [isCustomLogo, setIsCustomLogo] = useState<boolean>(() => Boolean(getStoredCustomLogo()));
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
  const activeTargetRef = useRef<WorkspaceTarget | null>(null);

  const activeWorkspaceOwnerUid = useMemo(() => {
    if (!user) return null;
    return linkedWorkspaceOwnerUid || user.uid;
  }, [user, linkedWorkspaceOwnerUid]);

  const workspaceTarget = useMemo<WorkspaceTarget | null>(() => {
    if (!user || !user.emailVerified || !activeWorkspaceOwnerUid) return null;
    return {
      ownerUid: activeWorkspaceOwnerUid,
      viewerUid: user.uid,
      viewerEmail: (user.email || '').trim().toLowerCase(),
      sharedEmails
    };
  }, [user, activeWorkspaceOwnerUid, sharedEmails]);

  useEffect(() => {
    activeTargetRef.current = workspaceTarget;
  }, [workspaceTarget]);

  // Propagate fatal Firestore errors to ErrorBoundary
  if (fatalError) {
    throw fatalError;
  }

  // Keep browser favicon synchronized with active app logo
  useEffect(() => {
    updateDocumentFavicon(logoUrl);
  }, [logoUrl]);

  const handleUpdateLogo = useCallback(
    (newDataUrl: string) => {
      saveCustomLogo(newDataUrl);
      setLogoUrl(newDataUrl);
      setIsCustomLogo(true);
      if (user && user.emailVerified && activeWorkspaceOwnerUid === user.uid) {
        saveWorkspaceCustomLogo(user.uid, newDataUrl).catch((err) => {
          console.warn('Gagal menyinkronkan logo ke cloud:', err);
        });
      }
    },
    [user, activeWorkspaceOwnerUid]
  );

  const handleResetLogo = useCallback(() => {
    resetCustomLogo();
    setLogoUrl(DEFAULT_APP_LOGO);
    setIsCustomLogo(false);
    if (user && user.emailVerified && activeWorkspaceOwnerUid === user.uid) {
      saveWorkspaceCustomLogo(user.uid, '').catch((err) => {
        console.warn('Gagal mereset logo di cloud:', err);
      });
    }
  }, [user, activeWorkspaceOwnerUid]);

  // Listen to Firebase Authentication state (with safety timeout so UI never hangs)
  useEffect(() => {
    setNotificationPermission(getNotificationPermission());
    let settled = false;

    void checkGoogleRedirectResult();

    const safetyTimer = window.setTimeout(() => {
      if (!settled) {
        setAuthReady(true);
      }
    }, 3500);

    const unsubAuth = onAuthStateChanged(auth, (nextUser) => {
      settled = true;
      window.clearTimeout(safetyTimer);
      setUser(nextUser);
      setAuthReady(true);
      if (nextUser) {
        setAuthNotice(null);
        setAuthErrorCode(null);
        setGuestMode(false);
        try {
          sessionStorage.removeItem(GUEST_MODE_STORAGE_KEY);
        } catch {
          // ignore
        }
      } else {
        setIsLoaded(false);
      }
    });
    return () => {
      window.clearTimeout(safetyTimer);
      unsubAuth();
    };
  }, []);

  // Load local IndexedDB data immediately when user enters in Local Mode (without Google sign-in)
  useEffect(() => {
    if (!authReady || user || !guestMode) return;

    let active = true;
    async function loadLocalWorkspace() {
      try {
        const [localAgendas, localJournals, localDuties] = await Promise.all([
          getAllAgendasFromDB(),
          getAllJournalsFromDB(),
          getAllHolidayDutiesFromDB()
        ]);
        if (!active) return;
        const resolvedAgendas = localAgendas.length > 0 ? localAgendas : INITIAL_AGENDAS;
        const resolvedJournals = localJournals.length > 0 ? localJournals : INITIAL_JOURNALS;
        const resolvedDuties = localDuties.length > 0 ? localDuties : INITIAL_HOLIDAY_DUTIES;
        setAgendas(resolvedAgendas);
        setJournals(resolvedJournals);
        setHolidayDuties(resolvedDuties);
        setIsLoaded(true);

        if (localAgendas.length === 0) void saveAgendasToDB(resolvedAgendas);
        if (localJournals.length === 0) void saveJournalsToDB(resolvedJournals);
        if (localDuties.length === 0) void saveHolidayDutiesToDB(resolvedDuties);
      } catch {
        if (!active) return;
        setAgendas(INITIAL_AGENDAS);
        setJournals(INITIAL_JOURNALS);
        setHolidayDuties(INITIAL_HOLIDAY_DUTIES);
        setIsLoaded(true);
      }
    }

    void loadLocalWorkspace();
    return () => {
      active = false;
    };
  }, [authReady, user, guestMode]);

  // Attach real-time Firestore sync for active workspace when signed in
  useEffect(() => {
    if (!authReady || !user) return;

    if (!user.emailVerified) {
      setWorkspaceNotice(
        'Email akun Google Anda belum terverifikasi. Data ditampilkan dari penyimpanan lokal perangkat ini.'
      );
      return;
    }

    let active = true;
    let unsubscribeCollections: (() => void) | null = null;
    let unsubscribeProfile: (() => void) | null = null;

    async function initCloudWorkspace(signedInUser: User) {
      setIsSyncing(true);
      setWorkspaceNotice(null);

      // Hydrate local IndexedDB immediately so user can use the app while cloud sync connects
      let localAgendas: AgendaItem[] = [];
      let localJournals: DailyJournalEntry[] = [];
      let localDuties: HolidayDutyEntry[] = [];
      try {
        [localAgendas, localJournals, localDuties] = await Promise.all([
          getAllAgendasFromDB(),
          getAllJournalsFromDB(),
          getAllHolidayDutiesFromDB()
        ]);
        if (active && (localAgendas.length > 0 || localJournals.length > 0 || localDuties.length > 0)) {
          setAgendas(localAgendas);
          setJournals(localJournals);
          setHolidayDuties(localDuties);
          setIsLoaded(true);
        }
      } catch {
        // ignore IndexedDB read errors
      }

      try {
        // Always ensure own user profile exists first
        const { isNewProfile, profile: ownProfile } = await ensureUserProfile(signedInUser);
        if (!active) return;

        let resolvedOwnerUid = signedInUser.uid;
        let resolvedSharedEmails = ownProfile.sharedEmails;
        let resolvedOwnerEmail = ownProfile.email;
        let resolvedCustomLogo = ownProfile.customLogo;

        // If device is linked to another owner's workspace (e.g., HP with different Gmail), verify access
        if (linkedWorkspaceOwnerUid && linkedWorkspaceOwnerUid !== signedInUser.uid) {
          const check = await verifyWorkspaceAccess(
            linkedWorkspaceOwnerUid,
            signedInUser.uid,
            signedInUser.email || ''
          );
          if (!active) return;
          if (check.ok && check.profile) {
            resolvedOwnerUid = check.profile.ownerId;
            resolvedSharedEmails = check.profile.sharedEmails;
            resolvedOwnerEmail = check.profile.email;
            resolvedCustomLogo = check.profile.customLogo;
          } else {
            setWorkspaceNotice(check.reason || 'Akses ruang kerja bersama ditolak.');
            try {
              localStorage.removeItem(WORKSPACE_STORAGE_KEY);
            } catch {
              // ignore
            }
            setLinkedWorkspaceOwnerUid(null);
          }
        }

        setActiveWorkspaceOwnerEmail(resolvedOwnerEmail);
        setSharedEmails(resolvedSharedEmails);

        // Apply cloud-synced logo if available
        if (resolvedCustomLogo && resolvedCustomLogo.startsWith('data:image/')) {
          saveCustomLogo(resolvedCustomLogo);
          setLogoUrl(resolvedCustomLogo);
          setIsCustomLogo(true);
        }

        const target: WorkspaceTarget = {
          ownerUid: resolvedOwnerUid,
          viewerUid: signedInUser.uid,
          viewerEmail: (signedInUser.email || '').trim().toLowerCase(),
          sharedEmails: resolvedSharedEmails
        };
        activeTargetRef.current = target;

        // Preserve unsynced local work on own workspace during first-ever cloud sign-in
        if (resolvedOwnerUid === signedInUser.uid) {
          const hasSyncedThisBrowser = (() => {
            try {
              return localStorage.getItem('subag_tu_pim_cloud_synced') === '1';
            } catch {
              return false;
            }
          })();

          if (isNewProfile || !hasSyncedThisBrowser) {
            if (isNewProfile) {
              if (localAgendas.length > 0 || localJournals.length > 0 || localDuties.length > 0) {
                await uploadDatasetToFirestore(
                  target,
                  {
                    agendas: localAgendas,
                    journals: localJournals,
                    holidayDuties: localDuties
                  },
                  { bestEffort: true }
                );
              } else {
                await uploadDatasetToFirestore(
                  target,
                  {
                    agendas: INITIAL_AGENDAS,
                    journals: INITIAL_JOURNALS,
                    holidayDuties: INITIAL_HOLIDAY_DUTIES
                  },
                  { bestEffort: true }
                );
              }
            } else {
              // Profile already exists from another device: safely upload ONLY custom local items not yet in cloud
              const customAgendas = localAgendas.filter((a) => !INITIAL_AGENDA_IDS.has(a.id));
              const customJournals = localJournals.filter((j) => !INITIAL_JOURNAL_IDS.has(j.id));
              const customDuties = localDuties.filter((d) => !INITIAL_DUTY_IDS.has(d.id));
              if (customAgendas.length > 0 || customJournals.length > 0 || customDuties.length > 0) {
                await uploadDatasetToFirestore(
                  target,
                  {
                    agendas: customAgendas,
                    journals: customJournals,
                    holidayDuties: customDuties
                  },
                  { skipExisting: true, bestEffort: true }
                );
              }
            }

            // If user had uploaded a custom logo locally before cloud sync, push it once
            const localCustomLogo = getStoredCustomLogo();
            if (localCustomLogo && !resolvedCustomLogo) {
              await saveWorkspaceCustomLogo(signedInUser.uid, localCustomLogo).catch(() => {});
            }
          }
        }

        if (!active) return;

        try {
          localStorage.setItem('subag_tu_pim_cloud_synced', '1');
        } catch {
          // ignore storage quota
        }

        // Subscribe to workspace profile changes (real-time customLogo + sharedEmails sync)
        unsubscribeProfile = subscribeWorkspaceProfile(
          resolvedOwnerUid,
          (updatedProfile) => {
            if (!active) return;
            setActiveWorkspaceOwnerEmail(updatedProfile.email);
            setSharedEmails(updatedProfile.sharedEmails);
            if (updatedProfile.customLogo && updatedProfile.customLogo.startsWith('data:image/')) {
              saveCustomLogo(updatedProfile.customLogo);
              setLogoUrl(updatedProfile.customLogo);
              setIsCustomLogo(true);
            } else if (updatedProfile.customLogo === '') {
              resetCustomLogo();
              setLogoUrl(DEFAULT_APP_LOGO);
              setIsCustomLogo(false);
            }
          },
          (err) => {
            if (!active) return;
            console.warn('Profile sync warning:', err);
          }
        );

        // Subscribe to real-time collections (agendas, journals, holidayDuties)
        unsubscribeCollections = subscribeUserCollections(target, {
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
            console.warn('Firestore live listener warning:', err);
            setWorkspaceNotice(
              'Sinkronisasi cloud real-time sedang terganggu. Data lokal tetap dapat diakses; klik "Atur Sinkronisasi" untuk menyambungkan ulang.'
            );
          }
        });

        // Immediately pull fresh authoritative server data without crashing app if temporarily offline
        try {
          const fresh = await fetchAllUserCollectionsFromServer(target);
          if (!active) return;
          setAgendas(fresh.agendas);
          setJournals(fresh.journals);
          setHolidayDuties(fresh.holidayDuties);
          setIsLoaded(true);
          await Promise.all([
            saveAgendasToDB(fresh.agendas),
            saveJournalsToDB(fresh.journals),
            saveHolidayDutiesToDB(fresh.holidayDuties)
          ]);
        } catch (serverPullErr) {
          console.warn('Initial server pull skipped (using live listener/local cache):', serverPullErr);
          if (active) {
            setIsLoaded(true);
          }
        }
      } catch (err) {
        if (!active) return;
        console.error('Cloud workspace init warning:', err);
        if (localAgendas.length === 0 && localJournals.length === 0 && localDuties.length === 0) {
          setAgendas(INITIAL_AGENDAS);
          setJournals(INITIAL_JOURNALS);
          setHolidayDuties(INITIAL_HOLIDAY_DUTIES);
        }
        setIsLoaded(true);
        const rawMsg = err instanceof Error ? err.message : String(err);
        if (rawMsg.toLowerCase().includes('quota exceeded') || rawMsg.toLowerCase().includes('resource-exhausted')) {
          setWorkspaceNotice(
            'Kuota harian database cloud sedang penuh. Anda tetap dapat bekerja dengan data lokal dan mengekspor cadangan.'
          );
        } else {
          setWorkspaceNotice(
            'Sinkronisasi cloud awal mengalami kendala koneksi/izin. Aplikasi tetap aktif dengan data lokal—klik tombol Sinkronkan untuk mencoba lagi.'
          );
        }
      } finally {
        if (active) {
          setIsSyncing(false);
        }
      }
    }

    void initCloudWorkspace(user);

    // Automatically refresh from Firestore server whenever user switches back to HP/PC tab
    const handleResumeSync = () => {
      if (document.visibilityState && document.visibilityState !== 'visible') return;
      const currentTarget = activeTargetRef.current;
      if (!currentTarget) return;
      fetchAllUserCollectionsFromServer(currentTarget)
        .then((fresh) => {
          if (!active) return;
          setAgendas(fresh.agendas);
          setJournals(fresh.journals);
          setHolidayDuties(fresh.holidayDuties);
        })
        .catch(() => {
          // Real-time listener will continue retrying when online
        });
    };

    window.addEventListener('focus', handleResumeSync);
    document.addEventListener('visibilitychange', handleResumeSync);

    return () => {
      active = false;
      window.removeEventListener('focus', handleResumeSync);
      document.removeEventListener('visibilitychange', handleResumeSync);
      if (unsubscribeCollections) unsubscribeCollections();
      if (unsubscribeProfile) unsubscribeProfile();
    };
  }, [authReady, user, linkedWorkspaceOwnerUid]);

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
            if (activeWorkspaceOwnerUid) {
              updateAgendaReminderInFirestore(activeWorkspaceOwnerUid, agenda.id, updatedReminder).catch((err) => {
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
  }, [agendas, isLoaded, dismissedAlertIds, activeWorkspaceOwnerUid]);

  const isInIframe = useMemo(() => {
    try {
      return window.self !== window.top;
    } catch {
      return true;
    }
  }, []);

  const handleEnterLocalMode = useCallback(() => {
    try {
      sessionStorage.setItem(GUEST_MODE_STORAGE_KEY, '1');
    } catch {
      // ignore
    }
    setAuthNotice(null);
    setAuthErrorCode(null);
    setGuestMode(true);
  }, []);

  const handleSignInGoogle = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthNotice(null);
    setAuthErrorCode(null);
    try {
      await signInWithGoogle();
    } catch (err) {
      const code = (err as { code?: string })?.code || 'unknown';
      setAuthErrorCode(code);
      if (code === 'auth/popup-blocked') {
        setAuthNotice(
          'Pop-up login diblokir oleh browser HP/Komputer. Izinkan pop-up, buka di tab baru, atau klik "Masuk Langsung ke Aplikasi" di bawah.'
        );
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
        setAuthNotice(
          'Jendela login Google tertutup sebelum selesai. Jika pop-up terhalang browser, buka di tab baru atau masuk langsung lewat Mode Lokal di bawah.'
        );
      } else if (code === 'auth/unauthorized-domain') {
        setAuthNotice(
          'Domain browser ini belum terdaftar pada Firebase Auth. Anda tetap dapat masuk menggunakan tombol "Masuk Langsung ke Aplikasi" di bawah.'
        );
      } else if (code === 'auth/operation-not-supported-in-this-environment') {
        setAuthNotice(
          'Browser/Mode Privat ini membatasi penyimpanan login Google. Buka di Chrome/Safari normal atau klik "Masuk Langsung ke Aplikasi".'
        );
      } else if (code === 'auth/network-request-failed') {
        setAuthNotice(
          'Koneksi internet terputus saat menghubungi Google. Periksa jaringan Anda atau gunakan "Masuk Langsung ke Aplikasi".'
        );
      } else {
        setAuthNotice(
          `Gagal masuk dengan Google (${code}). Anda dapat mencoba lagi atau klik "Masuk Langsung ke Aplikasi" di bawah.`
        );
      }
      throw err;
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  const handleSignInGoogleRedirect = useCallback(async () => {
    setIsAuthLoading(true);
    setAuthNotice(null);
    try {
      await signInWithGoogleRedirect();
    } catch (err) {
      const code = (err as { code?: string })?.code || 'unknown';
      setAuthErrorCode(code);
      setAuthNotice(
        `Login redirect tidak tersedia di browser ini (${code}). Gunakan tombol "Masuk Langsung ke Aplikasi" di bawah.`
      );
      setIsAuthLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    try {
      sessionStorage.removeItem(GUEST_MODE_STORAGE_KEY);
    } catch {
      // ignore
    }
    setGuestMode(false);
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
        if (workspaceTarget) {
          resolvedUrl = await fetchAttachmentDataUrl(workspaceTarget, docItem);
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
    [workspaceTarget]
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

  // Manual Cloud Server Sync refresh (bypasses local cache via getDocsFromServer)
  const handleManualSync = async (): Promise<{ ok: boolean; message: string }> => {
    if (!workspaceTarget) {
      setIsSyncModalOpen(true);
      return {
        ok: false,
        message: 'Silakan masuk dengan akun Google terlebih dahulu agar data tersinkronisasi.'
      };
    }

    setIsSyncing(true);
    try {
      const snapshot = await fetchAllUserCollectionsFromServer(workspaceTarget);
      setAgendas(snapshot.agendas);
      setJournals(snapshot.journals);
      setHolidayDuties(snapshot.holidayDuties);
      await Promise.all([
        saveAgendasToDB(snapshot.agendas),
        saveJournalsToDB(snapshot.journals),
        saveHolidayDutiesToDB(snapshot.holidayDuties)
      ]);
      setWorkspaceNotice(null);
      return {
        ok: true,
        message: `Data server cloud terbaru berhasil ditarik (${snapshot.agendas.length} agenda, ${snapshot.journals.length} jurnal, ${snapshot.holidayDuties.length} piket).`
      };
    } catch (err) {
      console.error('Manual sync error:', err);
      return {
        ok: false,
        message: 'Gagal menarik data dari server cloud. Periksa koneksi internet atau sesi akun Google Anda.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // Explicit push of current device dataset into cloud
  const handleUploadLocalToCloud = async (): Promise<{ ok: boolean; message: string }> => {
    if (!workspaceTarget) {
      return { ok: false, message: 'Silakan masuk dengan akun Google terlebih dahulu.' };
    }
    setIsSyncing(true);
    try {
      await uploadDatasetToFirestore(workspaceTarget, {
        agendas,
        journals,
        holidayDuties
      });
      return {
        ok: true,
        message: `Seluruh data perangkat ini (${agendas.length} agenda, ${journals.length} jurnal, ${holidayDuties.length} piket) berhasil dikirim ke cloud.`
      };
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return {
        ok: false,
        message: 'Gagal mengirim data ke cloud.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // Update owner-authorized collaborator email allowlist
  const handleUpdateSharedEmails = async (
    nextEmails: string[]
  ): Promise<{ ok: boolean; message: string }> => {
    if (!user || activeWorkspaceOwnerUid !== user.uid) {
      return { ok: false, message: 'Hanya pemilik ruang kerja yang dapat mengatur daftar email akses.' };
    }
    try {
      const saved = await updateWorkspaceSharedEmails(user.uid, nextEmails);
      setSharedEmails(saved);
      return {
        ok: true,
        message:
          saved.length > 0
            ? `Akses diperbarui (${saved.length} email HP/tim diizinkan). Sekarang salin tautan penghubung dan buka di HP.`
            : 'Daftar email akses berhasil diperbarui.'
      };
    } catch (err) {
      setFatalError(err instanceof Error ? err : new Error(String(err)));
      return { ok: false, message: 'Gagal memperbarui daftar email akses.' };
    }
  };

  // Join another user's authorized workspace (e.g., HP with personal Gmail joining Komputer's office workspace)
  const handleJoinWorkspace = async (
    ownerUid: string
  ): Promise<{ ok: boolean; message: string }> => {
    if (!user || !user.emailVerified) {
      return { ok: false, message: 'Masuk dengan akun Google terlebih dahulu.' };
    }
    const result = await verifyWorkspaceAccess(ownerUid, user.uid, user.email || '');
    if (!result.ok || !result.profile) {
      return { ok: false, message: result.reason || 'Tidak dapat terhubung ke ruang kerja tersebut.' };
    }
    try {
      localStorage.setItem(WORKSPACE_STORAGE_KEY, result.profile.ownerId);
    } catch {
      // ignore
    }
    setLinkedWorkspaceOwnerUid(result.profile.ownerId);
    return {
      ok: true,
      message: `Berhasil terhubung ke ruang kerja ${result.profile.email}. Data HP dan Komputer kini 100% sama secara real-time.`
    };
  };

  const handleLeaveSharedWorkspace = () => {
    try {
      localStorage.removeItem(WORKSPACE_STORAGE_KEY);
      if (window.location.search.includes('workspace=')) {
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch {
      // ignore
    }
    setLinkedWorkspaceOwnerUid(null);
  };

  // Explicit JSON backup import (works in both Cloud Mode and Local Mode)
  const handleImportBackup = async (data: {
    agendas: AgendaItem[];
    journals: DailyJournalEntry[];
    holidayDuties: HolidayDutyEntry[];
  }): Promise<{ ok: boolean; message: string }> => {
    setIsSyncing(true);
    try {
      setAgendas(data.agendas);
      setJournals(data.journals);
      setHolidayDuties(data.holidayDuties);
      await Promise.all([
        saveAgendasToDB(data.agendas),
        saveJournalsToDB(data.journals),
        saveHolidayDutiesToDB(data.holidayDuties)
      ]);

      if (workspaceTarget) {
        await uploadDatasetToFirestore(workspaceTarget, data, { bestEffort: true });
        return {
          ok: true,
          message: `Data berhasil diimpor ke database cloud (${data.agendas.length} agenda, ${data.journals.length} jurnal, ${data.holidayDuties.length} piket) dan otomatis tersinkron ke semua perangkat.`
        };
      }

      return {
        ok: true,
        message: `Data berhasil diimpor ke perangkat ini (${data.agendas.length} agenda, ${data.journals.length} jurnal, ${data.holidayDuties.length} piket). Masuk Google kapan saja untuk mengunggah ke cloud.`
      };
    } catch (err) {
      console.error('Import backup error:', err);
      return {
        ok: false,
        message: 'Terjadi kendala saat mengimpor data. Pastikan berkas cadangan JSON valid.'
      };
    } finally {
      setIsSyncing(false);
    }
  };

  // CRUD Handlers — write directly to active Firestore workspace
  const handleSaveAgenda = async (savedItem: AgendaItem) => {
    setAgendas((prev) => {
      const exists = prev.some((a) => a.id === savedItem.id);
      return exists ? prev.map((a) => (a.id === savedItem.id ? savedItem : a)) : [savedItem, ...prev];
    });
    await saveSingleAgendaToDB(savedItem);
    setIsModalOpen(false);
    setAgendaToEdit(null);

    if (workspaceTarget) {
      try {
        await saveAgendaToFirestore(workspaceTarget, savedItem);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    const target = agendas.find((a) => a.id === id);
    setAgendas((prev) => prev.filter((a) => a.id !== id));
    await deleteAgendaFromDB(id);
    if (activeWorkspaceOwnerUid) {
      try {
        await deleteAgendaFromFirestore(activeWorkspaceOwnerUid, id, target?.documents);
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

    if (activeWorkspaceOwnerUid) {
      try {
        await updateAgendaStatusInFirestore(activeWorkspaceOwnerUid, id, newStatus);
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

    if (activeWorkspaceOwnerUid) {
      updateAgendaReminderInFirestore(activeWorkspaceOwnerUid, agendaId, updatedReminder).catch((err) => {
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

    if (workspaceTarget) {
      try {
        await saveJournalToFirestore(workspaceTarget, entry);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteJournal = async (id: string) => {
    const target = journals.find((j) => j.id === id);
    setJournals((prev) => prev.filter((j) => j.id !== id));
    await deleteJournalFromDB(id);
    if (activeWorkspaceOwnerUid) {
      try {
        await deleteJournalFromFirestore(activeWorkspaceOwnerUid, id, target?.documents);
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

    if (workspaceTarget) {
      try {
        await saveHolidayDutyToFirestore(workspaceTarget, duty);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleBatchAddHolidayDuties = async (newDuties: HolidayDutyEntry[]) => {
    const updated = [...holidayDuties, ...newDuties];
    setHolidayDuties(updated);
    await saveHolidayDutiesToDB(updated);

    if (workspaceTarget) {
      try {
        await batchAddHolidayDutiesToFirestore(workspaceTarget, newDuties);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  const handleDeleteHolidayDuty = async (id: string) => {
    setHolidayDuties((prev) => prev.filter((d) => d.id !== id));
    await deleteHolidayDutyFromDB(id);

    if (activeWorkspaceOwnerUid) {
      try {
        await deleteHolidayDutyFromFirestore(activeWorkspaceOwnerUid, id);
      } catch (err) {
        setFatalError(err instanceof Error ? err : new Error(String(err)));
      }
    }
  };

  // Initial auth loading screen
  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 text-amber-400 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-300">Menghubungkan ke Database Cloud...</p>
        </div>
      </div>
    );
  }

  // Cloud Sign-In Welcome Screen (with 1-click Local Mode fallback so user is NEVER locked out)
  if (!user && !guestMode) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md bg-white text-slate-900 rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-6 py-7 text-center border-b border-slate-800">
            <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-500 via-amber-400 to-yellow-300 p-0.5 shadow-lg shadow-amber-500/20 mx-auto mb-4">
              <div className="w-full h-full bg-white rounded-[14px] flex items-center justify-center p-1.5 overflow-hidden">
                <img
                  src={logoUrl}
                  alt="Logo SUBAG TU PIM & PROTOKOL DITJENPAS"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </div>
            </div>
            <h1 className="text-lg font-extrabold tracking-tight text-white">
              SUBAG TU PIM &amp; PROTOKOL DITJENPAS
            </h1>
            <p className="text-xs text-slate-400 mt-1">
              Manajemen Agenda Bulanan, Jurnal Harian &amp; Piket Protokol
            </p>
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-2 text-center">
              <h2 className="text-base font-bold text-slate-900">
                Masuk untuk Sinkronisasi HP &amp; Komputer
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                Masuk menggunakan <strong>akun Google yang sama</strong> di HP dan Komputer agar seluruh agenda, jurnal, piket, lampiran, dan logo selalu identik secara real-time.
              </p>
            </div>

            {authNotice && (
              <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs font-medium text-red-800 space-y-2">
                <p>{authNotice}</p>
                {isInIframe ? (
                  <a
                    href={typeof window !== 'undefined' ? window.location.href : '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-red-900 underline font-semibold hover:text-red-700"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Buka di Tab Browser Baru untuk Login Google</span>
                  </a>
                ) : (
                  (authErrorCode === 'auth/popup-blocked' ||
                    authErrorCode === 'auth/popup-closed-by-user' ||
                    authErrorCode === 'auth/cancelled-popup-request') && (
                    <button
                      type="button"
                      onClick={() => {
                        void handleSignInGoogleRedirect();
                      }}
                      className="inline-flex items-center gap-1.5 text-red-900 underline font-semibold hover:text-red-700"
                    >
                      <span>Coba Login Google via Halaman Penuh (Redirect)</span>
                    </button>
                  )
                )}
              </div>
            )}

            <div className="space-y-2.5">
              <button
                type="button"
                onClick={() => {
                  void handleSignInGoogle().catch(() => {});
                }}
                disabled={isAuthLoading}
                className="w-full inline-flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white text-sm font-bold shadow-md transition"
              >
                {isAuthLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                ) : (
                  <LogIn className="w-4 h-4 text-amber-400" />
                )}
                <span>{isAuthLoading ? 'Membuka Login Google...' : 'Masuk dengan Akun Google'}</span>
              </button>

              <button
                type="button"
                onClick={handleEnterLocalMode}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs sm:text-sm font-semibold border border-slate-200 transition"
              >
                <span>Masuk Langsung ke Aplikasi (Mode Lokal)</span>
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-center text-[11px] text-slate-500">
              <div className="flex flex-col items-center gap-1">
                <Smartphone className="w-4 h-4 text-teal-600" />
                <span>Sinkron HP</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <Laptop className="w-4 h-4 text-blue-600" />
                <span>Sinkron PC</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <ShieldCheck className="w-4 h-4 text-amber-600" />
                <span>Cloud Aman</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
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
          onViewChange={handleViewChange}
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
          logoUrl={logoUrl}
          onOpenLogoModal={() => setIsLogoModalOpen(true)}
        />

        {/* Main App Content Container */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 overflow-x-clip print:overflow-visible">
          {!user && viewMode !== 'print' && (
            <div className="mb-4 p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs font-medium text-blue-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3 no-print">
              <span>
                Anda sedang menggunakan <strong>Mode Lokal</strong> (data tersimpan di perangkat ini). Masuk dengan akun Google kapan saja agar data otomatis sinkron antara HP &amp; Komputer.
                {authNotice ? ` — ${authNotice}` : ''}
              </span>
              <button
                type="button"
                onClick={() => {
                  void handleSignInGoogle().catch(() => {});
                }}
                disabled={isAuthLoading}
                className="inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-semibold shrink-0 transition"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-400" />
                <span>{isAuthLoading ? 'Memproses...' : 'Masuk Google'}</span>
              </button>
            </div>
          )}

          {workspaceNotice && viewMode !== 'print' && (
            <div className="mb-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-medium text-amber-900 flex items-center justify-between gap-3 no-print">
              <span>{workspaceNotice}</span>
              <button
                type="button"
                onClick={() => setIsSyncModalOpen(true)}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold shrink-0 transition"
              >
                Atur Sinkronisasi
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
            <AnimatePresence initial={false}>
              {(viewMode === 'calendar' || viewMode === 'list') && (
                <motion.div
                  key="agenda-filter-bar"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
                >
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
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}

        {/* View Switcher Output with Smooth Framer Motion Transitions */}
        <AnimatePresence mode="wait" initial={false} custom={viewDirection}>
          <motion.div
            key={viewMode}
            custom={viewDirection}
            variants={viewTransitionVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="print:transform-none print:opacity-100"
          >
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
                onOpenHolidayDutyTab={() => handleViewChange('piket')}
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
                logoUrl={logoUrl}
                onBackToCalendar={() => handleViewChange('calendar')}
              />
            )}
          </motion.div>
        </AnimatePresence>
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

      {/* HP <-> Komputer Cloud Sync & Multi-Account Linking Modal */}
      <SyncDeviceModal
        isOpen={isSyncModalOpen}
        onClose={() => setIsSyncModalOpen(false)}
        agendas={agendas}
        journals={journals}
        holidayDuties={holidayDuties}
        isSyncing={isSyncing}
        userUid={user?.uid || null}
        userEmail={user?.email || null}
        userDisplayName={user?.displayName || null}
        activeWorkspaceOwnerUid={activeWorkspaceOwnerUid}
        activeWorkspaceOwnerEmail={activeWorkspaceOwnerEmail}
        sharedEmails={sharedEmails}
        isAuthLoading={isAuthLoading}
        onSignInGoogle={handleSignInGoogle}
        onSignOut={handleSignOut}
        onManualSync={handleManualSync}
        onUploadLocalToCloud={handleUploadLocalToCloud}
        onUpdateSharedEmails={handleUpdateSharedEmails}
        onJoinWorkspace={handleJoinWorkspace}
        onLeaveSharedWorkspace={handleLeaveSharedWorkspace}
        onImportBackup={handleImportBackup}
      />

      {/* Logo Settings Modal */}
      <LogoSettingsModal
        isOpen={isLogoModalOpen}
        onClose={() => setIsLogoModalOpen(false)}
        logoUrl={logoUrl}
        isCustomLogo={isCustomLogo}
        onUpdateLogo={handleUpdateLogo}
        onResetLogo={handleResetLogo}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 no-print mt-12">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src={logoUrl}
              alt="Logo SUBAG TU PIM & PROTOKOL DITJENPAS"
              referrerPolicy="no-referrer"
              className="w-6 h-6 object-contain rounded"
            />
            <p className="font-medium text-slate-700">
              SUBAG TU PIM &amp; PROTOKOL DITJENPAS • Manajemen Agenda, Jurnal Harian &amp; Piket Protokol
            </p>
          </div>
          <p className="text-slate-400">
            Sinkronisasi Cloud Real-Time HP &amp; Komputer • Pengingat Otomatis • Unggah Berkas PDF &amp; Gambar
          </p>
        </div>
      </footer>
      </div>
    </MotionConfig>
  );
}
