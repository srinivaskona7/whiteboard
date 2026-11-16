// scene/version-history.js
// Version history for boards — saves snapshots to localStorage so users can
// browse and restore previous versions of their board.

import { serializeScene } from './storage.js';

export const VERSION_STORAGE_KEY = 'classroom_whiteboard_versions_v1';
export const MAX_VERSIONS = 50;

export class VersionHistory {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
    this._lastSavedTime = 0;
    this._debounceTimer = null;
  }

  // List all versions, newest first.
  list() {
    if (!this.storage) return [];
    try {
      const raw = this.storage.getItem(VERSION_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  // Save a version of the current scene. Debounced so rapid changes don't
  // create hundreds of versions.
  save(scene, { label = null, force = false } = {}) {
    if (!this.storage || !scene) return false;

    const now = Date.now();
    if (!force && now - this._lastSavedTime < 30000) {
      // Throttle auto-saves to at most once per 30 seconds.
      if (this._debounceTimer) clearTimeout(this._debounceTimer);
      this._debounceTimer = setTimeout(() => {
        this._doSave(scene, { label });
      }, 30000);
      return true;
    }

    return this._doSave(scene, { label, force });
  }

  _doSave(scene, { label = null, force = false } = {}) {
    const now = Date.now();
    const versions = this.list();

    const snapshot = {
      id: `v${now}`,
      timestamp: now,
      label: label || `Version ${versions.length + 1}`,
      sceneJson: serializeScene(scene),
    };

    const next = [snapshot, ...versions].slice(0, MAX_VERSIONS);

    try {
      this.storage.setItem(VERSION_STORAGE_KEY, JSON.stringify(next));
      this._lastSavedTime = now;
      return true;
    } catch {
      return false;
    }
  }

  // Restore a version by id. Returns the parsed scene or null.
  restore(versionId) {
    const versions = this.list();
    const found = versions.find((v) => v.id === versionId);
    if (!found) return null;
    try {
      return JSON.parse(found.sceneJson);
    } catch {
      return null;
    }
  }

  // Delete a version by id.
  delete(versionId) {
    if (!this.storage) return false;
    const versions = this.list();
    const next = versions.filter((v) => v.id !== versionId);
    try {
      this.storage.setItem(VERSION_STORAGE_KEY, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }

  // Clear all versions.
  clear() {
    if (!this.storage) return false;
    try {
      this.storage.removeItem(VERSION_STORAGE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  // Flush any pending debounced save.
  flush() {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = null;
    }
  }
}

// Format a timestamp into a human-readable string.
export function formatVersionTime(timestamp) {
  const d = new Date(timestamp);
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
