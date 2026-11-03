// render/shapes.js
import { FONT_MAP, resolveThemeColor } from './themes.js';
import { getStencilById } from '../stencils/index.js';
import {
  getConnectorPoints,
  getPointAlongConnector,
  getConnectorLabelPosition,
  getConnectorTangentFromPoint,
  strokeRoundedElbowCanvasPath,
} from '../scene/routing.js';

export function getDashArray(strokeStyle, strokeWidth = 2) {
  if (strokeStyle === 'dashed') return [strokeWidth * 4, strokeWidth * 2.5];
  if (strokeStyle === 'dotted') return [strokeWidth * 1.2, strokeWidth * 2.2];
  return [];
}

function seededOffset(seed, idx, amp = 2.2) {
  const s = Math.sin(seed * 12.9898 + idx * 78.233) * 43758.5453;
  return (s - Math.floor(s)) * amp * 2 - amp;
}

function hashId(id = '') {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h % 10000);
}

export function drawArrowhead(ctx, type, tipX, tipY, fromX, fromY, strokeWidth = 2, strokeColor = '#1e293b') {
  if (!type || type === 'none') return;
  const angle = Math.atan2(tipY - fromY, tipX - fromX);
  const size = Math.max(10, strokeWidth * 4.2);

  ctx.save();
  ctx.translate(tipX, tipY);
  ctx.rotate(angle);
  ctx.setLineDash([]);
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = strokeColor;
  ctx.lineWidth = strokeWidth;

  if (type === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(-size, -size * 0.55);
    ctx.lineTo(0, 0);
    ctx.lineTo(-size, size * 0.55);
    ctx.stroke();
  } else if (type === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size, -size * 0.58);
    ctx.lineTo(-size, size * 0.58);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-size * 0.65, -size * 0.45);
    ctx.lineTo(-size * 1.3, 0);
    ctx.lineTo(-size * 0.65, size * 0.45);
    ctx.closePath();
    ctx.fill();
  } else if (type === 'circle') {
    ctx.beginPath();
    ctx.arc(-size * 0.45, 0, size * 0.42, 0, Math.PI * 2);
    ctx.fill();
  } else if (type === 'bar') {
    ctx.beginPath();
    ctx.moveTo(-2, -size * 0.6);
    ctx.lineTo(-2, size * 0.6);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawSloppyPolygon(ctx, pts, seed) {
  if (pts.length < 2) return;
  for (let pass = 0; pass < 2; pass++) {
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ox = seededOffset(seed, i * 3 + pass, 1.8);
      const oy = seededOffset(seed, i * 3 + pass + 1, 1.8);
      if (i === 0) ctx.moveTo(a.x + ox, a.y + oy);
      const mx = (a.x + b.x) / 2 + seededOffset(seed, i * 5 + pass, 2.2);
      const my = (a.y + b.y) / 2 + seededOffset(seed, i * 7 + pass, 2.2);
      ctx.quadraticCurveTo(mx, my, b.x + ox * 0.5, b.y + oy * 0.5);
    }
    ctx.closePath();
    if (pass === 0) ctx.fill();
    ctx.stroke();
  }
}

export function wrapTextLines(ctx, text, maxWidth) {
  const nl = String.fromCharCode(10);
  const paragraphs = String(text || '').split(nl);
  const out = [];
  for (const para of paragraphs) {
    if (!para || maxWidth <= 20) {
      out.push(para);
      continue;
    }
    const words = para.split(' ');
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        out.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    out.push(line);
  }
  return out;
}

export function drawElementText(ctx, el, themeName = 'light', padding = 12) {
  if (!el.text || el.type === 'frame' || el.type === 'code' || el.type === 'table') return;
  const stencil = el.type === 'stencil' ? getStencilById(el.stencilId) : null;
  const isBoundary = Boolean(el.isBoundary || stencil?.isBoundary);
  const isCard = el.type === 'stencil' && Boolean(stencil?.isCard) && !isBoundary;
  const fontSize = isBoundary ? 13 : isCard ? Math.min(el.fontSize || 14, 15) : el.fontSize || 18;
  const fontStack = FONT_MAP[el.fontFamily || 'sans'] || FONT_MAP.sans;
  const color = resolveThemeColor(el.textColor || el.stroke || '#1e293b', themeName, 'text');

  ctx.save();
  ctx.font = `${isCard || isBoundary ? '600 ' : ''}${fontSize}px ${fontStack}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  if (isBoundary) {
    ctx.textAlign = 'left';
    ctx.fillText(String(el.text).split(String.fromCharCode(10))[0], el.x + 38, el.y + 18);
    ctx.restore();
    return;
  }

  const maxW =
    el.type === 'diamond'
      ? Math.max(48, el.w * 0.54)
      : el.type === 'ellipse'
        ? Math.max(54, el.w * 0.72)
        : Math.max(36, el.w - padding * 2);
  const lines =
    el.type === 'text'
      ? String(el.text).split(String.fromCharCode(10))
      : wrapTextLines(ctx, el.text, maxW);
  const lineH = fontSize * (isCard ? 1.18 : 1.32);
  const totalH = lines.length * lineH;
  const zoneCenterY = isCard ? el.y + el.h * 0.785 : el.y + el.h / 2;
  const startY = zoneCenterY - totalH / 2 + lineH / 2;

  const align = el.textAlign || 'center';
  ctx.textAlign = align;
  const innerPad = el.type === 'diamond' ? Math.round(el.w * 0.23) : padding;
  const tx =
    align === 'left'
      ? el.x + innerPad
      : align === 'right'
        ? el.x + el.w - innerPad
        : el.x + el.w / 2;

  lines.forEach((line, idx) => {
    ctx.fillText(line, tx, startY + idx * lineH);
  });
  ctx.restore();
}

export function drawStamp(ctx, el) {
  const { x, y, w, h, stampKind = 'tick', badgeValue = 1 } = el;
  const cx = x + w / 2, cy = y + h / 2, r = Math.min(w, h) / 2 - 3;
  ctx.save();
  ctx.lineWidth = 3;
  const styles = {
    tick: ['rgba(22, 163, 74, 0.16)', '#16a34a'],
    cross: ['rgba(220, 38, 38, 0.16)', '#dc2626'],
    star: ['#fef08a', '#ca8a04'],
    question: ['rgba(124, 58, 237, 0.15)', '#7c3aed'],
    'arrow-up': ['rgba(37, 99, 235, 0.15)', '#2563eb'],
    badge: ['#2563eb', '#1d4ed8'],
  };
  const [fill, stroke] = styles[stampKind] || styles.badge;
  ctx.fillStyle = fill; ctx.strokeStyle = stroke;
  if (stampKind === 'star') {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45, ang = (i * Math.PI) / 5 - Math.PI / 2;
      const px = cx + rad * Math.cos(ang), py = cy + rad * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (stampKind === 'tick') {
      ctx.beginPath(); ctx.moveTo(cx - r * 0.45, cy + r * 0.05); ctx.lineTo(cx - r * 0.1, cy + r * 0.4); ctx.lineTo(cx + r * 0.48, cy - r * 0.35); ctx.stroke();
    } else if (stampKind === 'cross') {
      const d = r * 0.38;
      ctx.beginPath(); ctx.moveTo(cx - d, cy - d); ctx.lineTo(cx + d, cy + d); ctx.moveTo(cx + d, cy - d); ctx.lineTo(cx - d, cy + d); ctx.stroke();
    } else if (stampKind === 'arrow-up') {
      ctx.beginPath(); ctx.moveTo(cx, cy + r * 0.45); ctx.lineTo(cx, cy - r * 0.45); ctx.moveTo(cx - r * 0.35, cy - r * 0.1); ctx.lineTo(cx, cy - r * 0.45); ctx.lineTo(cx + r * 0.35, cy - r * 0.1); ctx.stroke();
    } else {
      ctx.fillStyle = stampKind === 'question' ? '#7c3aed' : '#ffffff';
      ctx.font = `bold ${Math.round(r * 1.15)}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(stampKind === 'question' ? '?' : String(badgeValue || 1), cx, cy + 1);
    }
  }
  ctx.restore();
}

export function drawMathTool(ctx, el) {
  const { x, y, w, h, mathKind = 'ruler' } = el;
  ctx.save();
  ctx.fillStyle = 'rgba(254, 249, 195, 0.85)';
  ctx.strokeStyle = '#ca8a04';
  ctx.lineWidth = 2;

  if (mathKind === 'ruler') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#713f12';
    ctx.font = '10px sans-serif';
    ctx.textAlign = 'center';
    const step = 10;
    for (let dx = 10; dx < w - 6; dx += step) {
      const isMajor = dx % 50 === 0;
      const tickH = isMajor ? 16 : dx % 20 === 0 ? 11 : 6;
      ctx.beginPath();
      ctx.moveTo(x + dx, y);
      ctx.lineTo(x + dx, y + tickH);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(String(dx / 10), x + dx, y + 28);
      }
    }
  } else {
    // Protractor semicircle
    const cx = x + w / 2;
    const by = y + h;
    const r = Math.min(w / 2, h - 4);
    ctx.beginPath();
    ctx.arc(cx, by, r, Math.PI, 0, false);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, by, r * 0.55, Math.PI, 0, false);
    ctx.closePath();
    ctx.stroke();

    ctx.fillStyle = '#713f12';
    ctx.font = '9px sans-serif';
    ctx.textAlign = 'center';
    for (let deg = 0; deg <= 180; deg += 15) {
      const rad = Math.PI + (deg * Math.PI) / 180;
      const len = deg % 30 === 0 ? 12 : 6;
      ctx.beginPath();
      ctx.moveTo(cx + r * Math.cos(rad), by + r * Math.sin(rad));
      ctx.lineTo(cx + (r - len) * Math.cos(rad), by + (r - len) * Math.sin(rad));
      ctx.stroke();
      if (deg % 30 === 0) {
        ctx.fillText(
          `${deg}°`,
          cx + (r - 22) * Math.cos(rad),
          by + (r - 22) * Math.sin(rad) + 3
        );
      }
    }
  }
  ctx.restore();
}

// Wraps a cell value to the available width. Long unbroken tokens (commands, URLs)
// are hard-broken rather than squashed by canvas fillText's maxWidth behaviour.
export function wrapCellLines(ctx, text, maxWidth) {
  const raw = String(text ?? '');
  if (!raw) return [''];
  const lines = [];
  for (const paragraph of raw.split(String.fromCharCode(10))) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push('');
      continue;
    }
    let cur = '';
    for (const word of words) {
      const candidate = cur ? `${cur} ${word}` : word;
      if (ctx.measureText(candidate).width <= maxWidth) {
        cur = candidate;
        continue;
      }
      if (cur) {
        lines.push(cur);
        cur = '';
      }
      if (ctx.measureText(word).width <= maxWidth) {
        cur = word;
      } else {
        // Hard-break an over-long token across as many lines as it needs.
        let chunk = '';
        for (const ch of word) {
          if (ctx.measureText(chunk + ch).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk += ch;
          }
        }
        cur = chunk;
      }
    }
    if (cur) lines.push(cur);
  }
  return lines;
}

// Resolves the column widths and row heights of a table into absolute spans.
// `colWidths` / `rowHeights` hold optional relative weights; anything missing,
// non-numeric or non-positive falls back to an equal share so a partially
// hand-edited document can never render a zero-width cell.
export function tableGeometry(el) {
  const rows = Math.max(1, el.rows || 1);
  const cols = Math.max(1, el.cols || 1);
  const w = Math.max(1, el.w || 1);
  const h = Math.max(1, el.h || 1);
  const span = (weights, n, total) => {
    const usable =
      Array.isArray(weights) &&
      weights.length === n &&
      weights.every((v) => Number.isFinite(v) && v > 0);
    const values = usable ? weights.map(Number) : Array(n).fill(1);
    const sum = values.reduce((a, b) => a + b, 0) || 1;
    const sizes = values.map((v) => (v / sum) * total);
    const offsets = [0];
    for (let i = 0; i < n; i++) offsets.push(offsets[i] + sizes[i]);
    return { sizes, offsets };
  };
  const colSpan = span(el.colWidths, cols, w);
  const rowSpan = span(el.rowHeights, rows, h);
  return {
    rows,
    cols,
    cellW: colSpan.sizes,
    cellH: rowSpan.sizes,
    xs: colSpan.offsets.map((v) => el.x + v),
    ys: rowSpan.offsets.map((v) => el.y + v),
  };
}

export function tableCellPadding(el) {
  const p = Number(el.cellPadding);
  return Number.isFinite(p) ? Math.min(24, Math.max(0, p)) : 6;
}

// Grows the table so no cell content is clipped. Uses the real canvas metrics,
// so it agrees with what the renderer measured rather than estimating.
export function fitTableToContent(ctx, el, { maxWidth = 1600, maxHeight = 1200 } = {}) {
  const geo = tableGeometry(el);
  const fontSize = el.fontSize || 15;
  const lineH = fontSize * 1.25;
  const pad = tableCellPadding(el);
  ctx.save();
  const hasHeader = el.headerRow !== false;
  const fontFor = (r) => `${hasHeader && r === 0 ? '600' : '400'} ${fontSize}px ${FONT_MAP.sans}`;
  const colWidths = [];
  for (let c = 0; c < geo.cols; c++) {
    let widest = 24;
    for (let r = 0; r < geo.rows; r++) {
      ctx.font = fontFor(r);
      const val = String(el.cells?.[r]?.[c] ?? '');
      for (const line of val.split(String.fromCharCode(10))) {
        widest = Math.max(widest, ctx.measureText(line).width);
      }
    }
    colWidths.push(Math.min(maxWidth, widest + pad * 2 + 2));
  }
  const rowHeights = [];
  for (let r = 0; r < geo.rows; r++) {
    // The renderer budgets (cellH - 8) / lineH lines, so a fitted row must leave
    // that 8px headroom or Fit to content would immediately ellipsise its own text.
    let tallest = lineH + 8 + pad * 2;
    ctx.font = fontFor(r);
    for (let c = 0; c < geo.cols; c++) {
      const val = String(el.cells?.[r]?.[c] ?? '');
      const lines = wrapCellLines(ctx, val, Math.max(8, colWidths[c] - pad * 2));
      const explicitBreaks = val.split(String.fromCharCode(10)).length;
      tallest = Math.max(tallest, Math.max(lines.length, explicitBreaks) * lineH + 8 + pad * 2);
    }
    rowHeights.push(Math.min(maxHeight, tallest));
  }
  ctx.restore();
  el.colWidths = colWidths;
  el.rowHeights = rowHeights;
  el.w = Math.max(40, Math.round(colWidths.reduce((a, b) => a + b, 0)));
  el.h = Math.max(32, Math.round(rowHeights.reduce((a, b) => a + b, 0)));
  return { w: el.w, h: el.h };
}

export function drawTableElement(ctx, el, themeName) {
  const { x, y, w, h, cells = [] } = el;
  const geo = tableGeometry(el);
  const { rows, cols, xs, ys } = geo;
  const stroke = resolveThemeColor(el.stroke || '#1e293b', themeName, 'stroke');
  const fill = resolveThemeColor(el.fill || '#ffffff', themeName, 'fill');
  const hasHeader = el.headerRow !== false;

  ctx.save();
  ctx.fillStyle = fill === 'transparent' ? (themeName === 'dark' ? '#1e293b' : '#ffffff') : fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();

  // Alternate-row tint before the grid lines so the rules stay crisp.
  if (el.striped) {
    ctx.fillStyle = themeName === 'dark' ? 'rgba(148, 163, 184, 0.09)' : 'rgba(241, 245, 249, 0.85)';
    for (let r = hasHeader ? 1 : 0; r < rows; r += 2) {
      ctx.fillRect(x + 1, ys[r], w - 2, geo.cellH[r] - 1);
    }
  }

  // Header tint (only when the table actually has a header row).
  if (hasHeader) {
    ctx.fillStyle = themeName === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(226, 232, 240, 0.7)';
    ctx.fillRect(x, y, w, geo.cellH[0]);
  }

  ctx.beginPath();
  for (let r = 1; r < rows; r++) {
    ctx.moveTo(x, ys[r]);
    ctx.lineTo(x + w, ys[r]);
  }
  for (let c = 1; c < cols; c++) {
    ctx.moveTo(xs[c], y);
    ctx.lineTo(xs[c], y + h);
  }
  ctx.stroke();

  ctx.fillStyle = resolveThemeColor(el.textColor || '#1e293b', themeName, 'text');
  const fontSize = el.fontSize || 15;
  const lineH = fontSize * 1.25;
  const padX = tableCellPadding(el);
  const align = el.textAlign || 'center';
  const valign = el.valign || 'middle';

  for (let r = 0; r < rows; r++) {
    ctx.font = `${hasHeader && r === 0 ? '600' : '400'} ${fontSize}px ${FONT_MAP.sans}`;
    for (let c = 0; c < cols; c++) {
      const val = cells[r]?.[c] ?? '';
      const cellX = xs[c];
      const cellY = ys[r];
      const cellW = geo.cellW[c];
      const cellH = geo.cellH[r];
      const innerW = Math.max(8, cellW - padX * 2);
      const lines = wrapCellLines(ctx, val, innerW);
      const maxLines = Math.max(1, Math.floor((cellH - 8) / lineH));
      const visible = lines.slice(0, maxLines);
      if (lines.length > maxLines && visible.length > 0) {
        let last = visible[visible.length - 1];
        while (last.length > 1 && ctx.measureText(`${last}…`).width > innerW) {
          last = last.slice(0, -1);
        }
        visible[visible.length - 1] = `${last}…`;
      }
      ctx.save();
      ctx.beginPath();
      ctx.rect(cellX + 1, cellY + 1, cellW - 2, cellH - 2);
      ctx.clip();
      ctx.textAlign = align;
      ctx.textBaseline = 'middle';
      const totalH = visible.length * lineH;
      let startY;
      if (valign === 'top') startY = cellY + 8 + lineH / 2;
      else if (valign === 'bottom') startY = cellY + cellH - 6 - totalH + lineH / 2;
      else startY = cellY + cellH / 2 - totalH / 2 + lineH / 2;
      const tx =
        align === 'left'
          ? cellX + padX
          : align === 'right'
            ? cellX + cellW - padX
            : cellX + cellW / 2;
      visible.forEach((line, idx) => {
        ctx.fillText(line, tx, startY + idx * lineH);
      });
      ctx.restore();
    }
  }
  ctx.restore();
}

export function drawCodeElement(ctx, el) {
  const { x, y, w, h, text = '', highlightLines = '' } = el;
  const hlSet = parseHighlightSet(highlightLines);
  ctx.save();
  ctx.fillStyle = '#0f172a';
  ctx.strokeStyle = '#334155';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 8);
  ctx.fill();
  ctx.stroke();

  // Window header dots
  const dotColors = ['#ef4444', '#f59e0b', '#22c55e'];
  dotColors.forEach((dc, idx) => {
    ctx.fillStyle = dc;
    ctx.beginPath();
    ctx.arc(x + 16 + idx * 14, y + 14, 4.5, 0, Math.PI * 2);
    ctx.fill();
  });

  const fontSize = el.fontSize || 14;
  const lineH = fontSize * 1.45;
  const lines = String(text).split(String.fromCharCode(10));
  ctx.font = `${fontSize}px ${FONT_MAP.mono}`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  lines.forEach((line, idx) => {
    const lineNum = idx + 1;
    const ly = y + 36 + idx * lineH;
    if (ly + lineH / 2 > y + h - 6) return;
    if (hlSet.has(lineNum)) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.2)';
      ctx.fillRect(x + 4, ly - lineH / 2, w - 8, lineH);
    }
    ctx.fillStyle = '#64748b';
    ctx.fillText(String(lineNum).padStart(2, ' '), x + 12, ly);
    ctx.fillStyle = '#f8fafc';
    ctx.fillText(line, x + 40, ly);
  });
  ctx.restore();
}

export function parseHighlightSet(spec = '') {
  const set = new Set();
  const parts = String(spec || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (part.includes('-')) {
      const [a, b] = part.split('-').map((n) => parseInt(n, 10));
      if (!Number.isNaN(a) && !Number.isNaN(b)) {
        for (let i = Math.min(a, b); i <= Math.max(a, b); i++) set.add(i);
      }
    } else {
      const n = parseInt(part, 10);
      if (!Number.isNaN(n)) set.add(n);
    }
  }
  return set;
}

// Roughness is a presentation-only property of a connector: 0 clean, 1 sketch,
// 2 rough. It never changes the route handed to hit testing or bindings.
export function connectorRoughness(el) {
  if (Number.isFinite(el?.roughness)) {
    return Math.max(0, Math.min(2, Math.round(el.roughness)));
  }
  return el?.sloppy ? 1 : 0;
}

export function roughenConnectorPoints(el, pts) {
  const level = connectorRoughness(el);
  if (level === 0 || !Array.isArray(pts) || pts.length < 3) return pts;
  const amp = level >= 2 ? 3.2 : 1.4;
  const seed = hashId(el.id || '');
  return pts.map((p, i) => {
    if (i === 0 || i === pts.length - 1) return p;
    const prev = pts[i - 1];
    const next = pts[i + 1];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = seededOffset(seed + i * 17, i, amp);
    return {
      x: p.x + (-dy / len) * offset,
      y: p.y + (dx / len) * offset,
    };
  });
}

export function drawConnectorElement(ctx, el, page, themeTokens) {
  const stroke = resolveThemeColor(el.stroke || '#1e293b', themeTokens.name, 'stroke');
  const sw = el.strokeWidth || 2;
  const pts = getConnectorPoints(el, page);
  if (pts.length < 2) return;
  const sketchPts = roughenConnectorPoints(el, pts);

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(getDashArray(el.strokeStyle, sw));

  ctx.beginPath();
  if (el.routing === 'curved' && sketchPts.length === 3) {
    ctx.moveTo(sketchPts[0].x, sketchPts[0].y);
    ctx.quadraticCurveTo(sketchPts[1].x, sketchPts[1].y, sketchPts[2].x, sketchPts[2].y);
  } else if (el.routing === 'rounded-elbow' && sketchPts.length >= 3) {
    strokeRoundedElbowCanvasPath(ctx, sketchPts, Number(el.cornerRadius) || 14);
  } else {
    ctx.moveTo(sketchPts[0].x, sketchPts[0].y);
    for (let i = 1; i < sketchPts.length; i++) {
      ctx.lineTo(sketchPts[i].x, sketchPts[i].y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Rough strokes get a second, lighter pass so the line reads as ink rather
  // than a wobbling rectangle. Endpoints stay anchored.
  if (connectorRoughness(el) >= 2 && el.routing !== 'curved') {
    ctx.save();
    ctx.globalAlpha *= 0.55;
    ctx.beginPath();
    const second = roughenConnectorPoints({ ...el, id: `${el.id}-b` }, pts);
    ctx.moveTo(second[0].x, second[0].y);
    for (let i = 1; i < second.length; i++) ctx.lineTo(second[i].x, second[i].y);
    ctx.stroke();
    ctx.restore();
  }

  // Arrowheads calculated from non-zero segment or curve tangent
  if (el.startArrow && el.startArrow !== 'none') {
    const p0 = pts[0];
    const pFrom = getConnectorTangentFromPoint(el, 'start', page);
    drawArrowhead(ctx, el.startArrow, p0.x, p0.y, pFrom.x, pFrom.y, sw, stroke);
  }
  if (el.endArrow && el.endArrow !== 'none') {
    const pLast = pts[pts.length - 1];
    const pFrom = getConnectorTangentFromPoint(el, 'end', page);
    drawArrowhead(ctx, el.endArrow, pLast.x, pLast.y, pFrom.x, pFrom.y, sw, stroke);
  }

  // Connector labels: source (startLabel), middle (text), destination (endLabel)
  const labelSpecs = [
    el.startLabel ? { text: String(el.startLabel), role: 'start', sizeScale: 0.86 } : null,
    el.text ? { text: String(el.text), role: 'middle', sizeScale: 1 } : null,
    el.endLabel ? { text: String(el.endLabel), role: 'end', sizeScale: 0.86 } : null,
  ].filter(Boolean);

  for (const spec of labelSpecs) {
    const lp = getConnectorLabelPosition(el, spec.role, page);
    const fontSize = Math.max(11, Math.round((el.fontSize || 15) * spec.sizeScale));
    ctx.font = `500 ${fontSize}px ${FONT_MAP[el.fontFamily || 'sans']}`;
    const metrics = ctx.measureText(spec.text);
    const bw = metrics.width + 14;
    const bh = fontSize + 10;
    ctx.fillStyle = themeTokens.connectorLabelBg;
    ctx.beginPath();
    ctx.roundRect(lp.x - bw / 2, lp.y - bh / 2, bw, bh, 5);
    ctx.fill();
    ctx.fillStyle = stroke;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(spec.text, lp.x, lp.y);
  }
  ctx.restore();
}

export function drawShapeElement(ctx, el, themeTokens) {
  const stroke = resolveThemeColor(el.stroke || '#1e293b', themeTokens.name, 'stroke');
  const fill = resolveThemeColor(el.fill || 'transparent', themeTokens.name, 'fill');
  const sw = el.strokeWidth || 2;
  const seed = hashId(el.id);

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.fillStyle = fill;
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(getDashArray(el.strokeStyle, sw));

  const { x, y, w, h } = el;

  if (el.type === 'stencil') {
    const stencil = getStencilById(el.stencilId);
    if (stencil.isCard && fill === 'transparent') {
      ctx.fillStyle = themeTokens.name === 'dark' ? '#1e293b' : '#ffffff';
    }
    if (stencil.isCard && (!el.stroke || el.stroke === '#1e293b')) {
      ctx.strokeStyle = stencil.color || stroke;
    }
    stencil.draw(ctx, x, y, w, h);
    ctx.setLineDash([]);
    drawElementText(ctx, el, themeTokens.name, 10);
    ctx.restore();
    return;
  }

  if (el.type === 'question') {
    const accent = el.resolved ? '#16a34a' : '#d97706';
    ctx.fillStyle = el.resolved ? '#dcfce7' : '#fef3c7';
    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.stroke();
    // Pin badge circle
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x + 18, y + 18, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold 12px ${FONT_MAP.sans}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.resolved ? '✓' : '?', x + 18, y + 18.5);
    // Author & target header
    ctx.fillStyle = '#0f172a';
    ctx.font = `700 11px ${FONT_MAP.sans}`;
    ctx.textAlign = 'left';
    const header = `${el.authorName || 'Student'}${el.targetElementName ? ` → ${el.targetElementName}` : ''}`;
    ctx.fillText(header.slice(0, 28), x + 34, y + 18);
    // Question body
    ctx.font = `500 12px ${FONT_MAP.sans}`;
    ctx.fillStyle = '#1e293b';
    const qLines = wrapTextLines(ctx, el.text || 'Question', w - 20).slice(0, 2);
    qLines.forEach((ln, idx) => ctx.fillText(ln, x + 10, y + 38 + idx * 15));
    if (el.reply) {
      ctx.fillStyle = '#15803d';
      ctx.font = `600 10px ${FONT_MAP.sans}`;
      ctx.fillText(`↳ ${el.reply.slice(0, 30)}`, x + 10, y + h - 8);
    }
    ctx.restore();
    return;
  }

  if (el.type === 'sticky') {
    ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : '#fef08a';
    ctx.shadowColor = 'rgba(15, 23, 42, 0.16)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    drawElementText(ctx, { ...el, textColor: '#1e293b' }, 'light', 14);
    ctx.restore();
    return;
  }

  if (el.sloppy && (el.type === 'rect' || el.type === 'rounded-rect' || el.type === 'diamond')) {
    const pts =
      el.type === 'diamond'
        ? [
            { x: x + w / 2, y },
            { x: x + w, y: y + h / 2 },
            { x: x + w / 2, y: y + h },
            { x, y: y + h / 2 },
          ]
        : [
            { x, y },
            { x: x + w, y },
            { x: x + w, y: y + h },
            { x, y: y + h },
          ];
    drawSloppyPolygon(ctx, pts, seed);
  } else if (el.type === 'rect' || el.type === 'rounded-rect') {
    const r = el.type === 'rounded-rect' ? Math.max(4, el.roundness || 14) : el.roundness || 0;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (el.type === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, Math.abs(w) / 2, Math.abs(h) / 2, 0, 0, Math.PI * 2);
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
    if (el.sloppy) {
      ctx.beginPath();
      ctx.ellipse(
        x + w / 2 + 1.5,
        y + h / 2 - 1.2,
        Math.abs(w) / 2 + 1,
        Math.abs(h) / 2 - 1,
        0.04,
        0,
        Math.PI * 2
      );
      ctx.stroke();
    }
  } else if (el.type === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    if (fill !== 'transparent') ctx.fill();
    ctx.stroke();
  }

  ctx.setLineDash([]);
  drawElementText(ctx, el, themeTokens.name);
  ctx.restore();
}
