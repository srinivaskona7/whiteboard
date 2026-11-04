// scene/layout-metrics.js — bounding-box measurements for generated diagrams.
// The QA pass could only claim the 5% canvas-area target visually; these turn
// that claim into a number a test can assert on. Missing sizes fall back to
// the same 164 x 92 defaults the configuration engine creates elements with.
const DEFAULT_W = 164;
const DEFAULT_H = 92;

/**
 * Used bounding box of a set of elements. An empty or missing list measures
 * as a zero box rather than Infinity so ratios stay numeric.
 */
export function boundsOf(elements) {
  const list = Array.isArray(elements) ? elements : [];
  if (!list.length) return { minX: 0, minY: 0, maxX: 0, maxY: 0, w: 0, h: 0 };
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of list) {
    const x = el.x ?? 0;
    const y = el.y ?? 0;
    minX = Math.min(minX, x);
    minY = Math.min(minY, y);
    maxX = Math.max(maxX, x + (el.w || DEFAULT_W));
    maxY = Math.max(maxY, y + (el.h || DEFAULT_H));
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/**
 * Used bounding-box area divided by the canvas area, rounded to 4 dp.
 */
export function areaRatio(elements, canvasW = 3200, canvasH = 2400) {
  const b = boundsOf(elements);
  const canvas = (canvasW || 1) * (canvasH || 1);
  return Math.round(((b.w * b.h) / canvas) * 10000) / 10000;
}

/**
 * AABB overlap test between two elements. Boxes that merely touch an edge are
 * not overlapping, so a grid layout with 164-wide columns passes cleanly.
 */
export function overlaps(a, b) {
  if (!a || !b) return false;
  const aw = a.w || DEFAULT_W;
  const ah = a.h || DEFAULT_H;
  const bw = b.w || DEFAULT_W;
  const bh = b.h || DEFAULT_H;
  return a.x < b.x + bw && a.x + aw > b.x && a.y < b.y + bh && a.y + ah > b.y;
}
