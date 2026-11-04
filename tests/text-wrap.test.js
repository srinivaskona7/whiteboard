// tests/text-wrap.test.js — wrap/unwrap between standalone text elements and shape labels.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { canWrap, wrapTextIntoShape, unwrapShapeText } from '../scene/text-wrap.js';
import { createElement } from '../scene/model.js';

// A rect at (100, 100) with a text element whose center sits inside it.
const centeredPair = (shapeProps = {}) => {
  const shape = createElement('rect', { x: 100, y: 100, w: 200, h: 120, text: '', ...shapeProps });
  const textEl = createElement('text', { x: 150, y: 130, w: 100, h: 40, text: 'Hello board' });
  return { shape, textEl };
};

describe('canWrap', () => {
  test('true for a text element centered over a rect', () => {
    const { shape, textEl } = centeredPair();
    assert.equal(canWrap(textEl, shape), true);
  });

  test('false when the text center lies outside the shape bounds', () => {
    const shape = createElement('rect', { x: 100, y: 100, w: 200, h: 120, text: '' });
    const outside = createElement('text', { x: 500, y: 500, w: 100, h: 40, text: 'far away' });
    assert.equal(canWrap(outside, shape), false);
  });

  test('false when either side is locked', () => {
    const lockedText = centeredPair({ });
    lockedText.textEl.locked = true;
    assert.equal(canWrap(lockedText.textEl, lockedText.shape), false);

    const lockedShape = centeredPair({ locked: true });
    assert.equal(canWrap(lockedShape.textEl, lockedShape.shape), false);
  });

  test('false when the target is an arrow or another non-wrappable type', () => {
    const { textEl } = centeredPair();
    const arrow = createElement('arrow', { x: 100, y: 150, x2: 300, y2: 150 });
    const line = createElement('line', { x: 100, y: 150, x2: 300, y2: 150 });
    const table = createElement('table', { x: 100, y: 100, w: 200, h: 120 });
    assert.equal(canWrap(textEl, arrow), false);
    assert.equal(canWrap(textEl, line), false);
    assert.equal(canWrap(textEl, table), false);
  });

  test('false when the first element is not a text element', () => {
    const { shape } = centeredPair();
    const sticky = createElement('sticky', { x: 150, y: 130, w: 100, h: 40 });
    assert.equal(canWrap(sticky, shape), false);
  });

  test('every wrappable shape type passes the type check', () => {
    const { textEl } = centeredPair();
    for (const type of ['rect', 'rounded-rect', 'ellipse', 'diamond', 'stencil', 'sticky', 'frame']) {
      const shape = createElement(type, { x: 100, y: 100, w: 200, h: 120, text: '' });
      assert.equal(canWrap(textEl, shape), true, type);
    }
  });
});

describe('wrapTextIntoShape', () => {
  test('an empty-labeled shape adopts the text and reports the removed id', () => {
    const { shape, textEl } = centeredPair();
    const result = wrapTextIntoShape(textEl, shape);
    assert.deepEqual(result, { ok: true, shapeId: shape.id, removedId: textEl.id });
    assert.equal(shape.text, 'Hello board');
  });

  test('a labeled shape appends the text as a new line', () => {
    const { shape, textEl } = centeredPair({ text: 'Existing label' });
    const result = wrapTextIntoShape(textEl, shape);
    assert.equal(result.ok, true);
    assert.equal(shape.text, 'Existing label\nHello board');
  });

  test('a whitespace-only label counts as empty', () => {
    const { shape, textEl } = centeredPair({ text: '   ' });
    wrapTextIntoShape(textEl, shape);
    assert.equal(shape.text, 'Hello board');
  });

  test('fontSize is adopted only when the shape lacks one', () => {
    const { shape, textEl } = centeredPair();
    textEl.fontSize = 28;
    delete shape.fontSize;
    wrapTextIntoShape(textEl, shape);
    assert.equal(shape.fontSize, 28);

    const { shape: withSize, textEl: textWithSize } = centeredPair();
    withSize.fontSize = 18;
    textWithSize.fontSize = 28;
    wrapTextIntoShape(textWithSize, withSize);
    assert.equal(withSize.fontSize, 18, 'an explicit shape fontSize wins');
  });

  test('a non-wrappable pair returns { ok:false, reason } and mutates nothing', () => {
    const shape = createElement('rect', { x: 100, y: 100, w: 200, h: 120, text: 'Keep me' });
    const far = createElement('text', { x: 900, y: 900, w: 100, h: 40, text: 'Outside' });
    const before = { text: shape.text, x: shape.x, w: shape.w };
    const farText = far.text;

    const result = wrapTextIntoShape(far, shape);
    assert.equal(result.ok, false);
    assert.equal(typeof result.reason, 'string');
    assert.ok(result.reason.length > 0);
    assert.equal(shape.text, before.text, 'the shape was not mutated');
    assert.equal(far.text, farText, 'the text element was not mutated');

    const arrow = createElement('arrow', { x: 100, y: 150, x2: 300, y2: 150 });
    const near = createElement('text', { x: 150, y: 130, w: 100, h: 40, text: 'Centered' });
    const arrowResult = wrapTextIntoShape(near, arrow);
    assert.equal(arrowResult.ok, false);
    assert.equal(arrowResult.reason, 'shape not wrappable');
  });
});

describe('unwrapShapeText', () => {
  test('returns a centered spec and clears the shape label', () => {
    const shape = createElement('rect', { x: 100, y: 100, w: 200, h: 120, text: 'Two\nlines' });
    const result = unwrapShapeText(shape);
    assert.equal(result.ok, true);
    const spec = result.element;
    assert.equal(spec.text, 'Two\nlines');
    assert.equal(spec.fontSize, shape.fontSize);
    assert.equal(spec.y, 100, 'the new text sits at the shape top');
    assert.equal(spec.x, 100 + 100 - spec.w / 2, 'centered horizontally over the shape');
    assert.ok(spec.w > 0 && spec.h > 0);
    assert.equal(shape.text, '', 'the shape lost its label');
  });

  test('stroke adopts the shape label colour — textColor, then stroke, then the fallback', () => {
    // The detached text must keep the colour it had as the shape's label.
    // The earlier tool-style sourcing rendered a white label unwrapped from
    // a dark shape in the tool's default near-black (invisible on it).
    const labelled = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'A', textColor: '#ffffff' });
    assert.equal(unwrapShapeText(labelled).element.stroke, '#ffffff');
    const outlined = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'A' });
    // createElement defaults textColor, so only a legacy element without one
    // falls through to the shape's own stroke — the same precedence the
    // render pipeline uses for shape labels (el.textColor || el.stroke).
    delete outlined.textColor;
    outlined.stroke = '#654321';
    assert.equal(unwrapShapeText(outlined).element.stroke, '#654321');
    const plain = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'A' });
    assert.equal(unwrapShapeText(plain).element.stroke, plain.textColor, 'a normal shape unwraps in its own label colour');
    // The hard fallback only fires on a hand-built element with neither field.
    const bare = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'A' });
    delete bare.textColor;
    delete bare.stroke;
    assert.equal(unwrapShapeText(bare).element.stroke, '#1f2937');
    // The style argument no longer decides the colour — and each unwrap
    // mutates its shape (label cleared), so each assert needs a fresh one.
    const styled = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'A', textColor: '#ffffff' });
    assert.equal(unwrapShapeText(styled, { text: '#123456' }).element.stroke, '#ffffff');
  });

  test('a missing shape fontSize defaults the spec to 16', () => {
    const shape = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'Default size' });
    delete shape.fontSize;
    const result = unwrapShapeText(shape);
    assert.equal(result.element.fontSize, 16);
  });

  test('an empty, locked or non-wrappable shape refuses with a reason', () => {
    const empty = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: '' });
    const cleared = unwrapShapeText(empty);
    assert.equal(cleared.ok, false);
    assert.equal(typeof cleared.reason, 'string');

    const locked = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'Locked', locked: true });
    assert.equal(unwrapShapeText(locked).ok, false);

    const arrow = createElement('arrow', { x: 0, y: 0, x2: 200, y2: 0 });
    arrow.text = 'Arrow label';
    assert.equal(unwrapShapeText(arrow).ok, false);
  });

  test('a second call on the now-empty shape returns ok:false', () => {
    const shape = createElement('rect', { x: 0, y: 0, w: 200, h: 120, text: 'Only once' });
    assert.equal(unwrapShapeText(shape).ok, true);
    const again = unwrapShapeText(shape);
    assert.equal(again.ok, false);
    assert.equal(typeof again.reason, 'string');
  });
});

describe('wrap → unwrap round trip', () => {
  test('unwrapping restores the same text the shape adopted', () => {
    const { shape, textEl } = centeredPair();
    const original = textEl.text;

    const wrapped = wrapTextIntoShape(textEl, shape);
    assert.equal(wrapped.ok, true);

    const unwrapped = unwrapShapeText(shape);
    assert.equal(unwrapped.ok, true);
    const restored = createElement('text', unwrapped.element);
    assert.equal(restored.text, original);
    assert.equal(restored.type, 'text');
    assert.equal(shape.text, '');
  });
});
