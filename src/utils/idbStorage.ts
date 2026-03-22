/**
 * IndexedDB-backed storage for Zustand persist.
 * Handles larger datasets and avoids localStorage ~5MB limit.
 */

const DB_NAME = 'memory-atlas-db';
const STORE_NAME = 'persist';
const HANDLES_STORE = 'handles';
export const VAULT_ROOT_HANDLE_KEY = 'vault-root-directory';

const DB_VERSION = 2;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (event) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
      if (event.oldVersion < 2 && !db.objectStoreNames.contains(HANDLES_STORE)) {
        db.createObjectStore(HANDLES_STORE);
      }
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

/** Persist File System Access API directory handle (Chromium) for vault sync. */
export async function saveVaultRootDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    const req = store.put(handle, VAULT_ROOT_HANDLE_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}

export async function getVaultRootDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readonly');
    const store = tx.objectStore(HANDLES_STORE);
    const req = store.get(VAULT_ROOT_HANDLE_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => {
      const v = req.result;
      resolve(v && typeof v === 'object' ? (v as FileSystemDirectoryHandle) : null);
    };
    tx.oncomplete = () => db.close();
  });
}

export async function clearVaultRootDirectoryHandle(): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(HANDLES_STORE, 'readwrite');
    const store = tx.objectStore(HANDLES_STORE);
    const req = store.delete(VAULT_ROOT_HANDLE_KEY);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve();
    tx.oncomplete = () => db.close();
  });
}
