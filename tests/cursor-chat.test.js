// tests/cursor-chat.test.js — cursor chat and anchored emotes: the ephemeral social layer.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createScene, createElement } from '../scene/model.js';
import { CollabStore } from '../server/collab-server.js';
import { CollabClient } from '../scene/collab-client.js';

const sceneWithSticky = (text = 'Option A') => {
  const scene = createScene();
  const el = createElement('sticky', { x: 0, y: 0, text });
  scene.pages[0].elements.push(el);
  return { scene, page: scene.pages[0], el };
};

const setupRoom = () => {
  const store = new CollabStore(null);
  const { scene, el } = sceneWithSticky();
  const { roomId } = store.createRoom(scene);
  return { store, roomId, el, scene };
};

describe('Cursor chat server op', () => {
  test('a viewer may send a cursor chat — the op sits before the teacher gate', () => {
    const { store, roomId } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'chat:cursor',
      text: 'Look at this box!',
      authorName: 'Alex',
      color: '#059669',
      x: 120,
      y: 240,
    });
    assert.equal(out.ok, true);
    assert.equal(out.broadcast.type, 'chat:cursor');
    assert.equal(out.broadcast.chat.text, 'Look at this box!');
  });

  test('empty or whitespace-only text is rejected with 400', () => {
    const { store, roomId } = setupRoom();
    for (const text of ['', '   ', '\t\n']) {
      const out = store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text, x: 0, y: 0 });
      assert.equal(out.ok, false, JSON.stringify(text));
      assert.equal(out.code, 400);
    }
  });

  test('a 200-character text is trimmed to 140 in the broadcast', () => {
    const { store, roomId } = setupRoom();
    const long = 'a'.repeat(200);
    const out = store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text: long, x: 0, y: 0 });
    assert.equal(out.ok, true);
    assert.equal(out.broadcast.chat.text.length, 140);
    assert.equal(out.broadcast.chat.text, 'a'.repeat(140));
  });

  test('the broadcast chat carries sender meta, page and world position', () => {
    const { store, roomId, scene } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'chat:cursor',
      text: 'hello',
      authorName: 'Alex',
      color: '#059669',
      x: 42.5,
      y: -17,
      clientId: 'cli_student',
    });
    const chat = out.broadcast.chat;
    assert.equal(chat.clientId, 'cli_student');
    assert.equal(chat.name, 'Alex');
    assert.equal(chat.color, '#059669');
    assert.equal(chat.pageId, scene.pages[0].id);
    assert.equal(chat.x, 42.5);
    assert.equal(chat.y, -17);
    assert.ok(chat.id);
    assert.ok(Number.isFinite(chat.at));
    assert.equal(out.broadcast.senderClientId, 'cli_student');
  });

  test('a non-finite world position is rejected with 400', () => {
    const { store, roomId } = setupRoom();
    const bad = store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text: 'hi', x: NaN, y: 0 });
    assert.equal(bad.ok, false);
    assert.equal(bad.code, 400);
  });
});

describe('Anchored emote server op', () => {
  test('reaction:send with an elementId round-trips through the broadcast', () => {
    const { store, roomId, el } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'reaction:send',
      emoji: '🎉',
      authorName: 'Alex',
      elementId: el.id,
      x: 10,
      y: -24,
    });
    assert.equal(out.ok, true);
    assert.equal(out.broadcast.type, 'reaction:burst');
    assert.equal(out.broadcast.reaction.elementId, el.id);
    assert.equal(out.broadcast.reaction.x, 10);
    assert.equal(out.broadcast.reaction.y, -24);
  });

  test('garbage anchors are stripped: non-string elementId, NaN coords', () => {
    const { store, roomId } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'reaction:send',
      emoji: '👍',
      authorName: 'Alex',
      elementId: 12345,
      x: NaN,
      y: Infinity,
    });
    assert.equal(out.ok, true, 'an unanchorable emote still fires as a plain toast reaction');
    const rx = out.broadcast.reaction;
    assert.equal('elementId' in rx, false, 'non-string elementId must not ride the broadcast');
    assert.equal('x' in rx, false, 'NaN x must not ride the broadcast');
    assert.equal('y' in rx, false, 'Infinity y must not ride the broadcast');
  });

  test('a plain reaction:send keeps its existing payload shape', () => {
    const { store, roomId } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'reaction:send',
      emoji: '👍',
      authorName: 'Alex',
    });
    const rx = out.broadcast.reaction;
    assert.equal('elementId' in rx, false);
    assert.equal('x' in rx, false);
    assert.equal(rx.emoji, '👍');
    assert.equal(rx.authorName, 'Alex');
  });

  test('a world-point emote carries its pageId so it cannot leak onto other pages', () => {
    const { store, roomId } = setupRoom();
    const out = store.applyRoomOperation(roomId, 'viewer', {
      type: 'reaction:send',
      emoji: '🎉',
      authorName: 'Alex',
      x: 40,
      y: 60,
      pageId: 'page-1',
    });
    assert.equal(out.ok, true);
    assert.equal(out.broadcast.reaction.pageId, 'page-1');

    // Garbage pageId is stripped, never rejected — the emote still fires.
    const garbage = store.applyRoomOperation(roomId, 'viewer', {
      type: 'reaction:send',
      emoji: '👍',
      authorName: 'Alex',
      x: 0,
      y: 0,
      pageId: { not: 'a string' },
    });
    assert.equal(garbage.ok, true);
    assert.equal('pageId' in garbage.broadcast.reaction, false);
  });
});

describe('Cursor chat client state', () => {
  const fakeApp = (page) => ({
    scene: { pages: [page] },
    getPage: () => page,
    classroomUI: { getStudentName: () => 'Alex', update() {} },
    requestRender() {},
    updateUI() {},
    dialogs: { showToast() {} },
  });

  const clientOn = (page) => new CollabClient(fakeApp(page));

  test('broadcastCursorChat applies the sender bubble optimistically', () => {
    const { page } = sceneWithSticky();
    const collab = clientOn(page);
    const chat = collab.broadcastCursorChat('Check this!', page.id, { x: 100, y: 200 });
    assert.equal(chat.text, 'Check this!');
    assert.equal(collab.cursorChats.length, 1);
    assert.equal(collab.cursorChats[0].clientId, collab.clientId);
    assert.ok(collab.cursorChats[0].receivedAt, 'the optimistic entry stamps receivedAt like remote ones');
    assert.equal(collab.activeCursorChats().length, 1);
  });

  test('empty text or a missing world point sends nothing', () => {
    const { page } = sceneWithSticky();
    const collab = clientOn(page);
    assert.equal(collab.broadcastCursorChat('   ', page.id, { x: 0, y: 0 }), null);
    assert.equal(collab.broadcastCursorChat('hi', page.id, null), null);
    assert.equal(collab.cursorChats.length, 0);
  });

  test('cursorChats is capped at 12 and activeCursorChats drops entries older than 15s', () => {
    const { page } = sceneWithSticky();
    const collab = clientOn(page);
    for (let i = 0; i < 14; i++) {
      collab.broadcastCursorChat(`msg ${i}`, page.id, { x: i, y: 0 });
    }
    assert.equal(collab.cursorChats.length, 12, 'oldest entries are dropped');
    assert.equal(collab.cursorChats[0].text, 'msg 2');

    collab.cursorChats[0].receivedAt = Date.now() - 16000;
    assert.equal(collab.activeCursorChats().length, 11, 'expired bubbles stop rendering');
  });

  test('_handleServerMessage pushes remote bubbles and skips the optimistic echo', () => {
    const { page } = sceneWithSticky();
    const collab = clientOn(page);
    collab._handleServerMessage({
      type: 'chat:cursor',
      chat: { id: 'cx_x', clientId: 'cli_other', name: 'Sam', color: '#db2777', text: 'hey', pageId: page.id, x: 5, y: 6, at: 1 },
    });
    assert.equal(collab.cursorChats.length, 1);
    assert.equal(collab.cursorChats[0].name, 'Sam');
    assert.ok(collab.cursorChats[0].receivedAt);

    // The server excludes the sender's socket, but the client guard makes the
    // optimistic pairing explicit: an echoed own bubble must not duplicate.
    collab._handleServerMessage({
      type: 'chat:cursor',
      chat: { id: 'cx_own', clientId: collab.clientId, name: 'Alex', text: 'dupe', pageId: page.id, x: 0, y: 0, at: 1 },
    });
    assert.equal(collab.cursorChats.length, 1);
  });

  test('sendReaction with an anchor carries elementId and point into recentReactions', () => {
    const { page, el } = sceneWithSticky();
    const collab = clientOn(page);
    collab.sendReaction('❤️', { elementId: el.id, x: el.x + el.w / 2, y: el.y - 24 });
    const rx = collab.recentReactions[collab.recentReactions.length - 1];
    assert.equal(rx.emoji, '❤️');
    assert.equal(rx.elementId, el.id);
    assert.equal(rx.pageId, page.id, 'a world-point emote is stamped with its page');
    assert.ok(Number.isFinite(rx.x) && Number.isFinite(rx.y));
  });
});
