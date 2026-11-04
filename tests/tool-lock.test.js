// tests/tool-lock.test.js — tool-lock workspace pref: defaults off, boolean
// round-trip, garbage coerced to false, and survival alongside other keys.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { loadWorkspacePrefs, saveWorkspacePrefs } from '../scene/storage.js';

const PREFS_KEY = 'classroom_whiteboard_workspace_prefs_v1';

const mockStorage = () => {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    _dump: () => Object.fromEntries(store),
  };
};

describe('Tool lock pref', () => {
  test('fresh storage defaults to false', () => {
    const prefs = loadWorkspacePrefs(mockStorage());
    assert.equal(prefs.toolLockEnabled, false);
  });

  test('true and false round-trip through save + load', () => {
    const storage = mockStorage();
    assert.ok(saveWorkspacePrefs({ toolLockEnabled: true }, storage));
    assert.equal(loadWorkspacePrefs(storage).toolLockEnabled, true, 'true did not round-trip');
    assert.ok(saveWorkspacePrefs({ toolLockEnabled: false }, storage));
    assert.equal(loadWorkspacePrefs(storage).toolLockEnabled, false, 'false did not round-trip');
  });

  test('garbage values load as false', () => {
    for (const garbage of ['yes', 'locked', 1, 0, null, {}, undefined]) {
      const storage = mockStorage();
      storage.setItem(PREFS_KEY, JSON.stringify({ preset: 'diagram', toolLockEnabled: garbage }));
      assert.equal(
        loadWorkspacePrefs(storage).toolLockEnabled,
        false,
        `${JSON.stringify(garbage)} should not be accepted as on`
      );
    }
  });

  test('survives alongside other prefs keys', () => {
    const storage = mockStorage();
    storage.setItem(
      PREFS_KEY,
      JSON.stringify({
        preset: 'teach',
        minimapOpen: true,
        libraryIconSize: 'large',
        toolLockEnabled: true,
      })
    );
    const prefs = loadWorkspacePrefs(storage);
    assert.equal(prefs.toolLockEnabled, true);
    assert.equal(prefs.preset, 'teach');
    assert.equal(prefs.libraryIconSize, 'large');
    // Saving an unrelated pref must not drop the lock.
    assert.ok(saveWorkspacePrefs({ inspectorOpen: false }, storage));
    const reloaded = loadWorkspacePrefs(storage);
    assert.equal(reloaded.toolLockEnabled, true, 'lock lost to an unrelated save');
    assert.equal(reloaded.inspectorOpen, false);
  });
});
