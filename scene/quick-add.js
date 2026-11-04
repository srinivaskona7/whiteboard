// scene/quick-add.js — geometry for the connector quick-add dots (the Miro/
// FigJam-style "+" handles on a selected element). Pure maths only: the UI
// layer decides when the dots show, and the caller owns element creation and
// history. Everything measures through boundsOf so arrows, lines and pen
// strokes (whose x2/y2 or points may extend left/up of x/y) place correctly.
import { boundsOf, overlaps } from './layout-metrics.js';
import { cloneElement } from './model.js';

export const QUICK_ADD_DIRECTIONS = ['up', 'right', 'down', 'left'];

// World-px clearance between the two bounding boxes before the first scan step.
const BASE_GAP = 80;
const GAP_STEP = 40;
// How far to keep scanning before giving up and stacking anyway. Placement
// must never fail, so the last candidate is returned even when walled in.
const MAX_EXTRA_GAP = 400;

// Bounding box of a single element as {minX..maxY}, normalised so connectors
// with points left/up of their origin still measure correctly.
function boxOf(el) {
  return boundsOf([el]);
}

/**
 * Screen/world point on the element's edge facing `direction` — the midpoint
 * of that edge, where the quick-add dot sits.
 */
export function dotAnchor(el, direction) {
  const b = boxOf(el);
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  switch (direction) {
    case 'up':
      return { x: cx, y: b.minY };
    case 'down':
      return { x: cx, y: b.maxY };
    case 'left':
      return { x: b.minX, y: cy };
    case 'right':
      return { x: b.maxX, y: cy };
    default:
      return { x: cx, y: cy };
  }
}

/**
 * Top-left origin for a connected duplicate of `source` placed in
 * `direction`, plus the gap actually used. Scans outward from BASE_GAP in
 * GAP_STEP increments up to MAX_EXTRA_GAP and takes the first spot whose
 * target box clears `source` and every element in `others`. If nothing is
 * clear, the last candidate is returned anyway — quick-add must never fail
 * to produce coordinates.
 */
export function quickAddPlacement(source, direction, others = []) {
  const sb = boxOf(source);
  const target = { x: sb.minX, y: sb.minY, w: sb.w, h: sb.h };
  const lastGap = BASE_GAP + MAX_EXTRA_GAP;
  let gap = BASE_GAP;
  let candidate = null;
  for (; gap <= lastGap; gap += GAP_STEP) {
    candidate = offsetBox(target, direction, gap);
    if (isClear(candidate, source, others)) break;
  }
  // Walled in (or base already beyond MAX_EXTRA_GAP): return the furthest
  // candidate so the duplicate still lands somewhere deterministic.
  if (gap > lastGap) gap = lastGap;
  return {
    x: Math.round(candidate.x),
    y: Math.round(candidate.y),
    gap,
  };
}

function offsetBox(target, direction, gap) {
  switch (direction) {
    case 'up':
      return { ...target, y: target.y - target.h - gap };
    case 'down':
      return { ...target, y: target.y + target.h + gap };
    case 'left':
      return { ...target, x: target.x - target.w - gap };
    case 'right':
      return { ...target, x: target.x + target.w + gap };
    default:
      return { ...target };
  }
}

function isClear(candidate, source, others) {
  // The caller may or may not have filtered `source` out of `others`, so it is
  // checked explicitly first.
  if (overlaps(candidate, source)) return false;
  for (const el of others || []) {
    if (el === source) continue;
    if (overlaps(candidate, el)) return false;
  }
  return true;
}

/**
 * Connector endpoints for the quick-add arrow: from the source's edge facing
 * `direction` to the target's opposing edge, both at edge midpoints.
 */
export function quickAddArrow(source, target, direction) {
  const s = dotAnchor(source, direction);
  const opposite = {
    up: 'down',
    down: 'up',
    left: 'right',
    right: 'left',
  }[direction];
  const t = dotAnchor(target, opposite || direction);
  return {
    x1: Math.round(s.x),
    y1: Math.round(s.y),
    x2: Math.round(t.x),
    y2: Math.round(t.y),
  };
}

// Pen-style strokes are excluded alongside connectors: duplicating a stroke
// by dragging a dot has no meaningful "edge" to attach to.
const NOT_QUICK_ADDABLE = new Set(['arrow', 'line', 'ink', 'pen', 'highlighter']);

/**
 * Whether an element offers quick-add dots at all. Frames are addable — the
 * caller decides whether to copy the frame's children along with it.
 */
export function isQuickAddable(el) {
  if (!el) return false;
  if (el.locked) return false;
  if (el.isBoundary) return false;
  return !NOT_QUICK_ADDABLE.has(el.type);
}

function quickAddBlockReason(source) {
  if (!source) return 'missing element';
  if (source.locked) return 'element is locked';
  if (source.isBoundary) return 'boundary containers cannot be quick-added';
  if (NOT_QUICK_ADDABLE.has(source.type)) return 'connectors and ink cannot be quick-added';
  return null;
}

/**
 * A quick-add pair: a ready clone of `source` placed in `direction` plus the
 * arrow spec that connects the two. Pure — no app object, no DOM; the caller
 * creates the arrow, binds both ends and owns the page. Frames clone as the
 * frame only; copying their children along is a later feature. Arrow style
 * defaults follow the connector tool idiom.
 */
export function buildQuickAdd(page, source, direction, style = {}) {
  const reason = quickAddBlockReason(source);
  if (reason) return { ok: false, reason };

  const others = (page?.elements || []).filter((e) => e !== source);
  const { x, y } = quickAddPlacement(source, direction, others);

  // Clone through the canonical duplicate path so the copy is field-identical
  // to a Ctrl+D duplicate — votes, templateId, roundness, card flags all ride
  // along. Hand-picking fields here silently stripped those (a teacher
  // quick-adding a voted sticky lost the class's dots).
  const clone = cloneElement(source, { x: x - source.x, y: y - source.y });

  const target = { x, y, w: source.w || 0, h: source.h || 0 };
  const endpoints = quickAddArrow(source, target, direction);
  const arrowSpec = {
    // createElement's connector idiom is x/y + x2/y2; quickAddArrow reports the
    // same points as x1/y1 endpoints.
    x: endpoints.x1,
    y: endpoints.y1,
    x2: endpoints.x2,
    y2: endpoints.y2,
    stroke: style.stroke || source.stroke || '#1e293b',
    strokeWidth: style.strokeWidth || 2,
    strokeStyle: style.strokeStyle || 'solid',
    routing: style.routing || 'orthogonal',
    startArrow: 'none',
    endArrow: 'arrow',
  };

  return { ok: true, clone, arrowSpec };
}
