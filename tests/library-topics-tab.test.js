// tests/library-topics-tab.test.js — the Topics tab views, rendered as pure
// markup (no DOM): topic list, topic overview, folder view, search, level filter.
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { renderTopicsView, DEFAULT_TOPICS_STATE } from '../ui/library-topics-tab.js';
import { iconSizeLayout } from '../ui/library-panel.js';
import { ensureIconPackLoaded, ensurePackCommandsLoaded, ALL_STENCILS } from '../stencils/index.js';
import { LIBRARY_TOPICS, LEVEL_LABELS, summarizeTopics, commandTopicId } from '../stencils/library-topics.js';
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';

const layout = iconSizeLayout(48); // 3 columns
let commands = [];

before(async () => {
  await ensureIconPackLoaded();
  commands = (await ensurePackCommandsLoaded()).PACK_COMMANDS;
});

const view = (state, extra = {}) => renderTopicsView({ state, commands, layout, favorites: new Set(), ...extra });
const count = (html, re) => (html.match(re) || []).length;
const stripTags = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('the default state is the topic list with no filter', () => {
  assert.deepEqual({ ...DEFAULT_TOPICS_STATE, expanded: [] }, { topicId: '', folderId: '', q: '', level: 0, limit: 120, expanded: [], onlyTopic: false });
});

test('the topic list shows every topic once, numbered in learning order, with counts from the index', () => {
  const html = view({});
  const rows = [...html.matchAll(/data-topic="([^"]+)"[^>]*>\s*<span class="wb-topic-num">(\d+)<\/span>/g)];
  assert.deepEqual(
    rows.map((m) => m[1]),
    LIBRARY_TOPICS.map((t) => t.id)
  );
  assert.deepEqual(
    rows.map((m) => Number(m[2])),
    LIBRARY_TOPICS.map((_, i) => i + 1)
  );
  const summary = summarizeTopics({ level: 0 }, { staticStencils: ALL_STENCILS, workflows: WORKFLOW_INDEX.workflows });
  const git = summary.find((s) => s.id === 'git');
  assert.match(html, new RegExp(`${git.icons.toLocaleString('en-US')} icons`));
  assert.match(html, /18 topics in learning order/);
});

test('the topic list needs no pack data: it renders the same with no commands loaded', () => {
  assert.equal(view({}), view({}, { commands: [] }));
});

test('the level filter changes the topic list counts and says so', () => {
  const all = stripTags(view({}));
  const beginner = stripTags(view({ level: 1 }));
  assert.notEqual(all, beginner);
  assert.match(beginner, /topics in learning order at beginner level/);
  const s1 = summarizeTopics({ level: 1 }, { staticStencils: ALL_STENCILS, workflows: WORKFLOW_INDEX.workflows });
  const iconTotal = s1.reduce((n, s) => n + s.icons, 0);
  assert.match(beginner, new RegExp(`${iconTotal.toLocaleString('en-US')} icons`));
});

test('a topic overview has a crumb, a numbered table of contents and one section per folder', () => {
  const html = view({ topicId: 'linux' });
  assert.match(html, /data-topic-home/);
  assert.match(html, /<h3[^>]*>Linux<\/h3>/);
  const toc = html.slice(html.indexOf('wb-topic-toc'), html.indexOf('</ol>', html.indexOf('wb-topic-toc')));
  const folders = [...toc.matchAll(/data-folder="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(folders[0], 'fhs', 'Linux starts with the filesystem hierarchy');
  assert.ok(folders.includes('@commands') && folders.includes('@workflows'), 'commands and workflows close the path');
  assert.ok(folders.indexOf('@commands') < folders.indexOf('@workflows'));
  assert.equal(count(html, /class="wb-lib-category-section"/g), folders.length, 'one section per table-of-contents entry');
  assert.equal(count(html, /class="wb-cmd-card"/g), 3, 'a preview of three commands');
});

test('a folder view runs beginner to expert under level headings, with a stepper', () => {
  const html = view({ topicId: 'linux', folderId: 'files' });
  const heads = [...html.matchAll(/<span>(Beginner|Intermediate|Advanced|Expert)<\/span>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ['Beginner', 'Intermediate', 'Advanced', 'Expert']);
  assert.match(html, /2 of 16 ·/, 'Files, permissions & commands is the second Linux folder');
  assert.match(html, /Previous: Filesystem hierarchy/);
  assert.match(html, /Next: Packages/);
  assert.equal(count(html, /class="wb-topic-stepper"/g), 2, 'the stepper shows above and below a folder');
});

test('the first folder has a next step but no previous one, the last has the reverse', () => {
  const first = view({ topicId: 'linux', folderId: 'fhs' });
  assert.match(first, /1 of 16 ·/);
  assert.match(first, /Next: /);
  assert.doesNotMatch(first, /Previous: /);
  const last = view({ topicId: 'linux', folderId: '@workflows' });
  assert.match(last, /16 of 16 ·/);
  assert.match(last, /Previous: /);
  assert.doesNotMatch(last, /Next: /);
});

test('a folder is windowed, with a "show more" count that matches what is left', () => {
  const html = view({ topicId: 'aws', folderId: 'tiles', limit: 10 });
  const shown = count(html, /class="wb-stencil-item"/g);
  assert.equal(shown, 10);
  const m = html.match(/Show (\d+) more \((\d+) left\)/);
  assert.ok(m, 'a show-more button');
  assert.equal(Number(m[2].replace(/,/g, '')) + shown, ALL_STENCILS.filter((s) => s.category === 'pack/aws').length);
  const all = view({ topicId: 'aws', folderId: 'tiles', limit: 500 });
  assert.doesNotMatch(all, /data-more/, 'no button once everything is shown');
});

test('the commands folder groups by level and every card can copy and insert', () => {
  const html = view({ topicId: 'linux', folderId: '@commands' });
  const cmds = commands.filter((c) => commandTopicId(c) === 'linux');
  assert.equal(count(html, /class="wb-cmd-card"/g), cmds.length);
  assert.equal(count(html, /data-cmd-copy=/g), cmds.length);
  assert.equal(count(html, /data-cmd-insert=/g), cmds.length);
  const heads = [...html.matchAll(/wb-topic-section-title"><span>(Beginner|Intermediate|Advanced|Expert|General)<\/span>/g)].map((m) => LEVEL_LABELS.indexOf(m[1]));
  assert.deepEqual(heads, [...heads].sort((a, b) => a - b), 'level groups ascend');
});

test('a risky command shows its warning', () => {
  const risky = commands.find((c) => c.risky);
  assert.ok(risky, 'the pack has risky commands');
  const topic = commandTopicId(risky);
  const html = view({ topicId: topic, folderId: '@commands' });
  assert.ok(count(html, /class="wb-risky"/g) >= 1);
  assert.match(html, /Read before running/);
});

test('command text is escaped, never injected as markup', () => {
  const evil = { id: 'x', group: 'git', title: '<img src=x onerror=alert(1)>', cmd: 'echo "<script>alert(1)</script>" && cat <<EOF', note: '"quoted" & <b>', level: 1, risky: false, icon: '', cat: '' };
  const html = view({ topicId: 'git', folderId: '@commands' }, { commands: [evil] });
  assert.doesNotMatch(html, /<img src=x|<script>alert|<b>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('workflow cards in a topic carry Insert and Insert & present', () => {
  const html = view({ topicId: 'git', folderId: '@workflows' });
  const ids = [...html.matchAll(/data-wf-insert="([^"]+)"/g)].map((m) => m[1]);
  const expected = WORKFLOW_INDEX.workflows.filter((w) => w.topic === 'hello' || w.topic === 'git');
  assert.equal(ids.length, expected.length);
  assert.equal(count(html, /data-wf-present=/g), ids.length);
});

test('search finds icons, commands and workflows, grouped topic › folder', () => {
  const html = view({ q: 'chmod' });
  assert.match(html, /data-stencil="pk-linux-chmod"/);
  assert.match(html, /class="wb-cmd-card"/);
  assert.match(html, /Linux › /);
  assert.match(html, /for “chmod”/);
});

test('search results are escaped', () => {
  const html = view({ q: '<img src=x onerror=alert(1)>' });
  assert.doesNotMatch(html, /<img src=x/);
  assert.match(html, /No icons, commands or workflows match/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
});

test('search obeys the level filter', () => {
  const html = view({ q: 'iam', level: 4 });
  assert.doesNotMatch(html, /Beginner|Intermediate/);
  const none = view({ q: 'zzzxqv' });
  assert.match(none, /No icons, commands or workflows match “zzzxqv”/);
});

test('searching inside a topic lists its results first, and can be limited to it', () => {
  const all = view({ q: 'security', topicId: 'aws' });
  const heads = [...all.matchAll(/wb-topic-section-title"><span>([^<]+) › /g)].map((m) => m[1]);
  assert.equal(heads[0], 'AWS', 'the open topic leads');
  assert.match(all, /Only AWS/);
  const only = view({ q: 'security', topicId: 'aws', onlyTopic: true });
  const onlyHeads = new Set([...only.matchAll(/wb-topic-section-title"><span>([^<]+) › /g)].map((m) => m[1]));
  assert.deepEqual([...onlyHeads], ['AWS']);
  assert.match(only, /Search all topics/);
});

test('a search renders at most 300 icons and says how many were left out', () => {
  const html = view({ q: 'a', expanded: ['aws/tiles', 'linux/tiles', 'k8s/tiles', 'docker/tiles', 'diagrams/generic', 'diagrams/interface'] });
  assert.ok(count(html, /class="wb-stencil-item"/g) <= 300);
  assert.match(html, /Showing [\d,]+ of [\d,]+ icons/);
});

test('every topic, folder and level renders without holes', () => {
  for (const level of [0, 1, 2, 3, 4]) {
    for (const t of LIBRARY_TOPICS) {
      const views = [view({ topicId: t.id, level })];
      for (const fo of t.folders) views.push(view({ topicId: t.id, folderId: fo.id, level }));
      views.push(view({ topicId: t.id, folderId: '@commands', level }), view({ topicId: t.id, folderId: '@workflows', level }));
      for (const html of views) {
        assert.doesNotMatch(html, /undefined|NaN|\[object Object\]/, `${t.id} level ${level}`);
      }
    }
  }
});

test('a topic overview totals match the static index at every level', () => {
  for (const level of [0, 1, 2, 3, 4]) {
    const summary = summarizeTopics({ level }, { staticStencils: ALL_STENCILS, workflows: WORKFLOW_INDEX.workflows });
    for (const s of summary) {
      const html = view({ topicId: s.id, level });
      const tocCounts = [...html.slice(html.indexOf('wb-topic-toc')).split('</ol>')[0].matchAll(/data-folder="([^"]+)"[\s\S]*?wb-topic-count">([\d,]+)</g)];
      const icons = tocCounts.filter((m) => !m[1].startsWith('@')).reduce((n, m) => n + Number(m[2].replace(/,/g, '')), 0);
      assert.equal(icons, s.icons, `${s.id} icons at level ${level}`);
      const cmds = tocCounts.find((m) => m[1] === '@commands');
      assert.equal(cmds ? Number(cmds[2].replace(/,/g, '')) : 0, s.commands, `${s.id} commands at level ${level}`);
      const wfs = tocCounts.find((m) => m[1] === '@workflows');
      assert.equal(wfs ? Number(wfs[2].replace(/,/g, '')) : 0, s.workflows, `${s.id} workflows at level ${level}`);
    }
  }
});

test('favourites show filled stars', () => {
  const html = view({ topicId: 'linux', folderId: 'tiles' }, { favorites: new Set(['pk-linux-chmod']) });
  assert.match(html, /wb-fav-star active" data-fav-stencil="pk-linux-chmod"[^>]*>★/);
});
