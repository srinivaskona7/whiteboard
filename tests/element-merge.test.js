// tests/element-merge.test.js — element-level scene sync on the client: a
// full-scene broadcast must be a recency UNION, not a wholesale replace (the
// old replace reverted a second client's in-flight edit — the vote race).
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CollabClient } from '../scene/collab-client.js';
import { createPage, createElement } from '../scene/model.js';

const makeClient = () => {
  const page = createPage('Board', 'P1'); // (name, id) — remote pages must match by id
  page.elements.push(createElement('sticky', { x: 10, y: 10, w: 100, h: 100, text: 'shared' }));
  const app = {
    scene: { title: 'T', activePageId: 'P1', pages: [page] },
    getPage: () => page,
    requestRender() {},
    updateUI() {},
  };
  const client = new CollabClient(app);
  return { client, app, page };
};

describe('Element-level remote scene merge', () => {
  test('a newer local edit survives an older full-scene broadcast (the vote race)', () => {
    const { client, app, page: seed } = makeClient();
    const page = () => app.scene.pages[0];
    const el = page().elements[0];

    // A vote lands locally at t=200…
    el.votes = 3;
    el.updatedAt = 200;
    // …and a slightly older teacher scene (t=100) arrives afterwards.
    const remote = {
      title: 'T',
      activePageId: 'P1',
      pages: [
        {
          id: 'P1',
          camera: seed.camera,
          elements: [{ ...el, votes: 0, updatedAt: 100 }],
        },
      ],
    };
    client._applyRemoteScene(remote, []);
    assert.equal(page().elements[0].votes, 3, 'the newer local vote must not be reverted');
    assert.equal(page().elements[0].updatedAt, 200);
  });

  test('a newer remote element wins, ties go to the remote copy', () => {
    const { client, app, page: seed } = makeClient();
    const page = () => app.scene.pages[0];
    const el = page().elements[0];
    el.updatedAt = 100;
    const remote = {
      title: 'T',
      activePageId: 'P1',
      pages: [{ id: 'P1', camera: seed.camera, elements: [{ ...el, x: 999, updatedAt: 300 }] }],
    };
    client._applyRemoteScene(remote, []);
    assert.equal(page().elements[0].x, 999);

    el.updatedAt = 300;
    client._applyRemoteScene(remote, []);
    assert.equal(
      page().elements[0].x,
      999,
      'on equal updatedAt the remote (server-merged) copy wins, mirroring the server'
    );
  });

  test('local-only elements survive; deletedIds still delete', () => {
    const { client, app, page: seed } = makeClient();
    const page = () => app.scene.pages[0];
    const localOnly = createElement('sticky', { x: 300, y: 300, w: 80, h: 80, text: 'mine' });
    seed.elements.push(localOnly);
    const el = page().elements[0];

    const remote = {
      title: 'T',
      activePageId: 'P1',
      pages: [{ id: 'P1', camera: seed.camera, elements: [el] }],
    };
    client._applyRemoteScene(remote, []);
    assert.ok(page().elements.some((e) => e.id === localOnly.id), 'absence is not deletion');

    client._applyRemoteScene(remote, [localOnly.id]);
    assert.ok(!page().elements.some((e) => e.id === localOnly.id), 'deletedIds deletes');
  });

  test('cameras are preserved through the merge', () => {
    const { client, app, page: seed } = makeClient();
    const page = () => app.scene.pages[0];
    seed.camera = { x: 55, y: 66, zoom: 1.5 };
    const remote = {
      title: 'T',
      activePageId: 'P1',
      pages: [
        { id: 'P1', camera: { x: 0, y: 0, zoom: 1 }, elements: page.elements },
      ],
    };
    client._applyRemoteScene(remote, []);
    assert.deepEqual(page().camera, { x: 55, y: 66, zoom: 1.5 });
  });
});

describe('Snapshot loads bypass the merge (replace mode)', () => {
  test("a stored snapshot shows exactly what it stored — no recency union", () => {
    // A #/b/{id} link shares element ids with the creator's live board; the
    // union would show the creator's CURRENT board, not the snapshot.
    const { client, app, page } = makeClient();
    const el = page.elements[0];
    el.text = 'EDITED AFTER SNAPSHOT';
    el.updatedAt = 999;
    const snapshotScene = {
      title: 'T',
      activePageId: 'P1',
      pages: [{ id: 'P1', camera: page.camera, elements: [{ ...el, text: 'SNAPSHOT CONTENT', updatedAt: 100 }] }],
    };
    client._applyRemoteScene(snapshotScene, [], 'replace');
    assert.equal(
      app.scene.pages[0].elements[0].text,
      'SNAPSHOT CONTENT',
      'a snapshot link must show the stored content'
    );
  });
});
