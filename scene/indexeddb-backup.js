// scene/indexeddb-backup.js
// IndexedDB-based automatic backup for boards. localStorage is limited to ~5-10 MB,
// which fills up quickly with image-heavy diagrams. IndexedDB offers hundreds of MB
// and is the right place for automatic, invisible backups of classroom lessons.

export const IDB_NAME = 'StudioBoardBackups';
export const IDB_VERSION = 1;
export const IDB_STORE = 'backups';
export const MAX_BACKUPS = 100;

let _db = null;
let _dbReady = null;
let _dbInitPromise = null;

function _initDB() {
  if (_dbInitPromise) return _dbInitPromise;
  _dbInitPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB not available'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = (ev) => {
      const db = req.result;
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
    req.onsuccess = () => {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = () => reject(req.error);
  });
  return _dbInitPromise;
}

async function _ensureDB() {
  if (!_db) await _initDB();
  return _db;
}

export class IndexedDBBackup {
  constructor() {
    this._autoSaveTimer = null;
    this._lastAutoSaveTime = 0;
    this._autoSaveInterval = 60000; // 1 minute auto-save
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    try {
      await _ensureDB();
      this._initialized = true;
    } catch {
      // IndexedDB not available (private mode, etc.) — backups silently disabled
      this._initialized = false;
    }
  }

  // Save a backup of the current scene. Returns the backup id or null on failure.
  async save(scene, { label = null, auto = false } = {}) {
    try {
      const db = await _ensureDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);

      // Enforce max backups — delete oldest if we're at the limit
      const countReq = store.count();
      const count = await new Promise((res, rej) => {
        countReq.onsuccess = () => res(countReq.result);
        countReq.onerror = () => rej(countReq.error);
      });
      if (count >= MAX_BACKUPS) {
        const oldestIdx = store.index('timestamp');
        const oldestReq = oldestIdx.openCursor(IDBKeyRange.lowerBound(0), 'next');
        const oldestId = await new Promise((res, rej) => {
          oldestReq.onsuccess = (ev) => {
            const cursor = ev.target.result;
            if (cursor) res(cursor.primaryKey);
            else res(null);
          };
          oldestReq.onerror = () => rej(oldestReq.error);
        });
        if (oldestId != null) store.delete(oldestId);
      }

      const json = JSON.stringify(scene);
      const backup = {
        timestamp: Date.now(),
        label: label || `Auto-backup ${new Date().toLocaleTimeString()}`,
        title: scene.title || 'Untitled Board',
        pageCount: scene.pages ? scene.pages.length : 0,
        elementCount: scene.pages
          ? scene.pages.reduce((acc, p) => acc + (p.elements ? p.elements.length : 0), 0)
          : 0,
        sceneJson: json,
        auto,
      };

      const addReq = store.add(backup);
      const id = await new Promise((res, rej) => {
        addReq.onsuccess = () => res(addReq.result);
        addReq.onerror = () => rej(addReq.error);
      });

      // Restore keyPath overwrite — the store uses autoIncrement so id is set
      // by the DB; we return it for reference.
      return id;
    } catch (err) {
      console.warn('[IndexedDBBackup] save failed:', err);
      return null;
    }
  }

  // List all backups, newest first.
  async list() {
    try {
      const db = await _ensureDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const idx = store.index('timestamp');
      const all = await new Promise((res, rej) => {
        const req = idx.openCursor(IDBKeyRange.upperBound(Date.now()), 'prev');
        const items = [];
        req.onsuccess = (ev) => {
          const cursor = ev.target.result;
          if (cursor) {
            items.push({ id: cursor.primaryKey, ...cursor.value });
            cursor.continue();
          } else res(items);
        };
        req.onerror = () => rej(req.error);
      });
      return all;
    } catch {
      return [];
    }
  }

  // Restore a backup by id. Returns the parsed scene or null.
  async restore(id) {
    try {
      const db = await _ensureDB();
      const tx = db.transaction(IDB_STORE, 'readonly');
      const store = tx.objectStore(IDB_STORE);
      const backup = await new Promise((res, rej) => {
        const req = store.get(id);
        req.onsuccess = () => res(req.result);
        req.onerror = () => rej(req.error);
      });
      if (!backup) return null;
      return JSON.parse(backup.sceneJson);
    } catch {
      return null;
    }
  }

  // Delete a backup by id.
  async delete(id) {
    try {
      const db = await _ensureDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      await new Promise((res, rej) => {
        const req = store.delete(id);
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
      return true;
    } catch {
      return false;
    }
  }

  // Clear all backups.
  async clear() {
    try {
      const db = await _ensureDB();
      const tx = db.transaction(IDB_STORE, 'readwrite');
      const store = tx.objectStore(IDB_STORE);
      await new Promise((res, rej) => {
        const req = store.clear();
        req.onsuccess = () => res();
        req.onerror = () => rej(req.error);
      });
      return true;
    } catch {
      return false;
    }
  }

  // Start automatic background saving.
  startAutoSave(app) {
    if (this._autoSaveTimer) clearInterval(this._autoSaveTimer);
    this._autoSaveTimer = setInterval(async () => {
      if (app.scene) {
        await this.save(app.scene, { auto: true });
      }
    }, this._autoSaveInterval);
  }

  stopAutoSave() {
    if (this._autoSaveTimer) {
      clearInterval(this._autoSaveTimer);
      this._autoSaveTimer = null;
    }
  }
}

// Singleton instance
export const indexedDBBackup = new IndexedDBBackup();
