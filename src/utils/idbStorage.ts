/**
 * IndexedDB-backed storage for Zustand persist.
 * Handles larger datasets and avoids localStorage ~5MB limit.
 */

const DB_NAME = 'memory-atlas-db';
const STORE_NAME = 'persist';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME, { keyPath: 'key' });
    };
  });
}

function getItemFromIdb(key: string): Promise<string | null> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const row = req.result;
          resolve(row?.value ?? null);
        };
        tx.oncomplete = () => db.close();
      })
  );
}

function setItemInIdb(key: string, value: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put({ key, value });
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
      })
  );
}

function removeItemFromIdb(key: string): Promise<void> {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.delete(key);
        req.onerror = () => reject(req.error);
        req.onsuccess = () => resolve();
        tx.oncomplete = () => db.close();
      })
  );
}

/** One-time migration: if Idb is empty, copy from localStorage then remove. */
export const STORAGE_KEY = 'memory-atlas-storage';

function migrateFromLocalStorage(): Promise<string | null> {
  return getItemFromIdb(STORAGE_KEY).then((idbValue) => {
    if (idbValue != null && idbValue !== '') return idbValue;
    try {
      const local = localStorage.getItem(STORAGE_KEY);
      if (local != null && local !== '') {
        return setItemInIdb(STORAGE_KEY, local).then(() => {
          try {
            localStorage.removeItem(STORAGE_KEY);
          } catch {
            /* ignore */
          }
          return local;
        });
      }
    } catch {
      /* ignore */
    }
    return idbValue;
  });
}

/** Returns persisted state string (after migration) for flash prevention. Use before first paint. */
export function getPersistedStateForFlashPrevention(): Promise<string | null> {
  return migrateFromLocalStorage();
}

export interface StateStorage {
  getItem: (name: string) => Promise<string | null> | string | null;
  setItem: (name: string, value: string) => Promise<void> | void;
  removeItem: (name: string) => Promise<void> | void;
}

export const idbStorage: StateStorage = {
  getItem: (name: string): Promise<string | null> => {
    if (name !== STORAGE_KEY) return getItemFromIdb(name);
    return migrateFromLocalStorage();
  },
  setItem: (name: string, value: string): Promise<void> => setItemInIdb(name, value),
  removeItem: (name: string): Promise<void> => removeItemFromIdb(name),
};
