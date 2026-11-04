// tests/icon-pack.test.js — DevOps, Cloud & Teaching Icon Pack (2015 icons).
// Covers the generated module, lazy registration, draw/toSvg lockstep,
// per-icon defs namespacing, and the generator's refusal/idempotency rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = join(ROOT, 'stencils', 'icon-pack-icons.js');
const GEN_SCRIPT = join(ROOT, 'scripts', 'gen-icon-pack-icons.js');
const SOURCE = join(
  process.env.HOME || '',
  'Downloads',
  'aws-keys',
  'icons.js'
);

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const pack = await import('../stencils/icon-pack-icons.js');
const registry = await import('../stencils/index.js');

const hasSource = (() => {
  try {
    readFileSync(SOURCE);
    return true;
  } catch {
    return false;
  }
})();

test('the generated pack exposes the full 2015-icon set across its groups', () => {
  assert.equal(pack.PACK_STENCILS.length, 2015);
  const groupSum = pack.PACK_GROUPS.reduce((a, g) => a + g.count, 0);
  assert.equal(groupSum, 2015);
  assert.ok(pack.PACK_GROUPS.length >= 38, `expected >= 38 groups, got ${pack.PACK_GROUPS.length}`);
  for (const g of pack.PACK_GROUPS) {
    assert.ok(g.slug && /^[a-z0-9-]+$/.test(g.slug), `bad group slug: ${g.slug}`);
    assert.ok(g.label && g.count > 0);
  }
});

test('pack stencil ids are unique, pk- prefixed, and grouped under pack/ categories', () => {
  const ids = new Set();
  for (const s of pack.PACK_STENCILS) {
    assert.ok(s.id.startsWith('pk-'), `id not pk- prefixed: ${s.id}`);
    assert.ok(!ids.has(s.id), `duplicate stencil id: ${s.id}`);
    ids.add(s.id);
    assert.ok(s.category.startsWith('pack/'), `bad category: ${s.category}`);
    assert.equal(s.defaultText, ' ', 'icons must place without a caption');
    assert.ok(typeof s.draw === 'function' && typeof s.toSvg === 'function');
    assert.ok(s.svgInner.startsWith('<svg'), 'every stencil must carry its baked markup');
    assert.ok(s.svgInner.includes('viewBox="0 0 64 64"'));
  }
});

test('defs ids are per-icon namespaced so multiple icons can coexist in one SVG', () => {
  // A bare generic id (g1/k1) in ANY icon would let an earlier embedded
  // definition hijack a later reference in one exported SVG or library DOM.
  for (const s of pack.PACK_STENCILS) {
    const bareId = /\sid="(?!pk)[a-z0-9]*"/.exec(s.svgInner);
    assert.ok(!bareId, `${s.id} has an un-namespaced defs id: ${bareId?.[0]}`);
    const ns = s.id.replace(/^pk-/, 'pk');
    const badRef = /url\(#(?!pk)/.exec(s.svgInner);
    assert.ok(!badRef, `${s.id} references an un-namespaced defs id`);
    if (s.svgInner.includes('url(#')) {
      assert.ok(
        s.svgInner.includes(`url(#${ns}-`) || s.svgInner.includes(`href="#${ns}-`),
        `${s.id} references defs outside its own namespace`
      );
    }
  }
});

test('toSvg embeds the same markup at the same geometry draw uses (contain-fit)', () => {
  const s = pack.PACK_STENCILS.find((x) => x.id === 'pk-aws-amazon-ec2');
  assert.ok(s, 'pk-aws-amazon-ec2 must exist');

  // draw and toSvg share packIconGeometry: min(w,h) side, centered.
  const geo = pack.packIconGeometry(100, 200, 140, 96);
  assert.equal(geo.side, 96);
  assert.equal(geo.x, 122);
  assert.equal(geo.y, 200);

  const out = s.toSvg(100, 200, 140, 96);
  assert.ok(out.startsWith(`<svg x="122" y="200" width="96" height="96" `), 'toSvg must inject the contain-fit geometry');
  assert.ok(out.includes(s.svgInner.slice('<svg '.length)), 'toSvg must embed the identical baked markup');

  // Degenerate boxes must not emit garbage.
  assert.equal(s.toSvg(0, 0, 0, 0), '');
  assert.equal(s.toSvg(0, 0, -5, -5), '');
});

test('draw degrades to a dashed placeholder in Node (no Image global) without throwing', () => {
  const s = pack.PACK_STENCILS.find((x) => x.id === 'pk-aws-amazon-ec2');
  const ops = [];
  const ctx = {
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    beginPath: () => ops.push('beginPath'),
    roundRect: (x, y, w, h, r) => ops.push(`roundRect ${x},${y},${w},${h},${r}`),
    stroke: () => ops.push('stroke'),
    setLineDash: (d) => ops.push(`dash ${d}`),
    set lineWidth (v) {},
    get lineWidth () { return 0; },
  };
  assert.doesNotThrow(() => s.draw(ctx, 0, 0, 96, 96));
  assert.ok(ops.includes('beginPath'), 'placeholder path must be drawn');
  assert.ok(!ops.includes('drawImage'), 'no raster path is possible without an Image global');
});

test('registration is lazy, idempotent, and wired into the shared registry', async () => {
  const before = registry.ALL_STENCILS.length;
  // pack ids must not be in the registry before registration
  assert.ok(!registry.isStencilLoaded('pk-aws-amazon-ec2'), 'pack ids start unloaded');
  assert.equal(registry.getStencilById('missing-pk-icon').id, registry.ALL_STENCILS[0].id, 'sanity: unknown ids fall back');

  const m = await registry.ensureIconPackLoaded();
  assert.equal(m, pack, 'ensureIconPackLoaded resolves to the pack module');
  assert.equal(registry.ALL_STENCILS.length, before + 2015, 'registration adds every pack stencil');

  assert.ok(registry.isStencilLoaded('pk-aws-amazon-ec2'));
  assert.equal(registry.getStencilById('pk-aws-amazon-ec2').name, 'Amazon EC2');

  // Second load and re-registration must be no-ops (no duplicate cards).
  const again = await registry.ensureIconPackLoaded();
  assert.equal(again, pack);
  assert.equal(registry.registerIconPackStencils(pack.PACK_STENCILS).length, 0, 're-registration is a no-op');
  const ids = registry.ALL_STENCILS.map((s) => s.id);
  assert.equal(new Set(ids).size, ids.length, 'registry ids stay unique');
});

test('provenance maps pk- ids and pack/ categories to the iconpack source', () => {
  const sources = registry.ICON_PACK_SOURCES;
  assert.ok(sources.iconpack, 'manifest entry must exist');
  const p = registry.getIconProvenance({ id: 'pk-aws-amazon-ec2', category: 'pack/aws' });
  assert.equal(p.provider, sources.iconpack.provider);
  const p2 = registry.getIconProvenance({ id: 'anything', category: 'pack/aws' });
  assert.equal(p2.provider, sources.iconpack.provider);
});

test('group searches resolve through the shared search scoring', () => {
  const hits = pack.PACK_STENCILS.filter((s) =>
    registry.scoreStencilSearchMatch(s, ['ec2']) > 0
  );
  assert.ok(hits.length > 0);
  assert.ok(hits.some((s) => s.id === 'pk-aws-amazon-ec2'));
});

// ---- generator ----

test('the generator is idempotent against the checked-in module', () => {
  if (!hasSource) return; // source file not present on this machine: skip silently
  const snapshot = readFileSync(OUT_FILE);
  const before = sha256(snapshot);
  try {
    execFileSync('node', [GEN_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    assert.equal(sha256(readFileSync(OUT_FILE)), before, 'regeneration must not change the module');
  } finally {
    writeFileSync(OUT_FILE, snapshot);
  }
});

test('the generator refuses zero-icon sources and never clobbers the module', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'wb-pack-empty-'));
  writeFileSync(join(tmp, 'icons.js'), '(function(root){ var ICONS=[]; root.Icons=root.Icons||{}; })(this);');
  const snapshot = readFileSync(OUT_FILE);
  try {
    let failed = false;
    try {
      execFileSync('node', [GEN_SCRIPT], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ICON_PACK_SOURCE: join(tmp, 'icons.js'), ICON_PACK_OUT: join(tmp, 'out.js') },
      });
    } catch {
      failed = true; // generator must exit non-zero
    }
    assert.ok(failed, 'the generator must exit 1 on an empty pack');
    assert.ok(!existsSync(join(tmp, 'out.js')), 'an empty pack must not produce an output module');
  } finally {
    writeFileSync(OUT_FILE, snapshot);
  }
});

test('the generator rejects a malformed source instead of guessing', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'wb-pack-bad-'));
  writeFileSync(join(tmp, 'icons.js'), 'not-an-icons-file.js');
  const snapshot = readFileSync(OUT_FILE);
  try {
    let failed = false;
    try {
      execFileSync('node', [GEN_SCRIPT], {
        cwd: ROOT,
        encoding: 'utf8',
        env: { ...process.env, ICON_PACK_SOURCE: join(tmp, 'icons.js'), ICON_PACK_OUT: join(tmp, 'out.js') },
      });
    } catch {
      failed = true;
    }
    assert.ok(failed, 'the generator must exit 1 on a malformed source');
  } finally {
    writeFileSync(OUT_FILE, snapshot);
  }
});

test('the generator refuses hostile SVG markup (defense-in-depth for fresh downloads)', () => {
  // Consumers inject the baked markup raw (library innerHTML + verbatim
  // SVG-export embed), so a future re-run against a hostile icons.js must
  // not ship handlers, scripts, or external references.
  const tmp = mkdtempSync(join(tmpdir(), 'wb-pack-hostile-'));
  const clean = { id: 'demo.clean', name: 'Clean', group: 'Demo', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#eee"/></svg>' };
  const hostile = [
    '<script>alert(1)</script>',
    '<rect onload="alert(1)" width="8" height="8"/>',
    '<image href="https://evil.example/x.png" width="8" height="8"/>',
    '<a xlink:href="https://evil.example"><rect width="8" height="8"/></a>',
    '<rect width="8" height="8" fill="url(data:text/html;base64,PHNjcmlwdD4p"/>',
  ].map((payload, i) => ({
    id: `demo.hostile-${i}`,
    name: `Hostile ${i}`,
    group: 'Demo',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${payload}</svg>`,
  }));
  writeFileSync(join(tmp, 'icons.js'), `var ICONS=${JSON.stringify([clean, ...hostile])};`);
  execFileSync('node', [GEN_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    env: { ...process.env, ICON_PACK_SOURCE: join(tmp, 'icons.js'), ICON_PACK_OUT: join(tmp, 'out.js') },
  });
  const out = readFileSync(join(tmp, 'out.js'), 'utf8');
  assert.ok(out.includes('pk-demo-clean'), 'the clean icon must survive');
  for (let i = 0; i < hostile.length; i++) {
    assert.ok(!out.includes(`pk-demo-hostile-${i}`), `hostile icon ${i} must be rejected`);
  }
  assert.ok(!out.includes('alert(1)'), 'no handler payload may reach the module');
  // today's real pack must pass the same filter untouched
  for (const s of pack.PACK_STENCILS) {
    assert.ok(!/<script|<foreignObject|<image|javascript:|xlink:|data:|\son[a-z]+\s*=|\shref\s*=\s*"(?!#)|\ssrc\s*=/i.test(s.svgInner), `${s.id} contains forbidden markup`);
  }
});
