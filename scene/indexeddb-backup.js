// scene/indexeddb-backup.js
// IndexedDB is the AUTHORITATIVE board store. localStorage has a separate,
// much smaller quota (~5 MiB) that fails on image-heavy boards; IndexedDB has
// hundreds of MB. Small preferences stay in localStorage, board data lives here.

export const IDB_NAME = 'StudioBoardBackups';
export const IDB_VERSION = 2;
export const IDB_STORE = 'backups';
export const BOARD_STORE = 'boards';
export const BOARD_KEY = 'current';
export const MAX_BACKUPS = 30;
export const AUTO_BACKUP_INTERVAL = 5 * 60 * 1000; // 5 minutes

let _dbPromise = null;

function _openDB() {
  if (_dbPromise) return _dbPromise;
  _dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(IDB_NAME, IDB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BOARD_STORE)) {
        db.createObjectStore(BOARD_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        const store = db.createObjectStore(IDB_STORE, { keyPath: 'id', autoIncrement: true });
        store.createIndex('timestamp', 'timestamp', { unique: false });
        store.createIndex('title', 'title', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB blocked by another tab'));
  });
  return _dbPromise;
}

function _txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
  });
}

function _req(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function _byteLength(str) {
  try { return new TextEncoder().encode(str).byteLength; } catch { return str.length; }
}

// ── Primary board persistence ───────────────────────────────────────────

// Save the authoritative current board. Resolves only AFTER the transaction
// completes, so callers can show "Saved" truthfully.
export async function saveBoardToIDB(scene) {
  try {
    const db = await _openDB();
    const json = JSON.stringify(scene);
    const tx = db.transaction(BOARD_STORE, 'readwrite');
    tx.objectStore(BOARD_STORE).put({
      key: BOARD_KEY,
      sceneJson: json,
      bytes: _byteLength(json),
      updatedAt: Date.now(),
    });
    await _txDone(tx);
    return { ok: true, backend: 'IndexedDB', bytes: _byteLength(json), at: Date.now() };
  } catch (err) {
    const unavailable = /unavailable|blocked/i.test(err?.message || '');
    return {
      ok: false,
      backend: 'IndexedDB',
      reason: unavailable ? 'unavailable' : 'error',
      error: err,
    };
  }
}

// Load the authoritative board. Returns a parsed scene or null.
export async function loadBoardFromIDB() {
  try {
    const db = await _openDB();
    const tx = db.transaction(BOARD_STORE, 'readonly');
    const rec = await _req(tx.objectStore(BOARD_STORE).get(BOARD_KEY));
    if (!rec || !rec.sceneJson) return null;
    return JSON.parse(rec.sceneJson);
  } catch {
    return null;
  }
}

export async function getBoardInfo() {
  try {
    const db = await _openDB();
    const tx = db.transaction(BOARD_STORE, 'readonly');
    const rec = await _req(tx.objectStore(BOARD_STORE).get(BOARD_KEY));
    return rec ? { bytes: rec.bytes || 0, updatedAt: rec.updatedAt || 0 } : { bytes: 0, updatedAt: 0 };
  } catch {
    return { bytes: 0, updatedAt: 0 };
  }
}

export async function clearBoardFromIDB() {
  try {
    const db = await _openDB();
    const tx = db.transaction(BOARD_STORE, 'readwrite');
    tx.objectStore(BOARD_STORE).delete(BOARD_KEY);
    await _txDone(tx);
    return true;
  } catch {
    return false;
  }
}

// ── Checkpoint backups ──────────────────────────────────────────────────

export async function listBackups() {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const idx = tx.objectStore(IDB_STORE).index('timestamp');
    const items = await new Promise((resolve, reject) => {
      const cursorReq = idx.openCursor(IDBKeyRange.upperBound(Date.now()), 'prev');
      const out = [];
      cursorReq.onsuccess = (ev) => {
        const cursor = ev.target.result;
        if (cursor) {
          out.push({ id: cursor.primaryKey, ...cursor.value, bytes: cursor.value.bytes || 0 });
          cursor.continue();
        } else resolve(out);
      };
      cursorReq.onerror = () => reject(cursorReq.error);
    });
    return items;
  } catch {
    return [];
  }
}

export async function saveBackup(scene, { label = null, auto = false } = {}) {
  try {
    const db = await _openDB();
    const json = JSON.stringify(scene);
    const tx = db.transaction(IDB_STORE, 'readwrite');
    const store = tx.objectStore(IDB_STORE);
    const count = await _req(store.count());
    if (count >= MAX_BACKUPS) {
      const cursorReq = await new Promise((resolve, reject) => {
        const r = store.index('timestamp').openCursor(IDBKeyRange.lowerBound(0), 'next');
        r.onsuccess = (ev) => resolve(ev.target.result);
        r.onerror = () => reject(r.error);
      });
      if (cursorReq) store.delete(cursorReq.primaryKey);
    }
    const id = await _req(store.add({
      timestamp: Date.now(),
      label: label || `Auto-backup ${new Date().toLocaleTimeString()}`,
      title: scene.title || 'Untitled Board',
      pageCount: scene.pages ? scene.pages.length : 0,
      elementCount: scene.pages ? scene.pages.reduce((a, p) => a + (p.elements?.length || 0), 0) : 0,
      bytes: _byteLength(json),
      auto,
      sceneJson: json,
    }));
    await _txDone(tx);
    return id;
  } catch {
    return null;
  }
}

export async function restoreBackup(id) {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readonly');
    const rec = await _req(tx.objectStore(IDB_STORE).get(id));
    return rec ? JSON.parse(rec.sceneJson) : null;
  } catch {
    return null;
  }
}

export async function deleteBackup(id) {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).delete(id);
    await _txDone(tx);
    return true;
  } catch {
    return false;
  }
}

export async function clearAllBackups() {
  try {
    const db = await _openDB();
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).clear();
    await _txDone(tx);
    return true;
  } catch {
    return false;
  }
}

export class IndexedDBBackup {
  constructor() {
    this._timer = null;
  }
  async init() { try { await _openDB(); return true; } catch { return false; } }
  save(scene, opts) { return saveBackup(scene, opts); }
  list() { return listBackups(); }
  restore(id) { return restoreBackup(id); }
  delete(id) { return deleteBackup(id); }
  clear() { return clearAllBackups(); }
  startAutoSave(app) {
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => {
      if (app.scene) saveBackup(app.scene, { auto: true });
    }, AUTO_BACKUP_INTERVAL);
  }
  stopAutoSave() { if (this._timer) clearInterval(this._timer); this._timer = null; }
}

export const indexedDBBackup = new IndexedDBBackup();
