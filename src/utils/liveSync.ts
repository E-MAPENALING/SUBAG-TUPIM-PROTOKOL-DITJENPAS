import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';
import {
  addPendingOpToDB,
  deletePendingOpFromDB,
  getAllPendingOpsFromDB,
  StoredPendingOp
} from './indexedDb';

export interface LiveSyncPayload {
  version: number;
  syncToken?: string;
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  updatedAt: string;
}

export interface LiveVersionPayload {
  version: number;
  syncToken?: string;
  updatedAt: string;
}

export type PendingOp =
  | { type: 'agenda:upsert'; item: AgendaItem; ts: number }
  | { type: 'agenda:delete'; id: string; ts: number }
  | { type: 'journal:upsert'; item: DailyJournalEntry; ts: number }
  | { type: 'journal:delete'; id: string; ts: number }
  | { type: 'duty:upsert'; item: HolidayDutyEntry; ts: number }
  | { type: 'duty:batch'; items: HolidayDutyEntry[]; ts: number }
  | { type: 'duty:delete'; id: string; ts: number };

const LEGACY_PENDING_OPS_KEY = 'subag_tu_pim_pending_ops_v1';
const SYNC_CHANNEL_NAME = 'subag_tu_pim_live_sync_v1';

export interface LiveEventHandlers {
  onAgendaUpsert: (item: AgendaItem, version?: number) => void;
  onAgendaDelete: (id: string, version?: number) => void;
  onJournalUpsert: (item: DailyJournalEntry, version?: number) => void;
  onJournalDelete: (id: string, version?: number) => void;
  onDutyUpsert: (item: HolidayDutyEntry, version?: number) => void;
  onDutyBatch: (items: HolidayDutyEntry[], version?: number) => void;
  onDutyDelete: (id: string, version?: number) => void;
  onFullSync: (state: LiveSyncPayload) => void;
  onServerVersionChanged: (tokenOrVersion: string) => void;
}

let inFlightMutations = 0;
let flushInFlight: Promise<boolean> | null = null;

export function hasInFlightMutations(): boolean {
  return inFlightMutations > 0 || flushInFlight !== null;
}

async function withMutationTracking<T>(fn: () => Promise<T>): Promise<T> {
  inFlightMutations += 1;
  try {
    return await fn();
  } finally {
    inFlightMutations = Math.max(0, inFlightMutations - 1);
  }
}

// ==================== PENDING OFFLINE QUEUE (INDEXEDDB) ====================

async function migrateLegacyLocalStorageOps(): Promise<void> {
  try {
    const raw = localStorage.getItem(LEGACY_PENDING_OPS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      for (const op of parsed as PendingOp[]) {
        await addPendingOpToDB(op as Omit<StoredPendingOp, 'opId'>);
      }
    }
    localStorage.removeItem(LEGACY_PENDING_OPS_KEY);
  } catch {
    // ignore storage access errors
  }
}

export async function enqueuePendingOp(op: PendingOp): Promise<void> {
  await addPendingOpToDB(op as Omit<StoredPendingOp, 'opId'>);
}

export async function flushPendingOps(): Promise<boolean> {
  if (flushInFlight) {
    return flushInFlight;
  }

  flushInFlight = (async () => {
    await migrateLegacyLocalStorageOps();
    const ops = await getAllPendingOpsFromDB();
    if (ops.length === 0) return true;

    let allSucceeded = true;

    for (const op of ops) {
      try {
        switch (op.type) {
          case 'agenda:upsert':
            if (op.item) await syncAgendaUpsert(op.item as AgendaItem);
            break;
          case 'agenda:delete':
            if (op.id) await syncAgendaDelete(op.id);
            break;
          case 'journal:upsert':
            if (op.item) await syncJournalUpsert(op.item as DailyJournalEntry);
            break;
          case 'journal:delete':
            if (op.id) await syncJournalDelete(op.id);
            break;
          case 'duty:upsert':
            if (op.item) await syncDutyUpsert(op.item as HolidayDutyEntry);
            break;
          case 'duty:batch':
            if (op.items) await syncDutyBatch(op.items);
            break;
          case 'duty:delete':
            if (op.id) await syncDutyDelete(op.id);
            break;
        }
        if (typeof op.opId === 'number') {
          await deletePendingOpFromDB(op.opId);
        }
      } catch {
        allSucceeded = false;
        break;
      }
    }

    return allSucceeded;
  })().finally(() => {
    flushInFlight = null;
  });

  return flushInFlight;
}

// ==================== SAME-BROWSER TAB SYNC ====================

export function notifyOtherTabs(reason: string): void {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  try {
    const channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
    channel.postMessage({ reason, at: Date.now() });
    channel.close();
  } catch {
    // ignore unsupported environments
  }
}

// ==================== LIVE REST API (MOBILE + DESKTOP CACHE-SAFE) ====================

export async function fetchLiveVersion(): Promise<LiveVersionPayload> {
  const res = await fetch(`/api/live/version?_t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) {
    throw new Error(`Live version check failed (${res.status})`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Live version endpoint returned non-JSON response');
  }
  return (await res.json()) as LiveVersionPayload;
}

export async function fetchLiveState(): Promise<LiveSyncPayload> {
  const res = await fetch(`/api/live/state?_t=${Date.now()}`, {
    cache: 'no-store',
    credentials: 'include',
    headers: { 'Cache-Control': 'no-cache' }
  });
  if (!res.ok) {
    throw new Error(`Live state fetch failed (${res.status})`);
  }
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    throw new Error('Live state endpoint returned non-JSON response');
  }
  return (await res.json()) as LiveSyncPayload;
}

export async function mergeLiveState(localData: {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  forceRestore?: boolean;
}): Promise<LiveSyncPayload> {
  return withMutationTracking(async () => {
    const res = await fetch('/api/live/merge', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
      body: JSON.stringify(localData)
    });
    if (!res.ok) {
      throw new Error(`Live state merge failed (${res.status})`);
    }
    const data = (await res.json()) as LiveSyncPayload;
    notifyOtherTabs('sync:merge');
    return data;
  });
}

export async function syncAgendaUpsert(
  item: AgendaItem
): Promise<{ item: AgendaItem; version?: number }> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/agendas/${encodeURIComponent(item.id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(`Agenda sync failed (${res.status})`);
    }
    const data = (await res.json()) as { item?: AgendaItem; version?: number };
    notifyOtherTabs('agenda:upsert');
    return { item: data.item || item, version: data.version };
  });
}

export async function syncAgendaDelete(id: string): Promise<number | undefined> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/agendas/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      throw new Error(`Agenda delete sync failed (${res.status})`);
    }
    const data = (await res.json()) as { version?: number };
    notifyOtherTabs('agenda:delete');
    return data.version;
  });
}

export async function syncJournalUpsert(
  item: DailyJournalEntry
): Promise<{ item: DailyJournalEntry; version?: number }> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/journals/${encodeURIComponent(item.id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(`Journal sync failed (${res.status})`);
    }
    const data = (await res.json()) as { item?: DailyJournalEntry; version?: number };
    notifyOtherTabs('journal:upsert');
    return { item: data.item || item, version: data.version };
  });
}

export async function syncJournalDelete(id: string): Promise<number | undefined> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/journals/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      throw new Error(`Journal delete sync failed (${res.status})`);
    }
    const data = (await res.json()) as { version?: number };
    notifyOtherTabs('journal:delete');
    return data.version;
  });
}

export async function syncDutyUpsert(
  item: HolidayDutyEntry
): Promise<{ item: HolidayDutyEntry; version?: number }> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/duties/${encodeURIComponent(item.id)}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    });
    if (!res.ok) {
      throw new Error(`Holiday duty sync failed (${res.status})`);
    }
    const data = (await res.json()) as { item?: HolidayDutyEntry; version?: number };
    notifyOtherTabs('duty:upsert');
    return { item: data.item || item, version: data.version };
  });
}

export async function syncDutyBatch(
  items: HolidayDutyEntry[]
): Promise<{ items: HolidayDutyEntry[]; version?: number }> {
  return withMutationTracking(async () => {
    const res = await fetch('/api/live/duties/batch', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });
    if (!res.ok) {
      throw new Error(`Holiday duty batch sync failed (${res.status})`);
    }
    const data = (await res.json()) as { items?: HolidayDutyEntry[]; version?: number };
    notifyOtherTabs('duty:batch');
    return { items: data.items || items, version: data.version };
  });
}

export async function syncDutyDelete(id: string): Promise<number | undefined> {
  return withMutationTracking(async () => {
    const res = await fetch(`/api/live/duties/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    if (!res.ok) {
      throw new Error(`Holiday duty delete sync failed (${res.status})`);
    }
    const data = (await res.json()) as { version?: number };
    notifyOtherTabs('duty:delete');
    return data.version;
  });
}

// ==================== REAL-TIME SUBSCRIPTION (SSE + BROADCAST + MOBILE-SAFE POLLING) ====================

export function subscribeLiveUpdates(
  handlers: LiveEventHandlers,
  getCurrentSyncToken: () => string
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  let closed = false;
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let channel: BroadcastChannel | null = null;

  const checkVersionAndSync = async () => {
    if (closed || document.visibilityState === 'hidden' || hasInFlightMutations()) return;
    try {
      await flushPendingOps();
      const payload = await fetchLiveVersion();
      const remoteToken = payload.syncToken || `${payload.version}:${payload.updatedAt}`;
      if (!closed && !hasInFlightMutations() && remoteToken !== getCurrentSyncToken()) {
        handlers.onServerVersionChanged(remoteToken);
      }
    } catch {
      // ignore transient offline errors
    }
  };

  const connectSse = () => {
    if (closed || typeof EventSource === 'undefined') return;
    if (source && source.readyState !== EventSource.CLOSED) return;

    try {
      source = new EventSource('/api/live/stream', { withCredentials: true });
    } catch {
      source = new EventSource('/api/live/stream');
    }

    source.addEventListener('connected', (ev) => {
      try {
        const payload = JSON.parse((ev as MessageEvent).data) as {
          version?: number;
          syncToken?: string;
          updatedAt?: string;
        };
        const remoteToken =
          payload.syncToken ||
          (typeof payload.version === 'number' ? `${payload.version}:${payload.updatedAt || ''}` : '');
        flushPendingOps()
          .then(() => {
            if (
              !closed &&
              !hasInFlightMutations() &&
              remoteToken &&
              remoteToken !== getCurrentSyncToken()
            ) {
              handlers.onServerVersionChanged(remoteToken);
            }
          })
          .catch(() => {});
      } catch {
        // ignore parse errors
      }
    });

    source.addEventListener('agenda:upsert', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { item?: AgendaItem; version?: number } & AgendaItem;
        const item = data.item || data;
        if (item?.id) handlers.onAgendaUpsert(item, data.version);
      } catch (err) {
        console.warn('Invalid agenda:upsert payload:', err);
      }
    });

    source.addEventListener('agenda:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string; version?: number };
        if (parsed?.id) handlers.onAgendaDelete(parsed.id, parsed.version);
      } catch (err) {
        console.warn('Invalid agenda:delete payload:', err);
      }
    });

    source.addEventListener('journal:upsert', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { item?: DailyJournalEntry; version?: number } & DailyJournalEntry;
        const item = data.item || data;
        if (item?.id) handlers.onJournalUpsert(item, data.version);
      } catch (err) {
        console.warn('Invalid journal:upsert payload:', err);
      }
    });

    source.addEventListener('journal:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string; version?: number };
        if (parsed?.id) handlers.onJournalDelete(parsed.id, parsed.version);
      } catch (err) {
        console.warn('Invalid journal:delete payload:', err);
      }
    });

    source.addEventListener('duty:upsert', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { item?: HolidayDutyEntry; version?: number } & HolidayDutyEntry;
        const item = data.item || data;
        if (item?.id) handlers.onDutyUpsert(item, data.version);
      } catch (err) {
        console.warn('Invalid duty:upsert payload:', err);
      }
    });

    source.addEventListener('duty:batch', (ev) => {
      try {
        const data = JSON.parse((ev as MessageEvent).data) as { items?: HolidayDutyEntry[]; version?: number } | HolidayDutyEntry[];
        const items = Array.isArray(data) ? data : data.items;
        const version = Array.isArray(data) ? undefined : data.version;
        if (Array.isArray(items)) handlers.onDutyBatch(items, version);
      } catch (err) {
        console.warn('Invalid duty:batch payload:', err);
      }
    });

    source.addEventListener('duty:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string; version?: number };
        if (parsed?.id) handlers.onDutyDelete(parsed.id, parsed.version);
      } catch (err) {
        console.warn('Invalid duty:delete payload:', err);
      }
    });

    source.addEventListener('sync:full', (ev) => {
      try {
        handlers.onFullSync(JSON.parse((ev as MessageEvent).data) as LiveSyncPayload);
      } catch (err) {
        console.warn('Invalid sync:full payload:', err);
      }
    });

    source.onerror = () => {
      if (source) {
        source.close();
        source = null;
      }
      if (!closed && !reconnectTimer) {
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connectSse();
        }, 3000);
      }
    };
  };

  connectSse();

  // Same-browser tab synchronization via BroadcastChannel
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(SYNC_CHANNEL_NAME);
      channel.onmessage = () => {
        checkVersionAndSync();
      };
    } catch {
      // ignore unsupported environments
    }
  }

  // Reconcile automatically when mobile/desktop tab wakes up, regains focus, or comes online
  const handleWake = () => {
    if (document.visibilityState === 'visible') {
      if (!source || source.readyState === EventSource.CLOSED) {
        connectSse();
      }
      checkVersionAndSync();
    }
  };
  const handleOnline = () => {
    if (!source || source.readyState === EventSource.CLOSED) {
      connectSse();
    }
    flushPendingOps().finally(() => checkVersionAndSync());
  };

  window.addEventListener('focus', handleWake);
  window.addEventListener('pageshow', handleWake);
  document.addEventListener('visibilitychange', handleWake);
  window.addEventListener('online', handleOnline);

  // Fast lightweight 3s version check for seamless HP <-> Komputer sync even if proxy buffers SSE
  const versionInterval = setInterval(checkVersionAndSync, 3000);

  return () => {
    closed = true;
    clearInterval(versionInterval);
    window.removeEventListener('focus', handleWake);
    window.removeEventListener('pageshow', handleWake);
    document.removeEventListener('visibilitychange', handleWake);
    window.removeEventListener('online', handleOnline);
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (source) source.close();
    if (channel) channel.close();
  };
}
