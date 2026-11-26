import { AgendaItem, DailyJournalEntry, HolidayDutyEntry } from '../types/agenda';

const DB_NAME = 'AgendaPimpinanDB';
const DB_VERSION = 4;
const STORE_AGENDAS = 'agendas';
const STORE_JOURNALS = 'journals';
const STORE_HOLIDAY_DUTIES = 'holiday_duties';
const STORE_PENDING_OPS = 'pending_ops';
const STORE_ATTACHMENT_CACHE = 'attachment_cache';

export interface StoredPendingOp {
  opId?: number;
  type:
    | 'agenda:upsert'
    | 'agenda:delete'
    | 'journal:upsert'
    | 'journal:delete'
    | 'duty:upsert'
    | 'duty:batch'
    | 'duty:delete';
  item?: AgendaItem | DailyJournalEntry | HolidayDutyEntry;
  items?: HolidayDutyEntry[];
  id?: string;
  ts: number;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error('IndexedDB tidak didukung pada browser ini.'));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_AGENDAS)) {
        db.createObjectStore(STORE_AGENDAS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_JOURNALS)) {
        db.createObjectStore(STORE_JOURNALS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_HOLIDAY_DUTIES)) {
        db.createObjectStore(STORE_HOLIDAY_DUTIES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_PENDING_OPS)) {
        db.createObjectStore(STORE_PENDING_OPS, { keyPath: 'opId', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(STORE_ATTACHMENT_CACHE)) {
        db.createObjectStore(STORE_ATTACHMENT_CACHE, { keyPath: 'id' });
      }
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = () => {
      reject(request.error);
    };
  });
}

// ==================== AGENDAS ====================

export async function getAllAgendasFromDB(): Promise<AgendaItem[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENDAS, 'readonly');
      const store = tx.objectStore(STORE_AGENDAS);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  } catch (error) {
    console.warn('Gagal membaca dari IndexedDB, fallback ke localStorage:', error);
    const saved = localStorage.getItem('agenda_pimpinan_items');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveAgendasToDB(agendas: AgendaItem[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENDAS, 'readwrite');
      const store = tx.objectStore(STORE_AGENDAS);

      store.clear();
      for (const item of agendas) {
        store.put(item);
      }

      tx.oncomplete = () => {
        try {
          const lightweight = agendas.map(a => ({
            ...a,
            documents: a.documents.map(d => ({
              ...d,
              dataUrl: d.dataUrl.length > 500 ? '' : d.dataUrl
            }))
          }));
          localStorage.setItem('agenda_pimpinan_meta', JSON.stringify(lightweight));
        } catch {
          // ignore localStorage quota limit
        }
        resolve();
      };

      tx.onerror = () => {
        reject(tx.error);
      };
    });
  } catch (error) {
    console.error('Gagal menyimpan ke IndexedDB:', error);
  }
}

export async function saveSingleAgendaToDB(agenda: AgendaItem): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENDAS, 'readwrite');
      const store = tx.objectStore(STORE_AGENDAS);
      store.put(agenda);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menyimpan agenda ke IndexedDB:', error);
  }
}

export async function deleteAgendaFromDB(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_AGENDAS, 'readwrite');
      const store = tx.objectStore(STORE_AGENDAS);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menghapus dari IndexedDB:', error);
  }
}

// ==================== DAILY JOURNALS ====================

export async function getAllJournalsFromDB(): Promise<DailyJournalEntry[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JOURNALS, 'readonly');
      const store = tx.objectStore(STORE_JOURNALS);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Gagal membaca jurnal dari IndexedDB, fallback ke localStorage:', error);
    const saved = localStorage.getItem('agenda_pimpinan_journals');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveJournalsToDB(journals: DailyJournalEntry[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JOURNALS, 'readwrite');
      const store = tx.objectStore(STORE_JOURNALS);

      store.clear();
      for (const item of journals) {
        store.put(item);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menyimpan jurnal ke IndexedDB:', error);
  }
}

export async function saveSingleJournalToDB(journal: DailyJournalEntry): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JOURNALS, 'readwrite');
      const store = tx.objectStore(STORE_JOURNALS);
      store.put(journal);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menyimpan jurnal tunggal ke IndexedDB:', error);
  }
}

export async function deleteJournalFromDB(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_JOURNALS, 'readwrite');
      const store = tx.objectStore(STORE_JOURNALS);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menghapus jurnal dari IndexedDB:', error);
  }
}

// ==================== HOLIDAY PROTOCOL DUTIES ====================

export async function getAllHolidayDutiesFromDB(): Promise<HolidayDutyEntry[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HOLIDAY_DUTIES, 'readonly');
      const store = tx.objectStore(STORE_HOLIDAY_DUTIES);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Gagal membaca piket hari libur dari IndexedDB, fallback ke localStorage:', error);
    const saved = localStorage.getItem('agenda_pimpinan_holiday_duties');
    return saved ? JSON.parse(saved) : [];
  }
}

export async function saveHolidayDutiesToDB(duties: HolidayDutyEntry[]): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HOLIDAY_DUTIES, 'readwrite');
      const store = tx.objectStore(STORE_HOLIDAY_DUTIES);

      store.clear();
      for (const item of duties) {
        store.put(item);
      }

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menyimpan piket hari libur ke IndexedDB:', error);
  }
}

export async function saveSingleHolidayDutyToDB(duty: HolidayDutyEntry): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HOLIDAY_DUTIES, 'readwrite');
      const store = tx.objectStore(STORE_HOLIDAY_DUTIES);
      store.put(duty);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menyimpan piket hari libur tunggal ke IndexedDB:', error);
  }
}

export async function deleteHolidayDutyFromDB(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_HOLIDAY_DUTIES, 'readwrite');
      const store = tx.objectStore(STORE_HOLIDAY_DUTIES);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menghapus piket hari libur dari IndexedDB:', error);
  }
}

// ==================== PENDING SYNC QUEUE (SUPPORTS LARGE ATTACHMENTS) ====================

export async function getAllPendingOpsFromDB(): Promise<StoredPendingOp[]> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_OPS, 'readonly');
      const store = tx.objectStore(STORE_PENDING_OPS);
      const request = store.getAll();

      request.onsuccess = () => {
        const items = (request.result || []) as StoredPendingOp[];
        items.sort((a, b) => (a.opId || 0) - (b.opId || 0));
        resolve(items);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('Gagal membaca antrean sinkronisasi dari IndexedDB:', error);
    return [];
  }
}

export async function addPendingOpToDB(op: Omit<StoredPendingOp, 'opId'>): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_OPS, 'readwrite');
      const store = tx.objectStore(STORE_PENDING_OPS);
      store.add(op);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menambahkan antrean sinkronisasi ke IndexedDB:', error);
  }
}

export async function deletePendingOpFromDB(opId: number): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_PENDING_OPS, 'readwrite');
      const store = tx.objectStore(STORE_PENDING_OPS);
      store.delete(opId);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error('Gagal menghapus antrean sinkronisasi dari IndexedDB:', error);
  }
}

// ==================== ATTACHMENT DATA CACHE ====================

export async function getCachedAttachmentDataUrl(id: string): Promise<string | null> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENT_CACHE, 'readonly');
      const store = tx.objectStore(STORE_ATTACHMENT_CACHE);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as { id: string; dataUrl: string } | undefined;
        resolve(result?.dataUrl || null);
      };
      request.onerror = () => reject(request.error);
    });
  } catch {
    return null;
  }
}

export async function saveCachedAttachmentDataUrl(id: string, dataUrl: string): Promise<void> {
  if (!id || !dataUrl) return;
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENT_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_ATTACHMENT_CACHE);
      store.put({ id, dataUrl });

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.warn('Gagal menyimpan cache lampiran ke IndexedDB:', error);
  }
}

export async function deleteCachedAttachmentDataUrl(id: string): Promise<void> {
  try {
    const db = await openDatabase();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_ATTACHMENT_CACHE, 'readwrite');
      const store = tx.objectStore(STORE_ATTACHMENT_CACHE);
      store.delete(id);

      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore cache cleanup error
  }
}
