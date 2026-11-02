// render/shapes.js
import { FONT_MAP, resolveThemeColor } from './themes.js';
import { getStencilById } from '../stencils/index.js';
import { getConnectorPoints, getPointAlongConnector } from '../scene/routing.js';

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
  const fontSize = el.fontSize || 18;
  const fontStack = FONT_MAP[el.fontFamily || 'sans'] || FONT_MAP.sans;
  const color = resolveThemeColor(el.textColor || el.stroke || '#1e293b', themeName, 'text');

  ctx.save();
  ctx.font = `${fontSize}px ${fontStack}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'middle';

  const maxW = Math.max(24, el.w - padding * 2);
  const lines =
    el.type === 'sticky'
      ? wrapTextLines(ctx, el.text, maxW)
      : String(el.text).split(String.fromCharCode(10));
  const lineH = fontSize * 1.32;
  const totalH = lines.length * lineH;
  const startY = el.y + el.h / 2 - totalH / 2 + lineH / 2;

  const align = el.textAlign || 'center';
  ctx.textAlign = align;
  const tx =
    align === 'left'
      ? el.x + padding
      : align === 'right'
        ? el.x + el.w - padding
        : el.x + el.w / 2;

  lines.forEach((line, idx) => {
    ctx.fillText(line, tx, startY + idx * lineH);
  });
  ctx.restore();
}

export function drawStamp(ctx, el) {
  const { x, y, w, h, stampKind = 'tick', badgeValue = 1 } = el;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const r = Math.min(w, h) / 2 - 3;

  ctx.save();
  ctx.lineWidth = 3;
  if (stampKind === 'tick') {
    ctx.fillStyle = 'rgba(22, 163, 74, 0.16)';
    ctx.strokeStyle = '#16a34a';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - r * 0.45, cy + r * 0.05);
    ctx.lineTo(cx - r * 0.1, cy + r * 0.4);
    ctx.lineTo(cx + r * 0.48, cy - r * 0.35);
    ctx.stroke();
  } else if (stampKind === 'cross') {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.16)';
    ctx.strokeStyle = '#dc2626';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    const d = r * 0.38;
    ctx.beginPath();
    ctx.moveTo(cx - d, cy - d);
    ctx.lineTo(cx + d, cy + d);
    ctx.moveTo(cx + d, cy - d);
    ctx.lineTo(cx - d, cy + d);
    ctx.stroke();
  } else if (stampKind === 'star') {
    ctx.fillStyle = '#fef08a';
    ctx.strokeStyle = '#ca8a04';
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? r : r * 0.45;
      const ang = (i * Math.PI) / 5 - Math.PI / 2;
      const px = cx + rad * Math.cos(ang);
      const py = cy + rad * Math.sin(ang);
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  } else if (stampKind === 'question') {
    ctx.fillStyle = 'rgba(124, 58, 237, 0.15)';
    ctx.strokeStyle = '#7c3aed';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#7c3aed';
    ctx.font = `bold ${Math.round(r * 1.2)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', cx, cy + 2);
  } else if (stampKind === 'arrow-up') {
    ctx.fillStyle = 'rgba(37, 99, 235, 0.15)';
    ctx.strokeStyle = '#2563eb';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx, cy + r * 0.45);
    ctx.lineTo(cx, cy - r * 0.45);
    ctx.moveTo(cx - r * 0.35, cy - r * 0.1);
    ctx.lineTo(cx, cy - r * 0.45);
    ctx.lineTo(cx + r * 0.35, cy - r * 0.1);
    ctx.stroke();
  } else {
    // Number badge 1..9
    ctx.fillStyle = '#2563eb';
    ctx.strokeStyle = '#1d4ed8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.round(r * 1.1)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(badgeValue || 1), cx, cy + 1);
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

export function drawTableElement(ctx, el, themeName) {
  const { x, y, w, h, rows = 3, cols = 3, cells = [] } = el;
  const stroke = resolveThemeColor(el.stroke || '#1e293b', themeName, 'stroke');
  const fill = resolveThemeColor(el.fill || '#ffffff', themeName, 'fill');
  const cellW = w / cols;
  const cellH = h / rows;

  ctx.save();
  ctx.fillStyle = fill === 'transparent' ? (themeName === 'dark' ? '#1e293b' : '#ffffff') : fill;
  ctx.strokeStyle = stroke;
  ctx.lineWidth = el.strokeWidth || 2;
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.fill();
  ctx.stroke();

  // Header tint
  ctx.fillStyle = themeName === 'dark' ? 'rgba(148, 163, 184, 0.16)' : 'rgba(226, 232, 240, 0.7)';
  ctx.fillRect(x, y, w, cellH);

  ctx.beginPath();
  for (let r = 1; r < rows; r++) {
    ctx.moveTo(x, y + r * cellH);
    ctx.lineTo(x + w, y + r * cellH);
  }
  for (let c = 1; c < cols; c++) {
    ctx.moveTo(x + c * cellW, y);
    ctx.lineTo(x + c * cellW, y + h);
  }
  ctx.stroke();

  ctx.fillStyle = resolveThemeColor(el.textColor || '#1e293b', themeName, 'text');
  const fontSize = el.fontSize || 15;
  for (let r = 0; r < rows; r++) {
    ctx.font = `${r === 0 ? '600' : '400'} ${fontSize}px ${FONT_MAP.sans}`;
    for (let c = 0; c < cols; c++) {
      const val = cells[r]?.[c] ?? '';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(val), x + c * cellW + cellW / 2, y + r * cellH + cellH / 2, cellW - 8);
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

export function drawConnectorElement(ctx, el, page, themeTokens) {
  const stroke = resolveThemeColor(el.stroke || '#1e293b', themeTokens.name, 'stroke');
  const sw = el.strokeWidth || 2;
  const pts = getConnectorPoints(el, page);
  if (pts.length < 2) return;

  ctx.save();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = sw;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(getDashArray(el.strokeStyle, sw));

  ctx.beginPath();
  if (el.routing === 'curved' && pts.length === 3) {
    ctx.moveTo(pts[0].x, pts[0].y);
    ctx.quadraticCurveTo(pts[1].x, pts[1].y, pts[2].x, pts[2].y);
  } else {
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
  }
  ctx.stroke();
  ctx.setLineDash([]);

  // Arrowheads
  if (el.startArrow && el.startArrow !== 'none') {
    const p0 = pts[0];
    const p1 = pts[1];
    drawArrowhead(ctx, el.startArrow, p0.x, p0.y, p1.x, p1.y, sw, stroke);
  }
  if (el.endArrow && el.endArrow !== 'none') {
    const pLast = pts[pts.length - 1];
    const pPrev = pts[pts.length - 2];
    drawArrowhead(ctx, el.endArrow, pLast.x, pLast.y, pPrev.x, pPrev.y, sw, stroke);
  }

  // Connector label
  if (el.text) {
    const lp = getPointAlongConnector(el, el.labelT ?? 0.5, page);
    const fontSize = el.fontSize || 15;
    ctx.font = `500 ${fontSize}px ${FONT_MAP[el.fontFamily || 'sans']}`;
    const metrics = ctx.measureText(el.text);
    const bw = metrics.width + 14;
    const bh = fontSize + 10;
    ctx.fillStyle = themeTokens.connectorLabelBg;
    ctx.beginPath();
    ctx.roundRect(lp.x - bw / 2, lp.y - bh / 2, bw, bh, 5);
    ctx.fill();
    ctx.fillStyle = stroke;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(el.text, lp.x, lp.y);
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
    stencil.draw(ctx, x, y, w, h);
    ctx.setLineDash([]);
    drawElementText(ctx, el, themeTokens.name, 16);
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
