// tests/quick-add.test.js — quick-add dot geometry: placement scan, arrow
// endpoints and the isQuickAddable gate.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_ADD_DIRECTIONS,
  dotAnchor,
  quickAddPlacement,
  quickAddArrow,
  isQuickAddable,
} from '../scene/quick-add.js';
import { createElement } from '../scene/model.js';
import { overlaps } from '../scene/layout-metrics.js';

const rect = (props) => createElement('rect', props);

describe('Quick-add placement', () => {
  test('right lands at source.x + w + 80 with the same y when space is clear', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    const { x, y, gap } = quickAddPlacement(source, 'right', []);
    assert.equal(x, 180);
    assert.equal(y, 0);
    assert.equal(gap, 80);
  });

  test('a blocker on the first slot pushes right to the next candidate (+40 gap)', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    const blocker = rect({ x: 180, y: 30, w: 40, h: 40 });
    const { x, y, gap } = quickAddPlacement(source, 'right', [blocker]);
    assert.equal(gap, 120);
    assert.equal(x, 220);
    assert.equal(y, 0);
  });

  test('a blocker below pushes down to the next candidate (+40 gap)', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    const blocker = rect({ x: 30, y: 180, w: 40, h: 40 });
    const { x, y, gap } = quickAddPlacement(source, 'down', [blocker]);
    assert.equal(gap, 120);
    assert.equal(x, 0);
    assert.equal(y, 220);
  });

  test('the placement result overlaps nothing on a cluttered page', () => {
    const source = rect({ x: 500, y: 500, w: 100, h: 100 });
    const others = [
      rect({ x: 700, y: 480, w: 60, h: 60 }),
      rect({ x: 560, y: 660, w: 80, h: 40 }),
      rect({ x: 300, y: 420, w: 90, h: 90 }),
      rect({ x: 420, y: 500, w: 50, h: 50 }),
    ];
    for (const direction of QUICK_ADD_DIRECTIONS) {
      const { x, y, gap } = quickAddPlacement(source, direction, others);
      const box = { x, y, w: source.w, h: source.h };
      assert.equal(overlaps(box, source), false, `${direction} must clear the source`);
      for (const el of others) {
        assert.equal(overlaps(box, el), false, `${direction} placement overlaps another element`);
      }
      assert.ok(gap >= 80 && gap <= 480);
    }
  });

  test('a fully walled page still returns the last candidate with finite coordinates', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    // One wall covering every possible right-ward candidate without touching
    // the source itself.
    const wall = rect({ x: 150, y: -500, w: 2000, h: 2000 });
    const { x, y, gap } = quickAddPlacement(source, 'right', [wall]);
    assert.equal(gap, 480);
    assert.equal(x, 580);
    assert.equal(y, 0);
    assert.ok(Number.isFinite(x) && Number.isFinite(y));
  });
});

describe('Quick-add arrow endpoints', () => {
  const source = rect({ x: 10, y: 20, w: 100, h: 50 });

  test('right: source right-edge midpoint to target left-edge midpoint', () => {
    const target = rect({ x: 300, y: 20, w: 100, h: 50 });
    assert.deepEqual(quickAddArrow(source, target, 'right'), {
      x1: 110,
      y1: 45,
      x2: 300,
      y2: 45,
    });
  });

  test('left: source left-edge midpoint to target right-edge midpoint', () => {
    const target = rect({ x: -300, y: 20, w: 100, h: 50 });
    assert.deepEqual(quickAddArrow(source, target, 'left'), {
      x1: 10,
      y1: 45,
      x2: -200,
      y2: 45,
    });
  });

  test('down: source bottom-edge midpoint to target top-edge midpoint', () => {
    const target = rect({ x: 10, y: 300, w: 100, h: 50 });
    assert.deepEqual(quickAddArrow(source, target, 'down'), {
      x1: 60,
      y1: 70,
      x2: 60,
      y2: 300,
    });
  });

  test('up: source top-edge midpoint to target bottom-edge midpoint', () => {
    const target = rect({ x: 10, y: -300, w: 100, h: 50 });
    assert.deepEqual(quickAddArrow(source, target, 'up'), {
      x1: 60,
      y1: 20,
      x2: 60,
      y2: -250,
    });
  });

  test('a connector anchors on its bbox, not its (possibly reversed) endpoints', () => {
    // "arrow" drawn right-to-left: x2 is left of the geometry but the model
    // normalises w/h from x2/y2, so the bbox still spans -90..110, 20..70.
    const arrow = createElement('arrow', { x: -90, y: 20, x2: 110, y2: 70 });
    const target = rect({ x: 300, y: 20, w: 100, h: 50 });
    assert.deepEqual(quickAddArrow(arrow, target, 'right'), {
      x1: 110,
      y1: 45,
      x2: 300,
      y2: 45,
    });
  });
});

describe('isQuickAddable', () => {
  test('rejects locked elements, connectors, ink and boundary containers', () => {
    const locked = rect({ x: 0, y: 0 });
    locked.locked = true;
    assert.equal(isQuickAddable(locked), false);
    assert.equal(isQuickAddable(createElement('arrow', {})), false);
    assert.equal(isQuickAddable(createElement('line', {})), false);
    assert.equal(isQuickAddable(createElement('ink', {})), false);
    const boundary = rect({ x: 0, y: 0 });
    boundary.isBoundary = true;
    assert.equal(isQuickAddable(boundary), false);
    assert.equal(isQuickAddable(null), false);
  });

  test('accepts rect, stencil, frame and sticky', () => {
    assert.equal(isQuickAddable(rect({ x: 0, y: 0 })), true);
    assert.equal(isQuickAddable(createElement('stencil', {})), true);
    assert.equal(isQuickAddable(createElement('frame', {})), true);
    assert.equal(isQuickAddable(createElement('sticky', {})), true);
  });
});

describe('dotAnchor', () => {
  const el = rect({ x: 10, y: 20, w: 100, h: 50 });

  test('returns the edge midpoint for each direction', () => {
    assert.deepEqual(dotAnchor(el, 'up'), { x: 60, y: 20 });
    assert.deepEqual(dotAnchor(el, 'down'), { x: 60, y: 70 });
    assert.deepEqual(dotAnchor(el, 'left'), { x: 10, y: 45 });
    assert.deepEqual(dotAnchor(el, 'right'), { x: 110, y: 45 });
  });
});
