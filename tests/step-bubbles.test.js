// tests/step-bubbles.test.js — numbered step stamp: unbounded increment,
// reset-on-reselect, and a placement that validateElementsBatch accepts.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { StampTool, STAMP_KINDS } from '../tools/stamp.js';
import { validateElementsBatch } from '../scene/geometry.js';

function makeApp() {
  return {
    page: { elements: [] },
    getPage() {
      return this.page;
    },
    selectedIds: new Set(),
    commitChange() {},
    updateUI() {},
    requestRender() {},
  };
}

function place(tool, n = 1) {
  const placed = [];
  for (let i = 0; i < n; i++) {
    tool.onPointerDown({ x: 100 + i * 40, y: 120 });
    placed.push(tool.app.getPage().elements.at(-1));
  }
  return placed;
}

describe('step bubbles', () => {
  test('steps kind is part of the stamp kind cycle', () => {
    assert.ok(STAMP_KINDS.includes('steps'));
  });

  test('consecutive placements count 1,2,3 without wrapping', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('steps');
    const placed = place(tool, 12);
    assert.deepEqual(
      placed.map((el) => el.badgeValue),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
    );
    assert.ok(placed.every((el) => el.stampKind === 'steps'));
    assert.equal(tool.stepValue, 13, 'the counter is unbounded, unlike badge 1-9');
  });

  test('re-selecting the steps kind restarts the numbering at 1', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('steps');
    place(tool, 3);
    tool.selectKind('steps'); // re-arm: new sequence
    const [el] = place(tool, 1);
    assert.equal(el.badgeValue, 1);
  });

  test('resetSteps restarts the numbering without changing kind', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('steps');
    place(tool, 5);
    tool.resetSteps();
    const [el] = place(tool, 1);
    assert.equal(el.stampKind, 'steps');
    assert.equal(el.badgeValue, 1);
  });

  test('switching away and back to steps restarts the sequence', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('steps');
    place(tool, 4);
    tool.selectKind('tick');
    tool.selectKind('steps');
    const [el] = place(tool, 1);
    assert.equal(el.badgeValue, 1);
  });

  test('selectKind ignores unknown kinds', () => {
    const tool = new StampTool(makeApp());
    tool.selectKind('sparkle');
    assert.equal(tool.stampKind, 'tick');
  });

  test('badge kind still cycles 1-9 and is untouched by step numbering', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('badge');
    const placed = place(tool, 11);
    assert.deepEqual(
      placed.map((el) => el.badgeValue),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 1, 2]
    );
    assert.equal(tool.stepValue, 1);
  });

  test('every placement produces a valid, selected stamp element', () => {
    const app = makeApp();
    const tool = new StampTool(app);
    tool.selectKind('steps');
    const placed = place(tool, 3);
    const check = validateElementsBatch(placed);
    assert.equal(check.valid, true, check.reason);
    assert.ok(placed.every((el) => el.type === 'stamp' && el.w > 0 && el.h > 0));
    assert.deepEqual([...app.selectedIds], [placed[placed.length - 1].id]);
  });
});
