import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKFLOW_ICON_STENCILS, WORKFLOW_ICON_GROUPS } from '../stencils/workflow-icons.js';
import { ALL_STENCILS, getStencilById, getStencilsByCategory } from '../stencils/index.js';
import { WORKFLOW_TOPICS } from '../templates/workflows-data.js';

test('workflow icons: unique ids and names, no identical drawings, registered', () => {
  assert.ok(WORKFLOW_ICON_STENCILS.length >= 60);
  assert.equal(new Set(WORKFLOW_ICON_STENCILS.map((s) => s.id)).size, WORKFLOW_ICON_STENCILS.length);
  assert.equal(new Set(WORKFLOW_ICON_STENCILS.map((s) => s.name.toLowerCase())).size, WORKFLOW_ICON_STENCILS.length);
  assert.equal(new Set(WORKFLOW_ICON_STENCILS.map((s) => s.svgInner)).size, WORKFLOW_ICON_STENCILS.length);
  const ids = new Set(ALL_STENCILS.map((s) => s.id));
  for (const s of WORKFLOW_ICON_STENCILS) assert.ok(ids.has(s.id), s.id);
});

test('workflow icons: valid category, SVG export and draw function', () => {
  const cats = new Set(Object.values(WORKFLOW_ICON_GROUPS));
  for (const s of WORKFLOW_ICON_STENCILS) {
    assert.ok(cats.has(s.category), s.id);
    assert.equal(typeof s.draw, 'function');
    assert.match(s.toSvg(0, 0, 64, 64), /^<g transform=.*<\/g>$/s, s.id);
    assert.equal(s.toSvg(0, 0, 8, 8), '', 'too small to draw');
    const calls = [];
    const ctx = new Proxy({}, { get: (_, k) => (k === 'save' || k === 'restore' ? () => {} : (...a) => calls.push(k)), set: () => true });
    s.draw(ctx, 0, 0, 64, 64);
  }
});

test('workflows use the concept icons and every one is reachable by search', () => {
  const used = new Set(WORKFLOW_TOPICS.flatMap((t) => t.workflows.flatMap((w) => w.steps.map((s) => s.icon))));
  assert.ok([...used].filter((i) => i.startsWith('wf-')).length >= 20);
  for (const id of used) assert.ok(getStencilById(id).id === id, id);
  assert.ok(getStencilsByCategory('handshake').length > 0);
});
