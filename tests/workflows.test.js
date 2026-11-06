import test from 'node:test';
import assert from 'node:assert/strict';
import { WORKFLOW_TOPICS } from '../templates/workflows-data.js';
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';
import { buildWorkflow, wrapText, stateBoxes } from '../scene/workflow-builder.js';
import { validateElementsBatch } from '../scene/geometry.js';
import { filterWorkflows } from '../ui/workflows-tab.js';
import { getStencilById } from '../stencils/index.js';

const all = WORKFLOW_TOPICS.flatMap((t) => t.workflows.map((w) => ({ t, w })));

test('workflow library: 10 topics, unique ids, index matches data, at least 160 workflows', () => {
  assert.equal(WORKFLOW_TOPICS.length, 10);
  assert.ok(all.length >= 160, `found ${all.length}`);
  assert.equal(new Set(all.map(({ w }) => w.id)).size, all.length);
  assert.equal(WORKFLOW_INDEX.workflows.length, all.length);
  for (const t of WORKFLOW_TOPICS) assert.equal(WORKFLOW_INDEX.topics.find((x) => x.id === t.id).count, t.workflows.length);
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
  assert.equal(filterWorkflows({ topic: 'git' }).length, WORKFLOW_TOPICS.find((t) => t.id === 'git').workflows.length);
  assert.ok(filterWorkflows({ level: 1 }).every((w) => w.level === 1));
});

test('wrapText keeps lines within the width', () => {
  assert.ok(wrapText('alpha beta gamma delta', 10).every((l) => l.length <= 11));
});

test('every workflow has 2-3 Q&A pairs starting with the situation question, rendered on the board', () => {
  for (const { t, w } of all) {
    assert.ok(w.qna.length >= 2 && w.qna.length <= 3, w.id);
    assert.match(w.qna[0].q, /In which situation/, w.id);
    const r = buildWorkflow(w, t, { x: 0, y: 0 });
    const texts = r.elements.filter((e) => e.type === 'text').map((e) => e.text);
    assert.ok(texts.some((x) => x.startsWith('Q: In which situation')), w.id);
    assert.ok(texts.some((x) => x.startsWith('A: ')), w.id);
    const qa = r.elements.filter((e) => e.type === 'text' && /^(Q|A): /.test(e.text));
    assert.ok(qa.every((e) => !e.revealStep), 'Q&A stays visible from the first slide');
    assert.ok(qa.every((e) => e.y + e.h < r.frame.y + r.frame.h), w.id);
  }
});

test('hello journey: every step carries a recorded file state and four coloured boxes', () => {
  const hello = WORKFLOW_TOPICS.find((t) => t.id === 'hello');
  assert.equal(hello.workflows.length, 12);
  for (const w of hello.workflows) {
    for (const st of w.steps) {
      assert.ok(st.state, `${w.id}: ${st.title}`);
      assert.equal(stateBoxes(st.state).length, 4);
    }
    const r = buildWorkflow(w, hello, { x: 0, y: 0 });
    const titles = r.elements.filter((e) => e.type === 'text').map((e) => e.text);
    assert.ok(titles.includes('Working folder') && titles.includes('Staging area') && titles.includes('Remote server'), w.id);
    assert.ok(titles.some((x) => x.startsWith('Local repo')), w.id);
  }
});

test('hello journey: first step has no repository, the commit step shows HEAD', () => {
  const w = WORKFLOW_TOPICS.find((t) => t.id === 'hello').workflows.find((x) => x.id === 'hello-first-commit');
  assert.equal(w.steps[0].state.norepo, true);
  assert.match(stateBoxes(w.steps[3].state)[2].title, /HEAD [0-9a-f]{7}/);
  assert.ok(w.steps[3].state.local.some((l) => l.includes('Add hello.txt')));
});

test('hello journey: merge conflict file shows the markers, not a fake file name', () => {
  const w = WORKFLOW_TOPICS.find((t) => t.id === 'hello').workflows.find((x) => x.id === 'hello-merge-conflict');
  const conflict = w.steps[2].state;
  assert.deepEqual(conflict.working.map((f) => f[0]), ['hello.txt']);
  assert.ok(conflict.working[0][1].some((l) => l.startsWith('<<<<<<<')));
});

test('every workflow links to its previous and next module, and the board shows it', () => {
  for (const t of WORKFLOW_TOPICS) {
    t.workflows.forEach((w, i) => {
      assert.equal(w.nav.pos, i + 1);
      assert.equal(w.nav.of, t.workflows.length);
      assert.equal(w.nav.prev?.id ?? null, i ? t.workflows[i - 1].id : null);
      assert.equal(w.nav.next?.id ?? null, t.workflows[i + 1]?.id ?? null);
      const r = buildWorkflow(w, t, { x: 0, y: 0 });
      assert.ok(r.elements.some((e) => e.type === 'text' && e.text.includes('Previous module')), w.id);
    });
  }
});

test('topics are ordered for learning: hello, git, linux, docker, k8s, jenkins, aws, terraform, ansible, network', () => {
  assert.deepEqual(WORKFLOW_TOPICS.map((t) => t.id), ['hello', 'git', 'linux', 'docker', 'k8s', 'jenkins', 'aws', 'terraform', 'ansible', 'network']);
});

test('kubernetes topic: 13 modules, starts by checking the context, ends with uncordon verification', () => {
  const k = WORKFLOW_TOPICS.find((t) => t.id === 'k8s');
  assert.equal(k.workflows.length, 13);
  assert.match(k.workflows[0].steps[0].cmd, /current-context/);
  const drain = k.workflows.find((w) => w.id === 'k8s-node-maintenance');
  assert.ok(drain.steps.some((st) => /uncordon/.test(st.cmd) && /SchedulingDisabled/.test(st.cmd)));
  for (const w of k.workflows) for (const st of w.steps) assert.notEqual(st.outKind, 'recorded', `${w.id}: only real runs may be labelled recorded`);
});
