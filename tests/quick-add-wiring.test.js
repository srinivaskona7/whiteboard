// tests/quick-add-wiring.test.js — buildQuickAdd: the pure spec builder behind
// the quick-add dots (clone placement, connector style, refusals, overlap
// freedom on the resulting page).
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  QUICK_ADD_DIRECTIONS,
  buildQuickAdd,
  dotAnchor,
} from '../scene/quick-add.js';
import { createElement } from '../scene/model.js';
import { overlaps } from '../scene/layout-metrics.js';

const rect = (props) => createElement('rect', props);
const STYLE = { stroke: '#334155', strokeWidth: 2, strokeStyle: 'solid', routing: 'orthogonal' };

describe('buildQuickAdd clone spec', () => {
  test('right lands at the non-overlapping origin with the same size and stencil identity', () => {
    const source = createElement('stencil', {
      x: 100,
      y: 100,
      w: 120,
      h: 90,
      stencilId: 'aws-ec2',
      category: 'aws',
      name: 'EC2',
      text: 'App Server',
      isCard: true,
    });
    const page = { elements: [source] };
    const built = buildQuickAdd(page, source, 'right', STYLE);
    assert.equal(built.ok, true);
    const { clone } = built;
    assert.equal(clone.type, 'stencil');
    assert.equal(clone.x, 300); // 100 + 120 + 80 base gap
    assert.equal(clone.y, 100);
    assert.equal(clone.w, 120);
    assert.equal(clone.h, 90);
    assert.equal(clone.stencilId, 'aws-ec2');
    assert.equal(clone.category, 'aws');
    assert.equal(clone.text, 'App Server');
    assert.equal(clone.isCard, true);
    assert.equal(overlaps({ x: clone.x, y: clone.y, w: clone.w, h: clone.h }, source), false);
  });

  test('a blocker on the first slot shifts the clone to the next candidate', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    const blocker = rect({ x: 180, y: 30, w: 40, h: 40 });
    const built = buildQuickAdd({ elements: [source, blocker] }, source, 'right', STYLE);
    assert.equal(built.ok, true);
    assert.equal(built.clone.x, 220);
    assert.equal(built.clone.y, 0);
  });

  test('the clone rides through the canonical duplicate path — votes and templateId carry over', () => {
    // Regression: the hand-picked field list silently dropped el.votes (a
    // teacher quick-adding a voted sticky lost the class's dots) and
    // templateId. buildQuickAdd now clones via cloneElement, exactly like
    // Ctrl+D, so every field travels.
    const source = createElement('sticky', { x: 0, y: 0, w: 160, h: 160, text: 'Idea', templateId: 'tpl-a-01' });
    source.votes = 2;
    const built = buildQuickAdd({ elements: [source] }, source, 'right', STYLE);
    assert.equal(built.ok, true);
    assert.equal(built.clone.votes, 2);
    assert.equal(built.clone.templateId, 'tpl-a-01');
    assert.notEqual(built.clone.id, source.id, 'the clone gets a fresh id');
  });
});

describe('buildQuickAdd arrow spec', () => {
  test('endpoints run from the source edge to the clone edge, connector-tool style', () => {
    const source = rect({ x: 10, y: 20, w: 100, h: 50 });
    const built = buildQuickAdd({ elements: [source] }, source, 'right', STYLE);
    assert.equal(built.ok, true);
    assert.deepEqual(
      { x1: built.arrowSpec.x, y1: built.arrowSpec.y, x2: built.arrowSpec.x2, y2: built.arrowSpec.y2 },
      { x1: dotAnchor(source, 'right').x, y1: dotAnchor(source, 'right').y, x2: 190, y2: 45 }
    );
    assert.equal(built.arrowSpec.stroke, STYLE.stroke);
    assert.equal(built.arrowSpec.strokeWidth, STYLE.strokeWidth);
    assert.equal(built.arrowSpec.strokeStyle, STYLE.strokeStyle);
    assert.equal(built.arrowSpec.routing, 'orthogonal');
    assert.equal(built.arrowSpec.startArrow, 'none');
    assert.equal(built.arrowSpec.endArrow, 'arrow');
  });

  test('the built pair overlaps nothing else on the page', () => {
    const source = rect({ x: 500, y: 500, w: 100, h: 100 });
    const others = [
      rect({ x: 700, y: 480, w: 60, h: 60 }),
      rect({ x: 560, y: 660, w: 80, h: 40 }),
      rect({ x: 300, y: 420, w: 90, h: 90 }),
      rect({ x: 420, y: 500, w: 50, h: 50 }),
    ];
    const opposite = { up: 'down', down: 'up', left: 'right', right: 'left' };
    const page = { elements: [source, ...others] };
    for (const direction of QUICK_ADD_DIRECTIONS) {
      const built = buildQuickAdd(page, source, direction, STYLE);
      assert.equal(built.ok, true, direction);
      const clone = built.clone; // already a full element with a fresh id
      const arrow = createElement('arrow', built.arrowSpec);
      for (const el of [source, ...others]) {
        assert.equal(overlaps(clone, el), false, `${direction} clone overlaps page content`);
      }
      // The arrow attaches to the source by design, so its clearance is only
      // asserted against the rest of the page — with a bbox normalised from
      // the endpoints (the x/w convention assumes left-to-right) and a 1px
      // nominal thickness, because a zero extent falls back to the 164x92
      // default in overlaps().
      const arrowBox = {
        x: Math.min(arrow.x, arrow.x2),
        y: Math.min(arrow.y, arrow.y2),
        w: Math.max(1, Math.abs(arrow.x2 - arrow.x)),
        h: Math.max(1, Math.abs(arrow.y2 - arrow.y)),
      };
      for (const el of others) {
        assert.equal(overlaps(arrowBox, el), false, `${direction} arrow overlaps page content`);
      }
      // The connector runs exactly from the source edge to the clone's
      // opposing edge, so the pair is anchored and not merely adjacent.
      assert.equal(arrow.x, dotAnchor(source, direction).x);
      assert.equal(arrow.y, dotAnchor(source, direction).y);
      assert.equal(arrow.x2, dotAnchor(clone, opposite[direction]).x);
      assert.equal(arrow.y2, dotAnchor(clone, opposite[direction]).y);
    }
  });
});

describe('buildQuickAdd refusals and edge cases', () => {
  test('arrows, ink, boundary containers and locked sources return ok:false with a reason', () => {
    const page = { elements: [] };
    for (const el of [
      createElement('arrow', {}),
      createElement('line', {}),
      createElement('pen', {}),
      createElement('rect', { isBoundary: true }),
    ]) {
      const built = buildQuickAdd(page, el, 'right', STYLE);
      assert.equal(built.ok, false, el.type);
      assert.ok(built.reason, `${el.type} refusal carries a reason`);
      assert.equal(built.clone, undefined);
    }
    const locked = rect({ x: 0, y: 0, w: 60, h: 60 });
    locked.locked = true;
    const built = buildQuickAdd(page, locked, 'right', STYLE);
    assert.equal(built.ok, false);
    assert.equal(built.reason, 'element is locked');
  });

  test('a walled-in page still yields finite clone and arrow coordinates', () => {
    const source = rect({ x: 0, y: 0, w: 100, h: 100 });
    const wall = rect({ x: 150, y: -500, w: 2000, h: 2000 });
    const built = buildQuickAdd({ elements: [source, wall] }, source, 'right', STYLE);
    assert.equal(built.ok, true);
    assert.ok(Number.isFinite(built.clone.x));
    assert.ok(Number.isFinite(built.clone.y));
    assert.ok(Number.isFinite(built.arrowSpec.x));
    assert.ok(Number.isFinite(built.arrowSpec.x2));
  });

  test('a frame clones as the frame only, at a clear origin', () => {
    const frame = createElement('frame', { x: 0, y: 0, w: 300, h: 200, text: 'Slide 1' });
    const built = buildQuickAdd({ elements: [frame] }, frame, 'down', STYLE);
    assert.equal(built.ok, true);
    assert.equal(built.clone.type, 'frame');
    assert.equal(built.clone.y, 280); // 0 + 200 + 80 base gap
    assert.equal(built.clone.text, 'Slide 1');
  });
});
