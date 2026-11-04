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
      width: Math.max(200, Number(page.width) || 1280),
      height: Math.max(200, Number(page.height) || 720),
    };
    // Preserve an explicitly emptied note ("") as intentional state, not a missing field.
    if (!stripNotes && typeof page.teacherNotes === 'string') {
      outPage.teacherNotes = page.teacherNotes;
    }
    // Declarative teaching tracks travel with the page for the teacher.
    if (!stripNotes && page.animationTrack && Array.isArray(page.animationTrack.steps)) {
      outPage.animationTrack = {
        id: page.animationTrack.id,
        name: page.animationTrack.name,
        steps: page.animationTrack.steps,
      };
    }
    // Applied diagram configuration, so reopening the drawer does not reset it.
    if (page.architectureConfigs && typeof page.architectureConfigs === 'object') {
      outPage.architectureConfigs = structuredClone(page.architectureConfigs);
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

// Tools that every workspace preset keeps on the dock. They are the six a teacher
// reaches for regardless of mode, so switching preset must never hide them.
export const REQUIRED_PINNED_TOOLS = [
  'pen',
  'highlighter',
  'eraser',
  'sticky',
  'spotlight',
  'arrow',
  'vote',
];

// Bumped when REQUIRED_PINNED_TOOLS grows. The stamp is derived from the list
// itself, so prefs written before the list changed — including blobs that carry
// a stale version number — are topped up exactly once.
export const PINNED_TOOLS_VERSION = 3;
export const PINNED_TOOLS_STAMP = REQUIRED_PINNED_TOOLS.join(',');

export const DEFAULT_PRESET_TOOLS = {
  teach: [
    'select',
    'hand',
    'pen',
    'highlighter',
    'eraser',
    'sticky',
    'spotlight',
    'vote',
    'arrow',
    'laser',
    'pointer',
    'question',
  ],
  diagram: [
    'select',
    'hand',
    'pen',
    'highlighter',
    'eraser',
    'arrow',
    'sticky',
    'spotlight',
    'vote',
    'rect',
    'rounded-rect',
    'ellipse',
    'diamond',
    'line',
    'text',
    'frame',
    'table',
    'code',
  ],
  collaborate: [
    'select',
    'hand',
    'pen',
    'highlighter',
    'eraser',
    'sticky',
    'spotlight',
    'vote',
    'arrow',
    'laser',
    'pointer',
    'question',
    'stamp',
  ],
};

// Append missing required tools without disturbing the user's own order.
export function withRequiredPinnedTools(toolIds = []) {
  const list = Array.isArray(toolIds) ? [...toolIds] : [];
  for (const id of REQUIRED_PINNED_TOOLS) {
    if (!list.includes(id)) list.push(id);
  }
  return list;
}

export const WORKSPACE_PRESETS = {
  teach: {
    id: 'teach',
    label: 'Teach',
    description:
      'Minimal interface with maximum canvas space for pen, highlighter, laser, timer, presentation & questions.',
    defaultTools: DEFAULT_PRESET_TOOLS.teach,
    defaultInspectorOpen: false,
    defaultLeftPanel: null,
    defaultArrowPreset: 'simple-sketch',
  },
  diagram: {
    id: 'diagram',
    label: 'Diagram',
    description:
      'Architecture & diagramming workspace with shapes, connectors, libraries, containers, layers & Inspector.',
    defaultTools: DEFAULT_PRESET_TOOLS.diagram,
    defaultInspectorOpen: true,
    defaultLeftPanel: null,
    defaultArrowPreset: 'clean-technical',
  },
  collaborate: {
    id: 'collaborate',
    label: 'Collaborate',
    description:
      'Live classroom facilitation with participants, named cursors, questions, Follow Teacher & reactions.',
    defaultTools: DEFAULT_PRESET_TOOLS.collaborate,
    defaultInspectorOpen: false,
    defaultLeftPanel: 'wb-classroom-panel',
    defaultArrowPreset: 'simple-sketch',
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
    pinnedToolsVersion: PINNED_TOOLS_VERSION,
    pinnedToolsStamp: PINNED_TOOLS_STAMP,
    libraryIconSize: 'comfortable',
    toolLockEnabled: false,
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
    // Prefs saved before the dock gained its required tools are topped up once.
    // After that the stored list wins, so unpinning a tool stays respected.
    // Compare the stamp, not the version number: a blob written while the
    // required list was different (or by an older build) must still be healed.
    const needsMigration = parsed.pinnedToolsStamp !== PINNED_TOOLS_STAMP;
    const normalise = (key) => {
      const stored =
        Array.isArray(rawPinned[key]) && rawPinned[key].length > 0
          ? rawPinned[key]
          : [...DEFAULT_PRESET_TOOLS[key]];
      return needsMigration ? withRequiredPinnedTools(stored) : stored;
    };
    return {
      preset,
      pinnedToolsByPreset: {
        teach: normalise('teach'),
        diagram: normalise('diagram'),
        collaborate: normalise('collaborate'),
      },
      leftPanelWidth: Math.max(240, Math.min(480, Number(parsed.leftPanelWidth) || 320)),
      rightPanelWidth: Math.max(220, Math.min(440, Number(parsed.rightPanelWidth) || 268)),
      minimapOpen: Boolean(parsed.minimapOpen),
      inspectorOpen: parsed.inspectorOpen !== false,
      // Tool, brush, eraser and inspector state are part of the workspace too;
      // dropping them here made every setting revert on reload.
      inspectorPinned: Boolean(parsed.inspectorPinned),
      brush: typeof parsed.brush === 'string' ? parsed.brush : 'technical',
      brushSmoothing: ['off', 'adaptive', 'stabilizer'].includes(parsed.brushSmoothing)
        ? parsed.brushSmoothing
        : 'adaptive',
      brushOverrides:
        parsed.brushOverrides && typeof parsed.brushOverrides === 'object'
          ? Object.fromEntries(
              Object.entries(parsed.brushOverrides).filter(([, v]) => Number.isFinite(v))
            )
          : {},
      eraserSize: Number(parsed.eraserSize) || 12,
      eraserMode: parsed.eraserMode === 'stroke' ? 'stroke' : 'object',
      eraserScope: ['all', 'ink', 'objects'].includes(parsed.eraserScope)
        ? parsed.eraserScope
        : 'all',
      activeTool: typeof parsed.activeTool === 'string' ? parsed.activeTool : null,
      // Tool lock only accepts a real stored true; a garbage string like
      // 'yes' must not read as on.
      toolLockEnabled: parsed.toolLockEnabled === true,
      libraryIconSize:
        parsed.libraryIconSize === 'large' ? 'large' : parsed.libraryIconSize === 'compact' ? 'compact' : 'comfortable',
      pinnedToolsVersion: PINNED_TOOLS_VERSION,
      pinnedToolsStamp: PINNED_TOOLS_STAMP,
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
      p.width = Math.max(200, Number(p.width) || 1280);
      p.height = Math.max(200, Number(p.height) || 720);
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
  let pendingScene = null;

  const runSave = () => {
    if (!pendingScene) return;
    const scene = pendingScene;
    pendingScene = null;
    const ok = saveSceneToLocalStorage(scene, onQuotaError);
    if (onStatusChange) onStatusChange(ok ? 'saved' : 'error');
    const now = Date.now();
    if (ok && now - lastSnapshotTime > 45000) {
      lastSnapshotTime = now;
      saveRecoverySnapshot(scene, 'Auto-checkpoint');
    }
  };

  function scheduleSave(scene) {
    if (!scene) return;
    pendingScene = scene;
    if (onStatusChange) onStatusChange('saving');
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      runSave();
    }, delayMs);
  }

  // Flush a pending debounced write synchronously. Used on pagehide/visibilitychange so a
  // reload cannot discard a note or edit typed inside the debounce window.
  scheduleSave.flush = function flush() {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    runSave();
  };
  scheduleSave.hasPending = () => Boolean(pendingScene);
  return scheduleSave;
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
// Strips teacherNotes and default-valued properties so fallback URLs stay as compact as possible.
const DEFAULT_EL_PROPS = {
  rotation: 0,
  stroke: '#1e293b',
  fill: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid',
  opacity: 1,
  roundness: 0,
  sloppy: false,
  text: '',
  fontFamily: 'sans',
  fontSize: 18,
  textAlign: 'center',
  autoGrow: true,
  locked: false,
  hidden: false,
  revealStep: 0,
  groupId: null,
  containerId: null,
  link: '',
  startArrow: 'none',
  startLabel: '',
  endLabel: '',
  manualRoute: false,
  elbowOffset: 0,
};

function compactElementForHash(el) {
  const out = {};
  for (const [k, v] of Object.entries(el)) {
    if (k === 'createdAt' || k === 'updatedAt' || k === 'teacherNotes') continue;
    if (v === undefined || v === null || v === '') {
      if (k !== 'id' && k !== 'type') continue;
    }
    if (k in DEFAULT_EL_PROPS && DEFAULT_EL_PROPS[k] === v) continue;
    if (Array.isArray(v) && v.length === 0 && k === 'waypoints') continue;
    out[k] = v;
  }
  return out;
}

export function encodeSceneToHash(scene, options = {}) {
  const stripNotes = options.includeTeacherNotes !== true;
  const clean = sanitizeSceneForPersistence(scene, { stripNotes });
  assertValidSceneGeometry(clean);
  const compactPages = clean.pages.map((p) => ({
    id: p.id,
    name: p.name,
    background: p.background,
    camera: p.camera,
    ...(p.teacherNotes ? { teacherNotes: p.teacherNotes } : {}),
    elements: p.elements.map(compactElementForHash),
  }));
  const compact = {
    version: SCHEMA_VERSION,
    theme: clean.theme,
    activePageId: clean.activePageId,
    pages: compactPages,
    ...(clean.files && Object.keys(clean.files).length > 0 ? { files: clean.files } : {}),
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
