// server/collab-server.js — Persistent Short-Link Store & Real-Time WebSocket Classroom Collaboration Server
import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { URL } from 'node:url';

const WS_GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

export function generateShortId(prefix = 'b', byteLength = 6) {
  const token = crypto.randomBytes(byteLength).toString('base64url').replace(/[-_]/g, 'x').slice(0, 8);
  return `${prefix}_${token}`;
}

export function generateCapabilityToken() {
  return crypto.randomBytes(18).toString('base64url');
}

export function stripSceneTeacherNotes(scene) {
  if (!scene || typeof scene !== 'object') return scene;
  const clone = structuredClone(scene);
  if (Array.isArray(clone.pages)) {
    for (const p of clone.pages) {
      delete p.teacherNotes;
      if (Array.isArray(p.elements)) {
        for (const el of p.elements) {
          if (el && typeof el === 'object') {
            delete el.teacherNotes;
          }
        }
      }
    }
  }
  return clone;
}

export class CollabStore {
  constructor(storagePath = null) {
    this.storagePath = storagePath;
    this.boards = new Map(); // id -> { id, title, scene, createdAt, expiresAt, readOnly: true }
    this.rooms = new Map(); // roomId -> { roomId, title, scene, deletedIds: [], teacherToken, editorToken, createdAt, expiresAt, updatedAt, teacherViewport }
    this.clients = new Map(); // ws -> { clientId, sessionId, roomId, role, name, color, pageId, cursor, selectionIds, lastSeen }
    if (this.storagePath) {
      this._loadFromDisk();
    }
  }

  _loadFromDisk() {
    try {
      if (this.storagePath && fs.existsSync(this.storagePath)) {
        const raw = JSON.parse(fs.readFileSync(this.storagePath, 'utf8'));
        for (const [k, v] of Object.entries(raw.boards || {})) this.boards.set(k, v);
        for (const [k, v] of Object.entries(raw.rooms || {})) this.rooms.set(k, v);
      }
    } catch {
      // Ignore corrupt or missing store file
    }
  }

  _saveToDisk() {
    if (!this.storagePath) return;
    try {
      const dir = path.dirname(this.storagePath);
      fs.mkdirSync(dir, { recursive: true });
      const data = {
        boards: Object.fromEntries(this.boards),
        rooms: Object.fromEntries(this.rooms),
      };
      fs.writeFileSync(this.storagePath, JSON.stringify(data), 'utf8');
    } catch {
      // Ignore disk write failure in restricted environments
    }
  }

  isFiniteScene(scene) {
    if (!scene || !Array.isArray(scene.pages)) return false;
    for (const p of scene.pages) {
      for (const el of p.elements || []) {
        if (
          !el ||
          !el.id ||
          !Number.isFinite(el.x) ||
          !Number.isFinite(el.y) ||
          !Number.isFinite(el.w) ||
          !Number.isFinite(el.h)
        ) {
          return false;
        }
        if ((el.type === 'line' || el.type === 'arrow') && (!Number.isFinite(el.x2) || !Number.isFinite(el.y2))) {
          return false;
        }
      }
    }
    return true;
  }

  createSnapshot(scene, { title = 'StudioBoard Snapshot', expiresInMs = null, includeTeacherNotes = false } = {}) {
    if (!this.isFiniteScene(scene)) {
      throw new Error('INVALID_SCENE_GEOMETRY');
    }
    let id = generateShortId('b', 6);
    while (this.boards.has(id)) id = generateShortId('b', 6);
    const now = Date.now();
    const cleanScene = includeTeacherNotes ? structuredClone(scene) : stripSceneTeacherNotes(scene);
    const record = {
      id,
      title: scene.title || title,
      scene: cleanScene,
      accessLevel: 'viewer',
      createdAt: now,
      expiresAt: expiresInMs && Number.isFinite(expiresInMs) ? now + expiresInMs : null,
    };
    this.boards.set(id, record);
    this._saveToDisk();
    return {
      id: record.id,
      title: record.title,
      accessLevel: record.accessLevel,
      createdAt: record.createdAt,
      expiresAt: record.expiresAt,
      route: `#/b/${record.id}`,
    };
  }

  getSnapshot(id) {
    const rec = this.boards.get(id);
    if (!rec) return { status: 404, error: 'Snapshot not found.' };
    if (rec.expiresAt && Date.now() > rec.expiresAt) {
      this.boards.delete(id);
      return { status: 410, error: 'Snapshot link has expired.' };
    }
    return {
      status: 200,
      data: {
        ...rec,
        scene: stripSceneTeacherNotes(rec.scene),
      },
    };
  }

  createRoom(scene, { title = 'Live Classroom', expiresInMs = null, requestedRoomId = null } = {}) {
    if (!this.isFiniteScene(scene)) {
      throw new Error('INVALID_SCENE_GEOMETRY');
    }
    let roomId = requestedRoomId && /^[a-zA-Z0-9_-]{3,24}$/.test(requestedRoomId) && !this.rooms.has(requestedRoomId)
      ? requestedRoomId
      : generateShortId('r', 6);
    while (this.rooms.has(roomId)) roomId = generateShortId('r', 6);

    const now = Date.now();
    const teacherToken = generateCapabilityToken();
    const editorToken = generateCapabilityToken();
    const questionerToken = generateCapabilityToken();
    const room = {
      roomId,
      title: scene.title || title,
      scene: structuredClone(scene),
      deletedIds: [],
      teacherToken,
      editorToken,
      questionerToken,
      createdAt: now,
      updatedAt: now,
      expiresAt: expiresInMs && Number.isFinite(expiresInMs) ? now + expiresInMs : null,
      teacherViewport: null,
      timerState: {
        running: false,
        remainingSec: 300,
        mode: 'countdown',
        updatedAt: now,
      },
    };
    this.rooms.set(roomId, room);
    this._saveToDisk();
    return {
      roomId,
      title: room.title,
      teacherToken,
      editorToken,
      questionerToken,
      createdAt: now,
      expiresAt: room.expiresAt,
      viewerRoute: `#/r/${roomId}`,
      questionerRoute: `#/r/${roomId}?role=questioner`,
      editorRoute: `#/r/${roomId}?invite=${editorToken}`,
      teacherRoute: `#/r/${roomId}?teacher=${teacherToken}`,
    };
  }

  resolveRole(room, token = '', roleHint = '') {
    if (!room) return null;
    if (token && token === room.teacherToken) return 'teacher';
    if (token && token === room.editorToken) return 'editor';
    if ((token && token === room.questionerToken) || roleHint === 'questioner') return 'questioner';
    return 'viewer'; // Room ID alone NEVER grants editing rights
  }

  getRoomPublicState(roomId, token = '', roleHint = '') {
    const room = this.rooms.get(roomId);
    if (!room) return { status: 404, error: 'Classroom room not found.' };
    if (room.expiresAt && Date.now() > room.expiresAt) {
      this.rooms.delete(roomId);
      return { status: 410, error: 'Classroom room has expired.' };
    }
    const role = this.resolveRole(room, token, roleHint);
    const safeScene = role === 'teacher' ? room.scene : stripSceneTeacherNotes(room.scene);
    return {
      status: 200,
      data: {
        roomId: room.roomId,
        title: room.title,
        role,
        scene: safeScene,
        deletedIds: room.deletedIds || [],
        createdAt: room.createdAt,
        updatedAt: room.updatedAt,
        expiresAt: room.expiresAt,
        teacherViewport: room.teacherViewport,
        timerState: room.timerState || null,
        ...(role === 'teacher'
          ? {
              editorToken: room.editorToken,
              teacherToken: room.teacherToken,
              questionerToken: room.questionerToken,
            }
          : {}),
      },
    };
  }

  applyRoomOperation(roomId, role, op) {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, code: 404, error: 'Room not found.' };
    if (room.expiresAt && Date.now() > room.expiresAt) {
      return { ok: false, code: 410, error: 'Room expired.' };
    }

    const pageId = op.pageId || room.scene.activePageId;
    const page = room.scene.pages.find((p) => p.id === pageId) || room.scene.pages[0];
    if (!page) return { ok: false, code: 400, error: 'Page not found.' };

    // Enforce server-side role permissions:
    // Viewers can ONLY add questions or upvote/point; they CANNOT modify/delete protected board elements!
    if (op.type === 'reaction:send') {
      const emoji = String(op.emoji || '👍').slice(0, 8);
      const authorName = String(op.authorName || 'Participant').slice(0, 40);
      return {
        ok: true,
        broadcast: {
          type: 'reaction:burst',
          reaction: {
            id: generateShortId('rx', 4),
            emoji,
            authorName,
            color: op.color || '#2563eb',
            createdAt: Date.now(),
          },
          senderClientId: op.clientId,
        },
      };
    }

    if (op.type === 'question:add') {
      const q = op.question;
      if (!q || q.type !== 'question' || !Number.isFinite(q.x) || !Number.isFinite(q.y)) {
        return { ok: false, code: 400, error: 'Invalid question payload.' };
      }
      if (!String(q.authorName || '').trim()) {
        return { ok: false, code: 400, error: 'Participant name required before asking a question.' };
      }
      const existingIdx = page.elements.findIndex((e) => e.id === q.id);
      if (existingIdx === -1) {
        page.elements.push(structuredClone(q));
      }
      room.updatedAt = Date.now();
      this._saveToDisk();
      return { ok: true, broadcast: { type: 'question:added', pageId: page.id, question: q } };
    }

    if (op.type === 'question:update') {
      const qId = op.questionId;
      const existing = page.elements.find((e) => e.id === qId && e.type === 'question');
      if (!existing) return { ok: false, code: 404, error: 'Question not found.' };
      if (typeof op.reply === 'string') existing.reply = op.reply;
      if (typeof op.resolved === 'boolean') existing.resolved = op.resolved;
      existing.updatedAt = Date.now();
      room.updatedAt = Date.now();
      this._saveToDisk();
      return { ok: true, broadcast: { type: 'question:updated', pageId: page.id, question: existing } };
    }

    if (role !== 'teacher' && role !== 'editor') {
      return {
        ok: false,
        code: 403,
        error: 'FORBIDDEN_VIEWER_ROLE: Viewers cannot modify protected board content.',
      };
    }

    if (op.type === 'timer:sync') {
      room.timerState = {
        running: Boolean(op.timerState?.running),
        remainingSec: Math.max(0, Number(op.timerState?.remainingSec) || 0),
        mode: op.timerState?.mode === 'stopwatch' ? 'stopwatch' : 'countdown',
        updatedAt: Date.now(),
      };
      return {
        ok: true,
        broadcast: {
          type: 'timer:synced',
          timerState: room.timerState,
          senderClientId: op.clientId,
        },
      };
    }

    if (op.type === 'scene:sync') {
      if (!this.isFiniteScene(op.scene)) {
        return { ok: false, code: 400, error: 'Invalid non-finite geometry rejected.' };
      }
      this._mergeSceneIntoRoom(room, op.scene, op.deletedIds || []);
      room.updatedAt = Date.now();
      this._saveToDisk();
      return {
        ok: true,
        broadcast: {
          type: 'scene:synced',
          scene: room.scene,
          deletedIds: room.deletedIds,
          updatedAt: room.updatedAt,
          senderClientId: op.clientId,
        },
      };
    }

    if (op.type === 'elements:upsert') {
      const elements = Array.isArray(op.elements) ? op.elements : [];
      for (const el of elements) {
        if (!el || !el.id || !Number.isFinite(el.x) || !Number.isFinite(el.y)) {
          return { ok: false, code: 400, error: 'Invalid element geometry rejected.' };
        }
      }
      const deletedSet = new Set(room.deletedIds || []);
      for (const incoming of elements) {
        deletedSet.delete(incoming.id);
        const idx = page.elements.findIndex((e) => e.id === incoming.id);
        if (idx === -1) {
          page.elements.push(structuredClone(incoming));
        } else {
          const cur = page.elements[idx];
          if ((incoming.updatedAt || 0) >= (cur.updatedAt || 0)) {
            page.elements[idx] = structuredClone(incoming);
          }
        }
      }
      room.deletedIds = Array.from(deletedSet);
      room.updatedAt = Date.now();
      this._saveToDisk();
      return {
        ok: true,
        broadcast: {
          type: 'elements:upserted',
          pageId: page.id,
          elements,
          senderClientId: op.clientId,
        },
      };
    }

    if (op.type === 'elements:delete') {
      const ids = Array.isArray(op.ids) ? op.ids : [];
      const delSet = new Set(ids);
      const roomDelSet = new Set(room.deletedIds || []);
      ids.forEach((id) => roomDelSet.add(id));
      room.deletedIds = Array.from(roomDelSet);

      // Preserve anchored questions at their last world position when their anchor element is deleted
      for (const el of page.elements) {
        if (el.type === 'question' && el.targetElementId && delSet.has(el.targetElementId)) {
          const target = page.elements.find((t) => t.id === el.targetElementId);
          if (target) {
            el.x = target.x + (el.offsetX ?? Math.max(0, (target.w || 140) - 30));
            el.y = target.y + (el.offsetY ?? -36);
          }
          el.targetElementId = null;
          el.anchorDeleted = true;
        }
      }
      page.elements = page.elements.filter((e) => !delSet.has(e.id));
      room.updatedAt = Date.now();
      this._saveToDisk();
      return {
        ok: true,
        broadcast: {
          type: 'elements:deleted',
          pageId: page.id,
          ids,
          senderClientId: op.clientId,
        },
      };
    }

    if (op.type === 'teacher:camera' && role === 'teacher') {
      room.teacherViewport = {
        pageId: op.pageId || room.scene.activePageId,
        camera: op.camera,
        updatedAt: Date.now(),
      };
      return {
        ok: true,
        broadcast: {
          type: 'teacher:camera',
          pageId: room.teacherViewport.pageId,
          camera: room.teacherViewport.camera,
          senderClientId: op.clientId,
        },
      };
    }

    return { ok: false, code: 400, error: 'Unsupported operation.' };
  }

  _mergeSceneIntoRoom(room, incomingScene, incomingDeletedIds = []) {
    const delSet = new Set([...(room.deletedIds || []), ...incomingDeletedIds]);
    room.deletedIds = Array.from(delSet);
    room.scene.title = incomingScene.title || room.scene.title;
    room.scene.theme = incomingScene.theme || room.scene.theme;
    room.scene.activePageId = incomingScene.activePageId || room.scene.activePageId;
    room.scene.files = { ...(room.scene.files || {}), ...(incomingScene.files || {}) };

    const existingPages = new Map(room.scene.pages.map((p) => [p.id, p]));
    const mergedPages = [];

    for (const incPage of incomingScene.pages) {
      const curPage = existingPages.get(incPage.id);
      if (!curPage) {
        mergedPages.push({
          ...structuredClone(incPage),
          elements: (incPage.elements || []).filter((e) => !delSet.has(e.id)),
        });
      } else {
        // Merge elements by id without duplicating on reconnect
        const byId = new Map();
        for (const el of curPage.elements || []) {
          if (!delSet.has(el.id)) byId.set(el.id, el);
        }
        for (const el of incPage.elements || []) {
          if (delSet.has(el.id)) continue;
          const prev = byId.get(el.id);
          if (!prev || (el.updatedAt || 0) >= (prev.updatedAt || 0)) {
            byId.set(el.id, structuredClone(el));
          }
        }
        // Preserve anchored questions whose target element was deleted
        for (const el of byId.values()) {
          if (el.type === 'question' && el.targetElementId && !byId.has(el.targetElementId)) {
            el.targetElementId = null;
            el.anchorDeleted = true;
          }
        }
        mergedPages.push({
          ...curPage,
          name: incPage.name || curPage.name,
          background: incPage.background || curPage.background,
          elements: Array.from(byId.values()),
        });
      }
    }
    room.scene.pages = mergedPages;
  }
}

// RFC 6455 WebSocket Frame Encoder / Decoder (Zero external dependencies)
function encodeWsFrame(payloadObj) {
  const json = typeof payloadObj === 'string' ? payloadObj : JSON.stringify(payloadObj);
  const data = Buffer.from(json, 'utf8');
  const len = data.length;
  let header;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x81;
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function decodeWsFrames(buffer) {
  const messages = [];
  let offset = 0;
  while (offset + 2 <= buffer.length) {
    const b0 = buffer[offset];
    const b1 = buffer[offset + 1];
    const opcode = b0 & 0x0f;
    const isMasked = (b1 & 0x80) !== 0;
    let payloadLen = b1 & 0x7f;
    let headerLen = 2;

    if (payloadLen === 126) {
      if (offset + 4 > buffer.length) break;
      payloadLen = buffer.readUInt16BE(offset + 2);
      headerLen = 4;
    } else if (payloadLen === 127) {
      if (offset + 10 > buffer.length) break;
      payloadLen = Number(buffer.readBigUInt64BE(offset + 2));
      headerLen = 10;
    }

    const maskLen = isMasked ? 4 : 0;
    if (offset + headerLen + maskLen + payloadLen > buffer.length) break;

    const maskStart = offset + headerLen;
    const dataStart = maskStart + maskLen;
    const payload = Buffer.alloc(payloadLen);
    if (isMasked) {
      const mask = buffer.subarray(maskStart, maskStart + 4);
      for (let i = 0; i < payloadLen; i++) {
        payload[i] = buffer[dataStart + i] ^ mask[i % 4];
      }
    } else {
      buffer.copy(payload, 0, dataStart, dataStart + payloadLen);
    }

    offset = dataStart + payloadLen;
    if (opcode === 0x8) {
      messages.push({ type: 'close' });
    } else if (opcode === 0x9) {
      messages.push({ type: 'ping' });
    } else if (opcode === 0x1) {
      messages.push({ type: 'text', text: payload.toString('utf8') });
    }
  }
  return { messages, remaining: buffer.subarray(offset) };
}

export function connectNodeWsClient(wsUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(wsUrl.replace(/^ws:/, 'http:'));
    const key = crypto.randomBytes(16).toString('base64');
    const req = http.request({
      hostname: parsed.hostname,
      port: parsed.port,
      path: `${parsed.pathname}${parsed.search}`,
      method: 'GET',
      headers: {
        Connection: 'Upgrade',
        Upgrade: 'websocket',
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Key': key,
      },
    });
    req.on('error', reject);
    req.on('upgrade', (_res, socket, head) => {
      const inbox = [];
      const waiters = [];
      let recvBuf = head && head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);

      const processBuffer = () => {
        const { messages, remaining } = decodeWsFrames(recvBuf);
        recvBuf = remaining;
        for (const m of messages) {
          if (m.type === 'text') {
            try {
              const msg = JSON.parse(m.text);
              inbox.push(msg);
              for (let i = waiters.length - 1; i >= 0; i--) {
                if (waiters[i].pred(msg)) {
                  const w = waiters.splice(i, 1)[0];
                  w.resolve(msg);
                }
              }
            } catch {
              // Ignore
            }
          }
        }
      };

      if (recvBuf.length > 0) processBuffer();
      socket.on('error', () => {});
      socket.on('data', (chunk) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        processBuffer();
      });

      const waitFor = (pred, timeoutMs = 2500) => {
        const found = inbox.find(pred);
        if (found) return Promise.resolve(found);
        return new Promise((res, rej) => {
          const t = setTimeout(() => rej(new Error('WebSocket waitFor timeout')), timeoutMs);
          waiters.push({
            pred,
            resolve: (m) => {
              clearTimeout(t);
              res(m);
            },
          });
        });
      };

      const wsAdapter = {
        send(strOrObj) {
          if (!socket.destroyed) socket.write(encodeWsFrame(strOrObj));
        },
        close() {
          try {
            if (!socket.destroyed) {
              socket.write(Buffer.from([0x88, 0x00]));
              socket.end();
            }
          } catch {
            // Ignore
          }
        },
      };

      resolve({ ws: wsAdapter, inbox, waitFor });
    });
    req.end();
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 8 * 1024 * 1024) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const str = Buffer.concat(chunks).toString('utf8');
        resolve(str ? JSON.parse(str) : {});
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, Access-Control-Request-Private-Network',
    'Access-Control-Allow-Private-Network': 'true',
  });
  res.end(JSON.stringify(data));
}

export function attachCollabRoutes(httpServer, store = new CollabStore()) {
  const broadcastToRoom = (roomId, msgObj, excludeSocket = null) => {
    for (const [sock, meta] of store.clients.entries()) {
      if (meta.roomId === roomId && sock !== excludeSocket && !sock.destroyed) {
        try {
          let payload = msgObj;
          if (meta.role !== 'teacher') {
            if (msgObj.type === 'scene:synced' && msgObj.scene) {
              payload = { ...msgObj, scene: stripSceneTeacherNotes(msgObj.scene) };
            } else if (msgObj.type === 'elements:upserted' && Array.isArray(msgObj.elements)) {
              payload = {
                ...msgObj,
                elements: msgObj.elements.map((el) => {
                  const copy = { ...el };
                  delete copy.teacherNotes;
                  return copy;
                }),
              };
            }
          }
          sock.write(encodeWsFrame(payload));
        } catch {
          // Ignore broken socket
        }
      }
    }
  };

  const broadcastPresence = (roomId) => {
    const now = Date.now();
    const participants = [];
    for (const [sock, meta] of store.clients.entries()) {
      if (meta.roomId === roomId && !sock.destroyed && now - meta.lastSeen <= 25000) {
        participants.push({
          clientId: meta.clientId,
          sessionId: meta.sessionId,
          name: meta.name,
          color: meta.color,
          role: meta.role,
          pageId: meta.pageId,
          cursor: meta.cursor,
          handRaised: Boolean(meta.handRaised),
          handRaisedAt: meta.handRaisedAt || null,
          selectionIds: meta.selectionIds || [],
        });
      }
    }
    broadcastToRoom(roomId, { type: 'presence:list', roomId, participants });
  };

  const apiMiddleware = async (req, res, next) => {
    const urlObj = new URL(req.url || '/', 'http://localhost');
    const pathname = urlObj.pathname;

    if (!pathname.startsWith('/api/')) {
      if (next) return next();
      return false;
    }

    if (req.method === 'OPTIONS') {
      sendJson(res, 200, { ok: true });
      return true;
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        service: 'studioboard-collab-server',
        boardsCount: store.boards.size,
        roomsCount: store.rooms.size,
      });
      return true;
    }

    if (pathname === '/api/boards' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const created = store.createSnapshot(body.scene, {
          title: body.title,
          expiresInMs: body.expiresInMs,
        });
        sendJson(res, 201, created);
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Failed to create snapshot.' });
      }
      return true;
    }

    const boardMatch = /^\/api\/boards\/([a-zA-Z0-9_-]+)$/.exec(pathname);
    if (boardMatch && req.method === 'GET') {
      const result = store.getSnapshot(boardMatch[1]);
      if (result.status !== 200) sendJson(res, result.status, { error: result.error });
      else sendJson(res, 200, result.data);
      return true;
    }

    if (pathname === '/api/rooms' && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const created = store.createRoom(body.scene, {
          title: body.title,
          expiresInMs: body.expiresInMs,
          requestedRoomId: body.roomId,
        });
        sendJson(res, 201, created);
      } catch (err) {
        sendJson(res, 400, { error: err.message || 'Failed to create classroom room.' });
      }
      return true;
    }

    const roomMatch = /^\/api\/rooms\/([a-zA-Z0-9_-]+)$/.exec(pathname);
    if (roomMatch && req.method === 'GET') {
      const token = urlObj.searchParams.get('token') || '';
      const roleHint = urlObj.searchParams.get('role') || '';
      const result = store.getRoomPublicState(roomMatch[1], token, roleHint);
      if (result.status !== 200) sendJson(res, result.status, { error: result.error });
      else sendJson(res, 200, result.data);
      return true;
    }

    const roomOpMatch = /^\/api\/rooms\/([a-zA-Z0-9_-]+)\/ops$/.exec(pathname);
    if (roomOpMatch && req.method === 'POST') {
      try {
        const body = await readJsonBody(req);
        const roomId = roomOpMatch[1];
        const room = store.rooms.get(roomId);
        if (!room) {
          sendJson(res, 404, { error: 'Room not found.' });
          return true;
        }
        const role = store.resolveRole(room, body.token || '', body.roleHint || '');
        const outcome = store.applyRoomOperation(roomId, role, body);
        if (!outcome.ok) {
          sendJson(res, outcome.code || 400, { error: outcome.error });
          return true;
        }
        if (outcome.broadcast) {
          broadcastToRoom(roomId, outcome.broadcast);
        }
        sendJson(res, 200, { ok: true, role, updatedAt: room.updatedAt });
      } catch (err) {
        sendJson(res, 400, { error: err.message });
      }
      return true;
    }

    sendJson(res, 404, { error: 'Unknown API endpoint.' });
    return true;
  };

  if (httpServer) {
    httpServer.on('upgrade', (req, socket) => {
      const urlObj = new URL(req.url || '/', 'http://localhost');
      if (urlObj.pathname !== '/ws') return;

      const key = req.headers['sec-websocket-key'];
      if (!key) {
        socket.destroy();
        return;
      }
      const roomId = urlObj.searchParams.get('roomId') || '';
      const token = urlObj.searchParams.get('token') || '';
      const roleHint = urlObj.searchParams.get('role') || '';
      const clientId = urlObj.searchParams.get('clientId') || generateShortId('c', 4);
      const name = urlObj.searchParams.get('name') || 'Participant';
      const color = urlObj.searchParams.get('color') || '#2563eb';

      const CRLF = String.fromCharCode(13, 10);
      const room = store.rooms.get(roomId);
      if (!room) {
        socket.write(`HTTP/1.1 404 Not Found${CRLF}${CRLF}`);
        socket.destroy();
        return;
      }

      const role = store.resolveRole(room, token, roleHint);
      const accept = crypto.createHash('sha1').update(key + WS_GUID).digest('base64');
      socket.write(
        [
          'HTTP/1.1 101 Switching Protocols',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Accept: ${accept}`,
          CRLF,
        ].join(CRLF)
      );

      const sessionMeta = {
        clientId,
        sessionId: generateShortId('sess', 4),
        roomId,
        role,
        name,
        color,
        pageId: room.scene.activePageId,
        cursor: null,
        handRaised: false,
        handRaisedAt: null,
        selectionIds: [],
        lastSeen: Date.now(),
      };
      store.clients.set(socket, sessionMeta);

      // Send initial room state & assigned server role (stripping teacherNotes for non-teachers)
      socket.write(
        encodeWsFrame({
          type: 'room:welcome',
          roomId,
          role,
          clientId,
          sessionId: sessionMeta.sessionId,
          scene: role === 'teacher' ? room.scene : stripSceneTeacherNotes(room.scene),
          deletedIds: room.deletedIds || [],
          teacherViewport: room.teacherViewport,
          timerState: room.timerState || null,
        })
      );
      broadcastPresence(roomId);

      let recvBuf = Buffer.alloc(0);
      socket.on('data', (chunk) => {
        recvBuf = Buffer.concat([recvBuf, chunk]);
        const { messages, remaining } = decodeWsFrames(recvBuf);
        recvBuf = remaining;
        for (const m of messages) {
          if (m.type === 'close') {
            store.clients.delete(socket);
            socket.end();
            broadcastPresence(roomId);
            return;
          }
          if (m.type === 'text') {
            try {
              const msg = JSON.parse(m.text);
              sessionMeta.lastSeen = Date.now();
              if (msg.type === 'presence:update') {
                if (msg.name) sessionMeta.name = String(msg.name).slice(0, 40);
                if (msg.color) sessionMeta.color = String(msg.color).slice(0, 20);
                if (msg.pageId) sessionMeta.pageId = msg.pageId;
                if (typeof msg.handRaised === 'boolean') {
                  sessionMeta.handRaised = msg.handRaised;
                  sessionMeta.handRaisedAt = msg.handRaised ? Date.now() : null;
                }
                if (msg.cursor === null || (msg.cursor && Number.isFinite(msg.cursor.x) && Number.isFinite(msg.cursor.y))) {
                  sessionMeta.cursor = msg.cursor;
                }
                if (Array.isArray(msg.selectionIds)) {
                  sessionMeta.selectionIds = msg.selectionIds.slice(0, 20);
                }
                broadcastPresence(roomId);
              } else if (msg.type === 'pointer:ping') {
                if (!String(sessionMeta.name || msg.pointer?.authorName || '').trim()) {
                  socket.write(encodeWsFrame({ type: 'error', error: 'Name required to point.' }));
                  continue;
                }
                broadcastToRoom(
                  roomId,
                  {
                    type: 'pointer:ping',
                    pointer: {
                      ...msg.pointer,
                      authorName: sessionMeta.name || msg.pointer?.authorName,
                      color: sessionMeta.color,
                      pageId: msg.pageId || sessionMeta.pageId,
                    },
                  },
                  socket
                );
              } else {
                const outcome = store.applyRoomOperation(roomId, sessionMeta.role, {
                  ...msg,
                  clientId: sessionMeta.clientId,
                });
                if (!outcome.ok) {
                  socket.write(
                    encodeWsFrame({
                      type: 'error',
                      code: outcome.code,
                      error: outcome.error,
                    })
                  );
                } else if (outcome.broadcast) {
                  broadcastToRoom(roomId, outcome.broadcast, socket);
                }
              }
            } catch {
              // Ignore malformed JSON frame
            }
          }
        }
      });

      const cleanup = () => {
        if (store.clients.has(socket)) {
          store.clients.delete(socket);
          broadcastPresence(roomId);
        }
      };
      socket.on('close', cleanup);
      socket.on('error', cleanup);
    });
  }

  return { store, apiMiddleware };
}

export function createStandaloneCollabServer({ port = 4179, storagePath = null } = {}) {
  const store = new CollabStore(storagePath);
  const server = http.createServer();
  const { apiMiddleware } = attachCollabRoutes(server, store);
  server.on('request', (req, res) => {
    apiMiddleware(req, res, () => {
      sendJson(res, 404, { error: 'Not found' });
    });
  });

  const invokeInProcess = async (urlPath, options = {}) => {
    const method = (options.method || 'GET').toUpperCase();
    const bodyStr = typeof options.body === 'string' ? options.body : options.body ? JSON.stringify(options.body) : '';
    const listeners = {};
    const req = {
      url: urlPath,
      method,
      headers: options.headers || {},
      on(event, cb) {
        listeners[event] = listeners[event] || [];
        listeners[event].push(cb);
        if (event === 'data' && bodyStr) {
          queueMicrotask(() => cb(Buffer.from(bodyStr, 'utf8')));
        }
        if (event === 'end') {
          queueMicrotask(() => cb());
        }
        return this;
      },
      destroy() {},
    };
    let statusCode = 200;
    let respHeaders = {};
    let respBody = '';
    const res = {
      writeHead(code, headers = {}) {
        statusCode = code;
        respHeaders = headers;
      },
      end(str = '') {
        respBody = String(str);
      },
    };
    await apiMiddleware(req, res, () => {
      sendJson(res, 404, { error: 'Not found' });
    });
    return {
      status: statusCode,
      ok: statusCode >= 200 && statusCode < 300,
      headers: respHeaders,
      json: async () => (respBody ? JSON.parse(respBody) : {}),
      text: async () => respBody,
    };
  };

  let listening = false;
  return {
    server,
    store,
    apiMiddleware,
    request: invokeInProcess,
    start: () =>
      new Promise((resolve, reject) => {
        const onError = (err) => {
          if (err && (err.code === 'EPERM' || err.code === 'EACCES')) {
            listening = false;
            resolve(0);
          } else {
            reject(err);
          }
        };
        server.once('error', onError);
        server.listen(port, '127.0.0.1', () => {
          server.removeListener('error', onError);
          listening = true;
          const addr = server.address();
          resolve(addr ? addr.port : port);
        });
      }),
    stop: () =>
      new Promise((resolve) => {
        for (const sock of store.clients.keys()) sock.destroy();
        if (!listening) {
          resolve();
          return;
        }
        server.close(() => {
          listening = false;
          resolve();
        });
      }),
  };
}
