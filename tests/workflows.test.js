import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKFLOW_TOPICS } from '../templates/workflows-data.js';
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';
import { buildWorkflow, wrapText } from '../scene/workflow-builder.js';
import { validateElementsBatch } from '../scene/geometry.js';
import { filterWorkflows } from '../ui/workflows-tab.js';
import { getStencilById } from '../stencils/index.js';

const all = WORKFLOW_TOPICS.flatMap((t) => t.workflows.map((w) => ({ t, w })));

test('workflow library: 4 topics x 20 workflows, unique ids, index matches data', () => {
  assert.equal(WORKFLOW_TOPICS.length, 4);
  assert.equal(all.length, 80);
  assert.equal(new Set(all.map(({ w }) => w.id)).size, 80);
  assert.equal(WORKFLOW_INDEX.workflows.length, 80);
});

test('every step icon resolves to a real stencil', () => {
  for (const { w } of all) for (const s of w.steps) assert.ok(getStencilById(s.icon), `${w.id}: ${s.icon}`);
});

test('every workflow builds valid elements, one reveal step per step, bound arrows', () => {
  for (const { t, w } of all) {
    const r = buildWorkflow(w, t, { x: 0, y: 0 });
    assert.equal(validateElementsBatch(r.elements).valid, true, w.id);
    assert.equal(new Set(r.elements.map((e) => e.revealStep).filter(Boolean)).size, w.steps.length, w.id);
    for (const a of r.arrows) assert.ok(a.startBinding && a.endBinding, w.id);
  }
});

test('git workflows carry recorded output only', () => {
  const git = WORKFLOW_TOPICS.find((t) => t.id === 'git');
  const kinds = new Set(git.workflows.flatMap((w) => w.steps.map((s) => s.outKind)).filter(Boolean));
  assert.deepEqual([...kinds], ['recorded']);
});

test('search and level filters', () => {
  assert.ok(filterWorkflows({ q: 'merge' }).length > 0);
  assert.equal(filterWorkflows({ topic: 'git' }).length, 20);
  assert.ok(filterWorkflows({ level: 1 }).every((w) => w.level === 1));
});

test('wrapText keeps lines within the width', () => {
  assert.ok(wrapText('alpha beta gamma delta', 10).every((l) => l.length <= 11));
});
