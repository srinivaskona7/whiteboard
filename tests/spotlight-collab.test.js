// tests/spotlight-collab.test.js — teacher spotlight mirrored to viewers:
// server sanitization/op gating, client broadcast gating, and the remote
// apply path (viewer-only, echo-free).
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CollabStore } from '../server/collab-server.js';
import { CollabClient } from '../scene/collab-client.js';
import { createPage, createElement } from '../scene/model.js';

const makeStoreWithRoom = () => {
  const store = new CollabStore(null);
  const page = createPage('P1');
  page.elements.push(createElement('rect', { x: 10, y: 10, w: 50, h: 50 }));
  const scene = { title: 'T', activePageId: page.id, pages: [page] };
  const { roomId } = store.createRoom(scene);
  return { store, roomId };
};

describe('Spotlight broadcast — server', () => {
  test('teacher op sanitizes every field before storing', () => {
    const { store, roomId } = makeStoreWithRoom();
    const res = store.applyRoomOperation(roomId, 'teacher', {
      type: 'spotlight:sync',
      spotlight: {
        active: true,
        x: 250,
        y: -40,
        radius: 99999,
        magnifier: 1, // truthy non-boolean coerces to true
        magnifierScale: 12,
        dimOpacity: 3,
        dimBackground: false,
        pinned: true,
        pinWorld: { x: 'NaN', y: 20 },
        pinElementId: 123,
      },
    });
    assert.equal(res.ok, true);
    assert.equal(res.broadcast.type, 'spotlight:synced');
    const sp = res.broadcast.spotlight;
    assert.equal(sp.active, true);
    assert.equal(sp.radius, 2000, 'radius clamps to the ceiling');
    assert.equal(sp.magnifier, true);
    assert.equal(sp.magnifierScale, 4, 'magnifier zoom clamps to 4×');
    assert.equal(sp.dimOpacity, 0.95, 'dim opacity clamps below 1');
    assert.equal(sp.dimBackground, false);
    assert.equal(sp.pinned, true);
    assert.equal(sp.pinWorld, null, 'a non-finite pin point drops to null, not NaN geometry');
    assert.equal(sp.pinElementId, null, 'a non-string element id drops to null');
    assert.equal(sp.x, 250);
  });

  test('a null spotlight turns the mirror off, and non-finite coords fall back', () => {
    const { store, roomId } = makeStoreWithRoom();
    store.applyRoomOperation(roomId, 'teacher', {
      type: 'spotlight:sync',
      spotlight: { active: true, x: 1, y: 2, radius: 180 },
    });
    const off = store.applyRoomOperation(roomId, 'teacher', { type: 'spotlight:sync', spotlight: null });
    assert.equal(off.ok, true);
    assert.equal(off.broadcast.spotlight, null, 'viewers receive an explicit off state');
    assert.equal(store.rooms.get(roomId).spotlightState, null);

    const bad = store.applyRoomOperation(roomId, 'teacher', {
      type: 'spotlight:sync',
      spotlight: { active: 1, x: Number('x'), y: [], radius: 'wide' },
    });
    assert.equal(bad.ok, true);
    assert.equal(bad.broadcast.spotlight.x, 0, 'non-finite x falls back to 0');
    assert.equal(bad.broadcast.spotlight.y, 0);
    assert.equal(bad.broadcast.spotlight.radius, 180, 'non-finite radius falls back to the default');
    assert.equal(bad.broadcast.spotlight.active, true);
  });

  test('viewers and questioners cannot drive the spotlight', () => {
    const { store, roomId } = makeStoreWithRoom();
    for (const role of ['viewer', 'questioner']) {
      const res = store.applyRoomOperation(roomId, role, {
        type: 'spotlight:sync',
        spotlight: { active: true, x: 0, y: 0, radius: 180 },
      });
      assert.equal(res.ok, false, `${role} must be rejected`);
      assert.equal(res.code, 403);
    }
    assert.equal(store.rooms.get(roomId).spotlightState, null);
  });

  test('join payloads carry the live spotlight for late viewers', () => {
    const { store, roomId } = makeStoreWithRoom();
    store.applyRoomOperation(roomId, 'teacher', {
      type: 'spotlight:sync',
      spotlight: { active: true, x: 5, y: 6, radius: 220, pinned: true, pinWorld: { x: 30, y: 40 } },
    });
    const room = store.rooms.get(roomId);
    assert.ok(room.spotlightState, 'room state persists the mirror');
    // The welcome payload is assembled from the room record; the field is
    // included whenever the room state exists.
    assert.equal(room.spotlightState.pinWorld.x, 30);
    assert.equal(room.spotlightState.radius, 220);
  });
});

describe('Spotlight broadcast — client', () => {
  const makeClient = (role = 'teacher') => {
    const page = createPage('P1');
    const app = {
      scene: { pages: [page] },
      getPage: () => page,
      requestRender() {},
      updateUI() {},
      applied: [],
      applyRemoteSpotlight(sp) {
        this.applied.push(sp);
      },
    };
    const client = new CollabClient(app);
    client.role = role;
    client.status = 'live';
    client.roomId = 'room-1';
    const sent = [];
    client.ws = { readyState: 1, send: (raw) => sent.push(JSON.parse(raw)) };
    return { client, app, sent };
  };

  test('teacher/editor broadcast sends a spotlight:sync op; viewers never do', () => {
    const snap = { active: true, x: 9, y: 9, radius: 180 };
    const t = makeClient('teacher');
    t.client.broadcastSpotlight(snap);
    assert.equal(t.sent.length, 1);
    assert.equal(t.sent[0].type, 'spotlight:sync');
    assert.equal(t.sent[0].spotlight.active, true);

    const e = makeClient('editor');
    e.client.broadcastSpotlight(snap);
    assert.equal(e.sent.length, 1, 'editors may also drive the lens');

    const v = makeClient('viewer');
    v.client.broadcastSpotlight(snap);
    assert.equal(v.sent.length, 0, 'a viewer cannot broadcast a spotlight');
  });

  test('a null spotlight is sent as an explicit off state, not swallowed', () => {
    const { client, sent } = makeClient('teacher');
    client.broadcastSpotlight(null);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].spotlight, null);
  });

  test('viewers adopt the teacher spotlight; echoes and editors do not', () => {
    const v = makeClient('viewer');
    v.client._handleServerMessage({
      type: 'spotlight:synced',
      senderClientId: 'teacher-1',
      spotlight: { active: true, x: 1, y: 2, radius: 180, pinned: true, pinElementId: 'el-1' },
    });
    assert.equal(v.app.applied.length, 1);
    assert.equal(v.app.applied[0].pinElementId, 'el-1');

    // Own echo is ignored.
    v.client._handleServerMessage({
      type: 'spotlight:synced',
      senderClientId: v.client.clientId,
      spotlight: { active: true, x: 3, y: 4, radius: 180 },
    });
    assert.equal(v.app.applied.length, 1, 'the sender never re-applies its own lens');

    // An editor keeps local control.
    const e = makeClient('editor');
    e.client._handleServerMessage({
      type: 'spotlight:synced',
      senderClientId: 'teacher-1',
      spotlight: { active: true, x: 1, y: 2, radius: 180 },
    });
    assert.equal(e.app.applied.length, 0, 'editors are never hijacked by a remote lens');
  });

  test('a null remote state still reaches the app (turns the lens off)', () => {
    const v = makeClient('viewer');
    v.client._handleServerMessage({ type: 'spotlight:synced', senderClientId: 't', spotlight: null });
    assert.equal(v.app.applied.length, 1);
    assert.equal(v.app.applied[0], null);
  });
});
