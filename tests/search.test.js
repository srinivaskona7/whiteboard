// tests/search.test.js — one local search index with scopes, aliases and typo tolerance.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  tokenize,
  withinOneEdit,
  createEntry,
  searchEntries,
  searchEntriesDetailed,
  buildSearchEntries,
  loadSearchPrefs,
  saveSearchPrefs,
  pushRecent,
  pushRecentQuery,
  toggleFavourite,
  toggleFavouriteQuery,
} from '../scene/search.js';

const entries = [
  createEntry({ id: 'a', scope: 'actions', kind: 'action', title: 'Tool: Table', keywords: 'grid rows columns' }),
  createEntry({ id: 'b', scope: 'library', kind: 'stencil', title: 'Azure SQL Database', keywords: 'sql azure database' }),
  createEntry({ id: 'c', scope: 'objects', kind: 'element', title: 'Browser request', keywords: 'browser client' }),
  createEntry({ id: 'd', scope: 'lesson', kind: 'note', title: 'Explain CIDR blocks', visibility: 'teacher' }),
];

describe('Unified local search', () => {
  test('tokens are case-insensitive and whitespace tolerant', () => {
    assert.deepEqual(tokenize('  Azure   SQL '), ['azure', 'sql']);
    const result = searchEntries(entries, 'AZURE sql');
    assert.equal(result[0].id, 'b');
  });

  test('exact names outrank keyword-only hits', () => {
    const result = searchEntries(entries, 'table');
    assert.equal(result[0].id, 'a');
    const keywordOnly = searchEntries(entries, 'grid');
    assert.equal(keywordOnly[0].id, 'a');
  });

  test('a single typo still finds the entry', () => {
    assert.ok(withinOneEdit('tabel', 'table'));
    assert.ok(withinOneEdit('azur', 'azure'));
    assert.equal(searchEntries(entries, 'tabel')[0].id, 'a');
  });

  test('scope and type filters narrow results without hiding matches', () => {
    assert.equal(searchEntries(entries, 'browser', { scope: 'objects' }).length, 1);
    assert.equal(searchEntries(entries, 'browser', { scope: 'library' }).length, 0);
    assert.equal(searchEntries(entries, 'azure', { filter: 'stencil' }).length, 1);
    assert.equal(searchEntries(entries, 'azure', { filter: 'action' }).length, 0);
  });

  test('teacher-private notes are excluded from a student surface', () => {
    assert.equal(searchEntries(entries, 'CIDR', { studentMode: true }).length, 0);
    assert.equal(searchEntries(entries, 'CIDR', { studentMode: false }).length, 1);
  });

  test('board and lesson entries are built from page contents', () => {
    const page = {
      id: 'p1',
      name: 'Page 1',
      elements: [
        { id: 'e1', type: 'text', text: 'Subnet planning' },
        { id: 'e2', type: 'frame', text: 'Lesson', teacherNotes: 'Remember the /16 mask' },
      ],
    };
    const built = buildSearchEntries({ pages: [page], activePageId: 'p1' });
    assert.ok(built.some((e) => e.kind === 'element' && e.title === 'Subnet planning'));
    const note = built.find((e) => e.kind === 'note');
    assert.equal(note.visibility, 'teacher');
    assert.match(note.title, /mask/);
  });

  test('recents and favourites persist locally and stay deduplicated', () => {
    const map = new Map();
    const storage = {
      getItem: (k) => map.get(k) || null,
      setItem: (k, v) => map.set(k, String(v)),
    };
    let prefs = { recents: [], favourites: [], recentQueries: [], favouriteQueries: [] };
    prefs = pushRecent(prefs, 'a');
    prefs = pushRecent(prefs, 'b');
    prefs = pushRecent(prefs, 'a');
    assert.deepEqual(prefs.recents, ['a', 'b']);
    prefs = toggleFavourite(prefs, 'b');
    assert.deepEqual(prefs.favourites, ['b']);
    prefs = toggleFavourite(prefs, 'b');
    assert.deepEqual(prefs.favourites, []);
    saveSearchPrefs(prefs, storage);
    assert.deepEqual(loadSearchPrefs(storage), prefs);
  });

  test('a corrupt local prefs blob falls back to empty state', () => {
    const storage = { getItem: () => '{bad', setItem: () => {} };
    assert.deepEqual(loadSearchPrefs(storage), {
      recents: [],
      favourites: [],
      recentQueries: [],
      favouriteQueries: [],
    });
  });

  test('aliases index the stencil so a short service name finds it', () => {
    const built = buildSearchEntries({
      stencils: [{ id: 'aws-route53', name: 'Route 53 Hosted Zone', category: 'AWS', tags: 'dns' }],
      aliases: { r53: ['aws-route53'], route53: ['aws-route53'] },
    });
    assert.equal(searchEntries(built, 'r53')[0].id, 'stencil:aws-route53');
    assert.equal(searchEntries(built, 'route53')[0].id, 'stencil:aws-route53');
  });

  test('groups become searchable objects that carry their members', () => {
    const built = buildSearchEntries({
      pages: [
        {
          id: 'p1',
          name: 'Page 1',
          elements: [
            { id: 'a', type: 'stencil', text: 'Vm', groupId: 'g1', groupName: 'Web tier' },
            { id: 'b', type: 'stencil', text: 'Vmss', groupId: 'g1', groupName: 'Web tier' },
          ],
        },
      ],
    });
    const group = built.find((e) => e.kind === 'group');
    assert.ok(group);
    assert.equal(group.title, 'Web tier');
    assert.deepEqual(group.data.elementIds.sort(), ['a', 'b']);
    assert.equal(searchEntries(built, 'web tier')[0].kind, 'group');
  });

  test('an unnamed group falls back to its member text, never the raw id', () => {
    const built = buildSearchEntries({
      pages: [
        {
          id: 'p1',
          elements: [
            { id: 'a', type: 'stencil', text: 'Web VMSS', groupId: 'grp_abc123' },
            { id: 'b', type: 'stencil', text: 'App VMSS', groupId: 'grp_abc123' },
          ],
        },
      ],
    });
    const group = built.find((e) => e.kind === 'group');
    assert.equal(group.title, 'Web VMSS App VMSS');
    assert.ok(!group.title.includes('grp_abc123'));
  });

  test('the detailed search reports the true total beyond the page of results', () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      createEntry({ id: `n${i}`, scope: 'objects', kind: 'element', title: `Node ${i} service` })
    );
    const res = searchEntriesDetailed(many, 'node', { limit: 40 });
    assert.equal(res.items.length, 40);
    assert.equal(res.total, 60);
  });

  test('recent and favourite queries dedupe and are capped', () => {
    let prefs = { recents: [], favourites: [], recentQueries: [], favouriteQueries: [] };
    prefs = pushRecentQuery(prefs, 'subnet');
    prefs = pushRecentQuery(prefs, 'queue');
    prefs = pushRecentQuery(prefs, 'subnet');
    assert.deepEqual(prefs.recentQueries, ['subnet', 'queue']);

    prefs = toggleFavouriteQuery(prefs, 'vnet');
    assert.ok(prefs.favouriteQueries.includes('vnet'));
    prefs = toggleFavouriteQuery(prefs, 'vnet');
    assert.ok(!prefs.favouriteQueries.includes('vnet'));

    for (let i = 0; i < 20; i++) prefs = pushRecentQuery(prefs, `q${i}`);
    assert.ok(prefs.recentQueries.length <= 8);
  });
});

// Scale regression: the real catalog (152 templates, 580 registered stencils
// — the lazy DevOps pack loads on demand and is not in ALL_STENCILS) must
// keep index building and searching in the low milliseconds, with the
// detailed search reporting honest totals beyond the window.
import { ALL_STENCILS, SEARCH_ALIASES } from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';

describe('Search at catalog scale', () => {
  test('the full-catalog index builds and searches in milliseconds', () => {
    const t0 = performance.now();
    const entries = buildSearchEntries({
      commands: [],
      stencils: ALL_STENCILS,
      templates: BUILTIN_TEMPLATES,
      pages: [],
      activePageId: null,
      aliases: SEARCH_ALIASES,
    });
    const buildMs = performance.now() - t0;
    assert.ok(entries.length >= ALL_STENCILS.length + BUILTIN_TEMPLATES.length, 'every stencil and template is indexed');
    const t1 = performance.now();
    const res = searchEntriesDetailed(entries, 'kubernetes', { limit: 40 });
    const searchMs = performance.now() - t1;
    assert.ok(res.total >= 40, 'a common cloud term hits across the catalog');
    assert.equal(res.items.length, 40, 'the window is capped');
    assert.ok(buildMs < 250, `index build took ${buildMs.toFixed(0)}ms`);
    assert.ok(searchMs < 100, `search took ${searchMs.toFixed(0)}ms`);
  });
});
