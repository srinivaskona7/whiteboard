// tests/dock.test.js — pinned dock contract: required tools in every preset,
// a registry entry for every pin, and a one-time top-up of older prefs.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PRESET_TOOLS,
  REQUIRED_PINNED_TOOLS,
  PINNED_TOOLS_STAMP,
  WORKSPACE_PRESETS,
  loadWorkspacePrefs,
  saveWorkspacePrefs,
  withRequiredPinnedTools,
} from '../scene/storage.js';
import { TOOL_REGISTRY } from '../ui/registry.js';

const PRESETS = Object.keys(DEFAULT_PRESET_TOOLS);

const mockStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    _dump: () => Object.fromEntries(store),
  };
};

describe('Pinned dock tools', () => {
  test('Freehand, Highlighter, Eraser, Sticky, Spotlight and Arrow are pinned in every preset', () => {
    for (const preset of PRESETS) {
      for (const id of REQUIRED_PINNED_TOOLS) {
        assert.ok(
          DEFAULT_PRESET_TOOLS[preset].includes(id),
          `${preset} preset is missing pinned tool "${id}"`
        );
      }
    }
  });

  test('every pinned tool exists in the registry', () => {
    // A pinned id with no registry entry is silently dropped from the dock.
    const known = new Set(TOOL_REGISTRY.map((t) => t.id));
    for (const preset of PRESETS) {
      assert.ok(DEFAULT_PRESET_TOOLS[preset].length > 0, `${preset} has no pinned tools`);
      for (const id of DEFAULT_PRESET_TOOLS[preset]) {
        assert.ok(known.has(id), `${preset} pins unknown tool "${id}"`);
      }
    }
    for (const id of REQUIRED_PINNED_TOOLS) {
      assert.ok(known.has(id), `required tool "${id}" is not in TOOL_REGISTRY`);
    }
  });

  test('spotlight is registered as a dock tool with the F7 shortcut used by the toggle', () => {
    const spotlight = TOOL_REGISTRY.find((t) => t.id === 'spotlight');
    assert.ok(spotlight, 'spotlight missing from TOOL_REGISTRY');
    assert.equal(spotlight.group, 'dock');
    assert.equal(spotlight.shortcut, 'F7');
  });

  test('preset tools never repeat an id', () => {
    for (const preset of PRESETS) {
      const list = DEFAULT_PRESET_TOOLS[preset];
      assert.equal(new Set(list).size, list.length, `${preset} repeats a tool id`);
    }
  });

  test('WORKSPACE_PRESETS exposes the same default lists', () => {
    for (const preset of PRESETS) {
      assert.deepEqual(WORKSPACE_PRESETS[preset].defaultTools, DEFAULT_PRESET_TOOLS[preset]);
    }
  });
});

describe('Pinned tools prefs migration', () => {
  test('older prefs are topped up once and then left alone', () => {
    const storage = mockStorage();
    // A pre-versioned prefs blob: Teach pinned only four tools.
    storage.setItem(
      'classroom_whiteboard_workspace_prefs_v1',
      JSON.stringify({
        preset: 'teach',
        pinnedToolsByPreset: {
          teach: ['select', 'hand', 'pointer'],
          diagram: ['select', 'hand', 'rect'],
          collaborate: ['select', 'hand', 'sticky'],
        },
      })
    );

    const migrated = loadWorkspacePrefs(storage);
    for (const preset of PRESETS) {
      for (const id of REQUIRED_PINNED_TOOLS) {
        assert.ok(
          migrated.pinnedToolsByPreset[preset].includes(id),
          `${preset} was not topped up with "${id}"`
        );
      }
    }
    // The user's own order and choices are preserved, additions go last.
    assert.deepEqual(migrated.pinnedToolsByPreset.teach.slice(0, 3), ['select', 'hand', 'pointer']);
    assert.equal(migrated.pinnedToolsStamp, PINNED_TOOLS_STAMP);

    // Persisting and reloading must not re-add a tool the user then unpinned.
    const unpinned = migrated.pinnedToolsByPreset.teach.filter((id) => id !== 'eraser');
    saveWorkspacePrefs({ pinnedToolsByPreset: { teach: unpinned } }, storage);
    const reloaded = loadWorkspacePrefs(storage);
    assert.ok(!reloaded.pinnedToolsByPreset.teach.includes('eraser'), 'migration ran twice');
    assert.deepEqual(reloaded.pinnedToolsByPreset.teach, unpinned);
  });

  test('a stale version number with an un-migrated list is still healed', () => {
    // Regression: prefs written by an intermediate build carried the new
    // version number but the old tool list, which permanently skipped the
    // top-up. The stamp is derived from the list, so it cannot get out of step.
    const storage = mockStorage();
    storage.setItem(
      'classroom_whiteboard_workspace_prefs_v1',
      JSON.stringify({
        preset: 'diagram',
        pinnedToolsVersion: PINNED_TOOLS_STAMP.length + 99,
        pinnedToolsByPreset: { diagram: ['select', 'hand'] },
      })
    );
    const prefs = loadWorkspacePrefs(storage);
    for (const id of REQUIRED_PINNED_TOOLS) {
      assert.ok(prefs.pinnedToolsByPreset.diagram.includes(id), `"${id}" was not healed`);
    }
  });

  test('withRequiredPinnedTools keeps existing order and never duplicates', () => {
    const out = withRequiredPinnedTools(['select', 'pen', 'arrow']);
    assert.deepEqual(out.slice(0, 3), ['select', 'pen', 'arrow']);
    assert.equal(new Set(out).size, out.length);
    for (const id of REQUIRED_PINNED_TOOLS) assert.ok(out.includes(id));
  });

  test('fresh storage starts from the preset defaults', () => {
    const prefs = loadWorkspacePrefs(mockStorage());
    for (const preset of PRESETS) {
      assert.deepEqual(prefs.pinnedToolsByPreset[preset], DEFAULT_PRESET_TOOLS[preset]);
    }
  });
});
