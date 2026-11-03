// tests/animation.test.js — declarative teaching tracks, one clock, deterministic sampling.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIMATION_ACTIONS,
  createTrack,
  normalizeSteps,
  validateTrack,
  trackDuration,
  stepStartMs,
  sampleTrack,
  markerPoint,
} from '../scene/animation.js';
import { createScene, createElement } from '../scene/model.js';
import { serializeScene, parseSceneJson } from '../scene/storage.js';

const page = () => {
  const scene = createScene();
  const a = createElement('rect', { x: 0, y: 0, w: 80, h: 60 });
  const b = createElement('rect', { x: 300, y: 0, w: 80, h: 60 });
  const arrow = createElement('arrow', { x: 80, y: 30, x2: 300, y2: 30 });
  scene.pages[0].elements.push(a, b, arrow);
  return { scene, page: scene.pages[0], a, b, arrow };
};

describe('Teaching animation tracks', () => {
  test('the action allowlist is explicit', () => {
    assert.ok(ANIMATION_ACTIONS.includes('reveal'));
    assert.ok(ANIMATION_ACTIONS.includes('marker'));
    assert.ok(ANIMATION_ACTIONS.includes('response'));
    assert.ok(!ANIMATION_ACTIONS.includes('execute-script'));
  });

  test('unknown actions and duplicate step ids are rejected', () => {
    const { page: p } = page();
    assert.throws(() => createTrack({ id: 't', steps: [{ id: 'a', action: 'teleport' }] }));
    const track = createTrack({
      id: 't',
      steps: [
        { id: 'same', action: 'highlight' },
        { id: 'same', action: 'dim' },
      ],
    });
    const check = validateTrack(track, p);
    assert.equal(check.ok, false);
    assert.match(check.errors[0], /Duplicate/);
  });

  test('missing targets are reported before playback starts', () => {
    const { page: p } = page();
    const track = createTrack({ id: 't', steps: [{ id: 's1', action: 'reveal', targetId: 'missing' }] });
    const check = validateTrack(track, p);
    assert.equal(check.ok, false);
    assert.match(check.errors[0], /missing element/);
  });

  test('sampling is deterministic and follows the single clock', () => {
    const { page: p, a, b } = page();
    const track = createTrack({
      id: 't',
      steps: [
        { id: 's1', action: 'reveal', targetId: a.id, duration: 1000 },
        { id: 's2', action: 'reveal', targetId: b.id, duration: 1000 },
      ],
    });
    assert.equal(trackDuration(track), 2000);
    assert.equal(stepStartMs(track, 1), 1000);
    const first = sampleTrack(track, 500, { page: p });
    const again = sampleTrack(track, 500, { page: p });
    assert.deepEqual([...first.visible], [a.id]);
    assert.deepEqual([...again.visible], [a.id]);
    const second = sampleTrack(track, 1500, { page: p });
    assert.deepEqual([...second.visible].sort(), [a.id, b.id].sort());
    assert.equal(second.finished, false);
    assert.equal(sampleTrack(track, 2000, { page: p }).finished, true);
  });

  test('hide, dim and highlight compose without touching scene data', () => {
    const { page: p, a, b } = page();
    const before = JSON.stringify(p.elements);
    const track = createTrack({
      id: 't',
      steps: [
        { id: 's1', action: 'hide', targetId: a.id },
        { id: 's2', action: 'dim', targetId: b.id },
        { id: 's3', action: 'highlight', targetId: b.id },
      ],
    });
    const state = sampleTrack(track, 5000, { page: p });
    assert.ok(state.hidden.has(a.id));
    assert.ok(state.dimmed.has(b.id));
    assert.ok(state.highlighted.has(b.id));
    assert.equal(JSON.stringify(p.elements), before);
  });

  test('request and response markers travel in opposite directions', () => {
    const { page: p, arrow } = page();
    const track = createTrack({
      id: 't',
      steps: [
        { id: 'req', action: 'request', edgeId: arrow.id, duration: 1000 },
        { id: 'res', action: 'response', edgeId: arrow.id, duration: 1000 },
      ],
    });
    const req = sampleTrack(track, 500, { page: p });
    assert.equal(req.markers[0].action, 'request');
    assert.ok(req.markers[0].t > 0 && req.markers[0].t < 1);
    const res = sampleTrack(track, 1500, { page: p });
    assert.equal(res.markers[0].action, 'response');
    assert.ok(res.markers[0].t < 1 && res.markers[0].t >= 0);
  });

  test('markers resolve a point on the connector geometry', () => {
    const { page: p, arrow } = page();
    const mid = markerPoint(arrow, 0.5, p);
    assert.ok(mid && Number.isFinite(mid.x));
    assert.ok(mid.x >= 80 && mid.x <= 300);
  });

  test('reduced motion jumps straight to the end state', () => {
    const { page: p, a } = page();
    const track = createTrack({ id: 't', steps: [{ id: 's1', action: 'reveal', targetId: a.id, duration: 2000 }] });
    const mid = sampleTrack(track, 400, { page: p, reducedMotion: true });
    assert.ok(mid.visible.has(a.id));
  });

  test('tracks survive save and reload, and are stripped from student notes', () => {
    const { scene, page: p, a } = page();
    p.animationTrack = createTrack({ id: 't', steps: [{ id: 's1', action: 'reveal', targetId: a.id }] });
    const reloaded = parseSceneJson(serializeScene(scene));
    assert.equal(reloaded.pages[0].animationTrack.steps.length, 1);
    assert.equal(reloaded.pages[0].animationTrack.steps[0].targetId, a.id);
  });
});

describe('Animation hardening', () => {
  test('unknown edge ids are rejected and durations are normalized', () => {
    const { page: p } = page();
    const track = createTrack({ id: 't', steps: [{ id: 's1', action: 'request', edgeId: 'missing' }] });
    assert.equal(validateTrack(track, p).ok, false);
    assert.match(validateTrack(track, p).errors[0], /missing connector/);
    const normalized = normalizeSteps([{ action: 'highlight' }]);
    assert.equal(normalized[0].duration, 1400);
    assert.equal(normalized[0].id, 'step-1');
  });

  test('reveal steps hide their targets until reached', () => {
    const { page: p, a, b } = page();
    const track = createTrack({
      id: 't',
      steps: [
        { id: 's1', action: 'reveal', targetId: a.id, duration: 1000 },
        { id: 's2', action: 'reveal', targetId: b.id, duration: 1000 },
      ],
    });
    const early = sampleTrack(track, 200, { page: p });
    assert.ok(early.revealPending.has(b.id));
    assert.ok(!early.revealPending.has(a.id));
    const late = sampleTrack(track, 1500, { page: p });
    assert.equal(late.revealPending.size, 0);
  });

  test('reveal restores an element that an earlier hide removed', () => {
    const { page: p, a } = page();
    const track = createTrack({
      id: 't',
      steps: [
        { id: 's1', action: 'reveal', targetId: a.id, duration: 500 },
        { id: 's2', action: 'hide', targetId: a.id, duration: 500 },
        { id: 's3', action: 'reveal', targetId: a.id, duration: 500 },
      ],
    });
    assert.ok(sampleTrack(track, 700, { page: p }).hidden.has(a.id));
    const after = sampleTrack(track, 1700, { page: p });
    assert.ok(!after.hidden.has(a.id));
    assert.ok(after.visible.has(a.id));
  });

  test('failure, retry and backlog produce distinct badges with counts', () => {
    const { page: p, a, b } = page();
    const track = createTrack({
      id: 't',
      steps: [
        { id: 's1', action: 'failure', targetId: a.id, duration: 1000 },
        { id: 's2', action: 'retry', targetId: b.id, duration: 1000, count: 3 },
        { id: 's3', action: 'backlog', targetId: a.id, duration: 1000 },
      ],
    });
    const state = sampleTrack(track, 2500, { page: p });
    const failure = state.badges.find((x) => x.targetId === a.id);
    assert.equal(failure.action, 'backlog');
    assert.deepEqual(
      state.badges.map((x) => x.action).sort(),
      ['backlog', 'retry']
    );
    const retry = state.badges.find((x) => x.targetId === b.id);
    assert.equal(retry.count, 3);
  });

  test('badge steps without a target are rejected before playback', () => {
    const { page: p } = page();
    const track = createTrack({ id: 't', steps: [{ id: 's1', action: 'failure' }] });
    assert.equal(validateTrack(track, p).ok, false);
  });
});
