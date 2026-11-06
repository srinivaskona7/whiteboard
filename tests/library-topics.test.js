// tests/library-topics.test.js — the library's topic map (stencils/library-topics.js):
// every stencil from every source filed under exactly one topic and folder,
// beginner → expert order, command/workflow filing, search across icons,
// commands and workflows, and index-based counts that match the loaded tree.
import test from 'node:test';
import assert from 'node:assert/strict';

const registry = await import('../stencils/index.js');
const topics = await import('../stencils/library-topics.js');
const { PACK_COMMANDS } = await import('../stencils/icon-pack-commands.js');
const { PACK_INDEX } = await import('../stencils/icon-pack-index.js');
const { WORKFLOW_INDEX } = await import('../templates/workflows-index.js');
const { LEVEL_NAMES } = await import('../scene/workflow-builder.js');

const { LIBRARY_TOPICS, buildTopicTree, classifyCategory, summarizeTopics, searchLibrary, commandTopicId, workflowTopicId } =
  topics;

// Snapshot the eager registry, then register the lazy pack (icons + glyphs).
const staticStencils = registry.ALL_STENCILS.slice();
await registry.ensureIconPackLoaded();
const allStencils = registry.ALL_STENCILS;
const workflows = WORKFLOW_INDEX.workflows;

test('every stencil from every source is filed under a topic and folder — none unfiled', () => {
  assert.equal(staticStencils.length, 641, 'eager registry size changed — re-measure the docs');
  assert.equal(allStencils.length, 641 + 3404 + 263, 'static + pack tiles + pack glyphs');
  const { topics: tree, unassigned } = buildTopicTree(allStencils);
  const stray = [...new Set(unassigned.map((s) => s.category))];
  assert.deepEqual(stray, [], `unfiled categories: ${stray.join(', ')}`);
  assert.equal(
    tree.reduce((n, t) => n + t.count, 0),
    allStencils.length,
    'the tree must hold every stencil exactly once'
  );
});

test('the coverage check catches a category nobody filed', () => {
  const novel = { id: 'pk-demo-new', name: 'New', category: 'pack/brand-new-group', level: 0 };
  const { unassigned } = buildTopicTree([...allStencils.slice(0, 5), novel]);
  assert.deepEqual(
    unassigned.map((s) => s.id),
    ['pk-demo-new']
  );
});

test('no category is filed twice, no folder is empty, ids are unique', () => {
  const seen = new Map();
  const present = new Set(allStencils.map((s) => s.category));
  const { topics: tree } = buildTopicTree(allStencils);
  const topicIds = new Set();
  for (const t of LIBRARY_TOPICS) {
    assert.ok(!topicIds.has(t.id), `duplicate topic id ${t.id}`);
    topicIds.add(t.id);
    const folderIds = new Set();
    for (const fo of t.folders) {
      assert.ok(!folderIds.has(fo.id), `duplicate folder id ${t.id}/${fo.id}`);
      folderIds.add(fo.id);
      for (const c of fo.categories) {
        assert.ok(!seen.has(c), `${c} filed in both ${seen.get(c)} and ${t.id}/${fo.id}`);
        seen.set(c, `${t.id}/${fo.id}`);
        assert.ok(present.has(c), `${t.id}/${fo.id} files a category no stencil has: ${c}`);
      }
    }
  }
  for (const t of tree) for (const fo of t.folders) assert.ok(fo.items.length > 0, `empty folder ${t.id}/${fo.id}`);
});

test('icons inside every folder run from beginner to expert', () => {
  const { topics: tree } = buildTopicTree(allStencils);
  let leveledFolders = 0;
  for (const t of tree) {
    for (const fo of t.folders) {
      const levels = fo.items.map((s) => s.level || 0);
      for (let i = 1; i < levels.length; i++) {
        assert.ok(levels[i] >= levels[i - 1], `${t.id}/${fo.id} breaks level order at #${i}`);
      }
      if (levels.some((l) => l > 0)) leveledFolders += 1;
    }
  }
  assert.equal(leveledFolders, 39, 'the 39 leveled concept groups each fill one folder');
});

test('topics follow the Workflows tab order, and every workflow files under a topic', () => {
  const order = LIBRARY_TOPICS.map((t) => t.id);
  const positions = WORKFLOW_INDEX.topics.map((wt) => order.indexOf(workflowTopicId({ topic: wt.id })));
  assert.ok(!positions.includes(-1), 'every workflow topic maps to a library topic');
  for (let i = 1; i < positions.length; i++) assert.ok(positions[i] >= positions[i - 1], 'topic order must follow the workflow order');
  for (const w of workflows) assert.ok(workflowTopicId(w), `workflow ${w.id} has no topic`);
  assert.equal(workflowTopicId({ topic: 'hello' }), 'git');
  assert.equal(workflowTopicId({ topic: 'jenkins' }), 'cicd');
});

test('every command files under its own topic; Terraform and Ansible split the iac group', () => {
  assert.equal(PACK_COMMANDS.length, 183);
  const tally = {};
  for (const c of PACK_COMMANDS) {
    const id = commandTopicId(c);
    assert.ok(id, `command ${c.id} has no topic`);
    tally[id] = (tally[id] || 0) + 1;
  }
  assert.deepEqual(tally, { linux: 72, aws: 52, k8s: 27, docker: 10, terraform: 8, ansible: 8, git: 6 });
  // An AWS command whose teaching icon is a generic firewall tile stays in AWS.
  assert.equal(commandTopicId({ group: 'awsnet', cat: 'pack/firewall-and-security' }), 'aws');
  // Unknown groups fall back to the linked icon's topic.
  assert.equal(commandTopicId({ group: 'brandnew', cat: 'pack/docker' }), 'docker');
});

test('topic icons are eager line icons and level labels match the workflow builder', () => {
  for (const t of LIBRARY_TOPICS) {
    assert.ok(staticStencils.some((s) => s.id === t.icon), `${t.id} icon ${t.icon} is not an eager stencil`);
    assert.match(t.color, /^#[0-9A-Fa-f]{6}$/);
  }
  assert.deepEqual(topics.LEVEL_LABELS.slice(1), LEVEL_NAMES.slice(1));
});

test('index-based topic counts equal the loaded tree at every level', () => {
  const { topics: tree } = buildTopicTree(allStencils);
  for (const level of [0, 1, 2, 3, 4]) {
    const summary = summarizeTopics({ level }, { staticStencils, workflows, packIndex: PACK_INDEX });
    for (const t of tree) {
      const s = summary.find((x) => x.id === t.id);
      for (const fo of t.folders) {
        const expected = fo.items.filter((it) => !level || (it.level || 0) === level).length;
        const got = s.folders.find((x) => x.id === fo.id).count;
        assert.equal(got, expected, `level ${level} ${t.id}/${fo.id}: index says ${got}, tree has ${expected}`);
      }
      const cmds = PACK_COMMANDS.filter((c) => commandTopicId(c) === t.id && (!level || c.level === level)).length;
      assert.equal(s.commands, cmds, `level ${level} ${t.id} command count`);
      const wfs = workflows.filter((w) => workflowTopicId(w) === t.id && (!level || w.level === level)).length;
      assert.equal(s.workflows, wfs, `level ${level} ${t.id} workflow count`);
    }
  }
});

const sources = { stencils: allStencils, commands: PACK_COMMANDS, workflows };

test('search finds chmod as Linux icons and as copy-ready commands', () => {
  const r = searchLibrary({ query: 'chmod' }, sources);
  assert.ok(r.icons.length > 0 && r.icons.every((g) => g.items.length > 0));
  assert.ok(r.icons.some((g) => g.topicId === 'linux' && g.items.some((s) => s.id === 'pk-linux-chmod')));
  assert.ok(r.commands.length >= 3 && r.commands.every((c) => /chmod/i.test(`${c.title} ${c.cmd} ${c.note}`)));
});

test('a two-word search needs both words and ranks the AWS NAT gateway first', () => {
  const r = searchLibrary({ query: 'nat gateway' }, sources);
  const ids = r.icons.flatMap((g) => g.items.map((s) => s.id));
  assert.ok(ids.includes('pk-aws-aws-nat-gateway'));
  assert.ok(ids.includes('pk-awsvpc-vpc-nat-gateway-per-az-ha'));
  assert.equal(r.icons[0].topicId, 'aws', 'AWS is the first topic that files a NAT gateway');
  assert.equal(r.commands[0].id, 'awsnet.create-a-nat-gateway-for-private-subnets');
});

test('the level filter keeps only that level across icons, commands and workflows', () => {
  const r = searchLibrary({ level: 1 }, sources);
  assert.ok(r.iconTotal > 0 && r.commands.length > 0 && r.workflows.length > 0);
  for (const g of r.icons) for (const s of g.items) assert.equal(s.level, 1, `${s.id} is not beginner`);
  assert.ok(r.commands.every((c) => c.level === 1));
  assert.ok(r.workflows.every((w) => w.level === 1));
  const expert = searchLibrary({ query: 'iam', level: 4 }, sources);
  assert.ok(expert.icons.every((g) => g.items.every((s) => s.level === 4)));
});

test('a topic scope limits every result list to that topic', () => {
  const r = searchLibrary({ query: 'pod', topicId: 'k8s' }, sources);
  assert.ok(r.iconTotal > 0);
  assert.ok(r.icons.every((g) => g.topicId === 'k8s'));
  assert.ok(r.commands.every((c) => commandTopicId(c) === 'k8s'));
  assert.ok(r.workflows.every((w) => workflowTopicId(w) === 'k8s'));
  assert.equal(classifyCategory('pack/kubernetes-resources').topicId, 'k8s');
});
