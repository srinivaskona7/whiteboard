// tests/icon-size.test.js — library icon-size workspace pref: the granular
// pixel slider (28–96) round-trips, legacy 3-level stepper strings migrate
// to their closest pixel size, and garbage falls back to 48 px.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspacePrefs, saveWorkspacePrefs, normalizeLibraryIconSize } from '../scene/storage.js';
import { iconSizeLayout, normalizeIconSize } from '../ui/library-panel.js';

const PREFS_KEY = 'classroom_whiteboard_workspace_prefs_v1';
const LEGACY = { compact: 38, comfortable: 48, large: 64 };

const mockStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
  };
};

describe('Library icon size pref', () => {
  test('fresh storage defaults to 48 px', () => {
    assert.equal(loadWorkspacePrefs(mockStorage()).libraryIconSize, 48);
  });

  test('a pixel value round-trips through save + load', () => {
    const storage = mockStorage();
    for (const px of [28, 40, 48, 64, 88, 96]) {
      assert.ok(saveWorkspacePrefs({ libraryIconSize: px }, storage), `save ${px} failed`);
      assert.equal(loadWorkspacePrefs(storage).libraryIconSize, px, `${px} did not round-trip`);
    }
  });

  test('legacy stepper strings migrate to their closest pixel size', () => {
    for (const [level, px] of Object.entries(LEGACY)) {
      const storage = mockStorage();
      storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'diagram', libraryIconSize: level }));
      assert.equal(loadWorkspacePrefs(storage).libraryIconSize, px, `${level} should migrate to ${px}`);
    }
  });

  test('out-of-range and garbage values clamp or fall back to 48 px', () => {
    for (const [garbage, expected] of [
      ['huge', 48],
      [null, 48],
      [{}, 48],
      [undefined, 48],
      [8, 28], // clamped up
      [500, 96], // clamped down
      [43.6, 44], // rounded
    ]) {
      const storage = mockStorage();
      storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'teach', libraryIconSize: garbage }));
      assert.equal(
        loadWorkspacePrefs(storage).libraryIconSize,
        expected,
        `${JSON.stringify(garbage)} should read as ${expected}`
      );
    }
  });

  test('a missing key with other prefs still yields 48 px', () => {
    const storage = mockStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'teach', minimapOpen: true }));
    const prefs = loadWorkspacePrefs(storage);
    assert.equal(prefs.libraryIconSize, 48);
    assert.equal(prefs.preset, 'teach');
    assert.equal(prefs.minimapOpen, true);
  });

  test('the panel layout derives columns and focus step from the size', () => {
    // The arrow-key focus step must equal the grid column count at every
    // size, and the size maps onto the three grid tiers.
    for (const px of [28, 32, 36, 40, 48, 56, 60, 64, 72, 88, 96]) {
      const layout = iconSizeLayout(px);
      assert.equal(layout.focusStep, layout.cols, `focusStep must match columns at ${px}`);
      assert.equal(layout.size, normalizeIconSize(px));
    }
    assert.equal(iconSizeLayout(32).cols, 4); // small → 4 columns
    assert.equal(iconSizeLayout(48).cols, 3); // medium → 3 columns
    assert.equal(iconSizeLayout(80).cols, 2); // large → 2 columns
    assert.equal(iconSizeLayout('comfortable').size, 48, 'panel accepts legacy strings too');
    assert.equal(normalizeLibraryIconSize('compact'), 38, 'storage normalizer mirrors the migration');
  });
});
