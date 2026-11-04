// tests/spotlight.test.js — rounded spotlight: ellipse geometry, element fit,
// preset sizes and the Esc/menu precedence table, all against the pure helpers
// in render/canvas.js (no DOM needed).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  CanvasRenderer,
  spotlightEllipse,
  spotlightEscapeAction,
  SPOTLIGHT_SIZES,
  SPOTLIGHT_FIT_PADDING,
} from '../render/canvas.js';

function createMockCanvas(w = 1280, h = 800) {
  const ops = [];
  const ctx = {
    save: () => ops.push('save'),
    restore: () => ops.push('restore'),
    setTransform: () => {},
    translate: () => {},
    scale: () => {},
    rotate: () => {},
    beginPath: () => ops.push('beginPath'),
    closePath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    quadraticCurveTo: () => {},
    bezierCurveTo: () => {},
    arc: () => ops.push('arc'),
    ellipse: (x, y, rx, ry) => ops.push({ op: 'ellipse', x, y, rx, ry }),
    rect: () => ops.push('rect'),
    roundRect: () => {},
    clip: () => {},
    fill: () => ops.push('fill'),
    stroke: () => ops.push('stroke'),
    fillRect: () => ops.push('fillRect'),
    strokeRect: () => ops.push('strokeRect'),
    clearRect: () => {},
    fillText: (t) => ops.push(`text:${t}`),
    measureText: (t) => ({ width: String(t || '').length * 8 }),
    setLineDash: () => {},
    drawImage: () => ops.push('drawImage'),
  };
  return {
    width: w,
    height: h,
    style: {},
    ops,
    getContext: () => ctx,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: w, height: h }),
  };
}

describe('Spotlight ellipse geometry', () => {
  test('without a stored fit the cutout is a circle of the current radius', () => {
    const e = spotlightEllipse({ x: 400, y: 300, radius: 180 });
    assert.equal(e.cx, 400);
    assert.equal(e.cy, 300);
    assert.equal(e.rx, 180);
    assert.equal(e.ry, 180);
  });

  test('a point override recenters the ellipse and keeps the current shape', () => {
    const e = spotlightEllipse({ x: 0, y: 0, radius: 120 }, { point: { x: 650, y: 240 } });
    assert.equal(e.cx, 650);
    assert.equal(e.cy, 240);
    assert.equal(e.rx, 120);
    assert.equal(e.ry, 120);
  });

  test('an element fit is elliptical: half bounds plus padding, centered on the bounds', () => {
    const bounds = { x: 200, y: 100, w: 400, h: 160 };
    const cam = { x: 50, y: 30, zoom: 1 };
    const e = spotlightEllipse({}, { targetBounds: bounds, camera: cam });
    assert.equal(e.cx, (200 + 200) * 1 + 50);
    assert.equal(e.cy, (100 + 80) * 1 + 30);
    assert.equal(e.rx, 400 / 2 + SPOTLIGHT_FIT_PADDING);
    assert.equal(e.ry, 160 / 2 + SPOTLIGHT_FIT_PADDING);
    assert.ok(e.rx > e.ry, 'a wide element fits a wide ellipse, not a cropped circle');
  });

  test('the element fit honors camera zoom and keeps a visible minimum radius', () => {
    const far = spotlightEllipse(
      { radius: 180 },
      { targetBounds: { x: 1000, y: 2000, w: 80, h: 40 }, camera: { x: 0, y: 0, zoom: 2 } }
    );
    assert.equal(far.cx, (1000 + 40) * 2);
    assert.equal(far.cy, (2000 + 20) * 2);
    assert.equal(far.rx, (40 + SPOTLIGHT_FIT_PADDING) * 2);
    assert.equal(far.ry, (20 + SPOTLIGHT_FIT_PADDING) * 2);

    // A tiny element zoomed far out must not collapse the lens to a dot.
    const tiny = spotlightEllipse(
      { radius: 180 },
      { targetBounds: { x: 0, y: 0, w: 4, h: 4 }, camera: { x: 0, y: 0, zoom: 0.1 } }
    );
    assert.ok(tiny.rx >= 60 && tiny.ry >= 60);
  });

  test('a stored fit scales with the radius control so the banner slider keeps working', () => {
    const fitted = { x: 0, y: 0, radius: 180, fitRx: 232, fitRy: 112, fitBase: 180 };
    const same = spotlightEllipse(fitted);
    assert.equal(same.rx, 232);
    assert.equal(same.ry, 112);

    const grown = spotlightEllipse({ ...fitted, radius: 90 });
    assert.equal(grown.rx, 232 * (90 / 180));
    assert.equal(grown.ry, 112 * (90 / 180));
  });

  test('preset sizes are ascending circle radii and replace a stored fit when applied', () => {
    const names = Object.keys(SPOTLIGHT_SIZES);
    assert.deepEqual(names, ['small', 'medium', 'large']);
    assert.ok(SPOTLIGHT_SIZES.small < SPOTLIGHT_SIZES.medium);
    assert.ok(SPOTLIGHT_SIZES.medium < SPOTLIGHT_SIZES.large);
    // setSpotlightSize clears the fit, so the preset renders as a plain circle.
    const cleared = spotlightEllipse({ radius: SPOTLIGHT_SIZES.medium, fitRx: null, fitRy: null, fitBase: null });
    assert.equal(cleared.rx, SPOTLIGHT_SIZES.medium);
    assert.equal(cleared.ry, SPOTLIGHT_SIZES.medium);
  });
});

describe('Spotlight Esc / menu precedence', () => {
  test('an open context menu consumes Esc before the spotlight can react', () => {
    assert.equal(spotlightEscapeAction({ menuOpen: true, spotlightActive: true }), 'close-menu');
    assert.equal(spotlightEscapeAction({ menuOpen: true, spotlightActive: false }), 'close-menu');
  });

  test('with no menu open, Esc turns the spotlight off only while it is active', () => {
    assert.equal(spotlightEscapeAction({ menuOpen: false, spotlightActive: true }), 'spotlight-off');
    assert.equal(spotlightEscapeAction({ menuOpen: false, spotlightActive: false }), 'none');
    assert.equal(spotlightEscapeAction(), 'none');
  });
});

describe('Spotlight rendering', () => {
  test('the dimmed overlay and lens stroke are drawn with ctx.ellipse, not a square cutout', () => {
    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      { x: 400, y: 300, radius: 180, dimOpacity: 0.72, dimBackground: true }
    );
    const ellipses = mockCanvas.ops.filter((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.ok(ellipses.length >= 2, 'dim overlay and lens ring both use the ellipse cutout');
    for (const e of ellipses) {
      assert.equal(e.x, 400);
      assert.equal(e.y, 300);
      assert.equal(e.rx, 180);
      assert.equal(e.ry, 180);
    }
    assert.equal(mockCanvas.ops.filter((o) => o === 'arc').length, 0, 'no legacy circular arcs remain');
  });

  test('a fitted element renders a wide ellipse at the fit center', () => {
    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      { x: 500, y: 260, radius: 180, fitRx: 360, fitRy: 130, fitBase: 180, dimBackground: true }
    );
    const e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.ok(e);
    assert.equal(e.rx, 360);
    assert.equal(e.ry, 130);
  });
});

describe('World-space spotlight pins', () => {
  // A pin baked in screen coordinates drifts the moment the camera pans or
  // zooms; pins must re-project from world coordinates on every render.
  test('a world-point pin re-projects through the current camera', () => {
    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);
    const state = { pinned: true, pinWorld: { x: 100, y: 50 }, radius: 180, dimBackground: true };
    const page = { camera: { x: 0, y: 0, zoom: 1 }, elements: [] };
    renderer.drawSpotlightAndMagnifier(mockCanvas.getContext(), state, page);
    let e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.ok(e);
    assert.equal(e.x, 100, 'zoom 1: world == screen');
    assert.equal(e.y, 50);

    // Zoom in: the same world point sits elsewhere on screen.
    mockCanvas.ops.length = 0;
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      state,
      { camera: { x: 0, y: 0, zoom: 2 }, elements: [] }
    );
    e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.equal(e.x, 200, 'the pin follows the camera, not the stale screen coords');
    assert.equal(e.y, 100);
  });

  test('an element pin re-fits to the element as it moves', () => {
    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);
    const rect = { id: 'r1', type: 'rect', x: 0, y: 0, w: 200, h: 100 };
    const state = { pinned: true, pinElementId: 'r1', radius: 180, dimBackground: true };
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      state,
      { camera: { x: 0, y: 0, zoom: 1 }, elements: [rect] }
    );
    let e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.equal(e.x, 100, 'centered on the element bounds');
    assert.ok(e.rx >= 100 + 32, 'fit radius covers bounds plus padding');

    // Move the element: the lens must follow without any state change.
    rect.x = 500;
    rect.y = 400;
    mockCanvas.ops.length = 0;
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      state,
      { camera: { x: 0, y: 0, zoom: 1 }, elements: [rect] }
    );
    e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.equal(e.x, 600, 'the element pin tracks the element, not a frozen center');
    assert.equal(e.y, 450);
  });

  test('a deleted element pin falls back to the plain circle at the last center', () => {
    const mockCanvas = createMockCanvas(1440, 900);
    const renderer = new CanvasRenderer(mockCanvas);
    renderer.resize(1440, 900, 2);
    const state = {
      pinned: true,
      pinElementId: 'gone',
      x: 300,
      y: 200,
      radius: 180,
      dimBackground: true,
    };
    renderer.drawSpotlightAndMagnifier(
      mockCanvas.getContext(),
      state,
      { camera: { x: 0, y: 0, zoom: 1 }, elements: [] }
    );
    const e = mockCanvas.ops.find((o) => typeof o === 'object' && o.op === 'ellipse');
    assert.ok(e, 'no crash; the lens keeps rendering');
    assert.equal(e.rx, 180);
  });
});
