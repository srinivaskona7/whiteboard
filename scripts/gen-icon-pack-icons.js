// scripts/gen-icon-pack-icons.js
// Generates stencils/icon-pack-icons.js from the offline "DevOps, Cloud,
// Networking & Teaching Icon Pack" (user-supplied, ~/Downloads/aws-keys/icons.js).
//
// The pack's SVGs use gradients, clip paths, <text> labels and transforms —
// none of which the Lucide stroke-geometry compiler handles — so this
// generator bakes the raw (id-namespaced) SVG markup and the runtime module
// rasterizes it via Image + data URL for canvas and embeds it for SVG export.
//
// Usage:
//   node scripts/gen-icon-pack-icons.js
// Env:
//   ICON_PACK_SOURCE  source icons.js path (default ~/Downloads/aws-keys/icons.js)
//   ICON_PACK_OUT      output module path (default stencils/icon-pack-icons.js)
//
// The source file is UNTRUSTED DOWNLOADED DATA: this script extracts and
// JSON.parses the embedded ICONS array and never executes the file.

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = process.env.ICON_PACK_SOURCE || join(homedir(), 'Downloads', 'aws-keys', 'icons.js');
const OUT = process.env.ICON_PACK_OUT || join(ROOT, 'stencils', 'icon-pack-icons.js');

if (!existsSync(SRC)) {
  console.error(`Icon pack source not found: ${SRC}`);
  console.error('Set ICON_PACK_SOURCE to the downloaded icons.js path.');
  process.exit(1);
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
const FORBIDDEN_MARKUP =
  /<script|<foreignObject|<image|javascript:|xlink:|data:|\son[a-z]+\s*=|\shref\s*=\s*(["'])(?!#)|\ssrc\s*=/i;

// The source is an IIFE: `var ICONS=[ ... ]; ...`. Extract the array as
// pure JSON — the entries are plain JSON objects (verified by inspection).
const raw = readFileSync(SRC, 'utf8');
const MARK = 'var ICONS=';
const arrStart = raw.indexOf(MARK);
if (arrStart === -1) {
  console.error('Icon pack source does not contain `var ICONS=` — unexpected format.');
  process.exit(1);
}
const arrEnd = raw.indexOf('];', arrStart);
if (arrEnd === -1) {
  console.error('Icon pack source ICONS array is not terminated — unexpected format.');
  process.exit(1);
}
let icons;
try {
  icons = JSON.parse(raw.slice(arrStart + MARK.length, arrEnd + 1));
} catch (err) {
  console.error(`Icon pack array is not valid JSON: ${err.message}`);
  process.exit(1);
}
if (!Array.isArray(icons) || icons.length === 0) {
  console.error('Icon pack array is empty — refusing to write (would clobber the checked-in module).');
  process.exit(1);
}

// Validation + namespace pass. Gradient/clip ids inside each SVG are generic
// ("g1", "k1"); embedding several icons in one exported SVG (or one library
// DOM) makes the first definition win for every later reference. Rewrite each
// id to a per-icon namespace so definitions stay unique.
const seenIds = new Set();
const seenSlugs = new Set();
const groups = []; // first-appearance order
const groupCount = new Map();
const entries = [];

for (const icon of icons) {
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
  if (seenSlugs.has(slug)) {
    console.error(`Duplicate slug after normalisation (${slug}, from ${id}) — pack format changed.`);
    process.exit(1);
  }
  seenSlugs.add(slug);

  const ns = slug.replace(/^pk-/, 'pk');
  const namespaced = svg
    .replace(/\sid="([^"]+)"/g, (m, def) => ` id="${ns}-${def}"`)
    .replace(/url\(#([^)]+)\)/g, (m, def) => `url(#${ns}-${def})`)
    .replace(/href="#([^"]+)"/g, (m, def) => `href="#${ns}-${def}"`);

  const groupSlug = slugify(group || 'misc');
  if (!groupCount.has(groupSlug)) {
    groupCount.set(groupSlug, 0);
    groups.push({ slug: groupSlug, label: group || 'Misc' });
  }
  groupCount.set(groupSlug, groupCount.get(groupSlug) + 1);

  entries.push({
    slug,
    name,
    groupSlug,
    color: typeof color === 'string' ? color : '#2563eb',
    tags: Array.isArray(tags) ? tags.join(' ') : '',
    svg: namespaced,
  });
}

if (entries.length === 0) {
  console.error('Zero usable icons after validation — refusing to write (would clobber the checked-in module).');
  process.exit(1);
}

const HEADER = `// stencils/icon-pack-icons.js — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/gen-icon-pack-icons.js
//
// Source: "DevOps, Cloud, Networking & Teaching Icon Pack" (${icons.length} entries,
// ${entries.length} usable), user-supplied offline pack (~/Downloads/aws-keys/icons.js).
// License: unstated by the pack author — user-supplied, treated as internal-use.
//
// These SVGs use gradients, clip paths and <text> labels, so unlike the Lucide
// set they cannot compile to ctx ops. Canvas rasterizes the SVG via Image +
// data URL (all defs ids are per-icon namespaced at generation time so
// multiple icons can coexist in one exported SVG); the SVG export embeds the
// same markup with injected x/y/width/height — draw and toSvg share one
// contain-fit geometry, locked by tests/icon-pack.test.js.
//
// Node has no Image global, so draw degrades to a placeholder there; all
// other behaviour (registry, search, export strings) is fully testable.
`;

const body = `const ICONS = ${JSON.stringify(
  Object.fromEntries(entries.map((e) => [e.slug, { g: e.groupSlug, n: e.name, c: e.color, t: e.tags, s: e.svg }])),
  null,
  0
)};

export const PACK_GROUPS = ${JSON.stringify(
  groups.map((g) => ({ slug: g.slug, label: g.label, count: groupCount.get(g.slug) })),
  null,
  2
)};

export const PACK_GROUP_BY_SLUG = Object.fromEntries(PACK_GROUPS.map((g) => [g.slug, g.label]));

// Contain-fit geometry shared by draw and toSvg: the 64x64 glyph scales to
// min(w, h) and centers inside the element box (non-square boxes letterbox).
export function packIconGeometry(x, y, w, h) {
  const side = Math.max(0, Math.min(w, h));
  return { x: x + (w - side) / 2, y: y + (h - side) / 2, side };
}

// Canvas raster cache: slug -> { img, ready }. Images load async; the first
// frame draws a dashed placeholder and the load handler requests a re-render.
const IMG_CACHE = new Map();

function packImage(entry) {
  let rec = IMG_CACHE.get(entry);
  if (!rec) {
    if (typeof Image === 'undefined') return null;
    const img = new Image();
    rec = { img, ready: false };
    IMG_CACHE.set(entry, rec);
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
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(entry.s);
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

export const PACK_STENCILS = Object.entries(ICONS).map(([slug, entry]) => ({
  id: slug,
  name: entry.n,
  category: \`pack/\${entry.g}\`,
  // Blank label: icons render clean without a caption over the glyph
  // (mirrors the Lucide stencils; text stays editable on the element).
  defaultText: ' ',
  color: entry.c,
  tags: entry.t,
  draw: makeDraw(entry),
  toSvg: makeToSvg(entry),
  svgInner: entry.s,
}));
`;

const outText = `${HEADER}\n${body}\n`;

const prev = existsSync(OUT) ? readFileSync(OUT, 'utf8') : null;
if (prev === outText) {
  console.log(`stencils/icon-pack-icons.js is up to date (${entries.length} icons, ${groups.length} groups).`);
} else {
  writeFileSync(OUT, outText);
  const kb = Math.round(Buffer.byteLength(outText) / 1024);
  console.log(
    `Wrote ${OUT} — ${entries.length} icons, ${groups.length} groups, ${kb} KB (sha256 ${createHash('sha256')
      .update(outText)
      .digest('hex')
      .slice(0, 12)}).`
  );
}
