// render/svg-export.js
import { getThemeTokens, FONT_MAP, resolveThemeColor } from './themes.js';
import { getSelectionBounds, syncFreehandBounds } from '../scene/geometry.js';
import { wrapShapeTextLines } from '../scene/model.js';
import {
  getConnectorPoints,
  getPointAlongConnector,
  getConnectorLabelPosition,
  getConnectorTangentFromPoint,
  buildRoundedElbowSvgPath,
} from '../scene/routing.js';
import { getStencilById } from '../stencils/index.js';
import {
  resolveBrush,
  buildStrokeSegments,
  buildGrainPoints,
  buildNibOffsets,
  strokeOpacity,
} from '../scene/brushes.js';
import {
  parseHighlightSet,
  tableGeometry,
  tableCellPadding,
  roughenConnectorPoints,
  connectorRoughness,
  wrapCellLines,
} from './shapes.js';

// Offscreen measuring context, so exported table text wraps at the same width as
// the canvas. In a non-DOM environment (unit tests) it stays null and the caller
// falls back to the character-width estimate.
let _measureCtx;
function measureCtxFor(fontSize, weight) {
  if (_measureCtx === undefined) {
    try {
      _measureCtx = document.createElement('canvas').getContext('2d');
    } catch {
      _measureCtx = null;
    }
  }
  if (!_measureCtx) return null;
  _measureCtx.font = `${weight} ${fontSize}px ${FONT_MAP.sans}`;
  return _measureCtx;
}

export function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getSvgDashAttr(strokeStyle, strokeWidth = 2) {
  if (strokeStyle === 'dashed') {
    return `stroke-dasharray="${strokeWidth * 4},${strokeWidth * 2.5}"`;
  }
  if (strokeStyle === 'dotted') {
    return `stroke-dasharray="${strokeWidth * 1.2},${strokeWidth * 2.2}"`;
  }
  return '';
}

function renderSvgArrowhead(type, tipX, tipY, fromX, fromY, strokeWidth, strokeColor) {
  if (!type || type === 'none') return '';
  const angleDeg = (Math.atan2(tipY - fromY, tipX - fromX) * 180) / Math.PI;
  const size = Math.max(10, strokeWidth * 4.2);
  let inner = '';
  if (type === 'arrow') {
    inner = `<polyline points="${-size},${-size * 0.55} 0,0 ${-size},${size * 0.55}" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (type === 'triangle') {
    inner = `<polygon points="0,0 ${-size},${-size * 0.58} ${-size},${size * 0.58}" fill="${strokeColor}"/>`;
  } else if (type === 'diamond') {
    inner = `<polygon points="0,0 ${-size * 0.65},${-size * 0.45} ${-size * 1.3},0 ${-size * 0.65},${size * 0.45}" fill="${strokeColor}"/>`;
  } else if (type === 'circle') {
    inner = `<circle cx="${-size * 0.45}" cy="0" r="${size * 0.42}" fill="${strokeColor}"/>`;
  } else if (type === 'bar') {
    inner = `<line x1="-2" y1="${-size * 0.6}" x2="-2" y2="${size * 0.6}" stroke="${strokeColor}" stroke-width="${strokeWidth}"/>`;
  }
  return `<g transform="translate(${tipX},${tipY}) rotate(${angleDeg})">${inner}</g>`;
}

function renderSvgTextBlock(el, themeName, padding = 12) {
  if (!el.text) return '';
  const stencil = el.type === 'stencil' ? getStencilById(el.stencilId) : null;
  const isBoundary = Boolean(el.isBoundary || stencil?.isBoundary);
  const isCard = el.type === 'stencil' && Boolean(stencil?.isCard) && !isBoundary;
  const fontSize = isBoundary ? 13 : isCard ? Math.min(el.fontSize || 14, 15) : el.fontSize || 18;
  const fontStack = escapeXml(FONT_MAP[el.fontFamily || 'sans'] || FONT_MAP.sans);
  const color = resolveThemeColor(el.textColor || el.stroke || '#1e293b', themeName, 'text');
  if (isBoundary) {
    const firstLine = String(el.text).split(String.fromCharCode(10))[0];
    return `<text x="${el.x + 38}" y="${el.y + 18}" font-family="${fontStack}" font-size="${fontSize}" font-weight="600" fill="${color}" text-anchor="start" dominant-baseline="central">${escapeXml(firstLine)}</text>`;
  }
  const lines = wrapShapeTextLines(el, el.text);
  const lineH = fontSize * (isCard ? 1.18 : 1.32);
  const totalH = lines.length * lineH;
  const zoneCenterY = isCard ? el.y + el.h * 0.785 : el.y + el.h / 2;
  const startY = zoneCenterY - totalH / 2 + lineH / 2;

  const align = el.textAlign || 'center';
  const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
  const innerPad = el.type === 'diamond' ? Math.round(el.w * 0.23) : padding;
  const tx =
    align === 'left'
      ? el.x + innerPad
      : align === 'right'
        ? el.x + el.w - innerPad
        : el.x + el.w / 2;

  return lines
    .map(
      (line, idx) =>
        `<text x="${tx}" y="${startY + idx * lineH}" font-family="${fontStack}" font-size="${fontSize}" fill="${color}" text-anchor="${anchor}" dominant-baseline="central">${escapeXml(line)}</text>`
    )
    .join('');
}

export function exportToSvgString(scene, page = null, options = {}) {
  const resolvedPage =
    page && Array.isArray(page.elements)
      ? page
      : scene?.pages?.find((p) => p.id === scene.activePageId) || scene?.pages?.[0];
  const resolvedOpts = page && !Array.isArray(page.elements) ? page : options;
  const {
    selectionOnly = false,
    selectedIds = new Set(),
    transparent = false,
  } = resolvedOpts;

  const elements = selectionOnly
    ? resolvedPage.elements.filter((e) => selectedIds.has(e.id) && !e.hidden)
    : resolvedPage.elements.filter((e) => !e.hidden);

  const bounds = getSelectionBounds(elements) || { x: 0, y: 0, w: 800, h: 600 };
  const pad = 32;
  const vx = Math.floor(bounds.x - pad);
  const vy = Math.floor(bounds.y - pad);
  const vw = Math.max(64, Math.ceil(bounds.w + pad * 2));
  const vh = Math.max(64, Math.ceil(bounds.h + pad * 2));

  const theme = getThemeTokens(scene.theme);
  const parts = [];

  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vx} ${vy} ${vw} ${vh}" width="${vw}" height="${vh}">`
  );

  if (!transparent) {
    parts.push(`<rect x="${vx}" y="${vy}" width="${vw}" height="${vh}" fill="${theme.canvasBg}"/>`);
  }

  for (const el of elements) {
    parts.push(elementToSvg(el, resolvedPage, scene, theme));
  }

  parts.push(`</svg>`);
  return parts.join(String.fromCharCode(10));
}

function elementToSvg(el, page, scene, theme) {
  const stroke = resolveThemeColor(el.stroke || '#1e293b', theme.name, 'stroke');
  const fill =
    el.fill && el.fill !== 'transparent'
      ? resolveThemeColor(el.fill, theme.name, 'fill')
      : 'none';
  const sw = el.strokeWidth || 2;
  const dash = getSvgDashAttr(el.strokeStyle, sw);
  const opacityAttr = el.opacity !== undefined && el.opacity < 1 ? ` opacity="${el.opacity}"` : '';

  if (el.type === 'pen' || el.type === 'highlighter') {
    syncFreehandBounds(el);
  }
  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const cx = el.x + el.w / 2;
  const cy = el.y + h / 2;
  const rotDeg = el.rotation ? (el.rotation * 180) / Math.PI : 0;
  const transformAttr =
    rotDeg && el.type !== 'line' && el.type !== 'arrow'
      ? ` transform="rotate(${rotDeg} ${cx} ${cy})"`
      : '';

  const commonAttrs = `fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${dash}`;

  let inner = '';

  if (el.type === 'pen' || el.type === 'highlighter') {
    const pts = el.points || [];
    const preset = resolveBrush(el);
    const alpha = strokeOpacity(el);
    const groupOpen = alpha < 1 ? `<g opacity="${alpha}">` : '';
    const groupClose = alpha < 1 ? '</g>' : '';
    if (pts.length === 1) {
      inner = `${groupOpen}<circle cx="${pts[0].x}" cy="${pts[0].y}" r="${sw / 2}" fill="${stroke}"/>${groupClose}`;
    } else if (pts.length > 1) {
      const segments = buildStrokeSegments(el);
      const nib = buildNibOffsets(el);
      if (!preset.pressure && nib.length === 0) {
        const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        inner = `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${dash}/>`;
      } else {
        const widths = nib.length ? nib : [0];
        for (const off of widths) {
          for (const s of segments) {
            const dx = s.x2 - s.x1;
            const dy = s.y2 - s.y1;
            const len = Math.hypot(dx, dy) || 1;
            const ox = nib.length ? (-dy / len) * off : 0;
            const oy = nib.length ? (dx / len) * off : 0;
            const w = nib.length ? Math.max(1, s.width * (preset.nib?.aspect ?? 0.42)) : s.width;
            inner += `<line x1="${s.x1 + ox}" y1="${s.y1 + oy}" x2="${s.x2 + ox}" y2="${s.y2 + oy}" stroke="${stroke}" stroke-width="${w}" stroke-linecap="round"/>`;
          }
        }
      }
      for (const g of buildGrainPoints(el, segments)) {
        inner += `<circle cx="${g.x}" cy="${g.y}" r="${g.r}" fill="${stroke}" opacity="${Math.min(0.5, g.a)}"/>`;
      }
      inner = groupOpen + inner + groupClose;
    }
    return `<g${transformAttr}>${inner}</g>`;
  } else if (el.type === 'line' || el.type === 'arrow') {
    const pts = getConnectorPoints(el, page);
    if (pts.length >= 2) {
      const sketchPts = roughenConnectorPoints(el, pts);
      let d;
      if (el.routing === 'curved' && sketchPts.length === 3) {
        d = `M ${sketchPts[0].x} ${sketchPts[0].y} Q ${sketchPts[1].x} ${sketchPts[1].y} ${sketchPts[2].x} ${sketchPts[2].y}`;
      } else if (el.routing === 'rounded-elbow' && sketchPts.length >= 3) {
        d = buildRoundedElbowSvgPath(sketchPts, Number(el.cornerRadius) || 14);
      } else {
        d = sketchPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
      }
      inner += `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" ${dash}/>`;
      if (connectorRoughness(el) >= 2 && el.routing !== 'curved') {
        const second = roughenConnectorPoints({ ...el, id: `${el.id}-b` }, pts);
        const d2 = second.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        inner += `<path d="${d2}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round" opacity="0.55" ${dash}/>`;
      }
      if (el.startArrow && el.startArrow !== 'none') {
        const pFrom = getConnectorTangentFromPoint(el, 'start', page);
        inner += renderSvgArrowhead(el.startArrow, pts[0].x, pts[0].y, pFrom.x, pFrom.y, sw, stroke);
      }
      if (el.endArrow && el.endArrow !== 'none') {
        const last = pts[pts.length - 1];
        const pFrom = getConnectorTangentFromPoint(el, 'end', page);
        inner += renderSvgArrowhead(el.endArrow, last.x, last.y, pFrom.x, pFrom.y, sw, stroke);
      }
      const labelSpecs = [
        el.startLabel ? { text: String(el.startLabel), role: 'start', sizeScale: 0.86 } : null,
        el.text ? { text: String(el.text), role: 'middle', sizeScale: 1 } : null,
        el.endLabel ? { text: String(el.endLabel), role: 'end', sizeScale: 0.86 } : null,
      ].filter(Boolean);
      for (const spec of labelSpecs) {
        const lp = getConnectorLabelPosition(el, spec.role, page);
        const fontSize = Math.max(11, Math.round((el.fontSize || 15) * spec.sizeScale));
        const bw = Math.max(28, spec.text.length * fontSize * 0.6 + 14);
        const bh = fontSize + 10;
        inner += `<rect x="${lp.x - bw / 2}" y="${lp.y - bh / 2}" width="${bw}" height="${bh}" rx="5" fill="${theme.connectorLabelBg}"/>`;
        inner += `<text x="${lp.x}" y="${lp.y}" font-family="${escapeXml(FONT_MAP[el.fontFamily || 'sans'])}" font-size="${fontSize}" fill="${stroke}" text-anchor="middle" dominant-baseline="central">${escapeXml(spec.text)}</text>`;
      }
    }
  } else if (el.type === 'rect' || el.type === 'rounded-rect') {
    const r = el.type === 'rounded-rect' ? Math.max(4, el.roundness || 14) : el.roundness || 0;
    inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="${r}" ${commonAttrs}/>${renderSvgTextBlock(el, theme.name)}`;
  } else if (el.type === 'ellipse') {
    inner = `<ellipse cx="${cx}" cy="${cy}" rx="${Math.abs(el.w) / 2}" ry="${Math.abs(el.h) / 2}" ${commonAttrs}/>${renderSvgTextBlock(el, theme.name)}`;
  } else if (el.type === 'diamond') {
    const pts = `${cx},${el.y} ${el.x + el.w},${cy} ${cx},${el.y + el.h} ${el.x},${cy}`;
    inner = `<polygon points="${pts}" ${commonAttrs}/>${renderSvgTextBlock(el, theme.name)}`;
  } else if (el.type === 'sticky') {
    const stickyFill = el.fill && el.fill !== 'transparent' ? el.fill : '#fef08a';
    inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="4" fill="${stickyFill}" stroke="rgba(15,23,42,0.18)" stroke-width="1"/>${renderSvgTextBlock({ ...el, textColor: '#1e293b' }, 'light', 14)}`;
  } else if (el.type === 'stencil') {
    const stencil = getStencilById(el.stencilId);
    inner = `<g color="${stroke}">${stencil.toSvg(el.x, el.y, el.w, el.h, commonAttrs)}</g>${renderSvgTextBlock(el, theme.name, 16)}`;
  } else if (el.type === 'text') {
    inner = renderSvgTextBlock(el, theme.name, 4);
  } else if (el.type === 'frame') {
    inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${h}" rx="8" fill="${theme.frameBg}" stroke="${theme.frameBorder}" stroke-width="2" stroke-dasharray="8,4"/><rect x="${el.x}" y="${el.y}" width="${el.w}" height="36" rx="8" fill="${theme.frameHeaderBg}"/><text x="${el.x + 12}" y="${el.y + 18}" font-family="sans-serif" font-size="13" font-weight="600" fill="${theme.frameTitle}" dominant-baseline="central">${escapeXml(el.text || 'Frame')}</text>`;
  } else if (el.type === 'table') {
    const geo = tableGeometry(el);
    const { rows, cols, xs, ys } = geo;
    const hasHeader = el.headerRow !== false;
    const tableBg = fill === 'none' ? (theme.name === 'dark' ? '#1e293b' : '#ffffff') : fill;
    inner += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="${tableBg}" stroke="${stroke}" stroke-width="${sw}"/>`;
    if (el.striped) {
      const stripe = theme.name === 'dark' ? 'rgba(148,163,184,0.09)' : 'rgba(241,245,249,0.85)';
      for (let r = hasHeader ? 1 : 0; r < rows; r += 2) {
        inner += `<rect x="${el.x + 1}" y="${ys[r]}" width="${el.w - 2}" height="${geo.cellH[r] - 1}" fill="${stripe}"/>`;
      }
    }
    if (hasHeader) {
      const headerTint = theme.name === 'dark' ? 'rgba(148,163,184,0.16)' : 'rgba(226,232,240,0.7)';
      inner += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${geo.cellH[0]}" fill="${headerTint}"/>`;
    }
    for (let r = 1; r < rows; r++) {
      inner += `<line x1="${el.x}" y1="${ys[r]}" x2="${el.x + el.w}" y2="${ys[r]}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
    for (let c = 1; c < cols; c++) {
      inner += `<line x1="${xs[c]}" y1="${el.y}" x2="${xs[c]}" y2="${el.y + el.h}" stroke="${stroke}" stroke-width="${sw}"/>`;
    }
    const fontSize = el.fontSize || 15;
    const lineH = fontSize * 1.25;
    const approxCharW = fontSize * 0.55;
    const textColor = resolveThemeColor(el.textColor || '#1e293b', theme.name, 'text');
    const padX = tableCellPadding(el);
    const valign = el.valign || 'middle';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const val = String(el.cells?.[r]?.[c] ?? '');
        const cellW = geo.cellW[c];
        const cellH = geo.cellH[r];
        const innerW = Math.max(8, cellW - padX * 2);
        const weight = hasHeader && r === 0 ? 600 : 400;
        const measureCtx = measureCtxFor(fontSize, weight);
        let lines;
        if (measureCtx) {
          // Same wrap function and font the canvas renderer uses.
          lines = wrapCellLines(measureCtx, val, innerW);
        } else {
          const maxChars = Math.max(1, Math.floor(innerW / approxCharW));
          lines = [];
          for (const paragraph of val.split(String.fromCharCode(10))) {
            if (!paragraph) {
              lines.push('');
              continue;
            }
            let cur = '';
            for (const word of paragraph.split(/\s+/).filter(Boolean)) {
              const candidate = cur ? `${cur} ${word}` : word;
              if (candidate.length <= maxChars) {
                cur = candidate;
              } else {
                if (cur) lines.push(cur);
                cur = word.length <= maxChars ? word : word.slice(0, maxChars);
                let rest = word.slice(cur.length);
                while (rest.length > 0) {
                  lines.push(cur);
                  cur = rest.slice(0, maxChars);
                  rest = rest.slice(maxChars);
                }
              }
            }
            if (cur) lines.push(cur);
          }
        }
        const maxLines = Math.max(1, Math.floor((cellH - 8) / lineH));
        const visible = lines.slice(0, maxLines);
        if (lines.length > maxLines && visible.length > 0) {
          let last = visible[visible.length - 1];
          const measure = measureCtx || { measureText: (t) => ({ width: t.length * approxCharW }) };
          while (last.length > 1 && measure.measureText(`${last}…`).width > innerW) {
            last = last.slice(0, -1);
          }
          visible[visible.length - 1] = `${last}…`;
        }
        const totalH = visible.length * lineH;
        const startY =
          valign === 'top'
            ? ys[r] + 8 + lineH / 2
            : valign === 'bottom'
              ? ys[r] + cellH - 6 - totalH + lineH / 2
              : ys[r] + cellH / 2 - totalH / 2 + lineH / 2;
        const align = el.textAlign || 'center';
        const tx =
          align === 'left'
            ? xs[c] + padX
            : align === 'right'
              ? xs[c] + cellW - padX
              : xs[c] + cellW / 2;
        const anchor = align === 'left' ? 'start' : align === 'right' ? 'end' : 'middle';
        inner += `<text x="${tx}" y="${startY}" font-family="sans-serif" font-size="${fontSize}" font-weight="${weight}" fill="${textColor}" text-anchor="${anchor}" dominant-baseline="central">`;
        visible.forEach((line, idx) => {
          inner += `<tspan x="${tx}" dy="${idx === 0 ? 0 : lineH}">${escapeXml(line)}</tspan>`;
        });
        inner += `</text>`;
      }
    }
  } else if (el.type === 'code') {
    const hlSet = parseHighlightSet(el.highlightLines);
    const fontSize = el.fontSize || 14;
    const lineH = fontSize * 1.45;
    inner += `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="8" fill="#0f172a" stroke="#334155" stroke-width="2"/>`;
    String(el.text || '')
      .split(String.fromCharCode(10))
      .forEach((line, idx) => {
        const ly = el.y + 36 + idx * lineH;
        if (hlSet.has(idx + 1)) {
          inner += `<rect x="${el.x + 4}" y="${ly - lineH / 2}" width="${el.w - 8}" height="${lineH}" fill="rgba(250,204,21,0.2)"/>`;
        }
        inner += `<text x="${el.x + 40}" y="${ly}" font-family="monospace" font-size="${fontSize}" fill="#f8fafc" dominant-baseline="central">${escapeXml(line)}</text>`;
      });
  } else if (el.type === 'image') {
    const fileEntry = scene.files?.[el.fileId];
    if (fileEntry?.dataUrl) {
      inner = `<image x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" href="${escapeXml(fileEntry.dataUrl)}" preserveAspectRatio="none"/>`;
    } else {
      inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" fill="#e2e8f0" stroke="#94a3b8"/>`;
    }
  } else if (el.type === 'stamp') {
    const r = Math.min(el.w, el.h) / 2 - 3;
    const label =
      el.stampKind === 'tick'
        ? '✓'
        : el.stampKind === 'cross'
          ? '✕'
          : el.stampKind === 'star'
            ? '★'
            : el.stampKind === 'question'
              ? '?'
              : el.stampKind === 'arrow-up'
                ? '↑'
                : String(el.badgeValue || 1);
    inner = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#dbeafe" stroke="#2563eb" stroke-width="3"/><text x="${cx}" y="${cy}" font-family="sans-serif" font-size="${Math.round(r)}" font-weight="bold" fill="#1d4ed8" text-anchor="middle" dominant-baseline="central">${escapeXml(label)}</text>`;
  } else if (el.type === 'math') {
    inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="4" fill="rgba(254,249,195,0.85)" stroke="#ca8a04" stroke-width="2"/>`;
  } else if (el.type === 'question') {
    const accent = el.resolved ? '#16a34a' : '#d97706';
    const bg = el.resolved ? '#dcfce7' : '#fef3c7';
    inner = `<rect x="${el.x}" y="${el.y}" width="${el.w}" height="${el.h}" rx="10" fill="${bg}" stroke="${accent}" stroke-width="2"/><circle cx="${el.x + 18}" cy="${el.y + 18}" r="10" fill="${accent}"/><text x="${el.x + 18}" y="${el.y + 18}" font-family="sans-serif" font-size="12" font-weight="bold" fill="#ffffff" text-anchor="middle" dominant-baseline="central">${el.resolved ? '✓' : '?'}</text><text x="${el.x + 34}" y="${el.y + 18}" font-family="sans-serif" font-size="11" font-weight="bold" fill="#0f172a" dominant-baseline="central">${escapeXml(el.authorName || 'Student')}</text><text x="${el.x + 10}" y="${el.y + 42}" font-family="sans-serif" font-size="12" fill="#1e293b" dominant-baseline="central">${escapeXml(el.text || '')}</text>`;
  }

  return `<g data-id="${escapeXml(el.id)}" data-type="${escapeXml(el.type)}"${opacityAttr}${transformAttr}>${inner}</g>`;
}
