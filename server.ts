import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  AgendaItem,
  DailyJournalEntry,
  DocumentAttachment,
  HolidayDutyEntry,
  ProtocolOfficer
} from './src/types/agenda.ts';
import { INITIAL_AGENDAS } from './src/data/initialAgendas.ts';
import { INITIAL_JOURNALS, INITIAL_HOLIDAY_DUTIES } from './src/data/initialJournalAndDuty.ts';

interface DeletedRegistry {
  agendas: Record<string, string>;
  journals: Record<string, string>;
  holidayDuties: Record<string, string>;
}

interface LiveStoreData {
  version: number;
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  deletedIds: DeletedRegistry;
  updatedAt: string;
}

const PORT = Number(process.env.PORT) || 3000;
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.resolve(DATA_DIR, 'live-store.json');

const SAFE_ID_REGEX = /^[a-zA-Z0-9_-]{1,120}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'image/svg+xml'
]);

const MAX_DOCS_PER_ITEM = 15;
const MAX_DOC_DATAURL_LENGTH = 36_000_000; // ~25MB binary as base64

let store: LiveStoreData = {
  version: 1,
  agendas: [],
  journals: [],
  holidayDuties: [],
  deletedIds: { agendas: {}, journals: {}, holidayDuties: {} },
  updatedAt: new Date().toISOString()
};

let writeQueue: Promise<void> = Promise.resolve();
const sseClients = new Set<Response>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function sanitizeString(value: unknown, maxLength: number, fallback = ''): string {
  if (typeof value !== 'string') return fallback;
  return value.trim().slice(0, maxLength);
}

function sanitizeOptionalUrl(value: unknown): string | undefined {
  if (typeof value !== 'string' || !value.trim()) return undefined;
  const trimmed = value.trim().slice(0, 500);
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      return parsed.toString();
    }
  } catch {
    return undefined;
  }
  return undefined;
}

function sanitizeIsoTimestamp(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim().slice(0, 64);
  return Number.isNaN(Date.parse(trimmed)) ? fallback : trimmed;
}

function sanitizeDeletedMap(raw: unknown): Record<string, string> {
  if (!isRecord(raw)) return {};
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (SAFE_ID_REGEX.test(k) && typeof v === 'string' && !Number.isNaN(Date.parse(v))) {
      result[k] = v;
    }
  }
  return result;
}

function sanitizeDocuments(rawDocs: unknown): DocumentAttachment[] {
  if (!Array.isArray(rawDocs)) return [];
  const valid: DocumentAttachment[] = [];
  for (const item of rawDocs.slice(0, MAX_DOCS_PER_ITEM)) {
    if (!isRecord(item)) continue;
    const id = sanitizeString(item.id, 120);
    const name = sanitizeString(item.name, 240);
    const type = sanitizeString(item.type, 80);
    const dataUrl = typeof item.dataUrl === 'string' ? item.dataUrl : '';
    const size = typeof item.size === 'number' && Number.isFinite(item.size) && item.size >= 0 ? item.size : 0;
    const uploadedAt = sanitizeIsoTimestamp(item.uploadedAt, new Date().toISOString());

    if (!id || !name) continue;
    const hasAllowedMime = ALLOWED_MIME_TYPES.has(type) || /\.(pdf|png|jpe?g|webp|svg)$/i.test(name);
    if (!hasAllowedMime) continue;
    if (dataUrl.length > MAX_DOC_DATAURL_LENGTH) continue;
    if (dataUrl && !dataUrl.startsWith('data:application/pdf;') && !dataUrl.startsWith('data:image/')) {
      continue;
    }

    valid.push({ id, name, size, type, dataUrl, uploadedAt });
  }
  return valid;
}

function validateAgendaPayload(
  raw: unknown,
  expectedId?: string,
  preserveUpdatedAt = false
): AgendaItem | null {
  if (!isRecord(raw)) return null;
  const id = expectedId || sanitizeString(raw.id, 120);
  if (!SAFE_ID_REGEX.test(id)) return null;

  const title = sanitizeString(raw.title, 300);
  const date = sanitizeString(raw.date, 10);
  const startTime = sanitizeString(raw.startTime, 5);
  const endTime = sanitizeString(raw.endTime, 5);

  if (!title || !DATE_REGEX.test(date) || !TIME_REGEX.test(startTime) || !TIME_REGEX.test(endTime)) {
    return null;
  }

  const reminderRaw = isRecord(raw.reminder) ? raw.reminder : {};
  const minutesBefore =
    typeof reminderRaw.minutesBefore === 'number' &&
    Number.isFinite(reminderRaw.minutesBefore) &&
    reminderRaw.minutesBefore >= 0 &&
    reminderRaw.minutesBefore <= 10080
      ? reminderRaw.minutesBefore
      : 30;

  const nowIso = new Date().toISOString();

  return {
    id,
    title,
    category: sanitizeString(raw.category, 80, 'Rapat Koordinasi') as AgendaItem['category'],
    leader: sanitizeString(raw.leader, 80, 'Pimpinan Utama') as AgendaItem['leader'],
    leaderName: sanitizeString(raw.leaderName, 150, 'Pimpinan'),
    companions: sanitizeString(raw.companions, 400) || undefined,
    date,
    startTime,
    endTime,
    location: sanitizeString(raw.location, 300),
    virtualMeetingUrl: sanitizeOptionalUrl(raw.virtualMeetingUrl),
    dressCode: sanitizeString(raw.dressCode, 160) || undefined,
    priority: sanitizeString(raw.priority, 20, 'Tinggi') as AgendaItem['priority'],
    status: sanitizeString(raw.status, 30, 'Terjadwal') as AgendaItem['status'],
    notes: sanitizeString(raw.notes, 3000) || undefined,
    documents: sanitizeDocuments(raw.documents),
    reminder: {
      enabled: Boolean(reminderRaw.enabled),
      minutesBefore,
      soundEnabled: Boolean(reminderRaw.soundEnabled),
      triggered: Boolean(reminderRaw.triggered),
      lastNotified: typeof reminderRaw.lastNotified === 'string' ? reminderRaw.lastNotified.slice(0, 64) : undefined,
      snoozedUntil:
        typeof reminderRaw.snoozedUntil === 'number' && Number.isFinite(reminderRaw.snoozedUntil)
          ? reminderRaw.snoozedUntil
          : null
    },
    createdAt: sanitizeIsoTimestamp(raw.createdAt, nowIso),
    updatedAt: preserveUpdatedAt ? sanitizeIsoTimestamp(raw.updatedAt, nowIso) : nowIso
  };
}

function validateJournalPayload(
  raw: unknown,
  expectedId?: string,
  preserveUpdatedAt = false
): DailyJournalEntry | null {
  if (!isRecord(raw)) return null;
  const id = expectedId || sanitizeString(raw.id, 120);
  if (!SAFE_ID_REGEX.test(id)) return null;

  const title = sanitizeString(raw.title, 300);
  const date = sanitizeString(raw.date, 10);
  const time = sanitizeString(raw.time, 5);
  const summary = sanitizeString(raw.summary, 6000);
  const reporterName = sanitizeString(raw.reporterName, 150);

  if (!title || !DATE_REGEX.test(date) || !TIME_REGEX.test(time) || !summary || !reporterName) {
    return null;
  }

  const nowIso = new Date().toISOString();

  return {
    id,
    date,
    time,
    title,
    relatedAgendaId: sanitizeString(raw.relatedAgendaId, 120) || undefined,
    relatedAgendaTitle: sanitizeString(raw.relatedAgendaTitle, 300) || undefined,
    leaderName: sanitizeString(raw.leaderName, 150, 'Pimpinan'),
    location: sanitizeString(raw.location, 300, '-'),
    reporterName,
    reporterRole: sanitizeString(raw.reporterRole, 120, 'Petugas Protokol'),
    summary,
    followUp: sanitizeString(raw.followUp, 3000) || undefined,
    outcome: sanitizeString(raw.outcome, 40, 'Lancar & Kondusif') as DailyJournalEntry['outcome'],
    documents: sanitizeDocuments(raw.documents),
    createdAt: sanitizeIsoTimestamp(raw.createdAt, nowIso),
    updatedAt: preserveUpdatedAt ? sanitizeIsoTimestamp(raw.updatedAt, nowIso) : nowIso
  };
}

function validateHolidayDutyPayload(
  raw: unknown,
  expectedId?: string,
  preserveUpdatedAt = false
): HolidayDutyEntry | null {
  if (!isRecord(raw)) return null;
  const id = expectedId || sanitizeString(raw.id, 120);
  if (!SAFE_ID_REGEX.test(id)) return null;

  const date = sanitizeString(raw.date, 10);
  const holidayName = sanitizeString(raw.holidayName, 200);
  const coordinatorName = sanitizeString(raw.coordinatorName, 150);

  if (!DATE_REGEX.test(date) || !holidayName || !coordinatorName) {
    return null;
  }

  const rawOfficers = Array.isArray(raw.officers) ? raw.officers : [];
  const officers: ProtocolOfficer[] = [];
  for (const off of rawOfficers.slice(0, 30)) {
    if (!isRecord(off)) continue;
    const name = sanitizeString(off.name, 150);
    if (!name) continue;
    officers.push({
      id: sanitizeString(off.id, 120, `off-${Date.now()}-${officers.length}`),
      name,
      role: sanitizeString(off.role, 100, 'Petugas Protokol'),
      phone: sanitizeString(off.phone, 40)
    });
  }

  if (officers.length === 0) return null;

  const nowIso = new Date().toISOString();

  return {
    id,
    date,
    holidayName,
    dayType: sanitizeString(raw.dayType, 60, 'Akhir Pekan (Sabtu/Minggu)') as HolidayDutyEntry['dayType'],
    shift: sanitizeString(raw.shift, 60, 'Standby Penuh (24 Jam)') as HolidayDutyEntry['shift'],
    coordinatorName,
    coordinatorPhone: sanitizeString(raw.coordinatorPhone, 40) || undefined,
    officers,
    standbyLocation: sanitizeString(raw.standbyLocation, 250, 'Posko Protokol & On-Call'),
    notes: sanitizeString(raw.notes, 2000) || undefined,
    createdAt: sanitizeIsoTimestamp(raw.createdAt, nowIso),
    updatedAt: preserveUpdatedAt ? sanitizeIsoTimestamp(raw.updatedAt, nowIso) : nowIso
  };
}

function getPublicState() {
  return {
    version: store.version,
    agendas: store.agendas,
    journals: store.journals,
    holidayDuties: store.holidayDuties,
    updatedAt: store.updatedAt
  };
}

async function loadStoreFromDisk(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LiveStoreData>;
    const rawDeleted: Record<string, unknown> = isRecord(parsed.deletedIds) ? parsed.deletedIds : {};
    const isLegacyStore = typeof parsed.version !== 'number' && !isRecord(parsed.deletedIds);

    let loadedAgendas = Array.isArray(parsed.agendas) ? parsed.agendas : INITIAL_AGENDAS;
    let loadedJournals = Array.isArray(parsed.journals) ? parsed.journals : INITIAL_JOURNALS;
    let loadedDuties = Array.isArray(parsed.holidayDuties) ? parsed.holidayDuties : INITIAL_HOLIDAY_DUTIES;

    // Migrate legacy v0 live-store.json (which lacked version/deletedIds) so any unseeded collection matches dummy seed data
    if (isLegacyStore) {
      if (loadedAgendas.length === 0) loadedAgendas = INITIAL_AGENDAS;
      if (loadedJournals.length === 0) loadedJournals = INITIAL_JOURNALS;
      if (loadedDuties.length === 0) loadedDuties = INITIAL_HOLIDAY_DUTIES;
    }

    // Preserve tombstones for any initial dummy items that were intentionally deleted in v1+ live-store.json
    const deletedAgendas = sanitizeDeletedMap(rawDeleted.agendas);
    const deletedJournals = sanitizeDeletedMap(rawDeleted.journals);
    const deletedDuties = sanitizeDeletedMap(rawDeleted.holidayDuties);

    const existingAgendaIds = new Set(loadedAgendas.map((a) => a.id));
    const existingJournalIds = new Set(loadedJournals.map((j) => j.id));
    const existingDutyIds = new Set(loadedDuties.map((d) => d.id));
    const fallbackDeletedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString();

    for (const seed of INITIAL_AGENDAS) {
      if (!existingAgendaIds.has(seed.id) && !deletedAgendas[seed.id]) {
        deletedAgendas[seed.id] = fallbackDeletedAt;
      }
    }
    for (const seed of INITIAL_JOURNALS) {
      if (!existingJournalIds.has(seed.id) && !deletedJournals[seed.id]) {
        deletedJournals[seed.id] = fallbackDeletedAt;
      }
    }
    for (const seed of INITIAL_HOLIDAY_DUTIES) {
      if (!existingDutyIds.has(seed.id) && !deletedDuties[seed.id]) {
        deletedDuties[seed.id] = fallbackDeletedAt;
      }
    }

    store = {
      version: typeof parsed.version === 'number' && Number.isFinite(parsed.version) ? parsed.version : 1,
      agendas: loadedAgendas,
      journals: loadedJournals,
      holidayDuties: loadedDuties,
      deletedIds: {
        agendas: deletedAgendas,
        journals: deletedJournals,
        holidayDuties: deletedDuties
      },
      updatedAt: fallbackDeletedAt
    };

    if (isLegacyStore) {
      await persistStoreToDisk();
    }
  } catch {
    store = {
      version: 1,
      agendas: INITIAL_AGENDAS,
      journals: INITIAL_JOURNALS,
      holidayDuties: INITIAL_HOLIDAY_DUTIES,
      deletedIds: { agendas: {}, journals: {}, holidayDuties: {} },
      updatedAt: new Date().toISOString()
    };
    await persistStoreToDisk();
  }
}

function persistStoreToDisk(): Promise<void> {
  store.version += 1;
  store.updatedAt = new Date().toISOString();
  const payload = JSON.stringify(store);
  const tmpFile = `${DATA_FILE}.tmp`;

  writeQueue = writeQueue
    .then(async () => {
      await fs.mkdir(DATA_DIR, { recursive: true });
      await fs.writeFile(tmpFile, payload, 'utf-8');
      await fs.rename(tmpFile, DATA_FILE);
    })
    .catch((err) => {
      console.error('Failed to persist live store:', err);
    });

  return writeQueue;
}

function broadcastEvent(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(frame);
    } catch {
      sseClients.delete(client);
    }
  }
}

function isNewerThan(candidateIso: string, referenceIso: string): boolean {
  const c = Date.parse(candidateIso);
  const r = Date.parse(referenceIso);
  if (Number.isNaN(c) || Number.isNaN(r)) return false;
  return c > r;
}

async function startServer() {
  await loadStoreFromDisk();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Lightweight version check for fast client reconciliation
  app.get('/api/live/version', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({ version: store.version, updatedAt: store.updatedAt });
  });

  // Authoritative live state fetch
  app.get('/api/live/state', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(getPublicState());
  });

  // Real-time Server-Sent Events (SSE) stream
  app.get('/api/live/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.setHeader('Content-Encoding', 'none');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(
      `event: connected\ndata: ${JSON.stringify({ version: store.version, updatedAt: store.updatedAt })}\n\n`
    );

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 15000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ==================== AGENDAS ROUTES ====================
  app.put('/api/live/agendas/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateAgendaPayload(req.body, id, false);
    if (!item) {
      res.status(400).json({ error: 'Data agenda tidak valid.' });
      return;
    }

    delete store.deletedIds.agendas[item.id];
    const idx = store.agendas.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      store.agendas[idx] = item;
    } else {
      store.agendas = [item, ...store.agendas];
    }

    await persistStoreToDisk();
    broadcastEvent('agenda:upsert', { item, version: store.version });
    res.json({ item, version: store.version, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/agendas/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID agenda tidak valid.' });
      return;
    }

    store.agendas = store.agendas.filter((a) => a.id !== id);
    store.deletedIds.agendas[id] = new Date().toISOString();
    await persistStoreToDisk();
    broadcastEvent('agenda:delete', { id, version: store.version });
    res.json({ id, version: store.version, updatedAt: store.updatedAt });
  });

  // ==================== DAILY JOURNALS ROUTES ====================
  app.put('/api/live/journals/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateJournalPayload(req.body, id, false);
    if (!item) {
      res.status(400).json({ error: 'Data jurnal harian tidak valid.' });
      return;
    }

    delete store.deletedIds.journals[item.id];
    const idx = store.journals.findIndex((j) => j.id === item.id);
    if (idx >= 0) {
      store.journals[idx] = item;
    } else {
      store.journals = [item, ...store.journals];
    }

    await persistStoreToDisk();
    broadcastEvent('journal:upsert', { item, version: store.version });
    res.json({ item, version: store.version, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/journals/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID jurnal tidak valid.' });
      return;
    }

    store.journals = store.journals.filter((j) => j.id !== id);
    store.deletedIds.journals[id] = new Date().toISOString();
    await persistStoreToDisk();
    broadcastEvent('journal:delete', { id, version: store.version });
    res.json({ id, version: store.version, updatedAt: store.updatedAt });
  });

  // ==================== HOLIDAY PROTOCOL DUTIES ROUTES ====================
  app.put('/api/live/duties/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateHolidayDutyPayload(req.body, id, false);
    if (!item) {
      res.status(400).json({ error: 'Data jadwal piket hari libur tidak valid.' });
      return;
    }

    delete store.deletedIds.holidayDuties[item.id];
    const idx = store.holidayDuties.findIndex((d) => d.id === item.id);
    if (idx >= 0) {
      store.holidayDuties[idx] = item;
    } else {
      store.holidayDuties = [...store.holidayDuties, item];
    }

    await persistStoreToDisk();
    broadcastEvent('duty:upsert', { item, version: store.version });
    res.json({ item, version: store.version, updatedAt: store.updatedAt });
  });

  app.post('/api/live/duties/batch', async (req: Request, res: Response) => {
    const rawItems = isRecord(req.body) && Array.isArray(req.body.items) ? req.body.items : [];
    const added: HolidayDutyEntry[] = [];
    const existingIds = new Set(store.holidayDuties.map((d) => d.id));
    const existingDates = new Set(store.holidayDuties.map((d) => d.date));

    for (const raw of rawItems.slice(0, 60)) {
      const valid = validateHolidayDutyPayload(raw, undefined, false);
      if (valid && !existingIds.has(valid.id) && !existingDates.has(valid.date)) {
        delete store.deletedIds.holidayDuties[valid.id];
        store.holidayDuties.push(valid);
        existingIds.add(valid.id);
        existingDates.add(valid.date);
        added.push(valid);
      }
    }

    if (added.length > 0) {
      await persistStoreToDisk();
      broadcastEvent('duty:batch', { items: added, version: store.version });
    }

    res.json({ items: added, version: store.version, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/duties/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID jadwal piket tidak valid.' });
      return;
    }

    store.holidayDuties = store.holidayDuties.filter((d) => d.id !== id);
    store.deletedIds.holidayDuties[id] = new Date().toISOString();
    await persistStoreToDisk();
    broadcastEvent('duty:delete', { id, version: store.version });
    res.json({ id, version: store.version, updatedAt: store.updatedAt });
  });

  // Tombstone-aware, Last-Write-Wins merge for offline reconciliation
  app.post('/api/live/merge', async (req: Request, res: Response) => {
    if (!isRecord(req.body)) {
      res.status(400).json({ error: 'Payload sinkronisasi tidak valid.' });
      return;
    }

    let changed = false;

    if (Array.isArray(req.body.agendas)) {
      const existing = new Map(store.agendas.map((a) => [a.id, a]));
      for (const raw of req.body.agendas.slice(0, 500)) {
        const valid = validateAgendaPayload(raw, undefined, true);
        if (!valid) continue;
        const deletedAt = store.deletedIds.agendas[valid.id];
        if (deletedAt && !isNewerThan(valid.updatedAt, deletedAt)) continue;

        const current = existing.get(valid.id);
        if (!current) {
          delete store.deletedIds.agendas[valid.id];
          store.agendas.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        } else if (isNewerThan(valid.updatedAt, current.updatedAt)) {
          store.agendas = store.agendas.map((a) => (a.id === valid.id ? valid : a));
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (Array.isArray(req.body.journals)) {
      const existing = new Map(store.journals.map((j) => [j.id, j]));
      for (const raw of req.body.journals.slice(0, 500)) {
        const valid = validateJournalPayload(raw, undefined, true);
        if (!valid) continue;
        const deletedAt = store.deletedIds.journals[valid.id];
        if (deletedAt && !isNewerThan(valid.updatedAt, deletedAt)) continue;

        const current = existing.get(valid.id);
        if (!current) {
          delete store.deletedIds.journals[valid.id];
          store.journals.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        } else if (isNewerThan(valid.updatedAt, current.updatedAt)) {
          store.journals = store.journals.map((j) => (j.id === valid.id ? valid : j));
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (Array.isArray(req.body.holidayDuties)) {
      const existing = new Map(store.holidayDuties.map((d) => [d.id, d]));
      for (const raw of req.body.holidayDuties.slice(0, 500)) {
        const valid = validateHolidayDutyPayload(raw, undefined, true);
        if (!valid) continue;
        const deletedAt = store.deletedIds.holidayDuties[valid.id];
        if (deletedAt && !isNewerThan(valid.updatedAt, deletedAt)) continue;

        const current = existing.get(valid.id);
        if (!current) {
          delete store.deletedIds.holidayDuties[valid.id];
          store.holidayDuties.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        } else if (isNewerThan(valid.updatedAt, current.updatedAt)) {
          store.holidayDuties = store.holidayDuties.map((d) => (d.id === valid.id ? valid : d));
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (changed) {
      await persistStoreToDisk();
      broadcastEvent('sync:full', getPublicState());
    }

    res.json(getPublicState());
  });

  // Frontend serving (Vite dev middleware in dev, built dist in production)
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SUBAG TU PIM & PROTOKOL DITJENPAS live server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
