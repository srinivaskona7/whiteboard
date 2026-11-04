// tests/registry-integrity.test.js — registry-wide invariants that every pack
// can silently violate: duplicate stencil ids, aliases aimed at ids that do
// not exist, and lesson-pack stencils that fall back to ALL_STENCILS[0]
// because the id was never registered.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { ALL_STENCILS, SEARCH_ALIASES } from '../stencils/index.js';
import { buildDevOpsDiagramPacks } from '../ui/registry.js';

describe('Stencil registry integrity', () => {
  test('every stencil id is unique — a duplicate card pollutes search and the palette', () => {
    const seen = new Set();
    for (const s of ALL_STENCILS) {
      assert.ok(!seen.has(s.id), `duplicate stencil id ${s.id}`);
      seen.add(s.id);
    }
  });

  test('every search alias points at a registered stencil', () => {
    const ids = new Set(ALL_STENCILS.map((s) => s.id));
    for (const [alias, targets] of Object.entries(SEARCH_ALIASES)) {
      for (const target of targets) {
        assert.ok(ids.has(target), `alias "${alias}" points at unregistered stencil ${target}`);
      }
    }
  });

  test('every lesson-pack stencil resolves to real art, not the fallback stencil', () => {
    const ids = new Set(ALL_STENCILS.map((s) => s.id));
    for (const pack of buildDevOpsDiagramPacks()) {
      for (const el of pack.build()) {
        if (el.type !== 'stencil') continue;
        assert.ok(
          ids.has(el.stencilId),
          `${pack.id} uses unregistered stencil ${el.stencilId} — it would silently render the fallback`
        );
      }
    }
  });
});
