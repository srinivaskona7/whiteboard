// tests/smart-guides.test.js — smart-guide snapping: edges, midpoints and equal-gap spacing.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { computeSmartGuides } from '../scene/geometry.js';

function rect(x, y, w, h) {
  return { type: 'rect', x, y, w, h };
}

function bounds(x, y, w, h) {
  return { minX: x, minY: y, maxX: x + w, maxY: y + h, w, h };
}

describe('Smart guides', () => {
  test('single neighbor still snaps edge-to-edge', () => {
    const snap = computeSmartGuides(bounds(104, 0, 100, 100), [rect(0, 0, 100, 100)]);
    assert.equal(snap.dx, -4);
    const vertical = snap.guides.find((g) => g.type === 'vertical');
    assert.ok(vertical, 'expected a vertical guide');
    assert.equal(vertical.x, 100);
  });

  test('two neighbors 300px apart: snaps to the equal-gap position', () => {
    const moving = bounds(203, 0, 100, 100); // target minX is 200: gaps 100 + 100
    const snap = computeSmartGuides(moving, [rect(0, 0, 100, 100), rect(400, 0, 100, 100)]);
    assert.equal(snap.dx, -3);
    const placed = moving.minX + snap.dx;
    assert.equal(placed - 100, 100); // left gap
    assert.equal(400 - (placed + moving.w), 100); // right gap
    const xs = snap.guides.filter((g) => g.type === 'vertical').map((g) => g.x);
    assert.deepEqual(xs.sort(), [100, 400]);
  });

  test('edge snap beats an equal-gap snap within the same threshold', () => {
    // Moving minX 104: edge snap to the left neighbor's right edge is -4,
    // the equal-gap position (109) is +5 away — edge must win.
    const snap = computeSmartGuides(bounds(104, 0, 100, 100), [
      rect(0, 0, 100, 100),
      rect(218, 0, 100, 100),
    ]);
    assert.equal(snap.dx, -4);
  });

  test('equal gap beyond the threshold does not snap', () => {
    const snap = computeSmartGuides(bounds(215, 0, 100, 100), [
      rect(0, 0, 100, 100),
      rect(400, 0, 100, 100),
    ]);
    assert.equal(snap.dx, 0);
  });

  test('vertical arrangement snaps symmetrically', () => {
    const moving = bounds(0, 203, 100, 100); // target minY is 200: gaps 100 + 100
    const snap = computeSmartGuides(moving, [rect(0, 0, 100, 100), rect(0, 400, 100, 100)]);
    assert.equal(snap.dy, -3);
    const placed = moving.minY + snap.dy;
    assert.equal(placed - 100, 100); // top gap
    assert.equal(400 - (placed + moving.h), 100); // bottom gap
    const ys = snap.guides.filter((g) => g.type === 'horizontal').map((g) => g.y);
    assert.deepEqual(ys.sort(), [100, 400]);
  });

  test('no candidates: no snap, no guides', () => {
    const snap = computeSmartGuides(bounds(50, 50, 100, 100), []);
    assert.equal(snap.dx, 0);
    assert.equal(snap.dy, 0);
    assert.deepEqual(snap.guides, []);
  });

  test('return shape is unchanged', () => {
    const snap = computeSmartGuides(bounds(203, 0, 100, 100), [
      rect(0, 0, 100, 100),
      rect(400, 0, 100, 100),
    ]);
    assert.deepEqual(Object.keys(snap).sort(), ['dx', 'dy', 'guides']);
    for (const g of snap.guides) {
      if (g.type === 'vertical') {
        assert.deepEqual(Object.keys(g).sort(), ['type', 'x', 'y1', 'y2']);
      } else {
        assert.deepEqual(Object.keys(g).sort(), ['type', 'x1', 'x2', 'y']);
      }
    }
  });
});
