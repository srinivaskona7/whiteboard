// tests/icon-pack.test.js — DevOps, Cloud & Teaching Icon Pack (3404 tile icons,
// 263 line glyphs, 183 commands). Covers the generated modules, lazy
// registration, draw/toSvg lockstep for tiles and glyphs, per-icon defs
// namespacing, the static index, and the generator's refusal/idempotency rules.
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
const INDEX_FILE = join(ROOT, 'stencils', 'icon-pack-index.js');
const COMMANDS_FILE = join(ROOT, 'stencils', 'icon-pack-commands.js');
const GEN_SCRIPT = join(ROOT, 'scripts', 'gen-icon-pack-icons.js');
const SOURCE = join(
  process.env.HOME || '',
  'Documents',
  'Enchanté',
  'Conversations',
  '4DF0FA4A-A8B7-4198-86CD-6D9A7C20D4D7',
  'icon-pack',
  'icons.json'
);

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const pack = await import('../stencils/icon-pack-icons.js');
const registry = await import('../stencils/index.js');
const { PACK_COMMANDS, PACK_COMMAND_GROUPS } = await import('../stencils/icon-pack-commands.js');
const { PACK_INDEX } = await import('../stencils/icon-pack-index.js');
const tiles = pack.PACK_STENCILS.filter((s) => !s.isGlyph);
const glyphs = pack.PACK_STENCILS.filter((s) => s.isGlyph);

const hasSource = (() => {
  try {
    readFileSync(SOURCE);
    return true;
  } catch {
    return false;
  }
})();

test('the generated pack exposes all 3404 tile icons and 263 line glyphs', () => {
  assert.equal(pack.PACK_STENCILS.length, 3404 + 263);
  assert.equal(tiles.length, 3404);
  assert.equal(glyphs.length, 263);
  const groupSum = pack.PACK_GROUPS.reduce((a, g) => a + g.count, 0);
  assert.equal(groupSum, 3404);
  assert.equal(pack.PACK_GROUPS.length, 77);
  assert.equal(pack.GLYPH_SETS.reduce((a, g) => a + g.count, 0), 263);
  assert.equal(pack.GLYPH_SETS.length, 9);
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
    assert.ok(s.svgInner.includes(s.isGlyph ? 'viewBox="0 0 24 24"' : 'viewBox="0 0 64 64"'));
    assert.ok([0, 1, 2, 3, 4].includes(s.level), `${s.id} has level ${s.level}`);
  }
});

test('the 39 concept groups carry beginner→expert levels; the other 38 groups are unleveled', () => {
  const leveled = tiles.filter((s) => s.level > 0);
  assert.equal(leveled.length, 1389);
  const leveledGroups = new Set(leveled.map((s) => s.category));
  assert.equal(leveledGroups.size, 39);
  for (const cat of leveledGroups) {
    assert.ok(tiles.filter((s) => s.category === cat).every((s) => s.level > 0), `${cat} mixes leveled and unleveled icons`);
  }
  assert.equal(tiles.find((s) => s.id === 'pk-awsvpc-vpc-secondary-cidr').level, 3);
  assert.equal(tiles.find((s) => s.id === 'pk-aws-amazon-ec2').level, 0);
});

test('line glyphs are filed in named sets, draw in currentColor and carry no fixed colour', () => {
  for (const s of glyphs) {
    assert.match(s.id, /^pk-glyph-[a-z0-9-]+$/);
    assert.match(s.category, /^pack\/glyphs-[a-z]+$/);
    assert.notEqual(s.category, 'pack/glyphs-more', `${s.id} was never filed into a named glyph set`);
    assert.equal(s.color, undefined, 'placement must use the current stroke colour');
    assert.ok(s.svgInner.includes('stroke="currentColor"'));
  }
  const byId = Object.fromEntries(glyphs.map((s) => [s.id, s]));
  assert.equal(byId['pk-glyph-lb'].name, 'Load balancer');
  assert.equal(byId['pk-glyph-number-1'].name, 'Number 1');
  assert.equal(byId['pk-glyph-label-cfg'].name, 'Label .cfg');
  assert.equal(byId['pk-glyph-subpub'].category, 'pack/glyphs-tech');
});

test('glyph toSvg and draw share one padded contain-fit geometry', () => {
  const s = glyphs.find((x) => x.id === 'pk-glyph-check');
  const geo = pack.glyphGeometry(100, 200, 140, 96);
  assert.deepEqual(geo, { x: 130, y: 208, side: 80 });
  const out = s.toSvg(100, 200, 140, 96);
  assert.ok(out.startsWith('<svg x="130" y="208" width="80" height="80" '), out.slice(0, 80));
  assert.ok(out.includes(s.svgInner.slice('<svg '.length)));
  assert.equal(s.toSvg(0, 0, 16, 16), '', 'a box smaller than the padding emits nothing');

  const ops = [];
  const ctx = {
    strokeStyle: '#ff0000',
    save() {},
    restore() {},
    beginPath() {},
    stroke() {},
    setLineDash() {},
    roundRect: (x, y, w, h) => ops.push([x, y, w, h]),
  };
  s.draw(ctx, 100, 200, 140, 96);
  assert.deepEqual(ops[0], [133, 211, 74, 74], 'the Node placeholder sits on the same geometry');
});

test('glyph rasters take the element stroke colour, validated, with a slate fallback', () => {
  assert.equal(pack.glyphColor('#ff0000'), '#ff0000');
  assert.equal(pack.glyphColor('rgba(15, 23, 42, 0.5)'), 'rgba(15, 23, 42, 0.5)');
  assert.equal(pack.glyphColor({}), pack.GLYPH_FALLBACK_COLOR, 'a gradient strokeStyle falls back');
  assert.equal(pack.glyphColor('red" onload="x'), pack.GLYPH_FALLBACK_COLOR, 'nothing but a colour reaches the attribute');

  const srcs = [];
  const prevImage = globalThis.Image;
  globalThis.Image = class {
    set src(v) {
      srcs.push(decodeURIComponent(v));
    }
  };
  try {
    const s = glyphs.find((x) => x.id === 'pk-glyph-rocket');
    const ctx = { strokeStyle: '#16a34a', save() {}, restore() {}, beginPath() {}, stroke() {}, setLineDash() {}, roundRect() {} };
    s.draw(ctx, 0, 0, 96, 96);
    ctx.strokeStyle = { addColorStop() {} };
    s.draw(ctx, 0, 0, 96, 96);
  } finally {
    if (prevImage === undefined) delete globalThis.Image;
    else globalThis.Image = prevImage;
  }
  assert.equal(srcs.length, 2, 'one raster per colour');
  assert.ok(srcs[0].includes('<svg color="#16a34a" '));
  assert.ok(srcs[1].includes(`<svg color="${pack.GLYPH_FALLBACK_COLOR}" `));
});

test('commands are validated data linked to real pack icons', () => {
  assert.equal(PACK_COMMANDS.length, 183);
  assert.equal(PACK_COMMAND_GROUPS.reduce((a, g) => a + g.count, 0), 183);
  const byId = new Map(pack.PACK_STENCILS.map((s) => [s.id, s]));
  const ids = new Set();
  for (const c of PACK_COMMANDS) {
    assert.ok(!ids.has(c.id), `duplicate command ${c.id}`);
    ids.add(c.id);
    assert.ok(byId.has(c.icon), `${c.id} links missing icon ${c.icon}`);
    assert.equal(c.cat, byId.get(c.icon).category);
    assert.ok([1, 2, 3, 4].includes(c.level));
    assert.equal(typeof c.risky, 'boolean');
    assert.ok(c.cmd.trim() && c.title.trim());
  }
  assert.equal(PACK_COMMANDS.filter((c) => c.risky).length, 10);
});

test('the static index agrees with the generated pack and commands', () => {
  assert.equal(PACK_INDEX.icons, 3404);
  assert.equal(PACK_INDEX.glyphs, 263);
  assert.equal(PACK_INDEX.commands, 183);
  assert.deepEqual(
    PACK_INDEX.groups.map((g) => [g.slug, g.count]),
    pack.PACK_GROUPS.map((g) => [g.slug, g.count])
  );
  for (const g of PACK_INDEX.groups) {
    assert.equal(g.levels.reduce((a, n) => a + n, 0), g.count, `${g.slug} level histogram`);
    for (let l = 0; l <= 4; l++) {
      assert.equal(g.levels[l], tiles.filter((s) => s.category === `pack/${g.slug}` && s.level === l).length);
    }
  }
  assert.deepEqual(PACK_INDEX.glyphSets, pack.GLYPH_SETS);
  assert.equal(PACK_INDEX.commandTally.reduce((a, row) => a + row[3], 0), 183);
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
  assert.equal(registry.ALL_STENCILS.length, before + 3404 + 263, 'registration adds every pack stencil');

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

test('the generator is idempotent against the checked-in modules', () => {
  if (!hasSource) return; // source file not present on this machine: skip silently
  const files = [OUT_FILE, INDEX_FILE, COMMANDS_FILE];
  const snapshots = files.map((f) => readFileSync(f));
  try {
    execFileSync('node', [GEN_SCRIPT], { cwd: ROOT, encoding: 'utf8' });
    files.forEach((f, i) => {
      assert.equal(sha256(readFileSync(f)), sha256(snapshots[i]), `regeneration must not change ${f}`);
    });
  } finally {
    files.forEach((f, i) => writeFileSync(f, snapshots[i]));
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
    assert.ok(!existsSync(join(tmp, 'icon-pack-index.js')), 'nor an index module');
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
    '<style>body{display:none}</style>',
    '<a href="#x"><animate attributeName="href" to="javas&#99;ript:alert(1)"/><rect width="8" height="8"/></a>',
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
    assert.ok(!/<script|<foreignObject|<image|<style|<animate|<set\b|<a\b|javascript:|xlink:|data:|\son[a-z]+\s*=|\shref\s*=\s*"(?!#)|\ssrc\s*=/i.test(s.svgInner), `${s.id} contains forbidden markup`);
  }
});

test('the generator reads the JSON pack: levels, glyph filtering and validated commands', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'wb-pack-json-'));
  const tile = (id, extra = {}) => ({
    id,
    name: id,
    group: 'Demo: Concepts',
    tags: ['demo'],
    color: '#123456',
    svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#eee"/></svg>',
    ...extra,
  });
  writeFileSync(
    join(tmp, 'icons.json'),
    JSON.stringify({
      icons: [tile('demo.basic', { level: 2 }), tile('demo.flat'), tile('demo.badlevel', { level: 9 })],
      glyphs: {
        check: '<path d="M8 12l3 3 5-6"/>',
        brandnewkey: '<circle cx="12" cy="12" r="4"/>',
        style: '<style>*{display:none}</style>',
        handler: '<rect onload="alert(1)" width="4" height="4"/>',
        nested: '<svg><path d="M0 0"/></svg>',
        number: 42,
      },
    })
  );
  writeFileSync(
    join(tmp, 'commands.json'),
    JSON.stringify({
      groups: [{ folder: 'demo', title: 'Demo commands', count: 3 }],
      commands: [
        { id: 'demo.ok', group: 'demo', level: 1, risky: false, title: 'List', cmd: 'ls -l', note: '', iconId: 'demo.basic', color: '#123456' },
        { id: 'demo.noicon', group: 'demo', level: 2, risky: true, title: 'Gone', cmd: 'rm -i x', note: 'careful', iconId: 'demo.missing' },
        { id: 'demo.bad', group: 'demo', level: 1, title: '', cmd: '' },
      ],
    })
  );
  execFileSync('node', [GEN_SCRIPT], {
    cwd: ROOT,
    encoding: 'utf8',
    stdio: 'pipe',
    env: { ...process.env, ICON_PACK_SOURCE: join(tmp, 'icons.json'), ICON_PACK_OUT: join(tmp, 'out.js') },
  });
  const out = readFileSync(join(tmp, 'out.js'), 'utf8');
  assert.ok(out.includes('"pk-demo-basic":{') && out.includes('"l":2'), 'levels 1-4 are kept');
  assert.ok(!/"pk-demo-badlevel":\{[^}]*"l":/.test(out), 'an out-of-range level is dropped to unleveled');
  assert.ok(out.includes('"pk-glyph-check"'), 'a clean glyph survives');
  assert.ok(out.includes('"pk-glyph-brandnewkey":{"g":"glyphs-more"'), 'an unknown glyph key lands in glyphs-more');
  for (const bad of ['style', 'handler', 'nested', 'number']) assert.ok(!out.includes(`"pk-glyph-${bad}"`), `${bad} glyph must be rejected`);
  assert.ok(!out.includes('alert(1)') && !out.includes('display:none'));

  const index = readFileSync(join(tmp, 'icon-pack-index.js'), 'utf8');
  assert.ok(index.includes('"icons": 3') && index.includes('"glyphs": 2') && index.includes('"commands": 2'));

  const cmds = readFileSync(join(tmp, 'icon-pack-commands.js'), 'utf8');
  assert.ok(cmds.includes('"id": "demo.ok"') && cmds.includes('"icon": "pk-demo-basic"'));
  assert.ok(cmds.includes('"id": "demo.noicon"') && cmds.includes('"icon": ""'), 'a command with a missing icon is kept, unlinked');
  assert.ok(!cmds.includes('demo.bad'), 'a malformed command is skipped');
});

test('the generator refuses a malformed commands file without writing anything', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'wb-pack-badcmd-'));
  writeFileSync(
    join(tmp, 'icons.json'),
    JSON.stringify({ icons: [{ id: 'demo.a', name: 'A', group: 'Demo', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"></svg>' }] })
  );
  writeFileSync(join(tmp, 'commands.json'), '{ not json');
  let failed = false;
  try {
    execFileSync('node', [GEN_SCRIPT], {
      cwd: ROOT,
      stdio: 'pipe',
      env: { ...process.env, ICON_PACK_SOURCE: join(tmp, 'icons.json'), ICON_PACK_OUT: join(tmp, 'out.js') },
    });
  } catch {
    failed = true;
  }
  assert.ok(failed, 'a broken commands.json must stop the run');
  assert.ok(!existsSync(join(tmp, 'out.js')) && !existsSync(join(tmp, 'icon-pack-index.js')));
});
