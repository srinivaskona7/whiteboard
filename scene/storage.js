// scene/storage.js
import { SCHEMA_VERSION, createScene, createPage, createElement, uid } from './model.js';
import { isValidElementGeometry } from './geometry.js';

export const STORAGE_KEY = 'classroom_whiteboard_scene_v2';
export const LIBRARY_STORAGE_KEY = 'classroom_whiteboard_user_library_v1';
export const THEME_STORAGE_KEY = 'classroom_whiteboard_theme_v1';
export const RECOVERY_STORAGE_KEY = 'classroom_whiteboard_recovery_v1';
export const WORKSPACE_PREFS_KEY = 'classroom_whiteboard_workspace_prefs_v1';

const TRANSIENT_ELEMENT_KEYS = [
  'selected',
  'hovered',
  'hoveredPort',
  'laserTrail',
  'remoteCursor',
  'marqueeBox',
  'placementPreview',
  'connectorPreview',
  'smartGuides',
];

export function sanitizeSceneForPersistence(scene, { stripNotes = false } = {}) {
  if (!scene || typeof scene !== 'object') {
    throw new Error('Invalid scene object.');
  }
  const cleanPages = (scene.pages || []).map((page) => {
    const cleanElements = (page.elements || [])
      .filter((el) => el && !el.fading) // Strip ephemeral fading ink strokes
      .map((el) => {
        const copy = { ...el };
        for (const k of TRANSIENT_ELEMENT_KEYS) {
          delete copy[k];
        }
        if (stripNotes) {
          delete copy.teacherNotes;
        }
        return copy;
      });
    const outPage = {
      id: page.id || uid('page'),
      name: page.name || 'Page 1',
      elements: cleanElements,
      camera: {
        x: Number(page.camera?.x) || 0,
        y: Number(page.camera?.y) || 0,
        zoom: Math.max(0.1, Math.min(8, Number(page.camera?.zoom) || 1)),
      },
      background: ['plain', 'grid', 'dots'].includes(page.background) ? page.background : 'dots',
    };
    if (!stripNotes && page.teacherNotes) {
      outPage.teacherNotes = String(page.teacherNotes);
    }
    return outPage;
  });

  return {
    version: SCHEMA_VERSION,
    title: scene.title || 'StudioBoard Lesson',
    theme: scene.theme === 'dark' ? 'dark' : 'light',
    activePageId: scene.activePageId || cleanPages[0]?.id,
    pages: cleanPages,
    files: scene.files && typeof scene.files === 'object' ? { ...scene.files } : {},
    settings: {
      snapToGrid: scene.settings?.snapToGrid ?? true,
      snapToObjects: scene.settings?.snapToObjects ?? true,
      snapToAngle: scene.settings?.snapToAngle ?? true,
      gridSize: Number(scene.settings?.gridSize) || 20,
    },
  };
}

export function stripTeacherNotes(scene) {
  return sanitizeSceneForPersistence(scene, { stripNotes: true });
}

export const DEFAULT_PRESET_TOOLS = {
  teach: ['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'pointer', 'question'],
  diagram: [
    'select',
    'hand',
    'rect',
    'rounded-rect',
    'ellipse',
    'diamond',
    'arrow',
    'line',
    'text',
    'frame',
    'table',
    'code',
  ],
  collaborate: [
    'select',
    'hand',
    'pointer',
    'question',
    'sticky',
    'pen',
    'highlighter',
    'laser',
    'stamp',
  ],
};

export const WORKSPACE_PRESETS = {
  teach: {
    id: 'teach',
    label: 'Teach',
    description:
      'Minimal interface with maximum canvas space for pen, highlighter, laser, timer, presentation & questions.',
    defaultTools: DEFAULT_PRESET_TOOLS.teach,
    defaultInspectorOpen: false,
    defaultLeftPanel: null,
  },
  diagram: {
    id: 'diagram',
    label: 'Diagram',
    description:
      'Architecture & diagramming workspace with shapes, connectors, libraries, containers, layers & Inspector.',
    defaultTools: DEFAULT_PRESET_TOOLS.diagram,
    defaultInspectorOpen: true,
    defaultLeftPanel: null,
  },
  collaborate: {
    id: 'collaborate',
    label: 'Collaborate',
    description:
      'Live classroom facilitation with participants, named cursors, questions, Follow Teacher & reactions.',
    defaultTools: DEFAULT_PRESET_TOOLS.collaborate,
    defaultInspectorOpen: false,
    defaultLeftPanel: 'wb-classroom-panel',
  },
};

export function loadWorkspacePrefs(storage = globalThis.localStorage) {
  const defaults = {
    preset: 'diagram',
    pinnedToolsByPreset: {
      teach: [...DEFAULT_PRESET_TOOLS.teach],
      diagram: [...DEFAULT_PRESET_TOOLS.diagram],
      collaborate: [...DEFAULT_PRESET_TOOLS.collaborate],
    },
    leftPanelWidth: 320,
    rightPanelWidth: 268,
    minimapOpen: false,
    inspectorOpen: true,
  };
  if (!storage) return defaults;
  try {
    const raw = storage.getItem(WORKSPACE_PREFS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    const preset = ['teach', 'diagram', 'collaborate'].includes(parsed.preset)
      ? parsed.preset
      : 'diagram';
    const rawPinned =
      parsed.pinnedToolsByPreset && typeof parsed.pinnedToolsByPreset === 'object'
        ? parsed.pinnedToolsByPreset
        : {};
    return {
      preset,
      pinnedToolsByPreset: {
        teach:
          Array.isArray(rawPinned.teach) && rawPinned.teach.length > 0
            ? rawPinned.teach
            : [...DEFAULT_PRESET_TOOLS.teach],
        diagram:
          Array.isArray(rawPinned.diagram) && rawPinned.diagram.length > 0
            ? rawPinned.diagram
            : [...DEFAULT_PRESET_TOOLS.diagram],
        collaborate:
          Array.isArray(rawPinned.collaborate) && rawPinned.collaborate.length > 0
            ? rawPinned.collaborate
            : [...DEFAULT_PRESET_TOOLS.collaborate],
      },
      leftPanelWidth: Math.max(240, Math.min(480, Number(parsed.leftPanelWidth) || 320)),
      rightPanelWidth: Math.max(220, Math.min(440, Number(parsed.rightPanelWidth) || 268)),
      minimapOpen: Boolean(parsed.minimapOpen),
      inspectorOpen: parsed.inspectorOpen !== false,
    };
  } catch {
    return defaults;
  }
}

export function saveWorkspacePrefs(prefs, storage = globalThis.localStorage) {
  if (!storage || !prefs) return false;
  try {
    const current = loadWorkspacePrefs(storage);
    const merged = {
      ...current,
      ...prefs,
      pinnedToolsByPreset: {
        ...current.pinnedToolsByPreset,
        ...(prefs.pinnedToolsByPreset || {}),
      },
    };
    storage.setItem(WORKSPACE_PREFS_KEY, JSON.stringify(merged));
    return true;
  } catch {
    return false;
  }
}

export const loadWorkspacePreferences = loadWorkspacePrefs;
export const saveWorkspacePreferences = saveWorkspacePrefs;

export function migrateSceneData(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid whiteboard document format.');
  }

  const data = structuredClone(raw);
  const fromVersion = Number(data.version || 1);

  // v1 -> v2 migration hook:
  // v1 stored either a flat `elements` array at the root or v1 `pages` without v2 defaults.
  if (fromVersion < 2 && !Array.isArray(data.pages)) {
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
      p.teacherNotes = typeof p.teacherNotes === 'string' ? p.teacherNotes : '';
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
  const clean = sanitizeSceneForPersistence(scene);
  assertValidSceneGeometry(clean);
  const payload = {
    version: SCHEMA_VERSION,
    app: 'classroom-whiteboard-studio',
    title: clean.title || 'StudioBoard Lesson',
    exportedAt: new Date().toISOString(),
    theme: clean.theme,
    activePageId: clean.activePageId,
    pages: clean.pages,
    files: clean.files || {},
    settings: clean.settings,
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
    if (typeof onQuotaError === 'function') {
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

export function createDebouncedAutosave(arg1 = 500, arg2 = null, arg3 = null) {
  let delayMs = 500;
  let onQuotaError = null;
  let onStatusChange = null;

  if (typeof arg1 === 'function') {
    onStatusChange = arg1;
    delayMs = typeof arg2 === 'number' && Number.isFinite(arg2) ? arg2 : 350;
    onQuotaError = typeof arg3 === 'function' ? arg3 : null;
  } else {
    delayMs = typeof arg1 === 'number' && Number.isFinite(arg1) ? arg1 : 500;
    onQuotaError = typeof arg2 === 'function' ? arg2 : null;
    onStatusChange = typeof arg3 === 'function' ? arg3 : null;
  }

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
    const clean = sanitizeSceneForPersistence(scene);
    const list = loadRecoverySnapshots(storage);
    const totalElements = (clean.pages || []).reduce((acc, p) => acc + (p.elements?.length || 0), 0);
    const snap = {
      id: uid('snap'),
      timestamp: new Date().toISOString(),
      label,
      title: clean.title || 'StudioBoard Lesson',
      pageCount: clean.pages?.length || 1,
      elementCount: totalElements,
      sceneJson: JSON.stringify({
        version: SCHEMA_VERSION,
        title: clean.title,
        theme: clean.theme,
        activePageId: clean.activePageId,
        pages: clean.pages,
        files: clean.files || {},
        settings: clean.settings,
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
// Strips teacherNotes by default so ordinary shared links never leak private instructor notes.
export function encodeSceneToHash(scene, options = {}) {
  const stripNotes = options.includeTeacherNotes !== true;
  const clean = sanitizeSceneForPersistence(scene, { stripNotes });
  assertValidSceneGeometry(clean);
  const compact = {
    version: SCHEMA_VERSION,
    theme: clean.theme,
    activePageId: clean.activePageId,
    pages: clean.pages,
    files: clean.files || {},
    settings: clean.settings,
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
