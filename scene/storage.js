// scene/storage.js
import { SCHEMA_VERSION, createScene, createPage, createElement, uid } from './model.js';
import { isValidElementGeometry } from './geometry.js';

export const STORAGE_KEY = 'classroom_whiteboard_scene_v2';
export const LIBRARY_STORAGE_KEY = 'classroom_whiteboard_user_library_v1';
export const THEME_STORAGE_KEY = 'classroom_whiteboard_theme_v1';
export const RECOVERY_STORAGE_KEY = 'classroom_whiteboard_recovery_v1';

export function migrateSceneData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid whiteboard document format.');
  }

  const data = structuredClone(raw);
  const fromVersion = Number(data.version || 1);

  // v1 -> v2 migration hook:
  // v1 stored a flat `elements` array at the root and lacked `pages`, `files`, and `settings`.
  if (fromVersion < 2) {
    const migratedPage = createPage(data.title || 'Page 1', data.pageId || uid('page'));
    if (Array.isArray(data.elements)) {
      migratedPage.elements = data.elements.map((el) =>
        createElement(el.type || 'rect', {
          ...el,
          revealStep: el.revealStep ?? 0,
          autoGrow: el.autoGrow ?? true,
        })
      );
    }
    if (data.camera && typeof data.camera === 'object') {
      migratedPage.camera = {
        x: Number(data.camera.x) || 0,
        y: Number(data.camera.y) || 0,
        zoom: Number(data.camera.zoom) || 1,
      };
    }
    if (data.background) {
      migratedPage.background = data.background;
    }
    data.pages = [migratedPage];
    data.activePageId = migratedPage.id;
    delete data.elements;
    delete data.camera;
    data.version = SCHEMA_VERSION;
  }

  if (!Array.isArray(data.pages) || data.pages.length === 0) {
    const fallback = createPage('Page 1');
    data.pages = [fallback];
    data.activePageId = fallback.id;
  } else {
    for (const p of data.pages) {
      if (!p.id) p.id = uid('page');
      if (!p.name) p.name = 'Untitled Page';
      if (!Array.isArray(p.elements)) p.elements = [];
      p.elements = p.elements.map((el) => createElement(el.type || 'rect', el));
      p.camera = {
        x: Number(p.camera?.x) || 0,
        y: Number(p.camera?.y) || 0,
        zoom: Math.max(0.1, Math.min(8, Number(p.camera?.zoom) || 1)),
      };
      p.background = ['plain', 'grid', 'dots'].includes(p.background) ? p.background : 'dots';
    }
  }

  if (!data.activePageId || !data.pages.some((p) => p.id === data.activePageId)) {
    data.activePageId = data.pages[0].id;
  }

  data.title =
    typeof data.title === 'string' && data.title.trim() ? data.title.trim() : 'StudioBoard Lesson';
  data.files = data.files && typeof data.files === 'object' ? data.files : {};
  data.theme = data.theme === 'dark' ? 'dark' : 'light';
  data.settings = {
    snapToGrid: data.settings?.snapToGrid ?? true,
    snapToObjects: data.settings?.snapToObjects ?? true,
    snapToAngle: data.settings?.snapToAngle ?? true,
    gridSize: Number(data.settings?.gridSize) || 20,
  };
  data.version = SCHEMA_VERSION;

  return data;
}

export function assertValidSceneGeometry(scene) {
  if (!scene || !Array.isArray(scene.pages)) {
    throw new Error('Invalid scene structure.');
  }
  for (const page of scene.pages) {
    for (const el of page.elements || []) {
      if (!isValidElementGeometry(el)) {
        throw new Error(
          `Invalid non-finite geometry on element "${el?.name || el?.type || el?.id || 'unknown'}".`
        );
      }
    }
  }
}

export function serializeScene(scene) {
  assertValidSceneGeometry(scene);
  const payload = {
    version: SCHEMA_VERSION,
    app: 'classroom-whiteboard-studio',
    title: scene.title || 'StudioBoard Lesson',
    exportedAt: new Date().toISOString(),
    theme: scene.theme,
    activePageId: scene.activePageId,
    pages: scene.pages,
    files: scene.files || {},
    settings: scene.settings,
  };
  return JSON.stringify(payload, null, 2);
}

export function parseSceneJson(jsonString) {
  const raw = JSON.parse(jsonString);
  return migrateSceneData(raw);
}

export function saveSceneToLocalStorage(scene, onQuotaError = null, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    const serialized = serializeScene(scene);
    storage.setItem(STORAGE_KEY, serialized);
    storage.setItem(THEME_STORAGE_KEY, scene.theme);
    return true;
  } catch (err) {
    if (onQuotaError) {
      onQuotaError(err);
    }
    return false;
  }
}

export function loadSceneFromLocalStorage(preferredTheme = 'light', storage = globalThis.localStorage) {
  if (!storage) return createScene(preferredTheme);
  try {
    const rawStr = storage.getItem(STORAGE_KEY);
    if (!rawStr) {
      const savedTheme = storage.getItem(THEME_STORAGE_KEY) || preferredTheme;
      return createScene(savedTheme);
    }
    return parseSceneJson(rawStr);
  } catch {
    return createScene(preferredTheme);
  }
}

export const loadSceneFromStorage = loadSceneFromLocalStorage;

export function saveThemePreference(theme, storage = globalThis.localStorage) {
  if (!storage || !theme) return false;
  try {
    storage.setItem(THEME_STORAGE_KEY, theme);
    return true;
  } catch {
    return false;
  }
}

export function createDebouncedAutosave(delayMs = 500, onQuotaError = null, onStatusChange = null) {
  let timer = null;
  let lastSnapshotTime = 0;
  return function scheduleSave(scene) {
    if (!scene) return;
    if (onStatusChange) onStatusChange('saving');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const ok = saveSceneToLocalStorage(scene, onQuotaError);
      if (onStatusChange) onStatusChange(ok ? 'saved' : 'error');
      const now = Date.now();
      if (ok && now - lastSnapshotTime > 45000) {
        lastSnapshotTime = now;
        saveRecoverySnapshot(scene, 'Auto-checkpoint');
      }
    }, delayMs);
  };
}

export function loadRecoverySnapshots(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const raw = storage.getItem(RECOVERY_STORAGE_KEY);
    if (!raw) return [];
    const list = JSON.parse(raw);
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

export function saveRecoverySnapshot(scene, label = 'Manual Checkpoint', storage = globalThis.localStorage) {
  if (!storage || !scene) return false;
  try {
    const list = loadRecoverySnapshots(storage);
    const totalElements = (scene.pages || []).reduce((acc, p) => acc + (p.elements?.length || 0), 0);
    const snap = {
      id: uid('snap'),
      timestamp: new Date().toISOString(),
      label,
      title: scene.title || 'StudioBoard Lesson',
      pageCount: scene.pages?.length || 1,
      elementCount: totalElements,
      sceneJson: JSON.stringify({
        version: SCHEMA_VERSION,
        title: scene.title,
        theme: scene.theme,
        activePageId: scene.activePageId,
        pages: scene.pages,
        files: scene.files || {},
        settings: scene.settings,
      }),
    };
    const next = [snap, ...list].slice(0, 10);
    storage.setItem(RECOVERY_STORAGE_KEY, JSON.stringify(next));
    return true;
  } catch {
    return false;
  }
}

export function loadUserLibrary(storage = globalThis.localStorage) {
  if (!storage) return [];
  try {
    const str = storage.getItem(LIBRARY_STORAGE_KEY);
    if (!str) return [];
    const parsed = JSON.parse(str);
    return Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUserLibrary(items, storage = globalThis.localStorage) {
  if (!storage) return false;
  try {
    storage.setItem(
      LIBRARY_STORAGE_KEY,
      JSON.stringify({ version: 1, type: 'whiteboard-library', items }, null, 2)
    );
    return true;
  } catch {
    return false;
  }
}

export function exportLibraryJson(items) {
  return JSON.stringify(
    {
      version: 1,
      type: 'whiteboard-library',
      exportedAt: new Date().toISOString(),
      items,
    },
    null,
    2
  );
}

export function importLibraryJson(jsonString) {
  const parsed = JSON.parse(jsonString);
  const list = Array.isArray(parsed.items) ? parsed.items : Array.isArray(parsed) ? parsed : null;
  if (!list) throw new Error('Invalid .library.json format.');
  return list.filter((item) => item && item.name && Array.isArray(item.elements));
}

// URL Hash sharing (base64url UTF-8 encoding with size warning)
export function encodeSceneToHash(scene) {
  assertValidSceneGeometry(scene);
  const compact = {
    version: SCHEMA_VERSION,
    theme: scene.theme,
    activePageId: scene.activePageId,
    pages: scene.pages,
    files: scene.files || {},
    settings: scene.settings,
  };
  const json = JSON.stringify(compact);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const b64 = btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const hash = `#scene=${b64}`;
  return {
    hash,
    length: hash.length,
    warnLarge: hash.length > 6000,
  };
}

export function decodeSceneFromHash(hashString) {
  if (!hashString || !hashString.includes('scene=')) return null;
  const idx = hashString.indexOf('scene=');
  let b64 = hashString.slice(idx + 6).trim();
  if (!b64) return null;
  b64 = b64.replace(/-/g, '+').replace(/_/g, '/');
  while (b64.length % 4 !== 0) b64 += '=';
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const json = new TextDecoder().decode(bytes);
  return parseSceneJson(json);
}
