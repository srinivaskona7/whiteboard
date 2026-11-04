// tests/lesson.test.js — a lesson track derived from the diagram's own topology.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { analyzeDiagram, buildLessonSteps, buildLessonTrack } from '../scene/lesson.js';
import { sampleTrack, normalizeSteps, validateTrack, stepStartMs, createTrack } from '../scene/animation.js';
import { createScene, createElement } from '../scene/model.js';
import { bindConnectorEndpoint } from '../scene/bindings.js';

function chain(labels = ['Client', 'Load balancer', 'App cluster', 'Database']) {
  const scene = createScene();
  const page = scene.pages[0];
  const nodes = labels.map((text, i) =>
    createElement('stencil', { stencilId: 'cloud-generic', x: 60 + i * 240, y: 120, w: 164, h: 92, text })
  );
  page.elements.push(...nodes);
  const arrows = [];
  for (let i = 0; i < nodes.length - 1; i++) {
    const arrow = createElement('arrow', { routing: 'orthogonal', endArrow: 'arrow', text: `hop ${i + 1}` });
    bindConnectorEndpoint(arrow, 'start', nodes[i], 'right');
    bindConnectorEndpoint(arrow, 'end', nodes[i + 1], 'left');
    page.elements.push(arrow);
    arrows.push(arrow);
  }
  return { scene, page, nodes, arrows };
}

describe('Diagram lessons', () => {
  test('the entry node is the leftmost node nothing points at', () => {
    const { page, nodes } = chain();
    const analysis = analyzeDiagram(page);
    assert.equal(analysis.entryId, nodes[0].id);
    assert.deepEqual(
      analysis.order.map((h) => h.nodeId),
      nodes.map((n) => n.id)
    );
  });

  test('a disconnected title or legend is not chosen as the entry', () => {
    const { page, nodes } = chain();
    page.elements.push(
      createElement('stencil', {
        stencilId: 'cloud-generic',
        x: 0,
        y: 0,
        w: 164,
        h: 92,
        text: 'Lesson title',
      })
    );
    const analysis = analyzeDiagram(page);
    assert.equal(analysis.entryId, nodes[0].id, 'the decoration became the entry');
    assert.ok(analysis.order.length >= 3);
  });

  test('an explicit entry overrides the inferred one', () => {
    const { page, nodes } = chain();
    const analysis = analyzeDiagram(page, { entryId: nodes[2].id });
    assert.equal(analysis.entryId, nodes[2].id);
    assert.equal(analysis.order.length, 2, 'only the reachable tail is walked');
  });

  test('disconnected shapes are not revealed by the lesson', () => {
    const { page } = chain();
    const orphan = createElement('stencil', {
      stencilId: 'cloud-generic',
      x: 1200,
      y: 600,
      w: 164,
      h: 92,
      text: 'Unrelated note',
    });
    page.elements.push(orphan);
    const steps = buildLessonSteps(page);
    assert.ok(!steps.some((s) => s.targetId === orphan.id));
  });

  test('each hop produces a request marker carrying the connector label', () => {
    const { page, arrows } = chain();
    const steps = buildLessonSteps(page, { includeFailure: false });
    const markers = steps.filter((s) => s.action === 'request');
    assert.equal(markers.length, arrows.length);
    assert.deepEqual(
      markers.map((m) => m.edgeId),
      arrows.map((a) => a.id)
    );
    assert.equal(markers[0].narration, 'hop 1');
    // The track is valid against the page it was built from.
    const track = buildLessonTrack(page, { includeFailure: false });
    const sampled = sampleTrack(track, 2000, { page });
    assert.ok(sampled.markers.length === 1);
  });

  test('failure and retry are added only where a hop exists', () => {
    const { page, nodes } = chain();
    const steps = buildLessonSteps(page);
    const failure = steps.find((s) => s.action === 'failure');
    const retry = steps.find((s) => s.action === 'retry');
    assert.ok(failure, 'no failure beat');
    assert.equal(failure.targetId, nodes[nodes.length - 1].id);
    assert.ok(retry);
    assert.equal(retry.count, 3);

    const single = chain(['Only node']);
    assert.ok(!buildLessonSteps(single.page).some((s) => s.action === 'failure'));
  });

  test('rollout targets the deployment-looking node and steps 10/50/100', () => {
    const { page, nodes } = chain();
    const steps = buildLessonSteps(page, { includeRollout: true });
    const rollout = steps.filter((s) => s.action === 'rollout');
    assert.equal(rollout.length, 3);
    assert.equal(rollout[0].targetId, nodes[2].id, 'the cluster node should be the rollout target');
    assert.deepEqual(
      rollout.map((s) => s.count),
      [10, 50, 100]
    );
  });

  test('pulse and rollout are allowlisted and need a target', () => {
    assert.doesNotThrow(() => normalizeSteps([{ id: 'p', action: 'pulse', targetId: 'x' }]));
    assert.doesNotThrow(() => normalizeSteps([{ id: 'r', action: 'rollout', targetId: 'x', count: 25 }]));
    const { page } = chain();
    const missing = validateTrack(
      { id: 't', steps: normalizeSteps([{ id: 'p2', action: 'pulse' }]) },
      page
    );
    assert.equal(missing.ok, false);
    assert.match(missing.errors[0], /element target/);
  });

  test('a sampled pulse keeps a static highlight as well as motion', () => {
    const { page, nodes } = chain();
    // Isolate the pulse step. Sampling a lesson track would pass even if the
    // pulse branch stopped highlighting, because the preceding `failure` step
    // has already marked the same node — the test would be vacuous.
    const track = createTrack({
      id: 'pulse-only',
      steps: normalizeSteps([{ id: 'p', action: 'pulse', targetId: nodes[0].id, duration: 1000 }]),
    });
    const start = stepStartMs(track, 0);
    const state = sampleTrack(track, start + 500, { page });
    assert.equal(state.pulses.length, 1, 'no pulse drawn mid-step');
    assert.equal(state.pulses[0].targetId, nodes[0].id);
    assert.ok(state.highlighted.has(nodes[0].id), 'pulse left no static highlight');
    assert.equal(state.effects.get(nodes[0].id), 'pulse');

    const reduced = sampleTrack(track, start + 500, { page, reducedMotion: true });
    assert.ok(reduced.highlighted.has(nodes[0].id), 'reduced motion lost the highlight');
    assert.equal(reduced.pulses[0].progress, 1, 'reduced motion should jump to the end state');
  });

  test('an empty page produces no track', () => {
    const scene = createScene();
    assert.equal(buildLessonTrack(scene.pages[0]), null);
    assert.equal(buildLessonSteps(scene.pages[0]).length, 0);
  });

  test('a cycle still produces a walk instead of stalling', () => {
    const { page, nodes, arrows } = chain(['A', 'B', 'C']);
    const back = createElement('arrow', { routing: 'orthogonal' });
    bindConnectorEndpoint(back, 'start', nodes[2], 'right');
    bindConnectorEndpoint(back, 'end', nodes[0], 'left');
    page.elements.push(back);
    const analysis = analyzeDiagram(page);
    assert.equal(analysis.entryId, nodes[0].id);
    assert.equal(analysis.order.length, nodes.length);
    assert.equal(arrows.length, 2);
  });

  test('rollout targets a deployment, never network furniture', () => {
    // "Shared services VPC" matches /service/ but rolling out a VPC is nonsense.
    const { page } = chain(['Client', 'Shared services VPC', 'Application']);
    const rollout = buildLessonSteps(page, { includeRollout: true });
    const targets = new Set(rollout.filter((s) => s.action === 'rollout').map((s) => s.targetId));
    const application = page.elements.find((e) => e.text === 'Application');
    const vpc = page.elements.find((e) => e.text === 'Shared services VPC');
    assert.deepEqual([...targets], [application.id]);
    assert.ok(!targets.has(vpc.id), 'the VPC was chosen as the rollout target');
  });

  test('rollout still works for a Lambda-only chain', () => {
    // Lambda was missing from the matching regex, so four AWS templates had no
    // canary beat at all.
    const { page } = chain(['Upload bucket', 'Order Lambda']);
    const rollout = buildLessonSteps(page, { includeRollout: true });
    const lambda = page.elements.find((e) => e.text === 'Order Lambda');
    assert.ok(rollout.some((s) => s.action === 'rollout' && s.targetId === lambda.id));
  });

  // The 2026-11-03 animation research puts a hop at 400-600 ms with a
  // 300-500 ms pause between hops. A future "make it feel smoother" edit that
  // exceeds this fails here rather than shipping a 1.9-minute lesson.
  test('lesson timings stay inside the researched range', () => {
    const { page } = chain();
    const steps = buildLessonSteps(page, { includeFailure: false });
    const hops = steps.filter((s) => s.action === 'request');
    assert.ok(hops.length > 0);
    for (const hop of hops) {
      assert.ok(hop.duration >= 400 && hop.duration <= 600, `hop duration ${hop.duration}`);
      assert.ok(hop.delay >= 300 && hop.delay <= 500, `hop delay ${hop.delay}`);
    }
    const reveals = steps.filter((s) => s.action === 'reveal');
    for (const reveal of reveals) {
      assert.ok(reveal.duration >= 300 && reveal.duration <= 700, `reveal ${reveal.duration}`);
    }
    // Four hops plus the entry must fit inside the viewer's patience.
    const total = buildLessonTrack(page, { includeFailure: false }).steps
      .reduce((sum, s) => sum + s.duration + s.delay, 0);
    assert.ok(total < 12000, `a four-node lesson runs ${total} ms`);
  });
});
