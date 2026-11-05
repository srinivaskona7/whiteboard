// tests/rate-limit.test.js — per-client token buckets on the student-writable
// social ops (§25 recorded follow-up): a flooding viewer gets 429s, the room
// never sees the spam, and board ops (scene:sync) stay unlimited.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { CollabStore } from '../server/collab-server.js';
import { createPage, createElement } from '../scene/model.js';

const makeStore = () => {
  const store = new CollabStore(null);
  const page = createPage('Board', 'P1');
  page.elements.push(createElement('sticky', { x: 10, y: 10, w: 100, h: 100, text: 'x' }));
  const scene = { title: 'T', activePageId: 'P1', pages: [page] };
  const { roomId } = store.createRoom(scene);
  return { store, roomId };
};

describe('Social-op rate limiting', () => {
  test('chat:cursor bursts then 429s; the room never sees the flood', () => {
    const { store, roomId } = makeStore();
    const results = [];
    for (let i = 0; i < 8; i++) {
      results.push(
        store.applyRoomOperation(roomId, 'viewer', {
          type: 'chat:cursor',
          clientId: 'student-1',
          text: `msg ${i}`,
          x: 0,
          y: 0,
        })
      );
    }
    assert.deepEqual(results.map((r) => r.ok), [true, true, true, true, true, false, false, false]);
    assert.equal(results[5].code, 429);
    assert.equal(results[7].ok, false);
  });

  test('tokens refill over time (0.5/s for chat)', () => {
    const { store, roomId } = makeStore();
    for (let i = 0; i < 5; i++) {
      assert.equal(
        store.applyRoomOperation(roomId, 'viewer', {
          type: 'chat:cursor', clientId: 'student-2', text: 'hi', x: 0, y: 0,
        }).ok, true
      );
    }
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'chat:cursor', clientId: 'student-2', text: 'hi', x: 0, y: 0,
      }).code, 429
    );
    // Age the bucket 2.5s: 0.5 tokens/s refills ~1.25 — one op passes again.
    const bucket = store.opBuckets.get(`${roomId}|student-2|chat:cursor`);
    bucket.at -= 2500;
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'chat:cursor', clientId: 'student-2', text: 'hi again', x: 0, y: 0,
      }).ok, true
    );
  });

  test('buckets are per-client — one spammer never blocks a classmate', () => {
    const { store, roomId } = makeStore();
    for (let i = 0; i < 5; i++) {
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'chat:cursor', clientId: 'spammer', text: 'buy this', x: 0, y: 0,
      });
    }
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'chat:cursor', clientId: 'spammer', text: 'buy this', x: 0, y: 0,
      }).ok, false
    );
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'chat:cursor', clientId: 'quiet-kid', text: 'real question', x: 0, y: 0,
      }).ok, true
    );
  });

  test('reactions and questions get their own budgets', () => {
    const { store, roomId } = makeStore();
    for (let i = 0; i < 10; i++) {
      assert.equal(
        store.applyRoomOperation(roomId, 'viewer', {
          type: 'reaction:send', clientId: 's', emoji: '🎉',
        }).ok, true, `reaction ${i}`
      );
    }
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', { type: 'reaction:send', clientId: 's', emoji: '🎉' }).code,
      429
    );

    const question = (text) => ({
      type: 'question',
      id: `q_${text}`,
      x: 100,
      y: 100,
      authorName: 'Student',
      text,
    });
    for (let i = 0; i < 4; i++) {
      assert.equal(
        store.applyRoomOperation(roomId, 'viewer', {
          type: 'question:add', clientId: 's', question: question(`q${i}`),
        }).ok, true, `question ${i}`
      );
    }
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', {
        type: 'question:add', clientId: 's', question: question('q4'),
      }).code, 429
    );
  });

  test('board ops are never rate-limited — 30 rapid scene syncs all pass', () => {
    const { store, roomId } = makeStore();
    const scene = structuredClone(store.rooms.get(roomId).scene);
    for (let i = 0; i < 30; i++) {
      const res = store.applyRoomOperation(roomId, 'teacher', {
        type: 'scene:sync', clientId: 'teacher-1', scene,
      });
      assert.equal(res.ok, true, `scene:sync ${i} must never hit a bucket`);
    }
  });
});

describe('Rate-limit identity hardening', () => {
  test('a missing clientId is not an exemption — an anonymous flood still hits 429', () => {
    const { store, roomId } = makeStore();
    const results = [];
    for (let i = 0; i < 7; i++) {
      results.push(
        store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text: `msg ${i}`, x: 0, y: 0 })
      );
    }
    // No clientId anywhere: all requests share one anonymous bucket per room,
    // so the flood is throttled exactly like a named client's would be.
    assert.deepEqual(results.map((r) => r.ok), [true, true, true, true, true, false, false]);
  });

  test('the anonymous bucket is per-room — one room cannot throttle another', () => {
    const { store, roomId } = makeStore();
    for (let i = 0; i < 5; i++) {
      store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text: 'spam', x: 0, y: 0 });
    }
    assert.equal(
      store.applyRoomOperation(roomId, 'viewer', { type: 'chat:cursor', text: 'spam', x: 0, y: 0 }).ok,
      false
    );
    const page2 = createPage('Board2', 'P2');
    const scene2 = { title: 'T2', activePageId: 'P2', pages: [page2] };
    const { roomId: other } = (() => {
      const { roomId: rid } = store.createRoom(scene2);
      return { roomId: rid };
    })();
    assert.equal(
      store.applyRoomOperation(other, 'viewer', { type: 'chat:cursor', text: 'other room', x: 0, y: 0 }).ok,
      true,
      'a different room has its own anonymous bucket'
    );
  });
});
