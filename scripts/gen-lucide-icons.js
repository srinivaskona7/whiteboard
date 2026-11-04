#!/usr/bin/env node
// scripts/gen-lucide-icons.js — regenerates stencils/lucide-icons.js from the
// vendored lucide-static SVG set (devDependency, ISC license). The generated
// module is checked in so the app runtime keeps zero npm dependencies.
//
// Usage: node scripts/gen-lucide-icons.js
// A curated icon name that is missing from node_modules/lucide-static/icons is
// skipped with a printed warning — it is never invented.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// LUCIDE_ICONS_DIR (used by the test suite to prove the zero-icon refusal)
// overrides the vendored package location.
const ICONS_DIR =
  process.env.LUCIDE_ICONS_DIR || join(ROOT, 'node_modules', 'lucide-static', 'icons');
const OUT_FILE = join(ROOT, 'stencils', 'lucide-icons.js');

// Curated set: subcategory -> icon names as they appear in
// node_modules/lucide-static/icons/<name>.svg. Human labels are derived from
// the name (kebab-case -> Title Case) with per-word overrides below.
const CURATED = {
  education: [
    'school', 'graduation-cap', 'book-open', 'book', 'book-marked', 'library',
    'notebook-pen', 'notebook-text', 'pencil', 'pencil-line', 'pencil-ruler',
    'backpack', 'ruler', 'calculator', 'atom', 'flask-conical', 'microscope',
    'lightbulb', 'brain', 'apple', 'landmark', 'award', 'medal',
    // Classroom geometry & drawing tools
    'square', 'circle', 'triangle', 'hexagon', 'pentagon', 'octagon', 'diamond',
    'circle-dashed', 'square-dashed', 'shapes', 'spline', 'spline-pointer',
    'paintbrush', 'brush', 'palette', 'pen-tool', 'type', 'scissors',
    'highlighter', 'eraser',
  ],
  'tech-devops': [
    'server', 'server-cog', 'database', 'database-backup', 'hard-drive',
    'cloud', 'cloud-cog', 'cloud-off', 'cloud-upload', 'cloud-download',
    'cpu', 'memory-stick', 'circuit-board', 'monitor', 'monitor-smartphone',
    'laptop', 'laptop-minimal', 'keyboard', 'mouse', 'smartphone', 'tablet',
    'network', 'router', 'radio-tower', 'wifi', 'wifi-off', 'signal', 'globe',
    'git-branch', 'git-commit', 'git-merge', 'git-pull-request',
    'terminal', 'square-terminal', 'code', 'code-xml', 'braces', 'bug',
    'wrench', 'hammer', 'settings', 'sliders-horizontal',
    'container', 'package', 'box', 'boxes', 'layers', 'blocks', 'puzzle',
    'rocket', 'shield', 'shield-check', 'shield-off', 'shield-ban',
    'key-round', 'fingerprint', 'scan', 'qr-code', 'barcode',
    'cable', 'plug', 'plug-2', 'plug-zap', 'battery', 'battery-charging',
    'power', 'bluetooth', 'nfc', 'cast', 'screen-share',
  ],
  'office-business': [
    'presentation', 'briefcase', 'building', 'building-2', 'warehouse',
    'factory', 'calendar', 'calendar-days', 'calendar-check', 'calendar-clock',
    'clock', 'timer', 'hourglass', 'mail', 'send', 'inbox', 'paperclip',
    'clipboard-list', 'clipboard-check', 'file-text', 'files', 'folder',
    'folder-open', 'archive', 'printer', 'credit-card', 'wallet', 'receipt',
    'banknote', 'coins', 'shopping-cart', 'store',
    'chart-bar', 'chart-line', 'chart-pie', 'chart-column',
    'table', 'table-2', 'kanban', 'list-todo', 'list-checks', 'milestone',
    'signpost', 'target', 'search', 'filter', 'save', 'history', 'undo-2',
    'redo-2', 'upload', 'download', 'link', 'link-2', 'unlink',
  ],
  arrows: [
    'arrow-up', 'arrow-down', 'arrow-left', 'arrow-right',
    'arrow-up-left', 'arrow-up-right', 'arrow-down-left', 'arrow-down-right',
    'arrow-up-down', 'arrow-left-right',
    'arrow-up-from-line', 'arrow-down-to-line', 'arrow-up-to-line',
    'arrow-down-from-line',
    'move', 'move-up', 'move-down', 'move-left', 'move-right',
    'chevron-up', 'chevron-down', 'chevrons-up', 'chevrons-down',
    'corner-up-right', 'corner-down-right', 'trending-up', 'trending-down',
    'refresh-cw', 'rotate-cw', 'repeat',
  ],
  media: [
    'camera', 'camera-off', 'image', 'image-plus', 'video', 'video-off',
    'clapperboard', 'film', 'aperture', 'music', 'mic', 'mic-off',
    'headphones', 'speaker', 'volume-2', 'volume-x', 'play', 'pause',
    'skip-forward', 'skip-back', 'fast-forward', 'rewind', 'disc', 'radio',
    'tv', 'podcast', 'audio-waveform',
  ],
  'people-collaboration': [
    'user', 'users', 'user-plus', 'user-check', 'user-round', 'users-round',
    'user-cog', 'message-circle', 'message-square', 'messages-square',
    'handshake', 'hand', 'thumbs-up', 'thumbs-down', 'heart-handshake',
    'megaphone', 'bell', 'at-sign', 'phone', 'phone-call', 'contact',
    'address-book', 'id-card', 'log-in', 'log-out', 'door-open', 'door-closed',
  ],
  'nature-weather': [
    'sun', 'moon', 'sun-moon', 'sunset', 'sunrise', 'moon-star',
    'cloud-sun', 'cloud-moon', 'cloud-rain', 'cloud-snow', 'cloud-lightning',
    'cloud-fog', 'cloud-drizzle', 'cloud-hail', 'rainbow', 'umbrella',
    'snowflake', 'wind', 'droplet', 'droplets', 'thermometer', 'waves',
    'tornado', 'flower', 'flower-2', 'leaf', 'mountain',
  ],
  'status-symbols': [
    'check', 'check-check', 'x', 'circle-check', 'circle-x',
    'alert-circle', 'triangle-alert', 'info', 'circle-help', 'star', 'heart',
    'heart-crack', 'lock', 'lock-open', 'unlock', 'key', 'key-square',
    'lock-keyhole', 'bookmark', 'flag', 'pin', 'sparkles', 'zap', 'flame',
    'eye', 'eye-off', 'badge-check', 'circle-slash', 'circle-off', 'minus',
    'plus', 'equal', 'ban',
  ],
};

const WORD_OVERRIDES = {
  cpu: 'CPU', wifi: 'Wi-Fi', qr: 'QR', tv: 'TV', nfc: 'NFC', id: 'ID',
  api: 'API', url: 'URL', ip: 'IP', os: 'OS', ui: 'UI', ai: 'AI',
};

function humanLabel(name) {
  return name
    .split('-')
    .map((w) => WORD_OVERRIDES[w] || (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const r3 = (v) => Math.round(v * 1000) / 1000;
const r4 = (v) => Math.round(v * 10000) / 10000;
const TAU = Math.PI * 2;

// --- SVG path "d" parser: compiles the data into ctx ops (M/L/C/Q/E/Z) with
// absolute coordinates, resolving h/v shorthand, S/T reflection and the
// SVG arc (endpoint parameterization) to canvas ellipse arcs upfront so the
// generated runtime draw never needs a Path2D or its own parser.
function parsePathD(d, iconName) {
  const ops = [];
  let p = 0;
  const len = d.length;
  let cx = 0, cy = 0; // current point
  let sx = 0, sy = 0; // subpath start
  let prevC2x = null, prevC2y = null; // last cubic second control (S reflection)
  let prevQx = null, prevQy = null; // last quadratic control (T reflection)

  const skipSep = () => {
    while (p < len && /[\s,]/.test(d[p])) p++;
  };
  const readNumber = () => {
    skipSep();
    const m = /^[-+]?(?:\d*\.\d+|\d+)(?:[eE][-+]?\d+)?/.exec(d.slice(p));
    if (!m || !Number.isFinite(Number(m[0]))) {
      throw new Error(`${iconName}: malformed path data at "${d.slice(Math.max(0, p - 4), p + 16)}"`);
    }
    p += m[0].length;
    return Number(m[0]);
  };
  // Arc flags are single 0/1 characters and can be glued to the next number
  // ("00-1.999"), so they cannot go through readNumber.
  const readFlag = () => {
    skipSep();
    if (d[p] !== '0' && d[p] !== '1') {
      throw new Error(`${iconName}: malformed arc flag at "${d.slice(p, p + 16)}"`);
    }
    return d[p++] === '1' ? 1 : 0;
  };

  const consume = (cmd) => {
    switch (cmd) {
      case 'M': case 'm': {
        let x = readNumber(), y = readNumber();
        if (cmd === 'm') { x += cx; y += cy; }
        ops.push(['M', r3(x), r3(y)]);
        cx = sx = x; cy = sy = y;
        prevC2x = prevQx = null;
        break;
      }
      case 'L': case 'l': {
        let x = readNumber(), y = readNumber();
        if (cmd === 'l') { x += cx; y += cy; }
        ops.push(['L', r3(x), r3(y)]);
        cx = x; cy = y;
        prevC2x = prevQx = null;
        break;
      }
      case 'H': case 'h': {
        let x = readNumber();
        if (cmd === 'h') x += cx;
        ops.push(['L', r3(x), r3(cy)]);
        cx = x;
        prevC2x = prevQx = null;
        break;
      }
      case 'V': case 'v': {
        let y = readNumber();
        if (cmd === 'v') y += cy;
        ops.push(['L', r3(cx), r3(y)]);
        cy = y;
        prevC2x = prevQx = null;
        break;
      }
      case 'C': case 'c': {
        let x1 = readNumber(), y1 = readNumber(), x2 = readNumber(), y2 = readNumber(), x = readNumber(), y = readNumber();
        if (cmd === 'c') {
          x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy;
        }
        ops.push(['C', r3(x1), r3(y1), r3(x2), r3(y2), r3(x), r3(y)]);
        cx = x; cy = y;
        prevC2x = x2; prevC2y = y2; prevQx = null;
        break;
      }
      case 'S': case 's': {
        let x2 = readNumber(), y2 = readNumber(), x = readNumber(), y = readNumber();
        if (cmd === 's') { x2 += cx; y2 += cy; x += cx; y += cy; }
        const x1 = prevC2x === null ? cx : 2 * cx - prevC2x;
        const y1 = prevC2y === null ? cy : 2 * cy - prevC2y;
        ops.push(['C', r3(x1), r3(y1), r3(x2), r3(y2), r3(x), r3(y)]);
        cx = x; cy = y;
        prevC2x = x2; prevC2y = y2; prevQx = null;
        break;
      }
      case 'Q': case 'q': {
        let x1 = readNumber(), y1 = readNumber(), x = readNumber(), y = readNumber();
        if (cmd === 'q') { x1 += cx; y1 += cy; x += cx; y += cy; }
        ops.push(['Q', r3(x1), r3(y1), r3(x), r3(y)]);
        cx = x; cy = y;
        prevQx = x1; prevQy = y1; prevC2x = null;
        break;
      }
      case 'T': case 't': {
        let x = readNumber(), y = readNumber();
        if (cmd === 't') { x += cx; y += cy; }
        const x1 = prevQx === null ? cx : 2 * cx - prevQx;
        const y1 = prevQy === null ? cy : 2 * cy - prevQy;
        ops.push(['Q', r3(x1), r3(y1), r3(x), r3(y)]);
        cx = x; cy = y;
        prevQx = x1; prevQy = y1; prevC2x = null;
        break;
      }
      case 'A': case 'a': {
        const rx = readNumber(), ry = readNumber(), rot = readNumber();
        const laf = readFlag(), sf = readFlag();
        let x = readNumber(), y = readNumber();
        if (cmd === 'a') { x += cx; y += cy; }
        ops.push(...arcToEllipse(cx, cy, rx, ry, rot, laf, sf, x, y, iconName));
        cx = x; cy = y;
        prevC2x = prevQx = null;
        break;
      }
      case 'Z': case 'z': {
        ops.push(['Z']);
        cx = sx; cy = sy;
        prevC2x = prevQx = null;
        break;
      }
      default:
        throw new Error(`${iconName}: unknown path command "${cmd}"`);
    }
  };

  // Walk the commands; extra coordinate pairs after a command repeat it
  // (and after M they degrade to L per the SVG spec).
  let cmd = null;
  skipSep();
  if (p < len && /[MmLlHhVvCcSsQqTtAaZz]/.test(d[p])) cmd = d[p++];
  while (cmd) {
    consume(cmd);
    skipSep();
    if (p >= len) break;
    const c = d[p];
    if (/[MmLlHhVvCcSsQqTtAaZz]/.test(c)) {
      p++;
      cmd = c;
    } else {
      cmd = cmd === 'M' ? 'L' : cmd === 'm' ? 'l' : cmd;
    }
  }
  if (p < len) {
    throw new Error(`${iconName}: trailing garbage in path at "${d.slice(p, p + 16)}"`);
  }
  return ops;
}

// SVG endpoint-parameterized arc -> canvas ctx.ellipse center form
// (W3C SVG 1.1 appendix F.6.5).
function arcToEllipse(x1, y1, rx, ry, rotDeg, laf, sf, x2, y2, iconName) {
  rx = Math.abs(rx);
  ry = Math.abs(ry);
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) return [['L', r3(x2), r3(y2)]];
  const rot = (rotDeg * Math.PI) / 180;
  const cos = Math.cos(rot);
  const sin = Math.sin(rot);
  const dx2 = (x1 - x2) / 2;
  const dy2 = (y1 - y2) / 2;
  const x1p = cos * dx2 + sin * dy2;
  const y1p = -sin * dx2 + cos * dy2;
  if (rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p < 0) {
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    const scale = Math.sqrt(lam);
    rx *= scale;
    ry *= scale;
  }
  const nume = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p;
  const deno = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
  let co = deno === 0 ? 0 : Math.sqrt(Math.max(0, nume / deno));
  if (laf === sf) co = -co;
  const cxp = (co * rx * y1p) / ry;
  const cyp = (-co * ry * x1p) / rx;
  const ccx = cos * cxp - sin * cyp + (x1 + x2) / 2;
  const ccy = sin * cxp + cos * cyp + (y1 + y2) / 2;
  const angleBetween = (ux, uy, vx, vy) => {
    const dot = ux * vx + uy * vy;
    const len = Math.sqrt(ux * ux + uy * uy) * Math.sqrt(vx * vx + vy * vy);
    let a = Math.acos(Math.min(1, Math.max(-1, dot / (len || 1))));
    if (ux * vy - uy * vx < 0) a = -a;
    return a;
  };
  const theta1 = angleBetween(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
  let dTheta = angleBetween((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
  if (!sf && dTheta > 0) dTheta -= TAU;
  else if (sf && dTheta < 0) dTheta += TAU;
  if (!Number.isFinite(ccx) || !Number.isFinite(ccy)) {
    throw new Error(`${iconName}: degenerate arc in path`);
  }
  return [['E', r3(ccx), r3(ccy), r3(rx), r3(ry), r4(rot), r4(theta1), r4(theta1 + dTheta), sf === 0]];
}

const attrsOf = (tag) => {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z][a-zA-Z0-9-]*)="([^"]*)"/g)) out[m[1]] = m[2];
  return out;
};

// Allowed geometric elements — anything else inside the SVG fails loudly.
const KNOWN_TAGS = new Set(['path', 'circle', 'ellipse', 'rect', 'line', 'polygon', 'polyline']);

function parseIconSvg(svgText, iconName) {
  const open = svgText.indexOf('>', svgText.indexOf('<svg')) + 1;
  const close = svgText.lastIndexOf('</svg>');
  const body = svgText.slice(open, close);
  const tagRe = /<([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[^<>]*?)?)\/>/g;
  const elements = [];
  const innerParts = [];
  for (const m of body.matchAll(tagRe)) {
    const tag = m[1];
    if (!KNOWN_TAGS.has(tag)) {
      throw new Error(`${iconName}: unsupported element <${tag}> in the vendored SVG`);
    }
    const a = attrsOf(m[0]);
    const num = (k, fallback = 0) => {
      const v = Number(a[k]);
      if (a[k] === undefined || !Number.isFinite(v)) {
        throw new Error(`${iconName}: <${tag}> is missing a numeric "${k}"`);
      }
      return v;
    };
    let ops;
    switch (tag) {
      case 'path':
        ops = parsePathD(a.d || '', iconName);
        break;
      case 'circle':
        ops = [['E', r3(num('cx')), r3(num('cy')), r3(num('r')), r3(num('r')), 0, 0, r4(TAU), false]];
        break;
      case 'ellipse':
        ops = [['E', r3(num('cx')), r3(num('cy')), r3(num('rx')), r3(num('ry')), 0, 0, r4(TAU), false]];
        break;
      case 'rect': {
        const rw = num('width'), rh = num('height');
        const rx = a.rx !== undefined ? Number(a.rx) : a.ry !== undefined ? Number(a.ry) : 0;
        if (!Number.isFinite(rx)) throw new Error(`${iconName}: <rect> has a bad rx`);
        ops = [['R', r3(num('x')), r3(num('y')), r3(rw), r3(rh), r3(rx)]];
        break;
      }
      case 'line':
        ops = [
          ['M', r3(num('x1')), r3(num('y1'))],
          ['L', r3(num('x2')), r3(num('y2'))],
        ];
        break;
      case 'polygon':
      case 'polyline': {
        const pts = (a.points || '').trim().split(/[\s,]+/).map(Number);
        if (pts.length < 4 || pts.some((v) => !Number.isFinite(v))) {
          throw new Error(`${iconName}: <${tag}> has malformed points`);
        }
        ops = [['M', r3(pts[0]), r3(pts[1])]];
        for (let p = 2; p + 1 < pts.length; p += 2) ops.push(['L', r3(pts[p]), r3(pts[p + 1])]);
        if (tag === 'polygon') ops.push(['Z']);
        break;
      }
      default:
        throw new Error(`${iconName}: unsupported element <${tag}>`);
    }
    elements.push(ops);
    innerParts.push(m[0]);
  }
  // Fail loudly on anything else inside the SVG body (comments excepted).
  const leftovers = body
    .replace(tagRe, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .trim();
  if (leftovers) {
    throw new Error(`${iconName}: unexpected content in the vendored SVG: "${leftovers.slice(0, 60)}"`);
  }
  if (elements.length === 0) throw new Error(`${iconName}: no drawable elements found`);
  return { elements, inner: innerParts.join('') };
}

function buildIcons() {
  const icons = {};
  const counts = {};
  const skipped = [];
  for (const [sub, names] of Object.entries(CURATED)) {
    counts[sub] = 0;
    for (const name of names) {
      const file = join(ICONS_DIR, `${name}.svg`);
      if (!existsSync(file)) {
        skipped.push(name);
        console.warn(`[gen-lucide-icons] skipping "${name}" — not present in lucide-static/icons`);
        continue;
      }
      const { elements, inner } = parseIconSvg(readFileSync(file, 'utf8'), name);
      icons[name] = { c: sub, n: humanLabel(name), e: elements, s: inner };
      counts[sub]++;
    }
  }
  return { icons, counts, skipped };
}

function emitModule(icons) {
  const entries = Object.entries(icons)
    .map(([name, data]) => `  ${JSON.stringify(name)}: ${JSON.stringify(data)}`)
    .join(',\n');
  return `// stencils/lucide-icons.js — GENERATED FILE, DO NOT EDIT BY HAND.
// Regenerate with: node scripts/gen-lucide-icons.js
//
// Source: lucide-static v1.68.0 (https://lucide.dev), ISC License.
// @license lucide-static v1.68.0 - ISC
// Permission to use, copy, modify, and/or distribute this software for any
// purpose with or without fee is hereby granted, provided that the above
// copyright notice and this permission notice appear in all copies.
//
// Geometry is baked in from the vendored SVGs at generation time, so the
// runtime app keeps zero npm dependencies.
//
// Each element compiles to ctx ops (M/L/C/Q/E/R/Z) in absolute 24x24
// coordinates; the shared draw scales the ops into the element box.

const ICONS = {
${entries},
};

export const LUCIDE_SUBCATEGORIES = [
${Object.keys(CURATED)
  .map((c) => `  \`icons/${c}\`,`)
  .join('\n')}
];

function drawLucideIcon(elements) {
  return (ctx, x, y, w, h) => {
    const pad = 8;
    const scale = (Math.min(w, h) - pad * 2) / 24;
    if (!(scale > 0)) return;
    ctx.save();
    ctx.translate(x + (w - 24 * scale) / 2, y + (h - 24 * scale) / 2);
    ctx.scale(scale, scale);
    // Stroke width 2 in icon units — the ctx scale keeps it proportional.
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const ops of elements) {
      ctx.beginPath();
      for (const op of ops) {
        const k = op[0];
        if (k === 'M') ctx.moveTo(op[1], op[2]);
        else if (k === 'L') ctx.lineTo(op[1], op[2]);
        else if (k === 'C') ctx.bezierCurveTo(op[1], op[2], op[3], op[4], op[5], op[6]);
        else if (k === 'Q') ctx.quadraticCurveTo(op[1], op[2], op[3], op[4]);
        else if (k === 'E') ctx.ellipse(op[1], op[2], op[3], op[4], op[5], op[6], op[7], op[8]);
        else if (k === 'R') {
          const rx = Math.min(op[5] || 0, op[3] / 2, op[4] / 2);
          if (rx > 0 && typeof ctx.roundRect === 'function') ctx.roundRect(op[1], op[2], op[3], op[4], rx);
          else ctx.rect(op[1], op[2], op[3], op[4]);
        } else if (k === 'Z') ctx.closePath();
      }
      ctx.stroke();
    }
    ctx.restore();
  };
}

export const LUCIDE_STENCILS = Object.entries(ICONS).map(([name, icon]) => ({
  id: \`lucide-\${name}\`,
  name: icon.n,
  category: \`icons/\${icon.c}\`,
  // Blank label: an icon placed on the canvas renders clean, without a
  // duplicated caption over the glyph (text stays editable on the element).
  defaultText: ' ',
  draw: drawLucideIcon(icon.e),
  toSvg(x, y, w, h) {
    // Same inset as the canvas draw: pad 8, glyph = (min(w,h) - 16), centered.
    // Without it the SVG export renders ~20% larger than the live canvas.
    const pad = 8;
    const scale = (Math.min(w, h) - pad * 2) / 24;
    if (!(scale > 0)) return '';
    const tx = x + (w - 24 * scale) / 2;
    const ty = y + (h - 24 * scale) / 2;
    return (
      \`<g transform="translate(\${tx} \${ty}) scale(\${scale})" fill="none" stroke="currentColor"\` +
      \` stroke-width="2" stroke-linecap="round" stroke-linejoin="round">\${icon.s}</g>\`
    );
  },
  svgInner: icon.s,
}));
`;
}

const { icons, counts, skipped } = buildIcons();
const total = Object.values(counts).reduce((a, b) => a + b, 0);
// A zero-icon run means the vendored package is missing or every curated
// name vanished — writing an empty module would clobber the checked-in file
// and break the whole stencil registry for every later import. Refuse.
if (total === 0) {
  console.error(
    '[gen-lucide-icons] no icons resolved — lucide-static is missing or the curated names are all gone; NOT overwriting stencils/lucide-icons.js'
  );
  process.exit(1);
}
writeFileSync(OUT_FILE, emitModule(icons));
console.log(`[gen-lucide-icons] wrote ${total} icons to stencils/lucide-icons.js`);
for (const [sub, count] of Object.entries(counts)) console.log(`  icons/${sub}: ${count}`);
if (skipped.length) console.warn(`[gen-lucide-icons] skipped ${skipped.length}: ${skipped.join(', ')}`);
