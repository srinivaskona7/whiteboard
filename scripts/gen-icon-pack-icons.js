// scripts/gen-icon-pack-icons.js
// Generates the lazy DevOps icon pack modules from the offline "DevOps, Cloud,
// Networking & Teaching Icon Pack" (user-supplied):
//
//   stencils/icon-pack-icons.js     64x64 tile icons + 24x24 line glyphs — the
//                                   lazy `pk-` chunk
//   stencils/icon-pack-commands.js  copy-ready commands linked to pack icons
//                                   (lazy chunk; only when commands.json exists)
//   stencils/icon-pack-index.js     small static summary (group sizes, level
//                                   histograms, command tally) so the library's
//                                   Topics tab can show counts without loading
//                                   the multi-MB chunk
//
// The pack's tile SVGs use gradients, clip paths, <text> labels and transforms
// — none of which the Lucide stroke-geometry compiler handles — so this
// generator bakes the raw (id-namespaced) SVG markup and the runtime module
// rasterizes it via Image + data URL for canvas and embeds it for SVG export.
//
// Usage:
//   node scripts/gen-icon-pack-icons.js
// Env:
//   ICON_PACK_SOURCE        icons.json (current pack format) or a legacy icons.js
//                           holding `var ICONS=[…]` (default: the pack folder
//                           under ~/Documents/Enchanté/Conversations)
//   ICON_PACK_COMMANDS      commands.json (default: next to the source; skipped
//                           when absent)
//   ICON_PACK_OUT           icon module (default stencils/icon-pack-icons.js)
//   ICON_PACK_INDEX_OUT     index module (default: next to ICON_PACK_OUT)
//   ICON_PACK_COMMANDS_OUT  commands module (default: next to ICON_PACK_OUT)
//
// Every source file is UNTRUSTED DOWNLOADED DATA: this script JSON.parses it
// and never executes it. Nothing is written unless every input validates.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEFAULT_SOURCE = join(
  homedir(),
  'Documents',
  'Enchanté',
  'Conversations',
  '4DF0FA4A-A8B7-4198-86CD-6D9A7C20D4D7',
  'icon-pack',
  'icons.json'
);
const SRC = process.env.ICON_PACK_SOURCE || DEFAULT_SOURCE;
const OUT = process.env.ICON_PACK_OUT || join(ROOT, 'stencils', 'icon-pack-icons.js');
const INDEX_OUT = process.env.ICON_PACK_INDEX_OUT || join(dirname(OUT), 'icon-pack-index.js');
const COMMANDS_SRC = process.env.ICON_PACK_COMMANDS || join(dirname(SRC), 'commands.json');
const COMMANDS_OUT = process.env.ICON_PACK_COMMANDS_OUT || join(dirname(OUT), 'icon-pack-commands.js');

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(SRC)) {
  console.error(`Icon pack source not found: ${SRC}`);
  fail('Set ICON_PACK_SOURCE to the downloaded icons.json (or legacy icons.js) path.');
}

const slugify = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Rejects script tags, event handlers, external/embedded references and
// non-local URLs. Local fragment references (href="#pk…") stay allowed.
// The quote class covers single AND double quotes — a single-quoted
// href='https://…' must not slip past a double-quote-only pattern.
// <style> would restyle the whole page once the markup is injected into the
// library DOM, and <animate>/<set>/<a> can rewrite an href to an
// entity-encoded javascript: URL that the plain-text check cannot see.
const FORBIDDEN_MARKUP =
  /<script|<foreignObject|<image|<style|<animate|<set\b|<a\b|javascript:|xlink:|data:|\son[a-z]+\s*=|\shref\s*=\s*(["'])(?!#)|\ssrc\s*=/i;

const LEVEL_RANGE = (v) => (Number.isInteger(v) && v >= 1 && v <= 4 ? v : 0);

// ---- source parsing ----

function readIconSource(path) {
  const raw = readFileSync(path, 'utf8');
  // Current pack format: icons.json = { icons: [...], glyphs: { key: markup } }.
  if (raw.trimStart().startsWith('{')) {
    let data;
    try {
      data = JSON.parse(raw);
    } catch (err) {
      fail(`Icon pack JSON is not valid: ${err.message}`);
    }
    if (!data || !Array.isArray(data.icons)) fail('Icon pack JSON has no `icons` array — unexpected format.');
    const glyphs = data.glyphs && typeof data.glyphs === 'object' && !Array.isArray(data.glyphs) ? data.glyphs : {};
    return { icons: data.icons, glyphs };
  }
  // Legacy format: an IIFE holding `var ICONS=[ ... ];` of plain JSON objects.
  const MARK = 'var ICONS=';
  const arrStart = raw.indexOf(MARK);
  if (arrStart === -1) fail('Icon pack source is neither JSON nor a `var ICONS=` script — unexpected format.');
  const arrEnd = raw.indexOf('];', arrStart);
  if (arrEnd === -1) fail('Icon pack source ICONS array is not terminated — unexpected format.');
  let icons;
  try {
    icons = JSON.parse(raw.slice(arrStart + MARK.length, arrEnd + 1));
  } catch (err) {
    fail(`Icon pack array is not valid JSON: ${err.message}`);
  }
  return { icons, glyphs: {} };
}

const source = readIconSource(SRC);
if (!Array.isArray(source.icons) || source.icons.length === 0) {
  fail('Icon pack array is empty — refusing to write (would clobber the checked-in module).');
}

// ---- tile icons ----

// Validation + namespace pass. Gradient/clip ids inside each SVG are generic
// ("g1", "k1"); embedding several icons in one exported SVG (or one library
// DOM) makes the first definition win for every later reference. Rewrite each
// id to a per-icon namespace so definitions stay unique.
const namespaceIds = (markup, ns) =>
  markup
    .replace(/\sid="([^"]+)"/g, (m, def) => ` id="${ns}-${def}"`)
    .replace(/url\(#([^)]+)\)/g, (m, def) => `url(#${ns}-${def})`)
    .replace(/href="#([^"]+)"/g, (m, def) => `href="#${ns}-${def}"`);

const seenIds = new Set();
const seenSlugs = new Set();
const slugById = new Map(); // source id -> pk slug (commands link icons by source id)
const groups = []; // first-appearance order
const groupCount = new Map();
const groupLevels = new Map();
const entries = [];

for (const icon of source.icons) {
  const { id, name, group, tags, color, svg } = icon || {};
  if (typeof id !== 'string' || typeof name !== 'string' || typeof svg !== 'string') {
    console.error(`Skipping malformed icon entry: ${JSON.stringify(icon).slice(0, 120)}`);
    continue;
  }
  if (!svg.startsWith('<svg')) {
    console.error(`Skipping icon without an <svg> payload: ${id}`);
    continue;
  }
  if (!svg.includes('viewBox="0 0 64 64"')) {
    console.error(`Skipping icon without a 0 0 64 64 viewBox: ${id}`);
    continue;
  }
  // The source is untrusted downloaded data and consumers inject the markup
  // raw (library innerHTML + verbatim SVG-export embed). Handlers and
  // embedded/external references must never ship, even if today's source is
  // clean — the generator's whole premise is re-running on a fresh download.
  if (FORBIDDEN_MARKUP.test(svg)) {
    console.error(`Rejecting icon with forbidden markup (script/handlers/external refs): ${id}`);
    continue;
  }
  if (seenIds.has(id)) {
    console.error(`Skipping duplicate id: ${id}`);
    continue;
  }
  seenIds.add(id);

  let slug = `pk-${slugify(id)}`;
  if (slug === 'pk-') slug = `pk-icon-${entries.length}`;
  if (seenSlugs.has(slug)) fail(`Duplicate slug after normalisation (${slug}, from ${id}) — pack format changed.`);
  seenSlugs.add(slug);
  slugById.set(id, slug);

  const groupSlug = slugify(group || 'misc');
  if (!groupCount.has(groupSlug)) {
    groupCount.set(groupSlug, 0);
    groupLevels.set(groupSlug, [0, 0, 0, 0, 0]);
    groups.push({ slug: groupSlug, label: group || 'Misc' });
  }
  const level = LEVEL_RANGE(icon.level);
  groupCount.set(groupSlug, groupCount.get(groupSlug) + 1);
  groupLevels.get(groupSlug)[level] += 1;

  entries.push({
    slug,
    name,
    groupSlug,
    level,
    color: typeof color === 'string' ? color : '#2563eb',
    tags: Array.isArray(tags) ? tags.join(' ') : '',
    svg: namespaceIds(svg, slug.replace(/^pk-/, 'pk')),
  });
}

if (entries.length === 0) {
  fail('Zero usable icons after validation — refusing to write (would clobber the checked-in module).');
}

// ---- line glyphs ----

// The pack draws each tile around a 24x24 stroke glyph and ships the glyphs on
// their own. Every glyph key is filed into a named set here, in reading order;
// a key a future pack adds lands in "glyphs-more" (tests assert it is empty
// for today's pack, so a new key is filed deliberately, not by accident).
const GLYPH_SETS = [
  {
    slug: 'glyphs-arrows',
    label: 'Line Glyphs: Arrows & Motion',
    keys: 'arrowr arrowl up down arrowur arrowdr arrowboth darrow curved routepath chevr chevl chevu chevd dchev redo undo retry swap sort expand collapse fullscreen zoomin zoomout scaleup scaledown scaleout scalein trendup trenddown download upload login logout share skip',
  },
  {
    slug: 'glyphs-numbers',
    label: 'Line Glyphs: Numbers, Labels & Symbols',
    keys: 'n:1 n:2 n:3 n:4 n:5 n:6 n:7 n:8 n:9 n:10 n:11 n:12 t:.sh t:.py t:.yml t:toml t:.ini t:.cfg t:.conf t:.tf t:.sql t:.pem t:/24 t:IPv6 t:VS plus minus equals divide percent hash at ampersand',
  },
  {
    slug: 'glyphs-shapes',
    label: 'Line Glyphs: Shapes',
    keys: 'circle square triangle diamond pentagon hexagon star heart cross cube dashbox decision',
  },
  {
    slug: 'glyphs-status',
    label: 'Line Glyphs: Status & Feedback',
    keys: 'check checkbox xcircle close warn info question ban dotbig traffic flag target pulse gauge bars1 bars2 bars3 bars4 loading hourglass clock play pause stop power toggleon toggleoff bell thumbup thumbdown smile trophy',
  },
  {
    slug: 'glyphs-interface',
    label: 'Line Glyphs: Interface & Actions',
    keys: 'home menu search filter sliders gear wrench edit copy paste save trash link paperclip tag bookmark pin sticky clipboard listcheck notebook calendar table chart chartbar pie image camera video mic keyboard mouse printer scissors',
  },
  {
    slug: 'glyphs-tech',
    label: 'Line Glyphs: Tech & Infrastructure',
    keys: 'code terminal doc json folder database server rack vm chip laptop monitor cloud bucket package layers network router switch wifi globe tower radio plug usb battery bolt lb gate nat endpt listener tunnel subpub subpriv subiso flowlog packet stream queue mesh pipeline infinity helm commit branch branchsplit merge diff bug bot dev snap',
  },
  {
    slug: 'glyphs-security',
    label: 'Line Glyphs: Security',
    keys: 'lock unlock key shield shieldcheck firewall cert policy idbadge eye eyeoff hood skull fish',
  },
  {
    slug: 'glyphs-people',
    label: 'Line Glyphs: People, Business & Teaching',
    keys: 'user users contact crown headset chat mail phone phonecall megaphone presentation cap school book building factory store briefcase money card cart invoice',
  },
  {
    slug: 'glyphs-everyday',
    label: 'Line Glyphs: Everyday & Nature',
    keys: 'sun moon rain snowflake drop flame leaf tree mountain umbrella thermo map compass car bicycle plane truck rocket coffee music gamepad gift bulb flask scale watch',
  },
  { slug: 'glyphs-more', label: 'Line Glyphs: More', keys: '' },
];

// Readable names for keys whose title-cased form would be cryptic.
const GLYPH_NAMES = {
  arrowboth: 'Two-way arrow',
  arrowdr: 'Arrow down-right',
  arrowl: 'Arrow left',
  arrowr: 'Arrow right',
  arrowur: 'Arrow up-right',
  at: 'At sign',
  ban: 'Blocked',
  bars1: 'Level bars 1',
  bars2: 'Level bars 2',
  bars3: 'Level bars 3',
  bars4: 'Level bars 4',
  branchsplit: 'Branch split',
  cap: 'Graduation cap',
  cert: 'Certificate',
  chart: 'Line chart',
  chartbar: 'Bar chart',
  chevd: 'Chevron down',
  chevl: 'Chevron left',
  chevr: 'Chevron right',
  chevu: 'Chevron up',
  cross: 'Plus shape',
  darrow: 'Dashed arrow',
  dashbox: 'Dashed box',
  dchev: 'Double chevron',
  dev: 'Developer',
  doc: 'Document',
  dotbig: 'Status dot',
  endpt: 'Endpoint',
  eyeoff: 'Hidden',
  fish: 'Canary',
  flowlog: 'Flow log',
  gate: 'Gateway',
  hood: 'Attacker',
  idbadge: 'ID badge',
  json: 'JSON',
  lb: 'Load balancer',
  listcheck: 'Checklist',
  mesh: 'Service mesh',
  nat: 'NAT',
  phonecall: 'Phone call',
  pie: 'Pie chart',
  rack: 'Server rack',
  routepath: 'Route path',
  scale: 'Balance scale',
  scaledown: 'Scale down',
  scalein: 'Scale in',
  scaleout: 'Scale out',
  scaleup: 'Scale up',
  shieldcheck: 'Shield check',
  snap: 'Snapshot',
  subiso: 'Isolated subnet',
  subpriv: 'Private subnet',
  subpub: 'Public subnet',
  thermo: 'Thermometer',
  thumbdown: 'Thumbs down',
  thumbup: 'Thumbs up',
  toggleoff: 'Toggle off',
  toggleon: 'Toggle on',
  traffic: 'Traffic light',
  trenddown: 'Trend down',
  trendup: 'Trend up',
  usb: 'USB',
  vm: 'Virtual machine',
  warn: 'Warning',
  xcircle: 'Error',
  zoomin: 'Zoom in',
  zoomout: 'Zoom out',
};

const glyphSlug = (key) => {
  if (/^n:\d+$/.test(key)) return `number-${key.slice(2)}`;
  if (key.startsWith('t:')) return `label-${slugify(key.slice(2))}`;
  return slugify(key);
};

const glyphName = (key) => {
  if (GLYPH_NAMES[key]) return GLYPH_NAMES[key];
  if (/^n:\d+$/.test(key)) return `Number ${key.slice(2)}`;
  if (key.startsWith('t:')) return `Label ${key.slice(2)}`;
  return key.charAt(0).toUpperCase() + key.slice(1);
};

const setOfKey = new Map();
for (const set of GLYPH_SETS) {
  for (const key of set.keys.split(/\s+/).filter(Boolean)) {
    if (setOfKey.has(key)) fail(`Glyph key "${key}" is filed in two sets (${setOfKey.get(key)}, ${set.slug}).`);
    setOfKey.set(key, set.slug);
  }
}

const glyphEntries = [];
const glyphsBySet = new Map(GLYPH_SETS.map((s) => [s.slug, []]));
for (const [key, inner] of Object.entries(source.glyphs)) {
  if (typeof inner !== 'string' || !inner.trim() || inner.length > 4000) {
    console.error(`Skipping malformed glyph: ${JSON.stringify(key).slice(0, 60)}`);
    continue;
  }
  if (FORBIDDEN_MARKUP.test(inner) || /<\/?svg\b/i.test(inner)) {
    console.error(`Rejecting glyph with forbidden markup: ${JSON.stringify(key).slice(0, 60)}`);
    continue;
  }
  const slugPart = glyphSlug(key);
  if (!slugPart) {
    console.error(`Skipping glyph with an unusable key: ${JSON.stringify(key).slice(0, 60)}`);
    continue;
  }
  const slug = `pk-glyph-${slugPart}`;
  if (seenSlugs.has(slug)) fail(`Duplicate slug after normalisation (${slug}, from glyph ${key}) — pack format changed.`);
  seenSlugs.add(slug);
  const set = setOfKey.get(key) || 'glyphs-more';
  const words = key.replace(/^[nt]:/, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
  glyphsBySet.get(set).push({
    key,
    slug,
    set,
    name: glyphName(key),
    tags: ['glyph', 'line', words, set.replace('glyphs-', '')].filter(Boolean).join(' '),
    svg: namespaceIds(inner, slug.replace(/^pk-/, 'pk')),
  });
}
const keyOrder = (set) => set.keys.split(/\s+/).filter(Boolean);
for (const set of GLYPH_SETS) {
  const order = keyOrder(set);
  const list = glyphsBySet.get(set.slug);
  // Curated sets follow their reading order; "more" keeps source order.
  if (order.length) list.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  glyphEntries.push(...list);
}
const glyphSetSummary = GLYPH_SETS.map((s) => ({ slug: s.slug, label: s.label, count: glyphsBySet.get(s.slug).length })).filter(
  (s) => s.count > 0
);

// ---- commands ----

function readCommands(path) {
  let data;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    fail(`Commands file is not valid JSON (${path}): ${err.message}`);
  }
  if (!data || !Array.isArray(data.commands)) fail('Commands file has no `commands` array — unexpected format.');
  const groupTitles = new Map();
  for (const g of Array.isArray(data.groups) ? data.groups : []) {
    if (g && typeof g.folder === 'string' && typeof g.title === 'string') groupTitles.set(g.folder, g.title.slice(0, 120));
  }
  const seen = new Set();
  const out = [];
  for (const c of data.commands) {
    const { id, group, title, cmd, note, iconId, color } = c || {};
    if (
      typeof id !== 'string' ||
      !id ||
      id.length > 160 ||
      typeof group !== 'string' ||
      !/^[a-z0-9-]{1,40}$/i.test(group) ||
      typeof title !== 'string' ||
      !title.trim() ||
      title.length > 200 ||
      typeof cmd !== 'string' ||
      !cmd.trim() ||
      cmd.length > 4000
    ) {
      console.error(`Skipping malformed command: ${JSON.stringify(c).slice(0, 120)}`);
      continue;
    }
    if (seen.has(id)) {
      console.error(`Skipping duplicate command id: ${id}`);
      continue;
    }
    seen.add(id);
    const icon = typeof iconId === 'string' ? slugById.get(iconId) || '' : '';
    if (!icon) console.error(`Command ${id} links an icon that is not in the pack (${iconId}) — kept without an icon.`);
    const iconEntry = icon ? entryBySlug.get(icon) : null;
    out.push({
      id,
      group: group.toLowerCase(),
      groupTitle: groupTitles.get(group) || (typeof c.groupTitle === 'string' ? c.groupTitle.slice(0, 120) : group),
      title: title.trim(),
      cmd,
      note: typeof note === 'string' ? note.slice(0, 1000) : '',
      level: LEVEL_RANGE(c.level),
      risky: c.risky === true,
      icon,
      cat: iconEntry ? `pack/${iconEntry.groupSlug}` : '',
      color: typeof color === 'string' && /^#[0-9a-f]{3,8}$/i.test(color) ? color : '',
    });
  }
  if (out.length === 0) fail('Zero usable commands after validation — refusing to write.');
  return out;
}

const entryBySlug = new Map(entries.map((e) => [e.slug, e]));
const commands = existsSync(COMMANDS_SRC) ? readCommands(COMMANDS_SRC) : null;

// ---- module text ----

const sourceLabel = basename(dirname(SRC)) === 'icon-pack' ? 'icon-pack/icons.json' : basename(SRC);

const HEADER = `// stencils/icon-pack-icons.js — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/gen-icon-pack-icons.js
//
// Source: "DevOps, Cloud, Networking & Teaching Icon Pack" (${source.icons.length} entries,
// ${entries.length} usable tile icons, ${glyphEntries.length} line glyphs), user-supplied offline pack (${sourceLabel}).
// License: unstated by the pack author — user-supplied, treated as internal-use.
//
// Tile icons use gradients, clip paths and <text> labels, so unlike the Lucide
// set they cannot compile to ctx ops. Canvas rasterizes the SVG via Image +
// data URL (all defs ids are per-icon namespaced at generation time so
// multiple icons can coexist in one exported SVG); the SVG export embeds the
// same markup with injected x/y/width/height — draw and toSvg share one
// contain-fit geometry, locked by tests/icon-pack.test.js.
//
// Line glyphs are single-colour stroke icons drawn in currentColor: the SVG
// export resolves it from the element's <g color>, the canvas raster takes the
// element stroke the renderer has just set on ctx.strokeStyle.
//
// Node has no Image global, so draw degrades to a placeholder there; all
// other behaviour (registry, search, export strings) is fully testable.
`;

const iconsBody = `const ICONS = ${JSON.stringify(
  Object.fromEntries(
    entries.map((e) => [e.slug, { g: e.groupSlug, n: e.name, c: e.color, t: e.tags, s: e.svg, ...(e.level ? { l: e.level } : {}) }])
  ),
  null,
  0
)};

const GLYPHS = ${JSON.stringify(
  Object.fromEntries(glyphEntries.map((e) => [e.slug, { g: e.set, n: e.name, t: e.tags, s: e.svg }])),
  null,
  0
)};

export const PACK_GROUPS = ${JSON.stringify(
  groups.map((g) => ({ slug: g.slug, label: g.label, count: groupCount.get(g.slug) })),
  null,
  2
)};

export const GLYPH_SETS = ${JSON.stringify(glyphSetSummary, null, 2)};

export const PACK_GROUP_BY_SLUG = Object.fromEntries([...PACK_GROUPS, ...GLYPH_SETS].map((g) => [g.slug, g.label]));

// Contain-fit geometry shared by draw and toSvg: the 64x64 glyph scales to
// min(w, h) and centers inside the element box (non-square boxes letterbox).
export function packIconGeometry(x, y, w, h) {
  const side = Math.max(0, Math.min(w, h));
  return { x: x + (w - side) / 2, y: y + (h - side) / 2, side };
}

// Line glyphs keep an 8px margin inside the element box, like the Lucide and
// workflow line icons, so a glyph and a line icon placed side by side match.
export const GLYPH_PAD = 8;
export function glyphGeometry(x, y, w, h) {
  const side = Math.max(0, Math.min(w, h) - GLYPH_PAD * 2);
  return { x: x + (w - side) / 2, y: y + (h - side) / 2, side };
}

export const GLYPH_FALLBACK_COLOR = '#334155';
const GLYPH_OPEN =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">';

// Only plain colour strings reach the raster's color attribute. A gradient or
// pattern strokeStyle reads back as an object and falls back to slate.
const COLOR_RE = /^(#[0-9a-f]{3,8}|rgba?\\(\\s*[\\d.]+%?\\s*,\\s*[\\d.]+%?\\s*,\\s*[\\d.]+%?\\s*(,\\s*[\\d.]+%?\\s*)?\\))$/i;
export function glyphColor(value) {
  const c = typeof value === 'string' ? value.trim() : '';
  return COLOR_RE.test(c) ? c : GLYPH_FALLBACK_COLOR;
}

// Canvas raster cache: entry -> { img, ready } (tiles) or entry -> colour ->
// { img, ready } (glyphs). Images load async; the first frame draws a dashed
// placeholder and the load handler requests a re-render.
const IMG_CACHE = new Map();
const GLYPH_COLORS_PER_ICON = 8;

function loadImage(markup, rec) {
  const img = new Image();
  rec.img = img;
  img.onload = () => {
    rec.ready = true;
    // Re-render the live board once the raster is available.
    if (typeof window !== 'undefined' && window.__WHITEBOARD_APP__?.requestRender) {
      window.__WHITEBOARD_APP__.requestRender();
    }
  };
  img.onerror = () => {
    rec.ready = false;
    rec.failed = true;
  };
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(markup);
  return rec;
}

function packImage(entry) {
  let rec = IMG_CACHE.get(entry);
  if (!rec) {
    if (typeof Image === 'undefined') return null;
    rec = { img: null, ready: false };
    IMG_CACHE.set(entry, rec);
    loadImage(entry.s, rec);
  }
  return rec;
}

function glyphImage(entry, color) {
  let byColor = IMG_CACHE.get(entry);
  if (!byColor) {
    if (typeof Image === 'undefined') return null;
    byColor = new Map();
    IMG_CACHE.set(entry, byColor);
  }
  let rec = byColor.get(color);
  if (!rec) {
    // Bounded: a recolour storm keeps at most a handful of rasters per glyph.
    if (byColor.size >= GLYPH_COLORS_PER_ICON) byColor.delete(byColor.keys().next().value);
    rec = { img: null, ready: false };
    byColor.set(color, rec);
    loadImage(entry.svg.replace('<svg ', \`<svg color="\${color}" \`), rec);
  }
  return rec;
}

function drawPlaceholder(ctx, x, y, side) {
  ctx.save();
  ctx.strokeStyle = 'rgba(37, 99, 235, 0.45)';
  ctx.setLineDash([5, 4]);
  ctx.lineWidth = 1.5;
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x + 3, y + 3, side - 6, side - 6, 8);
    ctx.stroke();
  } else {
    ctx.strokeRect(x + 3, y + 3, side - 6, side - 6);
  }
  ctx.restore();
}

function makeDraw(entry) {
  return (ctx, x, y, w, h) => {
    const geo = packIconGeometry(x, y, w, h);
    const rec = packImage(entry);
    if (!rec || !rec.ready) {
      drawPlaceholder(ctx, geo.x, geo.y, geo.side);
      return;
    }
    ctx.drawImage(rec.img, geo.x, geo.y, geo.side, geo.side);
  };
}

function makeToSvg(entry) {
  return (x, y, w, h) => {
    const geo = packIconGeometry(x, y, w, h);
    if (!(geo.side > 0)) return '';
    // Same markup as the canvas raster, same geometry — the SVG viewer
    // scales the nested <svg> into the element box exactly as drawImage does.
    return entry.s.replace(
      '<svg ',
      \`<svg x="\${geo.x}" y="\${geo.y}" width="\${geo.side}" height="\${geo.side}" \`
    );
  };
}

function makeGlyphDraw(entry) {
  return (ctx, x, y, w, h) => {
    const geo = glyphGeometry(x, y, w, h);
    if (!(geo.side > 0)) return;
    // The renderer sets ctx.strokeStyle to the element's theme-resolved
    // stroke right before calling draw — that is the glyph colour.
    const rec = glyphImage(entry, glyphColor(ctx.strokeStyle));
    if (!rec || !rec.ready) {
      drawPlaceholder(ctx, geo.x, geo.y, geo.side);
      return;
    }
    ctx.drawImage(rec.img, geo.x, geo.y, geo.side, geo.side);
  };
}

function makeGlyphToSvg(entry) {
  return (x, y, w, h) => {
    const geo = glyphGeometry(x, y, w, h);
    if (!(geo.side > 0)) return '';
    // currentColor resolves from the exporter's <g color="stroke"> wrapper.
    return entry.svg.replace(
      '<svg ',
      \`<svg x="\${geo.x}" y="\${geo.y}" width="\${geo.side}" height="\${geo.side}" \`
    );
  };
}

const TILE_STENCILS = Object.entries(ICONS).map(([slug, entry]) => ({
  id: slug,
  name: entry.n,
  category: \`pack/\${entry.g}\`,
  // Blank label: icons render clean without a caption over the glyph
  // (mirrors the Lucide stencils; text stays editable on the element).
  defaultText: ' ',
  color: entry.c,
  tags: entry.t,
  // 1 beginner … 4 expert for the leveled concept groups; 0 for the rest.
  level: entry.l || 0,
  draw: makeDraw(entry),
  toSvg: makeToSvg(entry),
  svgInner: entry.s,
}));

const GLYPH_STENCILS = Object.entries(GLYPHS).map(([slug, entry]) => {
  entry.svg = GLYPH_OPEN + entry.s + '</svg>';
  return {
    id: slug,
    name: entry.n,
    category: \`pack/\${entry.g}\`,
    defaultText: ' ',
    // No colour: placement uses the current stroke, so a glyph is drawn in
    // whatever colour the user is drawing with (and recolours with it).
    tags: entry.t,
    level: 0,
    isGlyph: true,
    draw: makeGlyphDraw(entry),
    toSvg: makeGlyphToSvg(entry),
    svgInner: entry.svg,
  };
});

export const PACK_STENCILS = [...TILE_STENCILS, ...GLYPH_STENCILS];
`;

const iconsText = `${HEADER}\n${iconsBody}\n`;

// Command tally rows [group, linked-icon category, level, count] — enough for
// the Topics tab to count commands per topic and level without the chunk.
const tally = new Map();
for (const c of commands || []) {
  const k = `${c.group}\u0000${c.cat}\u0000${c.level}`;
  tally.set(k, (tally.get(k) || 0) + 1);
}
const commandTally = [...tally.entries()]
  .map(([k, n]) => {
    const [group, cat, level] = k.split('\u0000');
    return [group, cat, Number(level), n];
  })
  .sort((a, b) => (a[0] + a[1]).localeCompare(b[0] + b[1]) || a[2] - b[2]);

const indexText = `// stencils/icon-pack-index.js — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/gen-icon-pack-icons.js
//
// A few KB of counts describing the lazy icon pack (icon-pack-icons.js) and
// command set (icon-pack-commands.js), so the library can show topic sizes and
// level counts on first paint without downloading either chunk.
// levels[n] = icons at level n (0 = not leveled, 1 beginner … 4 expert).
// commandTally rows: [command group, linked icon category, level, count].

export const PACK_INDEX = ${JSON.stringify(
  {
    icons: entries.length,
    glyphs: glyphEntries.length,
    commands: commands ? commands.length : 0,
    groups: groups.map((g) => ({ slug: g.slug, label: g.label, count: groupCount.get(g.slug), levels: groupLevels.get(g.slug) })),
    glyphSets: glyphSetSummary,
    commandTally,
  },
  null,
  1
)};
`;

const commandGroups = [];
for (const c of commands || []) {
  const g = commandGroups.find((x) => x.slug === c.group);
  if (g) g.count += 1;
  else commandGroups.push({ slug: c.group, title: c.groupTitle, count: 1 });
}

const commandsText = commands
  ? `// stencils/icon-pack-commands.js — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/gen-icon-pack-icons.js
//
// ${commands.length} copy-ready commands from the icon pack's commands.json, each linked to the
// pack icon that teaches it (icon = pk-* stencil id, cat = that icon's category).
// risky = the command changes or deletes things: the library shows a warning
// and the note before it can be copied. Commands are DATA — the UI only ever
// renders them as escaped text and copies them; nothing here is executed.

export const PACK_COMMAND_GROUPS = ${JSON.stringify(commandGroups, null, 1)};

export const PACK_COMMANDS = ${JSON.stringify(
      commands.map(({ groupTitle, ...rest }) => rest),
      null,
      1
    )};
`
  : null;

// ---- write (only what changed) ----

function writeIfChanged(path, text, summary) {
  const prev = existsSync(path) ? readFileSync(path, 'utf8') : null;
  if (prev === text) {
    console.log(`${basename(path)} is up to date (${summary}).`);
    return;
  }
  writeFileSync(path, text);
  const kb = Math.round(Buffer.byteLength(text) / 1024);
  const sha = createHash('sha256').update(text).digest('hex').slice(0, 12);
  console.log(`Wrote ${path} — ${summary}, ${kb} KB (sha256 ${sha}).`);
}

writeIfChanged(
  OUT,
  iconsText,
  `${entries.length} icons, ${groups.length} groups, ${glyphEntries.length} glyphs in ${glyphSetSummary.length} sets`
);
writeIfChanged(INDEX_OUT, indexText, `${groups.length} groups, ${commandTally.length} command tally rows`);
if (commandsText) writeIfChanged(COMMANDS_OUT, commandsText, `${commands.length} commands, ${commandGroups.length} groups`);
else console.log(`No commands source at ${COMMANDS_SRC} — commands module left as is.`);
