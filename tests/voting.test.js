// tests/voting.test.js — dot voting: cast/cap/clear/tally maths plus the collab op gating.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  MAX_VOTES_PER_ELEMENT,
  castVote,
  clearVotes,
  totalVotes,
  tally,
  areVoteCountsHidden,
} from '../scene/voting.js';
import { createScene, createElement, cloneElement } from '../scene/model.js';
import { serializeScene, parseSceneJson } from '../scene/storage.js';
import { HistoryManager } from '../scene/history.js';
import { initVotingUI } from '../ui/voting.js';
import { CollabStore } from '../server/collab-server.js';

const sceneWithSticky = (text = 'Option A') => {
  const scene = createScene();
  const el = createElement('sticky', { x: 0, y: 0, text });
  scene.pages[0].elements.push(el);
  return { scene, page: scene.pages[0], el };
};

describe('Dot voting logic', () => {
  test('castVote writes the count onto el.votes, defaulting to 1', () => {
    const { el } = sceneWithSticky();
    assert.equal(el.votes, undefined);
    assert.equal(castVote(el), 1);
    assert.equal(el.votes, 1);
    assert.equal(castVote(el), 2);
    assert.equal(el.votes, 2);
  });

  test('the per-element cap stops further votes at the default of 3', () => {
    const { el } = sceneWithSticky();
    castVote(el);
    castVote(el);
    assert.equal(castVote(el), MAX_VOTES_PER_ELEMENT);
    assert.equal(MAX_VOTES_PER_ELEMENT, 3);
    assert.equal(castVote(el), 3, 'a capped element must not grow further');
    assert.equal(el.votes, 3);
  });

  test('a custom perElementCap is honoured', () => {
    const { el } = sceneWithSticky();
    assert.equal(castVote(el, { perElementCap: 1 }), 1);
    assert.equal(castVote(el, { perElementCap: 1 }), 1);
    assert.equal(el.votes, 1);
  });

  test('clearVotes zeroes every count and reports how many carried votes', () => {
    const scene = createScene();
    const a = createElement('sticky', { x: 0, y: 0, text: 'A' });
    const b = createElement('sticky', { x: 200, y: 0, text: 'B' });
    const c = createElement('sticky', { x: 400, y: 0, text: 'C' });
    scene.pages[0].elements.push(a, b, c);
    castVote(a);
    castVote(a);
    castVote(b);
    assert.equal(clearVotes(scene.pages[0].elements), 2);
    assert.deepEqual(
      scene.pages[0].elements.map((e) => e.votes),
      [0, 0, 0]
    );
  });

  test('totalVotes sums the dots across the page', () => {
    const scene = createScene();
    const a = createElement('sticky', { x: 0, y: 0, text: 'A' });
    const b = createElement('sticky', { x: 200, y: 0, text: 'B' });
    scene.pages[0].elements.push(a, b);
    castVote(a);
    castVote(a);
    castVote(b);
    assert.equal(totalVotes(scene.pages[0].elements), 3);
  });

  test('tally sorts by votes, keeps ties in page order and trims the label', () => {
    const scene = createScene();
    const a = createElement('sticky', { x: 0, y: 0, text: 'Idea Alpha\nsecond line' });
    const b = createElement('sticky', { x: 200, y: 0, text: 'Idea Beta' });
    const c = createElement('sticky', { x: 400, y: 0, text: 'Idea Gamma' });
    const d = createElement('sticky', { x: 600, y: 0, text: 'No votes yet' });
    scene.pages[0].elements.push(a, b, c, d);
    castVote(b);
    castVote(a);
    castVote(a);
    castVote(c);
    const rows = tally(scene.pages[0].elements);
    assert.deepEqual(
      rows.map((r) => r.id),
      [a.id, b.id, c.id],
      'unvoted elements are left out and ties keep page order'
    );
    assert.equal(rows[0].votes, 2);
    assert.equal(rows[0].text, 'Idea Alpha');
    assert.deepEqual(Object.keys(rows[0]), ['id', 'text', 'votes']);
  });

  test('votes persist with the board across a save/load round trip', () => {
    const { scene, el } = sceneWithSticky();
    castVote(el);
    castVote(el);
    const restored = parseSceneJson(serializeScene(scene));
    const saved = restored.pages[0].elements.find((e) => e.id === el.id);
    assert.equal(saved.votes, 2, 'votes must ride on the element, not in side storage');
  });

  test('duplicating an element carries its votes along', () => {
    const { el } = sceneWithSticky();
    castVote(el);
    const copy = cloneElement(el);
    assert.equal(copy.votes, 1);
  });
});

describe('Dot voting collab ops', () => {
  const setupRoom = () => {
    const store = new CollabStore(null);
    const { scene, el } = sceneWithSticky();
    const { roomId } = store.createRoom(scene);
    return { store, roomId, el };
  };

  test('only the teacher/editor may open or close a voting session', () => {
    const { store, roomId } = setupRoom();
    const denied = store.applyRoomOperation(roomId, 'viewer', { type: 'vote:session', active: true });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 403);

    const opened = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true });
    assert.equal(opened.ok, true);
    assert.equal(opened.broadcast.type, 'vote:session');
    assert.equal(opened.broadcast.session.active, true);
  });

  test('a viewer may cast one dot at a time while voting is open', () => {
    const { store, roomId, el } = setupRoom();
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true });

    const cast = store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });
    assert.equal(cast.ok, true);
    assert.equal(cast.broadcast.type, 'vote:cast');
    assert.equal(cast.broadcast.votes, 1);

    const room = store.rooms.get(roomId);
    const target = room.scene.pages[0].elements.find((e) => e.id === el.id);
    assert.equal(target.votes, 1, 'the server-side room scene keeps the vote for late joiners');
  });

  test('casting is rejected once the session is closed', () => {
    const { store, roomId, el } = setupRoom();
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true });
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: false });
    const denied = store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });
    assert.equal(denied.ok, false);
    assert.equal(denied.code, 403);
  });

  test('a secret session hides counts on the wire, the room keeps the tally', () => {
    const { store, roomId, el } = setupRoom();
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: true });

    // The cast broadcast carries null, not the count.
    const cast = store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });
    assert.equal(cast.ok, true);
    assert.equal(cast.broadcast.votes, null, 'the wire never carries the live count');

    // ...but the server's own scene still tallies for the reveal.
    const room = store.rooms.get(roomId);
    const target = room.scene.pages[0].elements.find((e) => e.id === el.id);
    assert.equal(target.votes, 1, 'the room scene is the only tally');

    // Every client-facing scene is stripped: REST join for any role.
    for (const [label, token] of [['teacher', room.teacherToken], ['viewer', '']]) {
      const pub = store.getRoomPublicState(roomId, token);
      const seenEl = pub.data.scene.pages[0].elements.find((e) => e.id === el.id);
      assert.equal(seenEl.votes, undefined, `${label} join payload must not carry counts`);
    }

    // A teacher scene sync mid-secret cannot clobber the tally with stale
    // local counts.
    const teacherScene = structuredClone(store.rooms.get(roomId).scene);
    const teacherEl = teacherScene.pages[0].elements.find((e) => e.id === el.id);
    teacherEl.votes = 0;
    teacherEl.updatedAt = Date.now();
    store.applyRoomOperation(roomId, 'teacher', { type: 'scene:sync', scene: teacherScene });
    const afterMerge = store.rooms.get(roomId).scene.pages[0].elements.find((e) => e.id === el.id);
    assert.equal(afterMerge.votes, 1, 'merge protection restores the secret tally');
  });

  test('closing or revealing the session broadcasts the tallied counts', () => {
    const { store, roomId, el } = setupRoom();
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: true });
    store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });
    store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });

    // Reveal without closing (setSecret(false) parity).
    const revealed = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true });
    assert.equal(revealed.broadcast.counts.length, 1);
    assert.equal(revealed.broadcast.counts[0].votes, 2);
    assert.equal(revealed.broadcast.counts[0].elementId, el.id);

    // Closing also reveals (a fresh secret session accumulates from there).
    store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: true });
    store.applyRoomOperation(roomId, 'viewer', { type: 'vote:cast', elementId: el.id });
    const closed = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: false });
    assert.equal(closed.broadcast.session.active, false);
    assert.equal(closed.broadcast.counts.length, 1);
    assert.equal(closed.broadcast.counts[0].votes, 3, 'the tally spans sessions until cleared');

    // Opening a session never carries counts.
    const reopened = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: true });
    assert.equal(reopened.broadcast.counts, null);
  });
});

describe('Remote votes are board state', () => {
  // A remote dot must reach history and autosave on the receiving client. The
  // pre-fix version mutated el.votes in memory only: a teacher undoing their
  // own stroke restored a pre-vote snapshot and broadcast the erasure of the
  // class's votes to everyone.
  const votesOn = (page, id) => page.elements.find((e) => e.id === id)?.votes;

  const fakeApp = (scene, page) => {
    const history = new HistoryManager();
    history.initPage(page);
    const calls = { commits: 0, autosaves: 0, broadcasts: 0, toasts: [] };
    const app = {
      scene,
      getPage: () => page,
      history,
      requestRender() {},
      updateUI() {},
      commitChange() {
        calls.commits++;
        history.record(page);
        app.scheduleAutosave();
      },
      scheduleAutosave() {
        calls.autosaves++;
      },
      collab: {
        broadcastSceneChange() {
          calls.broadcasts++;
        },
        broadcastVoteSession() {},
      },
      dialogs: {
        showToast(msg) {
          calls.toasts.push(msg);
        },
      },
    };
    return { app, history, calls };
  };

  test('a remote vote goes through commitChange and survives as a redoable step', () => {
    const { scene, page, el } = sceneWithSticky();
    const { app, history, calls } = fakeApp(scene, page);
    const voting = initVotingUI(app);

    voting.applyRemoteVote(page.id, el.id, 2);
    assert.equal(votesOn(page, el.id), 2);
    assert.equal(calls.commits, 1, 'the vote must use the shared element pipeline');
    assert.ok(history.canUndo(page), 'the vote is a recorded history step');
    assert.equal(calls.autosaves, 1, 'the vote is autosaved');

    // Undo reverts the vote as a visible step (not a silent erasure), and
    // redo brings it back.
    history.undo(page);
    assert.equal(votesOn(page, el.id), undefined, 'undo reverts the vote openly');
    history.redo(page);
    assert.equal(votesOn(page, el.id), 2, 'redo restores the vote');
  });

  test('a vote on a non-active page records history, autosave and broadcast', () => {
    const { scene, page } = sceneWithSticky();
    const other = { id: 'page-2', elements: [], camera: { x: 0, y: 0, zoom: 1 } };
    scene.pages.push(other);
    const el2 = createElement('sticky', { x: 0, y: 0, text: 'Other page idea' });
    other.elements.push(el2);
    const { app, history, calls } = fakeApp(scene, page);
    // A page with history of its own: the pre-vote state is the baseline the
    // vote's record must stack on top of.
    history.initPage(other);
    const voting = initVotingUI(app);

    voting.applyRemoteVote(other.id, el2.id, 3);
    assert.equal(votesOn(other, el2.id), 3);
    assert.ok(history.canUndo(other), 'the other page got its own history entry');
    assert.equal(calls.commits, 0, 'commitChange records the active page only');
    assert.ok(calls.autosaves >= 1 && calls.broadcasts >= 1, 'autosave and scene sync fired');
    history.undo(other);
    assert.equal(votesOn(other, el2.id), undefined, 'undo reverts the other page vote openly');
  });

  test('stop announces results across every page, not just the active one', () => {
    const { scene, page } = sceneWithSticky();
    const other = { id: 'page-2', elements: [], camera: { x: 0, y: 0, zoom: 1 } };
    scene.pages.push(other);
    const el2 = createElement('sticky', { x: 0, y: 0, text: 'Other page idea' });
    other.elements.push(el2);
    castVote(el2);
    const { app, calls } = fakeApp(scene, page);
    const voting = initVotingUI(app);

    voting.start();
    voting.stop();
    assert.ok(
      calls.toasts.some((m) => m.includes('Other page idea')),
      `results toast missed the other page's item: ${JSON.stringify(calls.toasts)}`
    );
  });
});

describe('Vote casting paths', () => {
  const votingApp = (scene, page, { viewer }) => {
    const history = new HistoryManager();
    history.initPage(page);
    const casts = [];
    const calls = { commits: 0, toasts: [] };
    const app = {
      scene,
      getPage: () => page,
      history,
      commitChange() {
        calls.commits++;
        history.record(page);
      },
      scheduleAutosave() {},
      requestRender() {},
      updateUI() {},
      collab: {
        canEditBoard: () => !viewer,
        broadcastVoteCast: (p, e, v) => casts.push([p, e, v]),
        broadcastVoteSession() {},
        broadcastSceneChange() {},
      },
      dialogs: {
        showToast(msg) {
          calls.toasts.push(msg);
        },
      },
    };
    return { app, history, casts, calls };
  };

  test('a viewer never mutates locally — the authoritative broadcast applies the dot', () => {
    const { scene, page, el } = sceneWithSticky();
    const { app, casts } = votingApp(scene, page, { viewer: true });
    const voting = initVotingUI(app);
    // A student never starts the session; the teacher's toggle activates it.
    voting.applyRemoteSession({ active: true });

    const ok = voting.castVoteOn(el);
    assert.equal(ok, true);
    assert.equal(casts.length, 1, 'the dot was sent to the server channel');
    assert.equal(el.votes, undefined, 'no optimistic local mutation to roll back');

    // The server's authoritative count arrives for everyone, sender included.
    voting.applyRemoteVote(page.id, el.id, 1);
    assert.equal(page.elements.find((e) => e.id === el.id).votes, 1);
  });

  test('a viewer at the cap is warned from the last broadcast count, without casting', () => {
    const { scene, page, el } = sceneWithSticky();
    const { app, casts, calls } = votingApp(scene, page, { viewer: true });
    const voting = initVotingUI(app);
    voting.applyRemoteSession({ active: true });
    // The local view already shows the maximum from the server's broadcasts.
    voting.applyRemoteVote(page.id, el.id, MAX_VOTES_PER_ELEMENT);

    const ok = voting.castVoteOn(el);
    assert.equal(ok, false);
    assert.equal(casts.length, 0, 'an at-cap click must not travel to the server');
    assert.ok(
      calls.toasts.some((m) => m.includes('maximum')),
      `no cap feedback: ${JSON.stringify(calls.toasts)}`
    );
    assert.equal(page.elements.find((e) => e.id === el.id).votes, MAX_VOTES_PER_ELEMENT);
  });

  test('a board owner commits locally and never uses the cast channel', () => {
    const { scene, page, el } = sceneWithSticky();
    const { app, casts, calls } = votingApp(scene, page, { viewer: false });
    const voting = initVotingUI(app);
    voting.start();

    const ok = voting.castVoteOn(el);
    assert.equal(ok, true);
    assert.equal(el.votes, 1, 'the owner applies the dot immediately');
    assert.equal(casts.length, 0, 'the cast channel is for viewers only');
    assert.equal(calls.commits, 1, 'the vote went through commitChange');
    assert.ok(app.history.canUndo(page), 'the vote is a history step');
  });
});

describe('Secret (hidden-until-reveal) voting', () => {
  const secretApp = (scene, page, { viewer = false } = {}) => {
    const history = new HistoryManager();
    history.initPage(page);
    const sessions = [];
    const calls = { toasts: [] };
    const app = {
      scene,
      getPage: () => page,
      history,
      commitChange() {
        history.record(page);
      },
      scheduleAutosave() {},
      requestRender() {},
      updateUI() {},
      collab: {
        canEditBoard: () => !viewer,
        broadcastVoteCast() {},
        broadcastVoteSession: (active, secret) => sessions.push([active, secret]),
        broadcastSceneChange() {},
      },
      dialogs: {
        showToast(msg) {
          calls.toasts.push(msg);
        },
      },
    };
    return { app, sessions, calls };
  };

  test('the teacher hides counts mid-session and reveals without closing', () => {
    const { scene, page } = sceneWithSticky();
    const { app, sessions } = secretApp(scene, page);
    const voting = initVotingUI(app);
    voting.start();
    assert.equal(voting.areCountsHidden(), false);

    voting.setSecret(true);
    assert.equal(voting.isSecret(), true);
    assert.equal(voting.areCountsHidden(), true, 'counts must be hidden while secret');
    assert.deepEqual(sessions.at(-1), [true, true], 'the secret flag rides the session broadcast');
    assert.equal(areVoteCountsHidden(), true, 'the renderer flag is set');

    voting.setSecret(false);
    assert.equal(voting.areCountsHidden(), false, 'reveal shows the counts again');
    assert.deepEqual(sessions.at(-1), [true, false]);
    assert.equal(voting.isActive(), true, 'reveal does not close the session');
  });

  test('closing the session always reveals — results are announced, counts reappear', () => {
    const { scene, page } = sceneWithSticky();
    const el = page.elements[0];
    castVote(el);
    const { app, sessions, calls } = secretApp(scene, page);
    const voting = initVotingUI(app);
    voting.start();
    voting.setSecret(true);

    voting.stop();
    assert.equal(voting.areCountsHidden(), false, 'stop is the reveal');
    assert.equal(voting.isSecret(), false);
    assert.deepEqual(sessions.at(-1), [false, false], 'the closed session clears the secret flag');
    assert.ok(calls.toasts.some((m) => m.includes('Voting results')), `results must be announced: ${JSON.stringify(calls.toasts)}`);
  });

  test('a viewer receives the secret flag and cannot change it', () => {
    const { scene, page } = sceneWithSticky();
    const { app, sessions } = secretApp(scene, page, { viewer: true });
    const voting = initVotingUI(app);

    voting.applyRemoteSession({ active: true, secret: true });
    assert.equal(voting.isActive(), true);
    assert.equal(voting.areCountsHidden(), true, 'a viewer hides the counts too');

    voting.setSecret(false);
    assert.equal(voting.areCountsHidden(), true, 'students cannot reveal the votes');
    assert.equal(sessions.length, 0, 'a rejected toggle must not broadcast');

    // The teacher's reveal arrives for everyone.
    voting.applyRemoteSession({ active: true, secret: false });
    assert.equal(voting.areCountsHidden(), false);

    // And a fresh non-secret session starts revealed.
    voting.applyRemoteSession({ active: false });
    voting.applyRemoteSession({ active: true });
    assert.equal(voting.areCountsHidden(), false);
  });

  test('a hidden cast (votes null) applies nothing; the reveal rebuilds counts', () => {
    const { scene, page } = sceneWithSticky();
    const { app } = secretApp(scene, page, { viewer: true });
    const voting = initVotingUI(app);
    const el = page.elements[0];

    voting.applyRemoteSession({ active: true, secret: true });
    // Server-authoritative but hidden: null must not zero or bump anything.
    el.votes = 0;
    voting.applyRemoteVote(page.id, el.id, null);
    assert.equal(el.votes, 0, 'a null count leaves the local tally untouched');

    // The reveal payload is the first time counts reach the client.
    voting.applyRemoteSession({ active: true, secret: false, counts: [{ pageId: page.id, elementId: el.id, votes: 4 }] });
    assert.equal(el.votes, 4, 'reveal counts rebuild the local scene');
    assert.equal(voting.areCountsHidden(), false);

    // Garbage counts never poison the scene.
    voting.applyRemoteSession({ active: true, secret: true });
    voting.applyRemoteSession({ active: false, counts: [{ pageId: page.id, elementId: el.id, votes: 'x' }] });
    assert.equal(el.votes, 0, 'a non-numeric reveal count falls back to 0');
  });

  test('setSecret outside an active session is a no-op', () => {
    const { scene, page } = sceneWithSticky();
    const { app, sessions } = secretApp(scene, page);
    const voting = initVotingUI(app);
    voting.setSecret(true);
    assert.equal(voting.isSecret(), false);
    assert.equal(sessions.length, 0);
  });

  test('the server carries the secret flag in the room-wide vote:session broadcast', () => {
    const store = new CollabStore(null);
    const { scene } = sceneWithSticky();
    const { roomId } = store.createRoom(scene);
    const opened = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: true });
    assert.equal(opened.ok, true);
    assert.equal(opened.broadcast.session.secret, true, 'the broadcast must carry the secret flag');
    assert.equal(opened.broadcast.session.active, true);

    // Garbage secret values normalize to false, never to hidden-by-default.
    const garbage = store.applyRoomOperation(roomId, 'teacher', { type: 'vote:session', active: true, secret: 'yes' });
    assert.equal(garbage.broadcast.session.secret, false);
  });
});
