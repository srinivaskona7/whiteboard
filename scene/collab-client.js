// scene/collab-client.js — Short-Link Resolution & Real-Time WebSocket Collaboration Client
import { uid } from './model.js';
import { assertValidSceneGeometry } from './storage.js';

const COLORS = [
  '#2563eb',
  '#db2777',
  '#059669',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#dc2626',
  '#4f46e5',
];

export function parseShareRoute(hashStr = '') {
  const raw = String(hashStr || '').replace(/^#/, '');
  if (!raw) return { mode: 'none' };

  // Short snapshot route: #/b/{id}
  const snapMatch = /^\/b\/([a-zA-Z0-9_-]+)(?:\?(.*))?$/.exec(raw);
  if (snapMatch) {
    return {
      mode: 'snapshot',
      boardId: snapMatch[1],
    };
  }

  // Short live room route: #/r/{roomId}?invite=...&teacher=...&role=questioner
  const roomMatch = /^\/r\/([a-zA-Z0-9_-]+)(?:\?(.*))?$/.exec(raw);
  if (roomMatch) {
    const roomId = roomMatch[1];
    const params = new URLSearchParams(roomMatch[2] || '');
    const token = params.get('teacher') || params.get('invite') || params.get('token') || '';
    const roleHint = params.get('role') || '';
    return {
      mode: 'room',
      roomId,
      token,
      roleHint,
    };
  }

  return { mode: 'legacy', raw };
}

export class CollabClient {
  constructor(app) {
    this.app = app;
    this.clientId = this._loadOrCreateIdentity('studioboard_client_id_v1', () => uid('cli'));
    this.color = this._loadOrCreateIdentity(
      'studioboard_client_color_v1',
      () => COLORS[Math.floor(Math.random() * COLORS.length)]
    );
    this.apiBase = this._resolveApiBase();
    this.backendAvailable = false;
    this.status = 'local'; // 'local' | 'connecting' | 'live' | 'snapshot' | 'offline' | 'error'
    this.statusMessage = 'Local board';
    this.roomId = '';
    this.boardId = '';
    this.role = 'teacher'; // 'teacher' | 'editor' | 'questioner' | 'viewer'
    this.roleHint = '';
    this.teacherToken = '';
    this.editorToken = '';
    this.questionerToken = '';
    this.activeToken = '';
    this.expiresAt = null;
    this.ws = null;
    this.reconnectTimer = null;
    this.deletedIds = new Set();
    this.participants = new Map(); // clientId -> { ...meta, renderCursor: { x, y } }
    this.followingTeacher = false;
    this.teacherViewport = null;
    this.handRaised = false;
    this.recentReactions = [];
    this.cursorChats = [];
    this._lastCursorSentAt = 0;
    this._suppressOutboundSync = false;
  }

  _loadOrCreateIdentity(key, generator) {
    try {
      const saved = sessionStorage.getItem(key) || localStorage.getItem(key);
      if (saved) return saved;
      const val = generator();
      sessionStorage.setItem(key, val);
      return val;
    } catch {
      return generator();
    }
  }

  _resolveApiBase() {
    if (typeof window === 'undefined') return '';
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('api') || localStorage.getItem('studioboard_api_base_v1') || '';
    return fromQuery.replace(/\/$/, '') || this.getSuggestedApiBase();
  }

  static isLoopbackHost(hostname) {
    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    );
  }

  /**
   * The backend a board should point at by default. Same origin whenever the
   * page was served over http(s) — that is the only address students on other
   * devices can reach, and it is correct both for the Vite middleware and for
   * a standalone server behind a proxy. The loopback port is only a sensible
   * default for a board opened straight from disk.
   */
  getSuggestedApiBase() {
    if (typeof window === 'undefined') return '';
    const { protocol } = window.location;
    if (protocol === 'http:' || protocol === 'https:') return '';
    return 'http://127.0.0.1:4179';
  }

  /** Whether the configured backend is reachable by a device other than this one. */
  isApiBaseReachableFromOtherDevices() {
    if (!this.apiBase) return true; // same origin as the page
    try {
      return !CollabClient.isLoopbackHost(new URL(this.apiBase).hostname);
    } catch {
      return true;
    }
  }

  isLocalPage() {
    if (typeof window === 'undefined') return true;
    return (
      window.location.protocol === 'file:' ||
      CollabClient.isLoopbackHost(window.location.hostname)
    );
  }

  setApiBase(url) {
    this.apiBase = String(url || '').trim().replace(/\/$/, '');
    try {
      if (this.apiBase) localStorage.setItem('studioboard_api_base_v1', this.apiBase);
      else localStorage.removeItem('studioboard_api_base_v1');
    } catch {
      // Ignore storage errors
    }
  }

  getEndpoint(pathStr) {
    return `${this.apiBase}${pathStr}`;
  }

  getWsUrl(queryParams) {
    if (this.apiBase && /^https?:\/\//.test(this.apiBase)) {
      const wsBase = this.apiBase.replace(/^http/, 'ws');
      return `${wsBase}/ws?${queryParams}`;
    }
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/ws?${queryParams}`;
  }

  buildShortUrl(routeHash) {
    if (typeof window === 'undefined') return routeHash;
    const base = `${window.location.origin}${window.location.pathname}`;
    return `${base}${routeHash.startsWith('#') ? routeHash : `#${routeHash}`}`;
  }

  async _probeHealthUrl(base) {
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), 1800);
    try {
      const res = await fetch(`${base}/api/health`, { signal: ctl.signal });
      clearTimeout(t);
      if (!res.ok) return false;
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('json')) return false;
      const data = await res.json();
      return Boolean(data && data.ok);
    } catch {
      clearTimeout(t);
      return false;
    }
  }

  async checkBackendHealth() {
    if (typeof fetch === 'undefined') {
      this.backendAvailable = false;
      return false;
    }
    const candidates = [this.apiBase];
    if (this.apiBase !== '') candidates.push('');
    // The standalone loopback port only helps when this page is itself local.
    // Probing it from a board served over the network would pin the UI to an
    // address no student can reach, and hide the same-origin failure.
    if (this.isLocalPage() && !candidates.includes('http://127.0.0.1:4179')) {
      candidates.push('http://127.0.0.1:4179');
    }
    for (const cand of candidates) {
      if (await this._probeHealthUrl(cand)) {
        this.apiBase = cand;
        this.backendAvailable = true;
        return true;
      }
    }
    this.backendAvailable = false;
    return false;
  }

  canEditBoard() {
    if (this.status === 'snapshot') return false;
    if (this.status === 'live' && (this.role === 'viewer' || this.role === 'questioner')) return false;
    return true;
  }

  canUseTool(toolId) {
    if (this.canEditBoard()) return true;
    if (this.status === 'snapshot') {
      return toolId === 'select' || toolId === 'hand';
    }
    return ['select', 'hand', 'pointer', 'question'].includes(toolId);
  }

  isRestrictedViewer() {
    return !this.canEditBoard();
  }

  async createShortSnapshot(expiresInMs = null) {
    assertValidSceneGeometry(this.app.scene);
    const healthy = await this.checkBackendHealth();
    if (!healthy) {
      throw new Error(
        'Short link backend is not reachable. Start the collaboration server or use the Offline Fallback link.'
      );
    }
    const res = await fetch(this.getEndpoint('/api/boards'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: this.app.scene.title,
        scene: this.app.scene,
        expiresInMs,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to create snapshot.');
    return {
      ...data,
      url: this.buildShortUrl(data.route),
    };
  }

  async startOrUpdateLiveRoom({ requestedRoomId = null, expiresInMs = null } = {}) {
    assertValidSceneGeometry(this.app.scene);
    const healthy = await this.checkBackendHealth();
    if (!healthy) {
      this.status = 'offline';
      this.statusMessage = 'Offline (No collaboration server configured)';
      this.app.updateUI?.();
      throw new Error(
        'Collaboration backend is unavailable. Cross-device live rooms and short links require the collaboration server.'
      );
    }

    const res = await fetch(this.getEndpoint('/api/rooms'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: this.app.scene.title,
        scene: this.app.scene,
        roomId: requestedRoomId,
        expiresInMs,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to start live room.');

    this.roomId = data.roomId;
    this.teacherToken = data.teacherToken;
    this.editorToken = data.editorToken;
    this.activeToken = data.teacherToken;
    this.role = 'teacher';
    this.expiresAt = data.expiresAt;

    try {
      sessionStorage.setItem(`studioboard_room_token_${data.roomId}`, data.teacherToken);
      sessionStorage.setItem(`studioboard_room_editor_${data.roomId}`, data.editorToken);
    } catch {
      // Ignore storage errors
    }

    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `#/r/${data.roomId}`);
    }

    await this.connectToRoom(data.roomId, data.teacherToken);
    return {
      ...data,
      viewerUrl: this.buildShortUrl(data.viewerRoute),
      editorUrl: this.buildShortUrl(data.editorRoute),
      teacherUrl: this.buildShortUrl(data.teacherRoute),
    };
  }

  async loadSnapshotById(boardId) {
    const healthy = await this.checkBackendHealth();
    if (!healthy) {
      this.status = 'offline';
      this.statusMessage = 'Offline · Cannot resolve short link without backend';
      this.app.dialogs?.showToast('Cannot load short snapshot link: collaboration backend is offline.');
      this.app.updateUI?.();
      return false;
    }
    const res = await fetch(this.getEndpoint(`/api/boards/${encodeURIComponent(boardId)}`));
    const data = await res.json();
    if (!res.ok) {
      this.status = 'error';
      this.statusMessage = data.error || 'Snapshot not found';
      this.app.dialogs?.showToast(this.statusMessage);
      this.app.updateUI?.();
      return false;
    }
    this.boardId = boardId;
    this.role = 'viewer';
    this.status = 'snapshot';
    this.expiresAt = data.expiresAt;
    this.statusMessage = 'Read-only Snapshot';
    this._applyRemoteScene(data.scene, [], 'replace');
    this.app.dialogs?.showToast(`Loaded read-only snapshot "${data.title}".`);
    return true;
  }

  async joinRoomById(roomId, tokenFromUrl = '', roleHint = '') {
    const savedToken =
      tokenFromUrl ||
      (typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(`studioboard_room_token_${roomId}`) || ''
        : '');
    const savedEditor =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem(`studioboard_room_editor_${roomId}`) || ''
        : '';
    this.roleHint = roleHint || this.roleHint || '';

    const healthy = await this.checkBackendHealth();
    if (!healthy) {
      this.status = 'offline';
      this.statusMessage = 'Offline · Live room unavailable';
      this.app.dialogs?.showToast('Collaboration server is unreachable. Live classroom is offline.');
      this.app.updateUI?.();
      return false;
    }

    const res = await fetch(
      this.getEndpoint(
        `/api/rooms/${encodeURIComponent(roomId)}?token=${encodeURIComponent(savedToken)}&role=${encodeURIComponent(this.roleHint)}`
      )
    );
    const data = await res.json();
    if (!res.ok) {
      this.status = 'error';
      this.statusMessage = data.error || 'Room not found';
      this.app.dialogs?.showToast(this.statusMessage);
      this.app.updateUI?.();
      return false;
    }

    this.roomId = roomId;
    this.role = data.role || 'viewer';
    this.activeToken = savedToken;
    this.teacherToken = data.teacherToken || (this.role === 'teacher' ? savedToken : '');
    this.editorToken = data.editorToken || savedEditor;
    this.questionerToken = data.questionerToken || '';
    this.expiresAt = data.expiresAt;
    if (savedToken) {
      try {
        sessionStorage.setItem(`studioboard_room_token_${roomId}`, savedToken);
      } catch {
        // Ignore
      }
    }

    this._applyRemoteScene(data.scene, data.deletedIds || []);
    if (data.teacherViewport && (this.role === 'viewer' || this.role === 'questioner')) {
      this.teacherViewport = data.teacherViewport;
    }
    if (data.timerState) {
      this.app.timerUI?.applyRemoteTimerState?.(data.timerState);
    }
    if (data.voteSession) {
      this.app.votingUI?.applyRemoteSession?.(data.voteSession);
    }
    // A viewer joining mid-session inherits the teacher's live spotlight.
    if (data.spotlightState && (this.role === 'viewer' || this.role === 'questioner')) {
      this.app.applyRemoteSpotlight?.(data.spotlightState);
    }

    // Keep URL clean so secret tokens are not left exposed in the address bar
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', `#/r/${roomId}`);
    }

    await this.connectToRoom(roomId, savedToken, this.roleHint);
    return true;
  }

  connectToRoom(roomId, token = '', roleHint = this.roleHint) {
    if (typeof WebSocket === 'undefined') return Promise.resolve(false);
    this.disconnect();
    this.roomId = roomId;
    this.activeToken = token;
    this.roleHint = roleHint || '';
    this.status = 'connecting';
    this.statusMessage = `Connecting to ${roomId}…`;
    this.app.updateUI?.();

    const name = this.app.classroomUI?.getStudentName() || (this.role === 'teacher' ? 'Teacher' : 'Student');
    const qs = new URLSearchParams({
      roomId,
      token: token || '',
      role: this.roleHint || '',
      clientId: this.clientId,
      name,
      color: this.color,
    }).toString();

    return new Promise((resolve) => {
      let settled = false;
      const ws = new WebSocket(this.getWsUrl(qs));
      this.ws = ws;

      ws.addEventListener('open', () => {
        this.status = 'live';
        this._updateLiveStatusText();
        this.app.updateUI?.();
        if (!settled) {
          settled = true;
          resolve(true);
        }
      });

      ws.addEventListener('message', (ev) => {
        try {
          const msg = JSON.parse(ev.data);
          this._handleServerMessage(msg);
        } catch {
          // Ignore invalid JSON
        }
      });

      ws.addEventListener('close', () => {
        if (this.ws === ws) {
          this.ws = null;
          if (this.roomId) {
            this.status = 'offline';
            this.statusMessage = `Reconnecting to ${this.roomId}…`;
            this.app.updateUI?.();
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
              if (this.roomId) this.connectToRoom(this.roomId, this.activeToken);
            }, 1800);
          }
        }
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });

      ws.addEventListener('error', () => {
        if (!settled) {
          settled = true;
          resolve(false);
        }
      });
    });
  }

  disconnect() {
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      const old = this.ws;
      this.ws = null;
      try {
        old.close();
      } catch {
        // Ignore
      }
    }
  }

  leaveRoom() {
    this.roomId = '';
    this.boardId = '';
    this.activeToken = '';
    this.role = 'teacher';
    this.followingTeacher = false;
    this.participants.clear();
    this.disconnect();
    this.status = 'local';
    this.statusMessage = 'Local board';
    if (typeof window !== 'undefined' && window.history?.replaceState) {
      window.history.replaceState(null, '', window.location.pathname);
    }
    this.app.updateUI?.();
    this.app.requestRender?.();
  }

  async revokeActiveRoom() {
    if (!this.roomId || !this.teacherToken) return false;
    const res = await fetch(
      this.getEndpoint(
        `/api/rooms/${encodeURIComponent(this.roomId)}?token=${encodeURIComponent(this.teacherToken)}`
      ),
      { method: 'DELETE' }
    );
    if (!res.ok) return false;
    this.leaveRoom();
    this.app.dialogs?.showToast('Classroom room link revoked and session ended.', 'info');
    return true;
  }

  async revokeSnapshot(boardId) {
    if (!boardId) return false;
    const res = await fetch(this.getEndpoint(`/api/boards/${encodeURIComponent(boardId)}`), {
      method: 'DELETE',
    });
    return res.ok;
  }

  _updateLiveStatusText() {
    const count = Math.max(1, this.participants.size);
    const roleLabel =
      this.role === 'teacher'
        ? 'Teacher'
        : this.role === 'editor'
          ? 'Editor'
          : this.role === 'questioner'
            ? 'Questioner'
            : 'Viewer / Q&A';
    this.statusMessage = `Live · ${this.roomId} · ${count} online (${roleLabel})`;
  }

  _handleServerMessage(msg) {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'room:welcome') {
      this.role = msg.role || 'viewer';
      this.status = 'live';
      this._applyRemoteScene(msg.scene, msg.deletedIds || []);
      if (msg.teacherViewport) {
        this.teacherViewport = msg.teacherViewport;
        if (this.followingTeacher) this._applyTeacherCamera(msg.teacherViewport);
      }
      if (msg.timerState) {
        this.app.timerUI?.applyRemoteTimerState?.(msg.timerState);
      }
      if (msg.voteSession) {
        this.app.votingUI?.applyRemoteSession?.(msg.voteSession);
      }
      if (msg.spotlightState && (this.role === 'viewer' || this.role === 'questioner')) {
        this.app.applyRemoteSpotlight?.(msg.spotlightState);
      }
      this._updateLiveStatusText();
      this.app.updateUI?.();
      this.app.classroomUI?.update();
      return;
    }

    if (msg.type === 'presence:list') {
      if (msg.roomId && msg.roomId !== this.roomId) return; // Prevent cross-room leakage
      const nextIds = new Set();
      for (const p of msg.participants || []) {
        nextIds.add(p.clientId);
        const prev = this.participants.get(p.clientId);
        this.participants.set(p.clientId, {
          ...p,
          renderCursor: prev?.renderCursor && p.cursor ? { ...prev.renderCursor } : p.cursor ? { ...p.cursor } : null,
        });
      }
      for (const oldId of Array.from(this.participants.keys())) {
        if (!nextIds.has(oldId)) this.participants.delete(oldId);
      }
      this._updateLiveStatusText();
      this.app.toolbarUI?.update();
      this.app.classroomUI?.update();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'scene:synced') {
      if (msg.senderClientId === this.clientId) return;
      this._applyRemoteScene(msg.scene, msg.deletedIds || []);
      return;
    }

    if (msg.type === 'elements:upserted') {
      if (msg.senderClientId === this.clientId) return;
      const page = this.app.scene.pages.find((p) => p.id === msg.pageId) || this.app.getPage();
      if (!page) return;
      for (const incoming of msg.elements || []) {
        this.deletedIds.delete(incoming.id);
        const idx = page.elements.findIndex((e) => e.id === incoming.id);
        if (idx === -1) page.elements.push(incoming);
        else page.elements[idx] = incoming;
      }
      this.app.updateUI?.();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'elements:deleted') {
      if (msg.senderClientId === this.clientId) return;
      const page = this.app.scene.pages.find((p) => p.id === msg.pageId) || this.app.getPage();
      if (!page) return;
      const delSet = new Set(msg.ids || []);
      delSet.forEach((id) => this.deletedIds.add(id));
      for (const el of page.elements) {
        if (el.type === 'question' && el.targetElementId && delSet.has(el.targetElementId)) {
          el.targetElementId = null;
          el.anchorDeleted = true;
        }
      }
      page.elements = page.elements.filter((e) => !delSet.has(e.id));
      this.app.updateUI?.();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'question:added' || msg.type === 'question:updated') {
      const page = this.app.scene.pages.find((p) => p.id === msg.pageId) || this.app.getPage();
      if (!page || !msg.question) return;
      const idx = page.elements.findIndex((e) => e.id === msg.question.id);
      if (idx === -1) page.elements.push(msg.question);
      else page.elements[idx] = msg.question;
      this.app.updateUI?.();
      this.app.classroomUI?.update();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'pointer:ping' && msg.pointer) {
      if (msg.pointer.pageId && msg.pointer.pageId !== this.app.getPage().id) return;
      this.app.studentPointers.push({
        ...msg.pointer,
        createdAt: Date.now(),
      });
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'teacher:camera') {
      this.teacherViewport = { pageId: msg.pageId, camera: msg.camera };
      if (this.followingTeacher && msg.senderClientId !== this.clientId) {
        this._applyTeacherCamera(this.teacherViewport);
      }
      return;
    }

    if (msg.type === 'reaction:burst' && msg.reaction) {
      this.recentReactions.push({ ...msg.reaction, receivedAt: Date.now() });
      if (this.recentReactions.length > 12) this.recentReactions.shift();
      this.app.dialogs?.showToast(`${msg.reaction.emoji} ${msg.reaction.authorName}`, 'info');
      this.app.classroomUI?.update();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'chat:cursor' && msg.chat) {
      // The server excludes the sender's socket (see the WS route) because the
      // sender already applied its own bubble optimistically; this guard makes
      // that pairing explicit against a stray echo.
      if (msg.chat.clientId === this.clientId) return;
      this.cursorChats.push({ ...msg.chat, receivedAt: Date.now() });
      if (this.cursorChats.length > 12) this.cursorChats.shift();
      this.app.requestRender?.();
      return;
    }

    if (msg.type === 'timer:synced' && msg.timerState) {
      this.app.timerUI?.applyRemoteTimerState?.(msg.timerState);
      return;
    }

    if (msg.type === 'vote:session' && msg.session) {
      // The reveal counts ride at the message root (server wire shape),
      // not inside the session object — pass them through explicitly.
      this.app.votingUI?.applyRemoteSession?.(msg.session, msg.counts);
      return;
    }

    if (msg.type === 'spotlight:synced') {
      // Sender already has its own lens; teachers/editors keep local control
      // of theirs. Only viewers/questioners adopt the teacher's spotlight.
      if (msg.senderClientId && msg.senderClientId === this.clientId) return;
      if (this.canEditBoard()) return;
      this.app.applyRemoteSpotlight?.(msg.spotlight);
      return;
    }

    if (msg.type === 'vote:cast') {
      // No sender-echo filter: a viewer's own dot is applied from this
      // authoritative count too, because the viewer never mutates locally.
      // A null count (secret session) applies nothing; the voter still gets
      // an ack so a hidden vote does not feel like a swallowed click.
      if (msg.votes === null || msg.votes === undefined) {
        if (msg.senderClientId === this.clientId) {
          this.app.dialogs?.showToast('🗳 Vote counted — hidden until reveal.', 'info');
        }
        return;
      }
      this.app.votingUI?.applyRemoteVote?.(msg.pageId, msg.elementId, msg.votes);
      return;
    }

    if (msg.type === 'error' && msg.error) {
      this.app.dialogs?.showToast(msg.error);
    }
  }

  // mode 'merge' (live collab): a recency union — the newer copy of each
  // element wins, ties go to the remote/server copy, local-only elements
  // survive. Mode 'replace' (stored snapshots, #/b/{id}): the remote scene IS
  // the document — a snapshot link must show exactly what was stored, never
  // the viewer's own newer copies of the same element ids.
  _applyRemoteScene(remoteScene, deletedIds = [], mode = 'merge') {
    if (!remoteScene || !Array.isArray(remoteScene.pages)) return;
    this._suppressOutboundSync = true;
    try {
      deletedIds.forEach((id) => this.deletedIds.add(id));
      const currentCamByPage = new Map(
        this.app.scene.pages.map((p) => [p.id, { ...p.camera }])
      );
      const localElementsByPage = new Map(
        this.app.scene.pages.map((p) => [p.id, p.elements || []])
      );
      this.app.scene.title = remoteScene.title || this.app.scene.title;
      // Element-level merge, mirroring the server's _mergeSceneIntoRoom: a
      // full-scene broadcast is a UNION of elements where the newer
      // updatedAt wins. The old wholesale replace reverted a second client's
      // in-flight edit (e.g. a vote cast a moment ago) whenever anyone else's
      // slightly older scene arrived — last-write-wins at scene granularity.
      this.app.scene.pages = remoteScene.pages.map((p) => ({
        ...p,
        camera: currentCamByPage.get(p.id) || p.camera || { x: 0, y: 0, zoom: 1 },
        elements:
          mode === 'replace'
            ? (p.elements || []).filter((e) => !this.deletedIds.has(e.id))
            : this._mergeElementsByRecency(
                localElementsByPage.get(p.id) || [],
                p.elements || []
              ).filter((e) => !this.deletedIds.has(e.id)),
      }));
      if (!this.app.scene.pages.some((p) => p.id === this.app.scene.activePageId)) {
        this.app.scene.activePageId =
          remoteScene.activePageId &&
          this.app.scene.pages.some((p) => p.id === remoteScene.activePageId)
            ? remoteScene.activePageId
            : this.app.scene.pages[0]?.id;
      }
      this.app.updateUI?.();
      this.app.requestRender?.();
    } finally {
      this._suppressOutboundSync = false;
    }
  }

  // Union of local and remote elements; the newer updatedAt wins (ties go to
  // the remote copy, matching the server). Local-only elements survive —
  // deletions travel through deletedIds, never through absence.
  _mergeElementsByRecency(localEls = [], remoteEls = []) {
    const byId = new Map();
    for (const el of localEls) byId.set(el.id, el);
    for (const el of remoteEls) {
      const prev = byId.get(el.id);
      if (!prev || (el.updatedAt || 0) >= (prev.updatedAt || 0)) {
        byId.set(el.id, el);
      }
    }
    return Array.from(byId.values());
  }

  _applyTeacherCamera(tv) {
    if (!tv || !tv.camera) return;
    if (tv.pageId && tv.pageId !== this.app.scene.activePageId) {
      const exists = this.app.scene.pages.some((p) => p.id === tv.pageId);
      if (exists) this.app.scene.activePageId = tv.pageId;
    }
    const page = this.app.getPage();
    page.camera = {
      x: Number(tv.camera.x) || 0,
      y: Number(tv.camera.y) || 0,
      zoom: Number(tv.camera.zoom) || 1,
    };
    this.app.updateUI?.();
    this.app.requestRender?.();
  }

  setFollowTeacher(enabled) {
    this.followingTeacher = Boolean(enabled);
    if (this.followingTeacher && this.teacherViewport) {
      this._applyTeacherCamera(this.teacherViewport);
    }
    this.app.updateUI?.();
    this.app.classroomUI?.update();
  }

  broadcastSceneChange(deletedIds = []) {
    if (this._suppressOutboundSync) return;
    deletedIds.forEach((id) => this.deletedIds.add(id));
    if (this.status !== 'live' || !this.roomId) return;
    if (!this.canEditBoard()) return;

    const payload = {
      type: 'scene:sync',
      scene: this.app.scene,
      deletedIds: Array.from(this.deletedIds),
    };
    this._sendWsOrRest(payload);
  }

  broadcastQuestionAdded(question) {
    if (this.status !== 'live' || !this.roomId) return;
    this._sendWsOrRest({
      type: 'question:add',
      pageId: this.app.getPage().id,
      question,
    });
  }

  broadcastQuestionUpdate(questionId, updates) {
    if (this.status !== 'live' || !this.roomId) return;
    this._sendWsOrRest({
      type: 'question:update',
      pageId: this.app.getPage().id,
      questionId,
      ...updates,
    });
  }

  broadcastPointerPing(pointer) {
    if (this.status !== 'live' || !this.roomId) return;
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(
        JSON.stringify({
          type: 'pointer:ping',
          pageId: this.app.getPage().id,
          pointer,
        })
      );
    }
  }

  broadcastTeacherCamera() {
    if (this.status !== 'live' || this.role !== 'teacher' || !this.roomId) return;
    if (this.ws && this.ws.readyState === 1) {
      const page = this.app.getPage();
      this.ws.send(
        JSON.stringify({
          type: 'teacher:camera',
          pageId: page.id,
          camera: page.camera,
        })
      );
    }
  }

  toggleHandRaised(nextState = !this.handRaised) {
    this.handRaised = Boolean(nextState);
    if (this.status === 'live' && this.ws && this.ws.readyState === 1) {
      const name = this.app.classroomUI?.getStudentName() || (this.role === 'teacher' ? 'Teacher' : 'Student');
      this.ws.send(
        JSON.stringify({
          type: 'presence:update',
          name,
          color: this.color,
          pageId: this.app.getPage().id,
          handRaised: this.handRaised,
        })
      );
    }
    this.app.classroomUI?.update();
  }

  sendReaction(emoji = '👍', anchor = null) {
    const authorName =
      this.app.classroomUI?.getStudentName() || (this.role === 'teacher' ? 'Teacher' : 'Student');
    const rx = {
      id: uid('rx'),
      emoji,
      authorName,
      color: this.color,
      createdAt: Date.now(),
      // World-point anchors are only meaningful on the page they were sent
      // from; without this, an emote on page B floats over page A's content
      // at the same world coordinates. Element anchors are looked up on the
      // active page at draw time and need no scoping.
      pageId: this.app.getPage?.()?.id ?? null,
    };
    const payload = {
      type: 'reaction:send',
      emoji,
      authorName,
      color: this.color,
      pageId: rx.pageId,
    };
    // An optional anchor floats the emote beside a board element or world
    // point; garbage fields are stripped by the server like anywhere else.
    if (anchor) {
      if (anchor.elementId) {
        rx.elementId = anchor.elementId;
        payload.elementId = anchor.elementId;
      }
      if (Number.isFinite(anchor.x) && Number.isFinite(anchor.y)) {
        rx.x = anchor.x;
        rx.y = anchor.y;
        payload.x = anchor.x;
        payload.y = anchor.y;
      }
    }
    this.recentReactions.push(rx);
    if (this.recentReactions.length > 12) this.recentReactions.shift();
    if (this.status === 'live' && this.roomId) {
      this._sendWsOrRest(payload);
    }
    this.app.dialogs?.showToast(`${emoji} ${authorName}`, 'info');
    this.app.classroomUI?.update();
  }

  // Cursor chat: a short speech bubble at the world cursor position. Open to
  // every role — it is social, not board content — and never persisted, so
  // late joiners never see past bubbles.
  broadcastCursorChat(text, pageId = null, worldPt = null) {
    const trimmed = String(text || '').trim().slice(0, 140);
    if (!trimmed) return null;
    if (!worldPt || !Number.isFinite(worldPt.x) || !Number.isFinite(worldPt.y)) return null;
    const page = this.app.getPage();
    const chat = {
      id: uid('cx'),
      clientId: this.clientId,
      name: this.app.classroomUI?.getStudentName() || (this.role === 'teacher' ? 'Teacher' : 'Student'),
      color: this.color,
      text: trimmed,
      pageId: pageId || page.id,
      x: worldPt.x,
      y: worldPt.y,
      at: Date.now(),
    };
    // The sender applies its own bubble optimistically so it draws identically
    // to remote ones; the server broadcast then excludes this socket.
    this.cursorChats.push({ ...chat, receivedAt: Date.now() });
    if (this.cursorChats.length > 12) this.cursorChats.shift();
    if (this.status === 'live' && this.roomId) {
      this._sendWsOrRest({
        type: 'chat:cursor',
        pageId: chat.pageId,
        text: chat.text,
        authorName: chat.name,
        color: chat.color,
        x: chat.x,
        y: chat.y,
      });
    }
    this.app.requestRender?.();
    return chat;
  }

  // Bubbles live 15 seconds; anything older stops rendering.
  activeCursorChats() {
    const now = Date.now();
    return this.cursorChats.filter((c) => now - (c.receivedAt ?? c.at ?? now) < 15000);
  }

  broadcastTimerState(timerState) {
    if (this.status !== 'live' || !this.roomId) return;
    if (this.role !== 'teacher' && this.role !== 'editor') return;
    this._sendWsOrRest({
      type: 'timer:sync',
      timerState,
    });
  }

  broadcastVoteSession(active, secret = false) {
    if (this.status !== 'live' || !this.roomId) return;
    if (this.role !== 'teacher' && this.role !== 'editor') return;
    this._sendWsOrRest({ type: 'vote:session', active: Boolean(active), secret: Boolean(secret) });
  }

  // Teacher/editor only: mirror the local spotlight lens to the room. The
  // server sanitizes every field before re-broadcast, so the snapshot is
  // sent as-is.
  broadcastSpotlight(spotlight) {
    if (this.status !== 'live' || !this.roomId) return;
    if (this.role !== 'teacher' && this.role !== 'editor') return;
    this._sendWsOrRest({ type: 'spotlight:sync', spotlight: spotlight || null });
  }

  // Viewer dots ride on their own channel: broadcastSceneChange is blocked for
  // students, but a vote must still reach everyone in the room.
  broadcastVoteCast(pageId, elementId, votes) {
    if (this.status !== 'live' || !this.roomId) return;
    this._sendWsOrRest({ type: 'vote:cast', pageId, elementId, votes });
  }

  sendCursorUpdate(worldPt, selectionIds = []) {
    if (this.status !== 'live' || !this.ws || this.ws.readyState !== 1) return;
    const now = Date.now();
    if (now - this._lastCursorSentAt < 50) return; // Throttle cursor updates to 20Hz
    this._lastCursorSentAt = now;
    const name = this.app.classroomUI?.getStudentName() || (this.role === 'teacher' ? 'Teacher' : 'Student');
    this.ws.send(
      JSON.stringify({
        type: 'presence:update',
        name,
        color: this.color,
        pageId: this.app.getPage().id,
        handRaised: this.handRaised,
        cursor:
          worldPt && Number.isFinite(worldPt.x) && Number.isFinite(worldPt.y)
            ? { x: Math.round(worldPt.x), y: Math.round(worldPt.y) }
            : null,
        selectionIds,
      })
    );
  }

  getInterpolatedRemoteCursors(activePageId) {
    const out = [];
    for (const p of this.participants.values()) {
      if (p.clientId === this.clientId) continue;
      if (p.pageId && p.pageId !== activePageId) continue; // Hide cursors on other pages
      if (!p.cursor || !Number.isFinite(p.cursor.x) || !Number.isFinite(p.cursor.y)) continue;
      if (!p.renderCursor) {
        p.renderCursor = { x: p.cursor.x, y: p.cursor.y };
      } else {
        p.renderCursor.x += (p.cursor.x - p.renderCursor.x) * 0.42;
        p.renderCursor.y += (p.cursor.y - p.renderCursor.y) * 0.42;
      }
      out.push({
        clientId: p.clientId,
        name: p.name || 'Participant',
        color: p.color || '#2563eb',
        role: p.role || 'viewer',
        x: p.renderCursor.x,
        y: p.renderCursor.y,
        selectionIds: p.selectionIds || [],
      });
    }
    return out;
  }

  _sendWsOrRest(payload) {
    if (this.ws && this.ws.readyState === 1) {
      this.ws.send(JSON.stringify(payload));
      return;
    }
    if (typeof fetch !== 'undefined' && this.roomId) {
      fetch(this.getEndpoint(`/api/rooms/${encodeURIComponent(this.roomId)}/ops`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          token: this.activeToken,
          clientId: this.clientId,
        }),
      }).catch(() => {});
    }
  }
}
