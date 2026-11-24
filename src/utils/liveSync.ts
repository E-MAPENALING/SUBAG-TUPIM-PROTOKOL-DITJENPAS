import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';

export interface LiveSyncPayload {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
  updatedAt: string;
}

export interface LiveEventHandlers {
  onAgendaUpsert: (item: AgendaItem) => void;
  onAgendaDelete: (id: string) => void;
  onJournalUpsert: (item: DailyJournalEntry) => void;
  onJournalDelete: (id: string) => void;
  onDutyUpsert: (item: HolidayDutyEntry) => void;
  onDutyBatch: (items: HolidayDutyEntry[]) => void;
  onDutyDelete: (id: string) => void;
  onFullSync: (state: LiveSyncPayload) => void;
  onReconnect: () => void;
}

export async function fetchLiveState(): Promise<LiveSyncPayload> {
  const res = await fetch('/api/live/state', { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Live state fetch failed (${res.status})`);
  }
  return (await res.json()) as LiveSyncPayload;
}

export async function mergeLocalWithLive(local: {
  agendas: AgendaItem[];
  journals: DailyJournalEntry[];
  holidayDuties: HolidayDutyEntry[];
}): Promise<LiveSyncPayload> {
  const res = await fetch('/api/live/merge', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(local)
  });
  if (!res.ok) {
    throw new Error(`Live merge failed (${res.status})`);
  }
  return (await res.json()) as LiveSyncPayload;
}

export async function syncAgendaUpsert(item: AgendaItem): Promise<void> {
  const res = await fetch(`/api/live/agendas/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) {
    throw new Error(`Agenda sync failed (${res.status})`);
  }
}

export async function syncAgendaDelete(id: string): Promise<void> {
  const res = await fetch(`/api/live/agendas/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Agenda delete sync failed (${res.status})`);
  }
}

export async function syncJournalUpsert(item: DailyJournalEntry): Promise<void> {
  const res = await fetch(`/api/live/journals/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) {
    throw new Error(`Journal sync failed (${res.status})`);
  }
}

export async function syncJournalDelete(id: string): Promise<void> {
  const res = await fetch(`/api/live/journals/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Journal delete sync failed (${res.status})`);
  }
}

export async function syncDutyUpsert(item: HolidayDutyEntry): Promise<void> {
  const res = await fetch(`/api/live/duties/${encodeURIComponent(item.id)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item)
  });
  if (!res.ok) {
    throw new Error(`Holiday duty sync failed (${res.status})`);
  }
}

export async function syncDutyBatch(items: HolidayDutyEntry[]): Promise<void> {
  const res = await fetch('/api/live/duties/batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ items })
  });
  if (!res.ok) {
    throw new Error(`Holiday duty batch sync failed (${res.status})`);
  }
}

export async function syncDutyDelete(id: string): Promise<void> {
  const res = await fetch(`/api/live/duties/${encodeURIComponent(id)}`, {
    method: 'DELETE'
  });
  if (!res.ok) {
    throw new Error(`Holiday duty delete sync failed (${res.status})`);
  }
}

export function subscribeLiveUpdates(handlers: LiveEventHandlers): () => void {
  if (typeof window === 'undefined' || typeof EventSource === 'undefined') {
    return () => {};
  }

  let closed = false;
  let hasConnectedOnce = false;
  let source: EventSource | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  const connect = () => {
    if (closed) return;
    source = new EventSource('/api/live/stream');

    source.addEventListener('connected', () => {
      if (hasConnectedOnce) {
        handlers.onReconnect();
      }
      hasConnectedOnce = true;
    });

    source.addEventListener('agenda:upsert', (ev) => {
      try {
        handlers.onAgendaUpsert(JSON.parse((ev as MessageEvent).data) as AgendaItem);
      } catch (err) {
        console.warn('Invalid agenda:upsert payload:', err);
      }
    });

    source.addEventListener('agenda:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string };
        if (parsed?.id) handlers.onAgendaDelete(parsed.id);
      } catch (err) {
        console.warn('Invalid agenda:delete payload:', err);
      }
    });

    source.addEventListener('journal:upsert', (ev) => {
      try {
        handlers.onJournalUpsert(JSON.parse((ev as MessageEvent).data) as DailyJournalEntry);
      } catch (err) {
        console.warn('Invalid journal:upsert payload:', err);
      }
    });

    source.addEventListener('journal:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string };
        if (parsed?.id) handlers.onJournalDelete(parsed.id);
      } catch (err) {
        console.warn('Invalid journal:delete payload:', err);
      }
    });

    source.addEventListener('duty:upsert', (ev) => {
      try {
        handlers.onDutyUpsert(JSON.parse((ev as MessageEvent).data) as HolidayDutyEntry);
      } catch (err) {
        console.warn('Invalid duty:upsert payload:', err);
      }
    });

    source.addEventListener('duty:batch', (ev) => {
      try {
        const items = JSON.parse((ev as MessageEvent).data) as HolidayDutyEntry[];
        if (Array.isArray(items)) handlers.onDutyBatch(items);
      } catch (err) {
        console.warn('Invalid duty:batch payload:', err);
      }
    });

    source.addEventListener('duty:delete', (ev) => {
      try {
        const parsed = JSON.parse((ev as MessageEvent).data) as { id: string };
        if (parsed?.id) handlers.onDutyDelete(parsed.id);
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
          connect();
        }, 3000);
      }
    };
  };

  connect();

  return () => {
    closed = true;
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (source) source.close();
  };
}
