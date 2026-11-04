// tests/icon-size.test.js — library icon-size workspace pref: whitelist
// round-trips for the three levels, garbage falls back to 'comfortable'.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspacePrefs, saveWorkspacePrefs } from '../scene/storage.js';

const PREFS_KEY = 'classroom_whiteboard_workspace_prefs_v1';
const LEVELS = ['compact', 'comfortable', 'large'];

const mockStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    _dump: () => Object.fromEntries(store),
  };
};

describe('Library icon size pref', () => {
  test('fresh storage defaults to comfortable', () => {
    assert.equal(loadWorkspacePrefs(mockStorage()).libraryIconSize, 'comfortable');
  });

  test('each level round-trips through save + load', () => {
    const storage = mockStorage();
    for (const level of LEVELS) {
      assert.ok(saveWorkspacePrefs({ libraryIconSize: level }, storage), `save ${level} failed`);
      assert.equal(loadWorkspacePrefs(storage).libraryIconSize, level, `${level} did not round-trip`);
    }
  });

  test('garbage values fall back to comfortable', () => {
    for (const garbage of ['huge', 42, null, {}, undefined]) {
      const storage = mockStorage();
      storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'diagram', libraryIconSize: garbage }));
      assert.equal(
        loadWorkspacePrefs(storage).libraryIconSize,
        'comfortable',
        `${JSON.stringify(garbage)} should not be accepted`
      );
    }
  });

  test('a missing key with other prefs still yields comfortable', () => {
    const storage = mockStorage();
    storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'teach', minimapOpen: true }));
    const prefs = loadWorkspacePrefs(storage);
    assert.equal(prefs.libraryIconSize, 'comfortable');
    assert.equal(prefs.preset, 'teach');
    assert.equal(prefs.minimapOpen, true);
  });

  test('compact and large survive alongside other prefs keys', () => {
    const storage = mockStorage();
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        preset: 'collaborate',
        minimapOpen: true,
        eraserSize: 24,
        libraryIconSize: 'compact',
      })
    );
    const compact = loadWorkspacePrefs(storage);
    assert.equal(compact.libraryIconSize, 'compact');
    assert.equal(compact.eraserSize, 24);

    saveWorkspacePrefs({ libraryIconSize: 'large', brush: 'technical' }, storage);
    const large = loadWorkspacePrefs(storage);
    assert.equal(large.libraryIconSize, 'large');
    assert.equal(large.preset, 'collaborate');
    assert.equal(large.brush, 'technical');
  });
});
