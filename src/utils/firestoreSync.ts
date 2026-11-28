import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getDocsFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  AgendaCategory,
  AgendaItem,
  AgendaStatus,
  DailyJournalEntry,
  DocumentAttachment,
  DutyShift,
  HolidayDutyEntry,
  HolidayType,
  JournalOutcome,
  LeaderRole,
  Priority,
  ProtocolOfficer,
  ReminderConfig
} from '../types/agenda';
import {
  deleteCachedAttachmentDataUrl,
  getCachedAttachmentDataUrl,
  saveCachedAttachmentDataUrl
} from './indexedDb';

export const SHARED_WORKSPACE_ID = 'ditjenpas_utama';
const SHARED_VISIBILITY = 'shared_unit';
const DEFAULT_UNIT_NAME = 'SUBAG TU PIM & PROTOKOL DITJENPAS';

const CHUNK_SIZE = 480_000;
const MAX_CHUNKS = 30;
const MAX_DOCUMENTS = 15;
const MAX_OFFICERS = 30;

const VALID_PRIORITIES: Priority[] = ['VIP', 'Tinggi', 'Sedang', 'Rutin'];
const VALID_STATUSES: AgendaStatus[] = ['Terjadwal', 'Berlangsung', 'Selesai', 'Ditunda', 'Dibatalkan'];
const VALID_OUTCOMES: JournalOutcome[] = [
  'Lancar & Kondusif',
  'Perlu Tindak Lanjut',
  'Ada Kendala',
  'Selesai Dilaporkan'
];
const VALID_DAY_TYPES: HolidayType[] = [
  'Akhir Pekan (Sabtu/Minggu)',
  'Libur Nasional',
  'Cuti Bersama',
  'Hari Besar Keagamaan'
];
const VALID_SHIFTS: DutyShift[] = [
  'Standby Penuh (24 Jam)',
  'Shift Pagi (07:30 - 14:00)',
  'Shift Siang/Sore (14:00 - 20:00)'
];

export interface SharedWorkspaceConfig {
  workspaceId: string;
  ownerId: string;
  unitName: string;
  customLogo: string;
}

export interface SharedWorkspaceActor {
  workspaceId: string;
  viewerUid: string;
  viewerEmail: string;
}

function sanitizeId(raw: string | undefined, prefix: string): string {
  const cleaned = (raw || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 100);
  if (cleaned.length > 0) return cleaned;
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function clampString(val: string | undefined, maxLen: number, fallback = ''): string {
  const str = typeof val === 'string' ? val.trim() : '';
  if (!str) return fallback.slice(0, maxLen);
  return str.slice(0, maxLen);
}

export function getLocalDateIso(dateObj: Date = new Date()): string {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sanitizeDate(val: string | undefined): string {
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  return getLocalDateIso();
}

function sanitizeTime(val: string | undefined, fallback = '08:00'): string {
  if (typeof val === 'string' && /^\d{2}:\d{2}$/.test(val.trim())) {
    return val.trim();
  }
  return fallback;
}

function timestampToIso(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.length > 0) {
    return val;
  }
  if (val && typeof val === 'object' && 'toDate' in val && typeof (val as { toDate: () => Date }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function sanitizeReminder(rem: ReminderConfig | undefined): ReminderConfig {
  const minutes = typeof rem?.minutesBefore === 'number' && Number.isFinite(rem.minutesBefore)
    ? Math.max(0, Math.min(10080, Math.round(rem.minutesBefore)))
    : 30;
  const result: ReminderConfig = {
    enabled: Boolean(rem?.enabled ?? true),
    minutesBefore: minutes,
    soundEnabled: Boolean(rem?.soundEnabled ?? true)
  };
  if (typeof rem?.triggered === 'boolean') {
    result.triggered = rem.triggered;
  }
  if (typeof rem?.lastNotified === 'string' && rem.lastNotified.length > 0) {
    result.lastNotified = rem.lastNotified.slice(0, 64);
  }
  if (rem?.snoozedUntil === null || (typeof rem?.snoozedUntil === 'number' && Number.isFinite(rem.snoozedUntil))) {
    result.snoozedUntil = rem.snoozedUntil;
  }
  return result;
}

function sanitizeOfficers(officers: ProtocolOfficer[] | undefined, fallbackName: string, fallbackPhone: string): ProtocolOfficer[] {
  const valid = (Array.isArray(officers) ? officers : [])
    .slice(0, MAX_OFFICERS)
    .map((o, idx) => ({
      id: sanitizeId(o?.id, `off_${idx}`),
      name: clampString(o?.name, 150, 'Petugas Protokol'),
      role: clampString(o?.role, 120, 'Petugas Protokol'),
      phone: clampString(o?.phone, 40, '-')
    }));

  if (valid.length === 0) {
    return [
      {
        id: 'off_default_1',
        name: clampString(fallbackName, 150, 'Petugas Protokol'),
        role: 'Koordinator Piket',
        phone: clampString(fallbackPhone, 40, '-')
      }
    ];
  }
  return valid;
}

function buildSharedCollectionQuery(
  workspaceId: string,
  subcollection: 'agendas' | 'journals' | 'holidayDuties'
) {
  const colRef = collection(db, 'workspaces', workspaceId, subcollection);
  return query(
    colRef,
    where('workspaceId', '==', workspaceId),
    where('visibility', '==', SHARED_VISIBILITY)
  );
}

// ==================== SHARED WORKSPACE PROFILE & LOGO ====================

export async function ensureSharedWorkspace(user: User): Promise<{
  isNewWorkspace: boolean;
  config: SharedWorkspaceConfig;
}> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const wsRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID);

  try {
    let snap;
    try {
      snap = await getDocFromServer(wsRef);
    } catch {
      snap = await getDoc(wsRef);
    }

    if (!snap.exists()) {
      await setDoc(wsRef, {
        workspaceId: SHARED_WORKSPACE_ID,
        ownerId: user.uid,
        unitName: DEFAULT_UNIT_NAME,
        customLogo: '',
        visibility: SHARED_VISIBILITY,
        updatedBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return {
        isNewWorkspace: true,
        config: {
          workspaceId: SHARED_WORKSPACE_ID,
          ownerId: user.uid,
          unitName: DEFAULT_UNIT_NAME,
          customLogo: ''
        }
      };
    }

    const data = snap.data();
    return {
      isNewWorkspace: false,
      config: {
        workspaceId: String(data.workspaceId || SHARED_WORKSPACE_ID),
        ownerId: String(data.ownerId || user.uid),
        unitName: String(data.unitName || DEFAULT_UNIT_NAME),
        customLogo: typeof data.customLogo === 'string' ? data.customLogo : ''
      }
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export function subscribeSharedWorkspace(
  onConfig: (config: SharedWorkspaceConfig) => void,
  onError: (err: Error) => void
): () => void {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const wsRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID);

  return onSnapshot(
    wsRef,
    (snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      onConfig({
        workspaceId: String(data.workspaceId || SHARED_WORKSPACE_ID),
        ownerId: String(data.ownerId || ''),
        unitName: String(data.unitName || DEFAULT_UNIT_NAME),
        customLogo: typeof data.customLogo === 'string' ? data.customLogo : ''
      });
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.GET, path);
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveSharedWorkspaceLogo(viewerUid: string, logoDataUrl: string): Promise<void> {
  const path = `workspaces/${SHARED_WORKSPACE_ID}`;
  const wsRef = doc(db, 'workspaces', SHARED_WORKSPACE_ID);
  const clamped = logoDataUrl ? logoDataUrl.slice(0, 450_000) : '';
  try {
    await updateDoc(wsRef, {
      customLogo: clamped,
      updatedBy: viewerUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

// ==================== CHUNKED ATTACHMENT STORAGE ====================

interface CloudDocumentMeta {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
  chunkCount: number;
}

async function prepareDocumentsForSharedCloud(
  actor: SharedWorkspaceActor,
  documents: DocumentAttachment[] | undefined
): Promise<CloudDocumentMeta[]> {
  if (!Array.isArray(documents) || documents.length === 0) return [];

  const limited = documents.slice(0, MAX_DOCUMENTS);
  const metaList: CloudDocumentMeta[] = [];

  for (const attachment of limited) {
    const attId = sanitizeId(attachment.id, 'doc');
    let chunkCount = typeof attachment.chunkCount === 'number' && attachment.chunkCount > 0
      ? attachment.chunkCount
      : 0;

    let rawDataUrl = attachment.dataUrl || '';
    if (!rawDataUrl) {
      const cached = await getCachedAttachmentDataUrl(attId);
      if (cached) rawDataUrl = cached;
    }

    if (rawDataUrl) {
      await saveCachedAttachmentDataUrl(attId, rawDataUrl);

      const totalChunks = Math.min(MAX_CHUNKS, Math.ceil(rawDataUrl.length / CHUNK_SIZE));
      chunkCount = totalChunks;

      const firstChunkId = `${attId}_0`;
      const firstChunkPath = `workspaces/${actor.workspaceId}/attachmentChunks/${firstChunkId}`;
      const firstChunkRef = doc(db, 'workspaces', actor.workspaceId, 'attachmentChunks', firstChunkId);

      let alreadyUploaded = false;
      try {
        const firstSnap = await getDoc(firstChunkRef);
        alreadyUploaded = firstSnap.exists();
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, firstChunkPath);
      }

      if (!alreadyUploaded) {
        for (let i = 0; i < totalChunks; i++) {
          const slice = rawDataUrl.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
          if (!slice) continue;
          const chunkId = `${attId}_${i}`;
          const chunkPath = `workspaces/${actor.workspaceId}/attachmentChunks/${chunkId}`;
          const chunkRef = doc(db, 'workspaces', actor.workspaceId, 'attachmentChunks', chunkId);
          try {
            await setDoc(chunkRef, {
              workspaceId: actor.workspaceId,
              visibility: SHARED_VISIBILITY,
              ownerId: actor.viewerUid,
              attachmentId: attId,
              chunkIndex: i,
              totalChunks,
              data: slice,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp()
            });
          } catch (error) {
            handleFirestoreError(error, OperationType.CREATE, chunkPath);
          }
        }
      }
    }

    metaList.push({
      id: attId,
      name: clampString(attachment.name, 200, 'dokumen'),
      size: typeof attachment.size === 'number' && Number.isFinite(attachment.size) ? Math.max(0, attachment.size) : 0,
      type: clampString(attachment.type, 120, 'application/octet-stream'),
      uploadedAt: clampString(attachment.uploadedAt, 64, new Date().toISOString()),
      chunkCount
    });
  }

  return metaList;
}

export async function fetchSharedAttachmentDataUrl(
  actor: SharedWorkspaceActor,
  attachment: DocumentAttachment
): Promise<string> {
  if (attachment.dataUrl && attachment.dataUrl.length > 0) {
    return attachment.dataUrl;
  }

  const attId = sanitizeId(attachment.id, 'doc');
  const cached = await getCachedAttachmentDataUrl(attId);
  if (cached) return cached;

  const expectedCount = attachment.chunkCount && attachment.chunkCount > 0 ? attachment.chunkCount : 0;

  if (expectedCount > 0) {
    const parts: string[] = [];
    for (let i = 0; i < expectedCount; i++) {
      const chunkId = `${attId}_${i}`;
      const chunkPath = `workspaces/${actor.workspaceId}/attachmentChunks/${chunkId}`;
      try {
        const snap = await getDoc(doc(db, 'workspaces', actor.workspaceId, 'attachmentChunks', chunkId));
        if (snap.exists()) {
          const data = snap.data();
          if (typeof data.data === 'string') {
            parts.push(data.data);
          }
        }
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, chunkPath);
      }
    }
    const fullUrl = parts.join('');
    if (fullUrl) {
      await saveCachedAttachmentDataUrl(attId, fullUrl);
      return fullUrl;
    }
  }

  const colPath = `workspaces/${actor.workspaceId}/attachmentChunks`;
  try {
    const baseCol = collection(db, 'workspaces', actor.workspaceId, 'attachmentChunks');
    const q = query(
      baseCol,
      where('workspaceId', '==', actor.workspaceId),
      where('visibility', '==', SHARED_VISIBILITY),
      where('attachmentId', '==', attId)
    );
    const snaps = await getDocs(q);
    const chunks = snaps.docs
      .map((d) => d.data() as { chunkIndex: number; data: string })
      .sort((a, b) => a.chunkIndex - b.chunkIndex);
    const fullUrl = chunks.map((c) => c.data).join('');
    if (fullUrl) {
      await saveCachedAttachmentDataUrl(attId, fullUrl);
    }
    return fullUrl;
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
  }
}

async function deleteSharedAttachmentChunks(
  workspaceId: string,
  documents: DocumentAttachment[] | undefined
): Promise<void> {
  if (!Array.isArray(documents) || documents.length === 0) return;
  for (const attachment of documents) {
    const attId = sanitizeId(attachment.id, 'doc');
    await deleteCachedAttachmentDataUrl(attId);
    const count = attachment.chunkCount && attachment.chunkCount > 0 ? attachment.chunkCount : 0;
    for (let i = 0; i < count; i++) {
      const chunkId = `${attId}_${i}`;
      try {
        await deleteDoc(doc(db, 'workspaces', workspaceId, 'attachmentChunks', chunkId));
      } catch {
        // Ignore if chunk already removed
      }
    }
  }
}

function hydrateDocumentMeta(rawDocs: unknown): DocumentAttachment[] {
  if (!Array.isArray(rawDocs)) return [];
  return rawDocs.map((d) => {
    const item = (d || {}) as Partial<CloudDocumentMeta & DocumentAttachment>;
    return {
      id: String(item.id || ''),
      name: String(item.name || 'Dokumen'),
      size: Number(item.size || 0),
      type: String(item.type || 'application/octet-stream'),
      dataUrl: typeof item.dataUrl === 'string' ? item.dataUrl : '',
      uploadedAt: String(item.uploadedAt || new Date().toISOString()),
      chunkCount: typeof item.chunkCount === 'number' ? item.chunkCount : 0
    };
  });
}

// ==================== MAPPERS ====================

function docToAgenda(data: Record<string, unknown>, docId: string): AgendaItem {
  return {
    id: String(data.id || docId),
    title: String(data.title || ''),
    category: (data.category as AgendaCategory) || 'Rapat Koordinasi',
    leader: (data.leader as LeaderRole) || 'Pimpinan Utama',
    leaderName: String(data.leaderName || ''),
    companions: typeof data.companions === 'string' ? data.companions : '',
    date: String(data.date || ''),
    startTime: String(data.startTime || '08:00'),
    endTime: String(data.endTime || '09:00'),
    location: String(data.location || ''),
    virtualMeetingUrl: typeof data.virtualMeetingUrl === 'string' ? data.virtualMeetingUrl : '',
    dressCode: typeof data.dressCode === 'string' ? data.dressCode : '',
    priority: VALID_PRIORITIES.includes(data.priority as Priority) ? (data.priority as Priority) : 'Sedang',
    status: VALID_STATUSES.includes(data.status as AgendaStatus) ? (data.status as AgendaStatus) : 'Terjadwal',
    notes: typeof data.notes === 'string' ? data.notes : '',
    documents: hydrateDocumentMeta(data.documents),
    reminder: sanitizeReminder(data.reminder as ReminderConfig),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function docToJournal(data: Record<string, unknown>, docId: string): DailyJournalEntry {
  return {
    id: String(data.id || docId),
    date: String(data.date || ''),
    time: String(data.time || '08:00'),
    title: String(data.title || ''),
    relatedAgendaId: typeof data.relatedAgendaId === 'string' && data.relatedAgendaId ? data.relatedAgendaId : undefined,
    relatedAgendaTitle: typeof data.relatedAgendaTitle === 'string' && data.relatedAgendaTitle ? data.relatedAgendaTitle : undefined,
    leaderName: String(data.leaderName || ''),
    location: String(data.location || ''),
    reporterName: String(data.reporterName || ''),
    reporterRole: String(data.reporterRole || ''),
    summary: String(data.summary || ''),
    followUp: typeof data.followUp === 'string' ? data.followUp : '',
    outcome: VALID_OUTCOMES.includes(data.outcome as JournalOutcome)
      ? (data.outcome as JournalOutcome)
      : 'Lancar & Kondusif',
    documents: hydrateDocumentMeta(data.documents),
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

function docToHolidayDuty(data: Record<string, unknown>, docId: string): HolidayDutyEntry {
  return {
    id: String(data.id || docId),
    date: String(data.date || ''),
    holidayName: String(data.holidayName || ''),
    dayType: VALID_DAY_TYPES.includes(data.dayType as HolidayType)
      ? (data.dayType as HolidayType)
      : 'Akhir Pekan (Sabtu/Minggu)',
    shift: VALID_SHIFTS.includes(data.shift as DutyShift)
      ? (data.shift as DutyShift)
      : 'Standby Penuh (24 Jam)',
    coordinatorName: String(data.coordinatorName || ''),
    coordinatorPhone: typeof data.coordinatorPhone === 'string' ? data.coordinatorPhone : '',
    officers: Array.isArray(data.officers) ? (data.officers as ProtocolOfficer[]) : [],
    standbyLocation: String(data.standbyLocation || ''),
    notes: typeof data.notes === 'string' ? data.notes : '',
    createdAt: timestampToIso(data.createdAt),
    updatedAt: timestampToIso(data.updatedAt)
  };
}

// ==================== REAL-TIME SUBSCRIPTIONS & SERVER REFRESH ====================

export interface FirestoreSyncCallbacks {
  onAgendas: (items: AgendaItem[]) => void;
  onJournals: (items: DailyJournalEntry[]) => void;
  onHolidayDuties: (items: HolidayDutyEntry[]) => void;
  onError: (err: Error) => void;
}

export function subscribeSharedCollections(
  workspaceId: string,
  callbacks: FirestoreSyncCallbacks
): () => void {
  const agendasPath = `workspaces/${workspaceId}/agendas`;
  const journalsPath = `workspaces/${workspaceId}/journals`;
  const dutiesPath = `workspaces/${workspaceId}/holidayDuties`;

  const unsubAgendas = onSnapshot(
    buildSharedCollectionQuery(workspaceId, 'agendas'),
    (snapshot) => {
      const items = snapshot.docs.map((d) => docToAgenda(d.data() as Record<string, unknown>, d.id));
      items.sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
      callbacks.onAgendas(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, agendasPath);
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubJournals = onSnapshot(
    buildSharedCollectionQuery(workspaceId, 'journals'),
    (snapshot) => {
      const items = snapshot.docs.map((d) => docToJournal(d.data() as Record<string, unknown>, d.id));
      items.sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
      callbacks.onJournals(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, journalsPath);
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  const unsubDuties = onSnapshot(
    buildSharedCollectionQuery(workspaceId, 'holidayDuties'),
    (snapshot) => {
      const items = snapshot.docs.map((d) => docToHolidayDuty(d.data() as Record<string, unknown>, d.id));
      items.sort((a, b) => a.date.localeCompare(b.date));
      callbacks.onHolidayDuties(items);
    },
    (err) => {
      try {
        handleFirestoreError(err, OperationType.LIST, dutiesPath);
      } catch (wrapped) {
        callbacks.onError(wrapped as Error);
      }
    }
  );

  return () => {
    unsubAgendas();
    unsubJournals();
    unsubDuties();
  };
}

export async function fetchAllSharedCollectionsFromServer(workspaceId: string): Promise<{
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
}> {
  const agendasPath = `workspaces/${workspaceId}/agendas`;
  const journalsPath = `workspaces/${workspaceId}/journals`;
  const dutiesPath = `workspaces/${workspaceId}/holidayDuties`;

  let agendas: AgendaItem[] = [];
  let journals: DailyJournalEntry[] = [];
  let holidayDuties: HolidayDutyEntry[] = [];

  try {
    const snap = await getDocsFromServer(buildSharedCollectionQuery(workspaceId, 'agendas'));
    agendas = snap.docs
      .map((d) => docToAgenda(d.data() as Record<string, unknown>, d.id))
      .sort((a, b) => `${a.date}T${a.startTime}`.localeCompare(`${b.date}T${b.startTime}`));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, agendasPath);
  }

  try {
    const snap = await getDocsFromServer(buildSharedCollectionQuery(workspaceId, 'journals'));
    journals = snap.docs
      .map((d) => docToJournal(d.data() as Record<string, unknown>, d.id))
      .sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, journalsPath);
  }

  try {
    const snap = await getDocsFromServer(buildSharedCollectionQuery(workspaceId, 'holidayDuties'));
    holidayDuties = snap.docs
      .map((d) => docToHolidayDuty(d.data() as Record<string, unknown>, d.id))
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, dutiesPath);
  }

  return { agendas, journals, holidayDuties };
}

// ==================== CRUD OPERATIONS ON SHARED WORKSPACE ====================

export async function saveAgendaToSharedWorkspace(
  actor: SharedWorkspaceActor,
  agenda: AgendaItem,
  options?: { skipExisting?: boolean }
): Promise<void> {
  const safeId = sanitizeId(agenda.id, 'ag');
  const path = `workspaces/${actor.workspaceId}/agendas/${safeId}`;
  const agendaRef = doc(db, 'workspaces', actor.workspaceId, 'agendas', safeId);

  const cloudDocs = await prepareDocumentsForSharedCloud(actor, agenda.documents);

  const baseEditablePayload = {
    title: clampString(agenda.title, 300, 'Agenda Pimpinan'),
    category: clampString(agenda.category, 80, 'Rapat Koordinasi'),
    leader: clampString(agenda.leader, 80, 'Pimpinan Utama'),
    leaderName: clampString(agenda.leaderName, 150, 'Pimpinan'),
    companions: clampString(agenda.companions, 400, ''),
    date: sanitizeDate(agenda.date),
    startTime: sanitizeTime(agenda.startTime, '08:00'),
    endTime: sanitizeTime(agenda.endTime, '09:00'),
    location: clampString(agenda.location, 300, ''),
    virtualMeetingUrl: clampString(agenda.virtualMeetingUrl, 500, ''),
    dressCode: clampString(agenda.dressCode, 160, ''),
    priority: VALID_PRIORITIES.includes(agenda.priority) ? agenda.priority : 'Sedang',
    status: VALID_STATUSES.includes(agenda.status) ? agenda.status : 'Terjadwal',
    notes: clampString(agenda.notes, 3000, ''),
    documents: cloudDocs,
    reminder: sanitizeReminder(agenda.reminder),
    updatedBy: actor.viewerUid,
    updatedAt: serverTimestamp()
  };

  try {
    const existing = await getDoc(agendaRef);
    if (existing.exists()) {
      if (options?.skipExisting) return;
      await updateDoc(agendaRef, baseEditablePayload);
    } else {
      await setDoc(agendaRef, {
        id: safeId,
        workspaceId: actor.workspaceId,
        visibility: SHARED_VISIBILITY,
        ownerId: actor.viewerUid,
        ...baseEditablePayload,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateAgendaStatusInSharedWorkspace(
  actor: SharedWorkspaceActor,
  agendaId: string,
  status: AgendaStatus
): Promise<void> {
  const safeId = sanitizeId(agendaId, 'ag');
  const path = `workspaces/${actor.workspaceId}/agendas/${safeId}`;
  const agendaRef = doc(db, 'workspaces', actor.workspaceId, 'agendas', safeId);

  try {
    await updateDoc(agendaRef, {
      status: VALID_STATUSES.includes(status) ? status : 'Terjadwal',
      updatedBy: actor.viewerUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateAgendaReminderInSharedWorkspace(
  actor: SharedWorkspaceActor,
  agendaId: string,
  reminder: ReminderConfig
): Promise<void> {
  const safeId = sanitizeId(agendaId, 'ag');
  const path = `workspaces/${actor.workspaceId}/agendas/${safeId}`;
  const agendaRef = doc(db, 'workspaces', actor.workspaceId, 'agendas', safeId);

  try {
    await updateDoc(agendaRef, {
      reminder: sanitizeReminder(reminder),
      updatedBy: actor.viewerUid,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteAgendaFromSharedWorkspace(
  workspaceId: string,
  agendaId: string,
  documents?: DocumentAttachment[]
): Promise<void> {
  const safeId = sanitizeId(agendaId, 'ag');
  const path = `workspaces/${workspaceId}/agendas/${safeId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'agendas', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
  await deleteSharedAttachmentChunks(workspaceId, documents);
}

export async function saveJournalToSharedWorkspace(
  actor: SharedWorkspaceActor,
  journal: DailyJournalEntry,
  options?: { skipExisting?: boolean }
): Promise<void> {
  const safeId = sanitizeId(journal.id, 'jrn');
  const path = `workspaces/${actor.workspaceId}/journals/${safeId}`;
  const journalRef = doc(db, 'workspaces', actor.workspaceId, 'journals', safeId);

  const cloudDocs = await prepareDocumentsForSharedCloud(actor, journal.documents);

  const baseEditablePayload = {
    date: sanitizeDate(journal.date),
    time: sanitizeTime(journal.time, '08:00'),
    title: clampString(journal.title, 300, 'Jurnal Kegiatan'),
    relatedAgendaId: clampString(journal.relatedAgendaId, 128, ''),
    relatedAgendaTitle: clampString(journal.relatedAgendaTitle, 300, ''),
    leaderName: clampString(journal.leaderName, 150, 'Pimpinan'),
    location: clampString(journal.location, 300, ''),
    reporterName: clampString(journal.reporterName, 150, 'Petugas Protokol'),
    reporterRole: clampString(journal.reporterRole, 120, 'Staf Subag TU Pim'),
    summary: clampString(journal.summary, 6000, '-'),
    followUp: clampString(journal.followUp, 3000, ''),
    outcome: VALID_OUTCOMES.includes(journal.outcome) ? journal.outcome : 'Lancar & Kondusif',
    documents: cloudDocs,
    updatedBy: actor.viewerUid,
    updatedAt: serverTimestamp()
  };

  try {
    const existing = await getDoc(journalRef);
    if (existing.exists()) {
      if (options?.skipExisting) return;
      await updateDoc(journalRef, baseEditablePayload);
    } else {
      await setDoc(journalRef, {
        id: safeId,
        workspaceId: actor.workspaceId,
        visibility: SHARED_VISIBILITY,
        ownerId: actor.viewerUid,
        ...baseEditablePayload,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function deleteJournalFromSharedWorkspace(
  workspaceId: string,
  journalId: string,
  documents?: DocumentAttachment[]
): Promise<void> {
  const safeId = sanitizeId(journalId, 'jrn');
  const path = `workspaces/${workspaceId}/journals/${safeId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'journals', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
  await deleteSharedAttachmentChunks(workspaceId, documents);
}

export async function saveHolidayDutyToSharedWorkspace(
  actor: SharedWorkspaceActor,
  duty: HolidayDutyEntry,
  options?: { skipExisting?: boolean }
): Promise<void> {
  const safeId = sanitizeId(duty.id, 'piket');
  const path = `workspaces/${actor.workspaceId}/holidayDuties/${safeId}`;
  const dutyRef = doc(db, 'workspaces', actor.workspaceId, 'holidayDuties', safeId);

  const coordinatorName = clampString(duty.coordinatorName, 150, 'Koordinator Piket');
  const coordinatorPhone = clampString(duty.coordinatorPhone, 40, '');

  const baseEditablePayload = {
    date: sanitizeDate(duty.date),
    holidayName: clampString(duty.holidayName, 200, 'Piket Hari Libur'),
    dayType: VALID_DAY_TYPES.includes(duty.dayType) ? duty.dayType : 'Akhir Pekan (Sabtu/Minggu)',
    shift: VALID_SHIFTS.includes(duty.shift) ? duty.shift : 'Standby Penuh (24 Jam)',
    coordinatorName,
    coordinatorPhone,
    officers: sanitizeOfficers(duty.officers, coordinatorName, coordinatorPhone),
    standbyLocation: clampString(duty.standbyLocation, 250, 'Ruang Subag TU Pimpinan & Protokol'),
    notes: clampString(duty.notes, 2000, ''),
    updatedBy: actor.viewerUid,
    updatedAt: serverTimestamp()
  };

  try {
    const existing = await getDoc(dutyRef);
    if (existing.exists()) {
      if (options?.skipExisting) return;
      await updateDoc(dutyRef, baseEditablePayload);
    } else {
      await setDoc(dutyRef, {
        id: safeId,
        workspaceId: actor.workspaceId,
        visibility: SHARED_VISIBILITY,
        ownerId: actor.viewerUid,
        ...baseEditablePayload,
        createdAt: serverTimestamp()
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function batchAddHolidayDutiesToSharedWorkspace(
  actor: SharedWorkspaceActor,
  duties: HolidayDutyEntry[]
): Promise<void> {
  for (const duty of duties) {
    await saveHolidayDutyToSharedWorkspace(actor, duty);
  }
}

export async function deleteHolidayDutyFromSharedWorkspace(workspaceId: string, dutyId: string): Promise<void> {
  const safeId = sanitizeId(dutyId, 'piket');
  const path = `workspaces/${workspaceId}/holidayDuties/${safeId}`;
  try {
    await deleteDoc(doc(db, 'workspaces', workspaceId, 'holidayDuties', safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function uploadDatasetToSharedWorkspace(
  actor: SharedWorkspaceActor,
  data: {
    agendas: AgendaItem[];
    journals: DailyJournalEntry[];
    holidayDuties: HolidayDutyEntry[];
  },
  options?: { skipExisting?: boolean; bestEffort?: boolean }
): Promise<void> {
  for (const agenda of data.agendas) {
    try {
      await saveAgendaToSharedWorkspace(actor, agenda, options);
    } catch (err) {
      if (!options?.skipExisting && !options?.bestEffort) throw err;
      console.warn('Melewati unggah agenda lokal bermasalah:', agenda.id, err);
    }
  }
  for (const journal of data.journals) {
    try {
      await saveJournalToSharedWorkspace(actor, journal, options);
    } catch (err) {
      if (!options?.skipExisting && !options?.bestEffort) throw err;
      console.warn('Melewati unggah jurnal lokal bermasalah:', journal.id, err);
    }
  }
  for (const duty of data.holidayDuties) {
    try {
      await saveHolidayDutyToSharedWorkspace(actor, duty, options);
    } catch (err) {
      if (!options?.skipExisting && !options?.bestEffort) throw err;
      console.warn('Melewati unggah piket lokal bermasalah:', duty.id, err);
    }
  }
}

// ==================== SEAMLESS LEGACY MIGRATION (/users/{uid} -> /workspaces/ditjenpas_utama) ====================

async function hydrateLegacyAttachments(
  userUid: string,
  documents: DocumentAttachment[]
): Promise<DocumentAttachment[]> {
  if (!documents.length) return [];
  const hydrated: DocumentAttachment[] = [];

  for (const attachment of documents) {
    if (attachment.dataUrl && attachment.dataUrl.length > 0) {
      hydrated.push(attachment);
      continue;
    }
    const attId = sanitizeId(attachment.id, 'doc');
    const cached = await getCachedAttachmentDataUrl(attId);
    if (cached) {
      hydrated.push({ ...attachment, dataUrl: cached });
      continue;
    }

    const expectedCount = attachment.chunkCount && attachment.chunkCount > 0 ? attachment.chunkCount : 0;
    let fullUrl = '';
    if (expectedCount > 0) {
      const parts: string[] = [];
      for (let i = 0; i < expectedCount; i++) {
        try {
          const snap = await getDoc(doc(db, 'users', userUid, 'attachmentChunks', `${attId}_${i}`));
          if (snap.exists() && typeof snap.data().data === 'string') {
            parts.push(snap.data().data as string);
          }
        } catch {
          // ignore missing legacy chunk
        }
      }
      fullUrl = parts.join('');
    }
    hydrated.push({ ...attachment, dataUrl: fullUrl });
  }

  return hydrated;
}

/**
 * Automatically migrates any existing records saved in the user's legacy per-account
 * /users/{uid} subcollections into the shared /workspaces/ditjenpas_utama workspace
 * without overwriting newer items already present in the shared workspace.
 */
export async function migrateLegacyUserWorkspaceToShared(
  actor: SharedWorkspaceActor,
  currentSharedLogo: string
): Promise<{ migratedCount: number; migratedLogo: string | null }> {
  let migratedCount = 0;
  let migratedLogo: string | null = null;

  try {
    const legacyProfileSnap = await getDoc(doc(db, 'users', actor.viewerUid));
    if (!legacyProfileSnap.exists()) {
      return { migratedCount: 0, migratedLogo: null };
    }

    const profileData = legacyProfileSnap.data();
    if (!currentSharedLogo && typeof profileData.customLogo === 'string' && profileData.customLogo.startsWith('data:image/')) {
      try {
        await saveSharedWorkspaceLogo(actor.viewerUid, profileData.customLogo);
        migratedLogo = profileData.customLogo;
      } catch {
        // ignore logo migration failure
      }
    }

    const [agendasSnap, journalsSnap, dutiesSnap] = await Promise.all([
      getDocs(query(collection(db, 'users', actor.viewerUid, 'agendas'), where('ownerId', '==', actor.viewerUid))),
      getDocs(query(collection(db, 'users', actor.viewerUid, 'journals'), where('ownerId', '==', actor.viewerUid))),
      getDocs(query(collection(db, 'users', actor.viewerUid, 'holidayDuties'), where('ownerId', '==', actor.viewerUid)))
    ]);

    for (const d of agendasSnap.docs) {
      const item = docToAgenda(d.data() as Record<string, unknown>, d.id);
      if (item.documents.length > 0) {
        item.documents = await hydrateLegacyAttachments(actor.viewerUid, item.documents);
      }
      try {
        await saveAgendaToSharedWorkspace(actor, item, { skipExisting: true });
        migratedCount++;
      } catch {
        // skip individual item errors
      }
    }

    for (const d of journalsSnap.docs) {
      const item = docToJournal(d.data() as Record<string, unknown>, d.id);
      if (item.documents.length > 0) {
        item.documents = await hydrateLegacyAttachments(actor.viewerUid, item.documents);
      }
      try {
        await saveJournalToSharedWorkspace(actor, item, { skipExisting: true });
        migratedCount++;
      } catch {
        // skip individual item errors
      }
    }

    for (const d of dutiesSnap.docs) {
      const item = docToHolidayDuty(d.data() as Record<string, unknown>, d.id);
      try {
        await saveHolidayDutyToSharedWorkspace(actor, item, { skipExisting: true });
        migratedCount++;
      } catch {
        // skip individual item errors
      }
    }
  } catch (err) {
    console.warn('Migrasi otomatis data lama dilewati:', err);
  }

  return { migratedCount, migratedLogo };
}
