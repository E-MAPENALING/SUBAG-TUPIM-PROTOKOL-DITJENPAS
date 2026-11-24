import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createServer as createViteServer } from 'vite';
import type {
  AgendaItem,
  DailyJournalEntry,
  DocumentAttachment,
  HolidayDutyEntry,
  ProtocolOfficer
} from './src/types/agenda.ts';
import { INITIAL_AGENDAS } from './src/data/initialAgendas.ts';
import { INITIAL_JOURNALS, INITIAL_HOLIDAY_DUTIES } from './src/data/initialJournalAndDuty.ts';

interface LiveStoreData {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
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
  agendas: [],
  journals: [],
  holidayDuties: [],
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
    const uploadedAt = sanitizeString(item.uploadedAt, 64, new Date().toISOString());

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

function validateAgendaPayload(raw: unknown, expectedId?: string): AgendaItem | null {
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
    createdAt: sanitizeString(raw.createdAt, 64, nowIso),
    updatedAt: nowIso
  };
}

function validateJournalPayload(raw: unknown, expectedId?: string): DailyJournalEntry | null {
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
    createdAt: sanitizeString(raw.createdAt, 64, nowIso),
    updatedAt: nowIso
  };
}

function validateHolidayDutyPayload(raw: unknown, expectedId?: string): HolidayDutyEntry | null {
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
    createdAt: sanitizeString(raw.createdAt, 64, nowIso),
    updatedAt: nowIso
  };
}

async function loadStoreFromDisk(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<LiveStoreData>;
    store = {
      agendas: Array.isArray(parsed.agendas) ? parsed.agendas : INITIAL_AGENDAS,
      journals: Array.isArray(parsed.journals) ? parsed.journals : INITIAL_JOURNALS,
      holidayDuties: Array.isArray(parsed.holidayDuties) ? parsed.holidayDuties : INITIAL_HOLIDAY_DUTIES,
      updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date().toISOString()
    };
  } catch {
    store = {
      agendas: INITIAL_AGENDAS,
      journals: INITIAL_JOURNALS,
      holidayDuties: INITIAL_HOLIDAY_DUTIES,
      updatedAt: new Date().toISOString()
    };
    await persistStoreToDisk();
  }
}

function persistStoreToDisk(): Promise<void> {
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

async function startServer() {
  await loadStoreFromDisk();

  const app = express();
  app.use(express.json({ limit: '50mb' }));

  // Health & full live state fetch
  app.get('/api/live/state', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(store);
  });

  // Real-time Server-Sent Events (SSE) stream
  app.get('/api/live/stream', (req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();

    sseClients.add(res);
    res.write(`event: connected\ndata: ${JSON.stringify({ updatedAt: store.updatedAt })}\n\n`);

    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
      } catch {
        clearInterval(heartbeat);
        sseClients.delete(res);
      }
    }, 25000);

    req.on('close', () => {
      clearInterval(heartbeat);
      sseClients.delete(res);
    });
  });

  // ==================== AGENDAS ROUTES ====================
  app.put('/api/live/agendas/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateAgendaPayload(req.body, id);
    if (!item) {
      res.status(400).json({ error: 'Data agenda tidak valid.' });
      return;
    }

    const idx = store.agendas.findIndex((a) => a.id === item.id);
    if (idx >= 0) {
      store.agendas[idx] = item;
    } else {
      store.agendas = [item, ...store.agendas];
    }

    await persistStoreToDisk();
    broadcastEvent('agenda:upsert', item);
    res.json({ item, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/agendas/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID agenda tidak valid.' });
      return;
    }

    store.agendas = store.agendas.filter((a) => a.id !== id);
    await persistStoreToDisk();
    broadcastEvent('agenda:delete', { id });
    res.json({ id, updatedAt: store.updatedAt });
  });

  // ==================== DAILY JOURNALS ROUTES ====================
  app.put('/api/live/journals/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateJournalPayload(req.body, id);
    if (!item) {
      res.status(400).json({ error: 'Data jurnal harian tidak valid.' });
      return;
    }

    const idx = store.journals.findIndex((j) => j.id === item.id);
    if (idx >= 0) {
      store.journals[idx] = item;
    } else {
      store.journals = [item, ...store.journals];
    }

    await persistStoreToDisk();
    broadcastEvent('journal:upsert', item);
    res.json({ item, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/journals/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID jurnal tidak valid.' });
      return;
    }

    store.journals = store.journals.filter((j) => j.id !== id);
    await persistStoreToDisk();
    broadcastEvent('journal:delete', { id });
    res.json({ id, updatedAt: store.updatedAt });
  });

  // ==================== HOLIDAY PROTOCOL DUTIES ROUTES ====================
  app.put('/api/live/duties/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    const item = validateHolidayDutyPayload(req.body, id);
    if (!item) {
      res.status(400).json({ error: 'Data jadwal piket hari libur tidak valid.' });
      return;
    }

    const idx = store.holidayDuties.findIndex((d) => d.id === item.id);
    if (idx >= 0) {
      store.holidayDuties[idx] = item;
    } else {
      store.holidayDuties = [...store.holidayDuties, item];
    }

    await persistStoreToDisk();
    broadcastEvent('duty:upsert', item);
    res.json({ item, updatedAt: store.updatedAt });
  });

  app.post('/api/live/duties/batch', async (req: Request, res: Response) => {
    const rawItems = isRecord(req.body) && Array.isArray(req.body.items) ? req.body.items : [];
    const added: HolidayDutyEntry[] = [];
    const existingIds = new Set(store.holidayDuties.map((d) => d.id));
    const existingDates = new Set(store.holidayDuties.map((d) => d.date));

    for (const raw of rawItems.slice(0, 60)) {
      const valid = validateHolidayDutyPayload(raw);
      if (valid && !existingIds.has(valid.id) && !existingDates.has(valid.date)) {
        store.holidayDuties.push(valid);
        existingIds.add(valid.id);
        existingDates.add(valid.date);
        added.push(valid);
      }
    }

    if (added.length > 0) {
      await persistStoreToDisk();
      broadcastEvent('duty:batch', added);
    }

    res.json({ items: added, updatedAt: store.updatedAt });
  });

  app.delete('/api/live/duties/:id', async (req: Request, res: Response) => {
    const id = req.params.id;
    if (!SAFE_ID_REGEX.test(id)) {
      res.status(400).json({ error: 'ID jadwal piket tidak valid.' });
      return;
    }

    store.holidayDuties = store.holidayDuties.filter((d) => d.id !== id);
    await persistStoreToDisk();
    broadcastEvent('duty:delete', { id });
    res.json({ id, updatedAt: store.updatedAt });
  });

  // Merge offline/local records that don't yet exist on the live server
  app.post('/api/live/merge', async (req: Request, res: Response) => {
    if (!isRecord(req.body)) {
      res.status(400).json({ error: 'Payload sinkronisasi tidak valid.' });
      return;
    }

    let changed = false;

    if (Array.isArray(req.body.agendas)) {
      const existing = new Map(store.agendas.map((a) => [a.id, a]));
      for (const raw of req.body.agendas.slice(0, 500)) {
        const valid = validateAgendaPayload(raw);
        if (!valid) continue;
        const current = existing.get(valid.id);
        if (!current) {
          store.agendas.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (Array.isArray(req.body.journals)) {
      const existing = new Map(store.journals.map((j) => [j.id, j]));
      for (const raw of req.body.journals.slice(0, 500)) {
        const valid = validateJournalPayload(raw);
        if (!valid) continue;
        if (!existing.has(valid.id)) {
          store.journals.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (Array.isArray(req.body.holidayDuties)) {
      const existing = new Map(store.holidayDuties.map((d) => [d.id, d]));
      for (const raw of req.body.holidayDuties.slice(0, 500)) {
        const valid = validateHolidayDutyPayload(raw);
        if (!valid) continue;
        if (!existing.has(valid.id)) {
          store.holidayDuties.push(valid);
          existing.set(valid.id, valid);
          changed = true;
        }
      }
    }

    if (changed) {
      await persistStoreToDisk();
      broadcastEvent('sync:full', store);
    }

    res.json(store);
  });

  // Frontend serving (Vite dev middleware or built dist in production)
  if (process.env.NODE_ENV !== 'production') {
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
