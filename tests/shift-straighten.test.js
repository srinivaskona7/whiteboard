// tests/shift-straighten.test.js — holding Shift while drawing a freehand
// stroke collapses it to a two-point straight line (MS-Whiteboard-style
// ink-to-line); releasing Shift resumes freehand.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPage } from '../scene/model.js';
import { DrawTool } from '../tools/draw.js';

const makeTool = () => {
  const page = createPage('Shift straighten');
  const tool = new DrawTool({
    activeTool: 'pen',
    currentStyle: { stroke: '#1e293b', strokeWidth: 3, opacity: 1 },
    scene: { settings: { snapToGrid: false } },
    getPage: () => page,
    requestRender: () => {},
    commitChange: () => {},
  });
  return { tool, page };
};

describe('Shift-straighten freehand strokes', () => {
  test('holding Shift collapses a wobbly stroke to a two-point line', () => {
    const { tool, page } = makeTool();
    tool.onPointerDown({ x: 10, y: 10 }, { pointerType: 'mouse' });
    tool.onPointerMove({ x: 24, y: 18 }, { pointerType: 'mouse' });
    tool.onPointerMove({ x: 40, y: 17 }, { pointerType: 'mouse' });
    tool.onPointerMove({ x: 58, y: 30 }, { pointerType: 'mouse' });

    tool.onPointerMove({ x: 120, y: 96 }, { pointerType: 'mouse', shiftKey: true });
    let el = page.elements[0];
    assert.equal(el.points.length, 2, 'Shift must collapse the stroke to two points');
    assert.deepEqual(el.points[1], { x: 120, y: 96 }, 'the line end must be the cursor');

    // Still shifted: the end keeps tracking the cursor, still two points.
    tool.onPointerMove({ x: 130, y: 80 }, { pointerType: 'mouse', shiftKey: true });
    assert.equal(page.elements[0].points.length, 2);
    assert.deepEqual(page.elements[0].points[1], { x: 130, y: 80 });

    // Pointer up commits the straightened stroke intact.
    tool.onPointerUp();
    el = page.elements[0];
    assert.equal(el.points.length, 2, 'simplification must not drop either endpoint of a line');
    assert.deepEqual(el.points[0], { x: 10, y: 10 });
    assert.deepEqual(el.points[1], { x: 130, y: 80 });
  });

  test('releasing Shift resumes freehand from the straightened end', () => {
    const { tool, page } = makeTool();
    tool.onPointerDown({ x: 0, y: 0 }, { pointerType: 'mouse' });
    tool.onPointerMove({ x: 60, y: 40 }, { pointerType: 'mouse', shiftKey: true });
    assert.equal(page.elements[0].points.length, 2);
    tool.onPointerMove({ x: 80, y: 70 }, { pointerType: 'mouse' });
    assert.ok(page.elements[0].points.length >= 2, 'freehand resumes with the line as its history');
    const last = page.elements[0].points[page.elements[0].points.length - 1];
    assert.ok(
      Math.hypot(last.x - 80, last.y - 70) < 3,
      `the resume point must be near the cursor, got (${last.x}, ${last.y})`
    );
  });

  test('the bounds follow the straightened stroke', () => {
    const { tool, page } = makeTool();
    tool.onPointerDown({ x: 100, y: 100 }, { pointerType: 'mouse' });
    tool.onPointerMove({ x: 20, y: 180 }, { pointerType: 'mouse', shiftKey: true });
    const el = page.elements[0];
    // syncFreehandBounds pads by max(2, strokeWidth/2) = 2 (strokeWidth 3).
    assert.equal(el.x, 18);
    assert.equal(el.y, 98);
    assert.equal(el.w, 84);
    assert.equal(el.h, 84);
  });
});
