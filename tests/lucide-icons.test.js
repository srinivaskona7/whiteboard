// tests/lucide-icons.test.js — locks on the checked-in Lucide icon pack: the
// generated module imports, every entry is a well-formed stencil registered in
// the shared map, each draw runs against a recording ctx, and the generator is
// idempotent (running it twice reproduces the identical file).
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LUCIDE_STENCILS, LUCIDE_SUBCATEGORIES } from '../stencils/lucide-icons.js';
import { ALL_STENCILS, getStencilById, SEARCH_ALIASES } from '../stencils/index.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GEN_SCRIPT = join(ROOT, 'scripts', 'gen-lucide-icons.js');
const OUT_FILE = join(ROOT, 'stencils', 'lucide-icons.js');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

// Every ctx method a lucide draw can call, as a no-op that records its name.
function recordingCtx() {
  const calls = [];
  const stub = new Proxy(
    {},
    {
      get(_t, prop) {
        if (typeof prop !== 'string') return undefined;
        return (...args) => {
          calls.push(prop);
        };
      },
    }
  );
  return { ctx: stub, calls };
}

describe('Lucide icon stencils', () => {
  test('the generated module is importable and clears the count floor', () => {
    assert.ok(Array.isArray(LUCIDE_STENCILS));
    assert.ok(LUCIDE_STENCILS.length >= 250, `expected >= 250 icons, found ${LUCIDE_STENCILS.length}`);
  });

  test('every entry has a unique lucide- id, a function draw, and resolves via getStencilById', () => {
    const seen = new Set();
    for (const s of LUCIDE_STENCILS) {
      assert.ok(s.id.startsWith('lucide-'), `${s.id} does not start with "lucide-"`);
      assert.ok(!seen.has(s.id), `duplicate lucide stencil id ${s.id}`);
      seen.add(s.id);
      assert.equal(typeof s.draw, 'function', `${s.id} has no draw function`);
      assert.equal(getStencilById(s.id), s, `${s.id} does not resolve via getStencilById`);
    }
  });

  test('every curated subcategory is non-empty', () => {
    assert.ok(LUCIDE_SUBCATEGORIES.length >= 7, 'expected at least 7 curated subcategories');
    for (const cat of LUCIDE_SUBCATEGORIES) {
      const items = LUCIDE_STENCILS.filter((s) => s.category === cat);
      assert.ok(items.length > 0, `curated category ${cat} is empty`);
    }
    const knownCats = new Set(LUCIDE_SUBCATEGORIES);
    for (const s of LUCIDE_STENCILS) {
      assert.ok(knownCats.has(s.category), `${s.id} has unlisted category ${s.category}`);
    }
  });

  test('the pack registers into ALL_STENCILS and its aliases point at registered ids', () => {
    const ids = new Set(ALL_STENCILS.map((s) => s.id));
    for (const s of LUCIDE_STENCILS) assert.ok(ids.has(s.id), `${s.id} is missing from ALL_STENCILS`);
    for (const target of SEARCH_ALIASES.db) assert.ok(ids.has(target), `alias "db" → ${target} is unregistered`);
  });

  test('every draw runs against a stub ctx and strokes at least one path op', () => {
    const PATH_OPS = ['moveTo', 'lineTo', 'ellipse', 'rect', 'roundRect', 'bezierCurveTo', 'quadraticCurveTo'];
    for (const s of LUCIDE_STENCILS) {
      const { ctx, calls } = recordingCtx();
      assert.doesNotThrow(() => s.draw(ctx, 10, 20, 140, 96), `${s.id}.draw threw`);
      assert.ok(calls.includes('stroke'), `${s.id}.draw never stroked`);
      assert.ok(
        PATH_OPS.some((op) => calls.includes(op)),
        `${s.id}.draw issued no path op (calls: ${calls.join(',')})`
      );
    }
  });

  test('draw tolerates a degenerate element box instead of dividing by zero', () => {
    const { ctx } = recordingCtx();
    for (const s of LUCIDE_STENCILS) {
      assert.doesNotThrow(() => s.draw(ctx, 0, 0, 0, 0), `${s.id}.draw threw on a zero box`);
    }
  });

  test('toSvg emits scaled currentColor markup usable by the palette cards', () => {
    for (const s of LUCIDE_STENCILS) {
      const out = s.toSvg(4, 4, 40, 36, '');
      assert.ok(out.startsWith('<g transform="translate('), `${s.id}.toSvg has no transform`);
      assert.ok(out.includes('stroke="currentColor"'), `${s.id}.toSvg does not use currentColor`);
      assert.ok(out.includes(s.svgInner), `${s.id}.toSvg dropped its geometry`);
    }
  });

  test('the generator is idempotent: two runs reproduce the identical file', () => {
    // The generator rewrites the checked-in file — snapshot it so a failed
    // run (e.g. a lucide-static version bump changing geometry mid-cycle)
    // can never leave the tree with a corrupted stencil module.
    const snapshot = readFileSync(OUT_FILE);
    try {
      const before = sha256(snapshot);
      for (let run = 0; run < 2; run++) {
        const res = spawnSync(process.execPath, [GEN_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
        assert.equal(res.status, 0, `generator run ${run + 1} failed: ${res.stderr}`);
        const after = sha256(readFileSync(OUT_FILE));
        assert.equal(after, before, `generator run ${run + 1} changed the checked-in file`);
      }
    } finally {
      writeFileSync(OUT_FILE, snapshot);
    }
  });

  test('the generator refuses to clobber the module when nothing resolves', () => {
    // A missing vendored package must exit non-zero and leave the checked-in
    // module untouched — the pre-fix generator wrote a 3 KB empty file and
    // exited 0, breaking every later import.
    const snapshot = readFileSync(OUT_FILE);
    try {
      const res = spawnSync(
        process.execPath,
        [GEN_SCRIPT],
        { cwd: ROOT, encoding: 'utf8', env: { ...process.env, LUCIDE_ICONS_DIR: join(ROOT, 'nonexistent-dir-' + Date.now()) } }
      );
      assert.notEqual(res.status, 0, 'a zero-icon generator run must fail loudly');
      assert.equal(sha256(readFileSync(OUT_FILE)), sha256(snapshot), 'the checked-in module must be untouched');
    } finally {
      writeFileSync(OUT_FILE, snapshot);
    }
  });

  test('toSvg geometry matches the canvas draw geometry (same inset, same centering)', () => {
    const s = LUCIDE_STENCILS.find((x) => x.id === 'lucide-school');
    const svg = s.toSvg(0, 0, 140, 96);
    const m = svg.match(/translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/);
    assert.ok(m, 'toSvg must emit a translate+scale transform');
    // draw path: pad 8 → scale (96-16)/24, tx (140-80)/2, ty (96-80)/2.
    assert.equal(Number(m[1]), 30);
    assert.equal(Number(m[2]), 8);
    assert.ok(Math.abs(Number(m[3]) - 80 / 24) < 1e-9, 'SVG export must not render larger than the canvas');
    // Degenerate boxes render nothing rather than a negative scale.
    assert.equal(s.toSvg(0, 0, 10, 10).includes('scale(-'), false);
  });
});

// Provenance: lucide stencils must attribute to the Lucide/ISC pack, never the
// Devicon fallback — a wrong license label in tooltips is a compliance bug.
test('lucide stencils carry Lucide provenance (ISC license), not the Devicon fallback', async () => {
  const { getIconProvenance } = await import('../stencils/manifest.js');
  const { getStencilById } = await import('../stencils/index.js');
  const p = getIconProvenance(getStencilById('lucide-school'));
  assert.equal(p.packKey, 'lucide');
  assert.equal(p.provider, 'Lucide');
  assert.equal(p.license, 'ISC License');
  assert.equal(p.upstreamSource, 'https://github.com/lucide-icons/lucide');
});
