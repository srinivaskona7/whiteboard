// scene/text-wrap.js — Excalidraw-style text wrap/unwrap between standalone text
// elements and shapes. Pure element logic only: the caller owns the page, so
// removing the wrapped text element and inserting the unwrapped one happen in
// main.js, never here.

import { boundsOf } from './layout-metrics.js';

// Shapes whose label (`el.text`) is rendered inside them. Connectors, freehand
// ink, tables and code blocks own their text differently and never adopt one.
const WRAPPABLE_TYPES = new Set([
  'rect',
  'rounded-rect',
  'ellipse',
  'diamond',
  'stencil',
  'sticky',
  'frame',
]);

function wrapBlockReason(textEl, shapeEl) {
  if (!textEl || !shapeEl) return 'missing element';
  if (textEl.type !== 'text') return 'not a text element';
  if (!WRAPPABLE_TYPES.has(shapeEl.type)) return 'shape not wrappable';
  if (textEl.locked || shapeEl.locked) return 'element locked';
  const b = boundsOf([shapeEl]);
  const cx = textEl.x + (textEl.w || 0) / 2;
  const cy = textEl.y + (textEl.h || 0) / 2;
  if (cx < b.minX || cx > b.maxX || cy < b.minY || cy > b.maxY) return 'text outside shape';
  return null;
}

// True when the text element can be folded into the shape as its label.
export function canWrap(textEl, shapeEl) {
  return wrapBlockReason(textEl, shapeEl) === null;
}

// Move a standalone text element's content into a shape. The shape keeps its
// existing label, if any, as its own line. Returns the id the caller must
// remove from the page — page surgery stays out of this module.
export function wrapTextIntoShape(textEl, shapeEl, _style) {
  const reason = wrapBlockReason(textEl, shapeEl);
  if (reason) return { ok: false, reason };

  const label = String(textEl.text ?? '');
  const existing = String(shapeEl.text ?? '');
  shapeEl.text = existing.trim() ? `${existing}\n${label}` : label;
  if (shapeEl.fontSize == null) shapeEl.fontSize = textEl.fontSize;
  return { ok: true, shapeId: shapeEl.id, removedId: textEl.id };
}

// Detach a shape's label back into a standalone text element spec. The caller
// calls createElement('text', spec) and clears nothing else — the shape itself
// is mutated here to lose its label, which is the unwrap semantics.
export function unwrapShapeText(shapeEl, style) {
  if (!shapeEl) return { ok: false, reason: 'missing element' };
  if (!WRAPPABLE_TYPES.has(shapeEl.type)) return { ok: false, reason: 'shape not wrappable' };
  if (shapeEl.locked) return { ok: false, reason: 'element locked' };
  const text = String(shapeEl.text ?? '');
  if (!text.trim()) return { ok: false, reason: 'shape has no label' };

  const fontSize = shapeEl.fontSize || 16;
  const lines = text.split('\n');
  const maxLineLength = lines.reduce((m, l) => Math.max(m, l.length), 0);
  // Same rough glyph metric the autoGrow path uses; good enough to center the
  // new element without a canvas measurement.
  const width = Math.max(40, Math.ceil(maxLineLength * fontSize * 0.6));
  const b = boundsOf([shapeEl]);
  const spec = {
    x: b.minX + b.w / 2 - width / 2,
    y: b.minY,
    w: width,
    h: Math.ceil(lines.length * fontSize * 1.35),
    text,
    fontSize,
    stroke: shapeEl.textColor || shapeEl.stroke || '#1f2937',
  };
  shapeEl.text = '';
  return { ok: true, element: spec };
}
