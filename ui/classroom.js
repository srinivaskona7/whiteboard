// ui/classroom.js — Short Sharing Links, Live WebSocket Classroom, Named Pointers & Anchored Q&A
import { createElement, uid } from '../scene/model.js';
import { hitTestScene } from '../scene/hit.js';
import { encodeSceneToHash, decodeSceneFromHash } from '../scene/storage.js';
import { escapeXml } from '../render/svg-export.js';
import { renderUrlQrSvg } from './qr.js';

export const CLASSROOM_CHANNEL_NAME = 'studioboard_classroom_v1';
export const STUDENT_NAME_STORAGE_KEY = 'studioboard_student_name_v1';

export function encodeClassroomShareHash(scene, roomCode = 'DEVOPS-101') {
  const { hash: baseHash } = encodeSceneToHash(scene);
  const encodedScene = baseHash.replace(/^#scene=/, '');
  const safeRoom = encodeURIComponent((roomCode || 'DEVOPS-101').trim());
  return `#classroom=1&room=${safeRoom}&scene=${encodedScene}`;
}

export function buildClassroomShareHash(scene, roomCode = 'DEVOPS-101') {
  const hash = encodeClassroomShareHash(scene, roomCode);
  return { hash, length: hash.length };
}

export function pointAtBoardLocation(page, worldPt, { authorName = 'Student' } = {}) {
  const cleanName = String(authorName || '').trim();
  if (!cleanName) {
    throw new Error('Participant display name is required before pointing.');
  }
  const hit = hitTestScene(page, worldPt.x, worldPt.y, { includeLocked: true });
  const target = hit && hit.type !== 'question' ? hit : null;
  const targetElementName = target ? target.text || target.name || target.type : '';
  return {
    id: uid('ptr'),
    x: worldPt.x,
    y: worldPt.y,
    authorName: cleanName,
    targetElementId: target?.id || null,
    targetElementName,
    targetLabel: targetElementName || 'Canvas Point',
    createdAt: Date.now(),
  };
}

export function attachQuestionToBoard(
  page,
  worldPt,
  { authorName = 'Student', questionText = 'Question?' } = {}
) {
  const cleanName = String(authorName || '').trim();
  if (!cleanName) {
    throw new Error('Participant display name is required before asking a question.');
  }
  const hit = hitTestScene(page, worldPt.x, worldPt.y, { includeLocked: true });
  const target = hit && hit.type !== 'question' ? hit : null;
  const qx = target ? Math.round(target.x + Math.max(0, target.w - 30)) : Math.round(worldPt.x);
  const qy = target ? Math.round(target.y - 36) : Math.round(worldPt.y);
  const offsetX = target ? qx - target.x : 0;
  const offsetY = target ? qy - target.y : 0;
  const qEl = createElement('question', {
    x: qx,
    y: qy,
    w: 220,
    h: 78,
    text: String(questionText || '').trim(),
    authorName: cleanName,
    targetElementId: target?.id || null,
    targetElementName: target ? target.text || target.name || target.type : '',
    offsetX,
    offsetY,
    anchorDeleted: false,
    resolved: false,
    reply: '',
  });
  page.elements.push(qEl);
  return qEl;
}

export function parseClassroomHash(hashStr = '') {
  if (!hashStr || !hashStr.startsWith('#classroom=1')) return null;
  const query = hashStr.slice(1);
  const params = new URLSearchParams(query);
  const room = params.get('room') || 'DEVOPS-101';
  const sceneParam = params.get('scene');
  let scene = null;
  if (sceneParam) {
    try {
      scene = decodeSceneFromHash(`#scene=${sceneParam}`);
    } catch {
      scene = null;
    }
  }
  return { isClassroom: true, room, scene };
}

export class ClassroomTool {
  constructor(app) {
    this.app = app;
  }

  onPointerDown(world) {
    const page = this.app.getPage();
    const hit = hitTestScene(page, world.x, world.y, { includeLocked: true });
    const targetEl = hit && hit.type !== 'question' ? hit : null;
    const targetLabel =
      targetEl?.text || targetEl?.name || (targetEl ? targetEl.type : 'Canvas Point');

    const proceedWithAuthor = (authorName) => {
      if (this.app.activeTool === 'pointer') {
        this.app.classroomUI.recordPointer({
          id: uid('ptr'),
          x: world.x,
          y: world.y,
          authorName,
          targetElementId: targetEl?.id || null,
          targetLabel,
          createdAt: Date.now(),
        });
        this.app.dialogs.showToast(`📍 ${authorName} pointed at ${targetLabel}`);
        return;
      }

      if (this.app.activeTool === 'question') {
        const draft = this.app.classroomUI.getDraftQuestion();
        if (draft) {
          this.app.classroomUI.createQuestionAt(world.x, world.y, draft, targetEl, authorName);
        } else {
          this.app.dialogs.openPromptModal({
            title: `Ask Question (${authorName})`,
            label: `Attach question to ${targetLabel}:`,
            defaultValue: 'How does traffic fail over if this component goes down?',
            confirmLabel: 'Pin Question to Board',
            onConfirm: (val) => {
              if (val && val.trim()) {
                this.app.classroomUI.createQuestionAt(
                  world.x,
                  world.y,
                  val.trim(),
                  targetEl,
                  authorName
                );
              }
            },
          });
        }
      }
    };

    const currentName = (this.app.classroomUI.getStudentName() || '').trim();
    if (!currentName) {
      this.app.dialogs.openPromptModal({
        title: 'Enter Your Name First',
        label: 'Your display name is required before pointing or asking a question:',
        defaultValue: '',
        confirmLabel: 'Save Name & Continue',
        onConfirm: (entered) => {
          const clean = String(entered || '').trim();
          if (!clean) {
            this.app.dialogs.showToast('Please enter your name before pointing or asking a question.');
            return;
          }
          this.app.classroomUI.setStudentName(clean);
          proceedWithAuthor(clean);
        },
      });
      return;
    }

    proceedWithAuthor(currentName);
  }

  onPointerMove() {}
  onPointerUp() {}
}

export function initClassroomUI(app) {
  const panel = document.getElementById('wb-classroom-panel');
  if (!panel) {
    return {
      update() {},
      toggle() {},
      openJoinBanner() {},
      getStudentName: () => 'Student',
      setStudentName() {},
      getDraftQuestion: () => '',
      recordPointer() {},
      createQuestionAt() {},
      focusQuestion() {},
    };
  }

  let studentName = localStorage.getItem(STUDENT_NAME_STORAGE_KEY) || '';
  let draftQuestion = '';
  let filterUnansweredOnly = false;
  let activeShortLink = '';
  let activeLinkLabel = '';
  let showQrCode = false;
  let selectedTtlHours = '24'; // '24' | '168' | '0'

  let channel = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(CLASSROOM_CHANNEL_NAME);
      channel.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg || typeof msg !== 'object') return;
        // Only use BroadcastChannel when not connected to a live WebSocket room
        if (app.collab?.status === 'live') return;
        if (msg.type === 'pointer' && msg.pointer) {
          app.studentPointers.push({ ...msg.pointer, createdAt: Date.now() });
          app.requestRender();
        } else if (msg.type === 'question' && msg.question) {
          const page = app.getPage();
          if (!page.elements.some((e) => e.id === msg.question.id)) {
            page.elements.push(msg.question);
            app.commitChange();
            app.updateUI();
            app.requestRender();
          }
        }
      };
    } catch {
      channel = null;
    }
  }

  function setStudentName(name) {
    studentName = (name || '').trim();
    try {
      localStorage.setItem(STUDENT_NAME_STORAGE_KEY, studentName);
    } catch {
      // Ignore storage errors
    }
    app.collab?.sendCursorUpdate(null, Array.from(app.selectedIds || []));
  }

  function recordPointer(ptr) {
    app.studentPointers.push(ptr);
    app.requestRender();
    if (app.collab?.status === 'live') {
      app.collab.broadcastPointerPing(ptr);
    } else if (channel) {
      try {
        channel.postMessage({ type: 'pointer', pointer: ptr });
      } catch {
        // Ignore
      }
    }
  }

  function createQuestionAt(x, y, text, targetEl = null, authorOverride = null) {
    const page = app.getPage();
    const author = (authorOverride || studentName || '').trim();
    if (!author) {
      app.dialogs.showToast('Please set your display name before asking a question.');
      return null;
    }
    const hitCandidate =
      targetEl ||
      (() => {
        const h = hitTestScene(page, x, y, page.camera?.zoom || 1);
        return h && h.type !== 'question' ? h : null;
      })();
    const qx = hitCandidate ? Math.round(hitCandidate.x + Math.max(0, hitCandidate.w - 30)) : Math.round(x);
    const qy = hitCandidate ? Math.round(hitCandidate.y - 36) : Math.round(y);
    const offsetX = hitCandidate ? qx - hitCandidate.x : 0;
    const offsetY = hitCandidate ? qy - hitCandidate.y : 0;
    const anchorRx = hitCandidate && hitCandidate.w > 0 ? Math.max(0, Math.min(1, offsetX / hitCandidate.w)) : 0.85;
    const anchorRy = hitCandidate && hitCandidate.h > 0 ? Math.max(0, Math.min(1, (y - hitCandidate.y) / hitCandidate.h)) : 0;

    const qEl = createElement('question', {
      x: qx,
      y: qy,
      w: 220,
      h: 78,
      text: text.trim(),
      authorName: author,
      targetElementId: hitCandidate?.id || null,
      targetElementName: hitCandidate ? hitCandidate.text || hitCandidate.name || hitCandidate.type : '',
      offsetX,
      offsetY,
      anchorRx,
      anchorRy,
      anchorDeleted: false,
      resolved: false,
      reply: '',
    });

    page.elements.push(qEl);
    draftQuestion = '';
    if (app.collab?.status === 'live') {
      app.collab.broadcastQuestionAdded(qEl);
    } else {
      app.commitChange();
      if (channel) {
        try {
          channel.postMessage({ type: 'question', question: qEl });
        } catch {
          // Ignore
        }
      }
    }
    if (!app.toolLock) app.setTool('select');
    app.selectedIds = new Set([qEl.id]);
    app.updateUI();
    app.requestRender();
    render();
    app.dialogs.showToast('❓ Question pinned to component!');
    return qEl;
  }

  function focusQuestion(qId) {
    const page = app.getPage();
    const qEl = page.elements.find((e) => e.id === qId);
    if (!qEl) return;
    const target = qEl.targetElementId
      ? page.elements.find((e) => e.id === qEl.targetElementId)
      : qEl;
    const focusEl = target || qEl;
    const cx = focusEl.x + (focusEl.w || 160) / 2;
    const cy = focusEl.y + (focusEl.h || 80) / 2;
    page.camera.x = Math.round(window.innerWidth / 2 - cx * page.camera.zoom);
    page.camera.y = Math.round(window.innerHeight / 2 - cy * page.camera.zoom);
    app.selectedIds = new Set([qEl.id]);
    recordPointer({
      id: uid('ptr'),
      x: cx,
      y: cy,
      authorName: qEl.authorName || 'Student',
      targetElementId: focusEl.id,
      targetLabel: qEl.targetElementName || 'Question',
      createdAt: Date.now(),
    });
    app.updateUI();
    app.requestRender();
  }

  async function copyVerifiedLink(url, label) {
    activeShortLink = url;
    activeLinkLabel = label;
    try {
      await navigator.clipboard.writeText(url);
      app.dialogs.showToast(`🔗 Copied ${label} (${url.length} chars)`);
    } catch {
      app.dialogs.showToast(`Created ${label}: ${url}`);
    }
    render();
  }

  function getTtlMs() {
    const hrs = Number(selectedTtlHours);
    return hrs > 0 ? hrs * 3600 * 1000 : null;
  }

  function render() {
    if (panel.classList.contains('wb-hidden')) return;
    const page = app.getPage();
    const allQuestions = page.elements.filter((e) => e.type === 'question' && !e.hidden);
    const unansweredCount = allQuestions.filter((q) => !q.resolved && !q.reply).length;
    const visibleQuestions = filterUnansweredOnly
      ? allQuestions.filter((q) => !q.resolved)
      : allQuestions;

    const collab = app.collab;
    const isLive = collab?.status === 'live';
    const isSnapshot = collab?.status === 'snapshot';
    const participants = collab ? Array.from(collab.participants.values()) : [];

    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>🎓 Live Classroom & Short Share (${allQuestions.length})</strong>
        <button type="button" class="wb-icon-btn" id="btn-close-classroom" aria-label="Close Classroom Panel">✕</button>
      </div>
      <div class="wb-panel-body">
        <div class="wb-prop-section">
          <div class="wb-prop-title">Connection & Access Status</div>
          <div class="wb-status-card ${isLive ? 'wb-status-live' : collab?.backendAvailable ? 'wb-status-live' : isSnapshot ? 'wb-status-ro' : 'wb-status-offline'}">
            <div><strong>${escapeXml(collab?.statusMessage || 'Local board')}</strong></div>
            <div class="wb-muted" style="font-size:11px;margin-top:2px;">
              Backend: <code>${escapeXml(collab?.apiBase || (typeof window !== 'undefined' ? window.location.origin : 'same-origin'))}</code> · ${collab?.backendAvailable ? '✓ Online' : 'Offline'}
            </div>
            ${
              !collab?.backendAvailable && !isLive
                ? `<div class="wb-muted" style="font-size:11px;margin-top:4px;">Short links and cross-device live collaboration require a reachable collaboration server.</div>
                   <div style="display:flex;gap:4px;margin-top:6px;">
                     <input type="text" id="cls-backend-url" class="wb-input" style="font-size:11px;padding:3px 6px;" placeholder="http://127.0.0.1:4179" value="${escapeXml(collab?.apiBase || 'http://127.0.0.1:4179')}" aria-label="Collaboration Server URL"/>
                     <button type="button" class="wb-btn wb-sm" id="btn-cls-connect-backend">Connect</button>
                   </div>`
                : ''
            }
            ${
              collab?.expiresAt
                ? `<div class="wb-muted" style="font-size:11px;">Expires: ${new Date(collab.expiresAt).toLocaleString()}</div>`
                : ''
            }
          </div>
          ${
            isLive
              ? `<div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:6px;">
                  ${participants
                    .map(
                      (p) =>
                        `<span class="wb-participant-chip" style="border-color:${escapeXml(p.color || '#2563eb')}"><i style="background:${escapeXml(p.color || '#2563eb')}"></i>${p.handRaised ? '✋ ' : ''}${escapeXml(p.name || 'User')} (${escapeXml(p.role)})</span>`
                    )
                    .join('')}
                </div>
                ${
                  collab.role !== 'teacher'
                    ? `<div class="wb-prop-row" style="margin-top:6px;">
                        <label style="display:flex;align-items:center;gap:6px;font-size:12px;">
                          <input type="checkbox" id="chk-follow-teacher" ${collab.followingTeacher ? 'checked' : ''}/>
                          Follow Teacher Camera
                        </label>
                        ${
                          collab.followingTeacher
                            ? `<button type="button" class="wb-btn wb-sm wb-danger" id="btn-stop-following">Stop Following</button>`
                            : ''
                        }
                      </div>`
                    : `<div class="wb-btn-group" style="margin-top:6px;">
                        <button type="button" class="wb-btn wb-sm" id="btn-cls-broadcast-view" title="Broadcast current page and camera viewport to students following you">📡 Broadcast My View</button>
                        <button type="button" class="wb-btn wb-sm" id="btn-cls-shared-timer" title="Open Shared Classroom Timer">⏱ Shared Timer</button>
                      </div>`
                }`
              : ''
          }
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">Facilitation: Hand & Reactions</div>
          <div class="wb-btn-group" style="margin-bottom:6px;">
            <button type="button" class="wb-btn wb-sm ${collab?.handRaised ? 'active wb-primary' : ''}" id="btn-cls-raise-hand">
              ✋ ${collab?.handRaised ? 'Lower Hand' : 'Raise Hand'}
            </button>
            <button type="button" class="wb-btn wb-sm" data-cls-reaction="👍" title="Send Thumbs Up">👍</button>
            <button type="button" class="wb-btn wb-sm" data-cls-reaction="👏" title="Send Applause">👏</button>
            <button type="button" class="wb-btn wb-sm" data-cls-reaction="💡" title="Got It / Idea">💡</button>
            <button type="button" class="wb-btn wb-sm" data-cls-reaction="❓" title="Need Clarification">❓</button>
            <button type="button" class="wb-btn wb-sm" data-cls-reaction="✅" title="Ready / Done">✅</button>
          </div>
          ${
            collab?.recentReactions?.length > 0
              ? `<div class="wb-muted" style="font-size:11px;display:flex;gap:6px;flex-wrap:wrap;">
                  ${collab.recentReactions
                    .slice(-4)
                    .map((r) => `<span>${escapeXml(r.emoji)} ${escapeXml(r.authorName)}</span>`)
                    .join(' · ')}
                </div>`
              : ''
          }
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">Short Sharing Links (Backend Stored)</div>
          <label class="wb-prop-row">
            <span>Link Expiration</span>
            <select id="cls-link-ttl" aria-label="Share Link Expiration">
              <option value="24" ${selectedTtlHours === '24' ? 'selected' : ''}>24 hours</option>
              <option value="168" ${selectedTtlHours === '168' ? 'selected' : ''}>7 days</option>
              <option value="0" ${selectedTtlHours === '0' ? 'selected' : ''}>Never expire</option>
            </select>
          </label>
          <div class="wb-btn-group" style="flex-direction:column;gap:6px;">
            <button type="button" class="wb-btn wb-sm wb-primary" id="btn-cls-live-student">
              🎓 ${isLive ? 'Copy Student Join Link (Viewer / Q&A)' : 'Start Live Room & Copy Student Link'}
            </button>
            <button type="button" class="wb-btn wb-sm" id="btn-cls-live-questioner">
              ❓ ${isLive ? 'Copy Questioner Link (Pointer & Q&A)' : 'Start Live Room & Copy Questioner Link'}
            </button>
            ${
              !isLive || collab.role === 'teacher'
                ? `<button type="button" class="wb-btn wb-sm" id="btn-cls-live-editor">
                    ✏️ ${isLive && collab.editorToken ? 'Copy Authorized Editor Invite Link' : 'Start Live Room & Copy Editor Invite'}
                  </button>`
                : ''
            }
            <button type="button" class="wb-btn wb-sm" id="btn-cls-short-snapshot">
              📸 Create Read-Only Short Snapshot (#/b/…)
            </button>
          </div>
          ${
            activeShortLink
              ? `<div class="wb-short-link-box" style="margin-top:8px;padding:8px;border:1px solid var(--border-subtle);border-radius:8px;background:var(--bg-muted);">
                  <div style="font-size:11px;font-weight:600;margin-bottom:4px;">${escapeXml(activeLinkLabel)} (${activeShortLink.length} chars)</div>
                  <div style="display:flex;gap:4px;">
                    <input type="text" id="cls-short-url-output" class="wb-input" readonly value="${escapeXml(activeShortLink)}" style="font-size:11px;"/>
                    <button type="button" class="wb-btn wb-sm" id="btn-toggle-qr">${showQrCode ? 'Hide QR' : 'QR'}</button>
                  </div>
                  ${showQrCode ? `<div style="display:flex;justify-content:center;padding-top:8px;">${renderUrlQrSvg(activeShortLink, 128)}</div>` : ''}
                </div>`
              : ''
          }
          <details style="margin-top:6px;font-size:11px;">
            <summary class="wb-muted" style="cursor:pointer;">Offline Fallback (Embedded #scene=… URL)</summary>
            <div style="padding-top:6px;display:flex;flex-direction:column;gap:4px;">
              <span class="wb-muted">Embeds full board in URL hash for serverless static use (can be long):</span>
              <button type="button" class="wb-btn wb-sm" id="btn-cls-copy-fallback-link">Copy Offline Fallback URL</button>
            </div>
          </details>
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">Your Classroom Identity (Required to Point/Ask)</div>
          <label class="wb-prop-row">
            <span>Display Name</span>
            <input type="text" id="cls-student-name" class="wb-input" style="width:148px" value="${escapeXml(studentName)}" placeholder="Enter your name..." aria-label="Participant Name"/>
          </label>
          <div style="display:flex;flex-direction:column;gap:6px;margin-top:4px;">
            <textarea id="cls-question-draft" class="wb-input" rows="2" placeholder="Type a question and click a component on canvas...">${escapeXml(draftQuestion)}</textarea>
            <div class="wb-btn-group">
              <button type="button" class="wb-btn wb-sm ${app.activeTool === 'pointer' ? 'active wb-primary' : ''}" id="btn-cls-point-tool">📍 Point (W)</button>
              <button type="button" class="wb-btn wb-sm ${app.activeTool === 'question' ? 'active wb-primary' : ''}" id="btn-cls-ask-tool">❓ Pin Question (Q)</button>
            </div>
          </div>
        </div>

        <div class="wb-prop-section">
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <div class="wb-prop-title" style="margin:0;">Questions (${visibleQuestions.length}/${allQuestions.length})</div>
            <button type="button" class="wb-btn wb-sm ${filterUnansweredOnly ? 'active wb-primary' : ''}" id="btn-filter-unanswered">
              ${filterUnansweredOnly ? `Unanswered (${unansweredCount})` : 'Filter Unanswered'}
            </button>
          </div>
          ${
            visibleQuestions.length === 0
              ? `<p class="wb-muted">No matching questions on this page.</p>`
              : `<div class="wb-question-list">
                  ${visibleQuestions
                    .map(
                      (q) => `
                    <div class="wb-question-card ${q.resolved ? 'resolved' : ''}">
                      <div class="wb-question-meta">
                        <strong>👤 ${escapeXml(q.authorName || 'Student')}</strong>
                        <span class="wb-question-badge">${q.resolved ? '✓ Resolved' : '● Open'}</span>
                      </div>
                      ${
                        q.anchorDeleted
                          ? `<div class="wb-question-target" style="color:#d97706;">⚠ Original component removed${q.targetElementName ? `: ${escapeXml(q.targetElementName)}` : ''}</div>`
                          : q.targetElementName
                            ? `<div class="wb-question-target">🔗 Attached to: <em>${escapeXml(q.targetElementName)}</em></div>`
                            : ''
                      }
                      <div class="wb-question-body">${escapeXml(q.text)}</div>
                      ${q.reply ? `<div class="wb-question-reply"><strong>Reply:</strong> ${escapeXml(q.reply)}</div>` : ''}
                      <div class="wb-btn-group" style="margin-top:6px;">
                        <button type="button" class="wb-btn wb-sm" data-focus-q="${escapeXml(q.id)}">🎯 Locate</button>
                        <button type="button" class="wb-btn wb-sm" data-reply-q="${escapeXml(q.id)}">💬 Reply</button>
                        <button type="button" class="wb-btn wb-sm" data-resolve-q="${escapeXml(q.id)}">${q.resolved ? '↺ Reopen' : '✓ Resolve'}</button>
                        ${
                          collab?.canEditBoard() !== false
                            ? `<button type="button" class="wb-btn wb-sm wb-danger" data-del-q="${escapeXml(q.id)}" aria-label="Delete Question">🗑</button>`
                            : ''
                        }
                      </div>
                    </div>
                  `
                    )
                    .join('')}
                </div>`
          }
        </div>
      </div>
    `;

    panel.querySelector('#btn-close-classroom')?.addEventListener('click', () => {
      panel.classList.add('wb-hidden');
      app.toolbarUI?.update();
    });

    panel.querySelector('#btn-cls-connect-backend')?.addEventListener('click', async () => {
      const urlVal = panel.querySelector('#cls-backend-url')?.value?.trim() || '';
      app.collab?.setApiBase(urlVal);
      const ok = await app.collab?.checkBackendHealth();
      if (ok) {
        app.dialogs.showToast(`✓ Connected to collaboration server (${app.collab.apiBase || 'same-origin'})`, 'success');
      } else {
        app.dialogs.showToast('Collaboration server not reachable at that URL.', 'warn');
      }
      render();
      app.toolbarUI?.update();
    });

    panel.querySelector('#cls-link-ttl')?.addEventListener('change', (e) => {
      selectedTtlHours = e.target.value;
    });

    panel.querySelector('#chk-follow-teacher')?.addEventListener('change', (e) => {
      app.collab?.setFollowTeacher(e.target.checked);
    });

    panel.querySelector('#btn-stop-following')?.addEventListener('click', () => {
      app.collab?.setFollowTeacher(false);
    });

    panel.querySelector('#btn-cls-broadcast-view')?.addEventListener('click', () => {
      app.collab?.broadcastTeacherCamera();
      app.dialogs.showToast('📡 Broadcasted current viewport to students following you.', 'info');
    });

    panel.querySelector('#btn-cls-shared-timer')?.addEventListener('click', () => {
      app.timerUI?.toggle();
    });

    panel.querySelector('#btn-cls-raise-hand')?.addEventListener('click', () => {
      app.collab?.toggleHandRaised();
    });

    panel.querySelectorAll('[data-cls-reaction]').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.collab?.sendReaction(btn.dataset.clsReaction);
      });
    });

    panel.querySelector('#btn-cls-live-student')?.addEventListener('click', async () => {
      try {
        if (app.collab?.status === 'live' && app.collab.roomId) {
          const url = app.collab.buildShortUrl(`#/r/${app.collab.roomId}`);
          await copyVerifiedLink(url, 'Student Live Join Link (Viewer / Q&A)');
        } else {
          const created = await app.collab.startOrUpdateLiveRoom({ expiresInMs: getTtlMs() });
          await copyVerifiedLink(created.viewerUrl, 'Student Live Join Link (Viewer / Q&A)');
        }
      } catch (err) {
        app.dialogs.showToast(err.message);
      }
    });

    panel.querySelector('#btn-cls-live-questioner')?.addEventListener('click', async () => {
      try {
        if (app.collab?.status === 'live' && app.collab.roomId) {
          const url = app.collab.buildShortUrl(`#/r/${app.collab.roomId}?role=questioner`);
          await copyVerifiedLink(url, 'Student Questioner Link (Pointer & Q&A)');
        } else {
          const created = await app.collab.startOrUpdateLiveRoom({ expiresInMs: getTtlMs() });
          const url = app.collab.buildShortUrl(`#/r/${created.roomId}?role=questioner`);
          await copyVerifiedLink(url, 'Student Questioner Link (Pointer & Q&A)');
        }
      } catch (err) {
        app.dialogs.showToast(err.message);
      }
    });

    panel.querySelector('#btn-cls-live-editor')?.addEventListener('click', async () => {
      try {
        if (app.collab?.status === 'live' && app.collab.roomId && app.collab.editorToken) {
          const url = app.collab.buildShortUrl(`#/r/${app.collab.roomId}?invite=${app.collab.editorToken}`);
          await copyVerifiedLink(url, 'Authorized Editor Invite Link');
        } else {
          const created = await app.collab.startOrUpdateLiveRoom({ expiresInMs: getTtlMs() });
          await copyVerifiedLink(created.editorUrl, 'Authorized Editor Invite Link');
        }
      } catch (err) {
        app.dialogs.showToast(err.message);
      }
    });

    panel.querySelector('#btn-cls-short-snapshot')?.addEventListener('click', async () => {
      try {
        const snap = await app.collab.createShortSnapshot(getTtlMs());
        await copyVerifiedLink(snap.url, 'Read-Only Short Snapshot Link');
      } catch (err) {
        app.dialogs.showToast(err.message);
      }
    });

    panel.querySelector('#btn-toggle-qr')?.addEventListener('click', () => {
      showQrCode = !showQrCode;
      render();
    });

    panel.querySelector('#btn-cls-copy-fallback-link')?.addEventListener('click', async () => {
      try {
        const hash = encodeClassroomShareHash(app.scene, app.collab?.roomId || 'DEVOPS-101');
        const url = `${window.location.origin}${window.location.pathname}${hash}`;
        await navigator.clipboard.writeText(url);
        app.dialogs.showToast(`Copied Offline Fallback URL (${url.length} chars)`);
      } catch (err) {
        app.dialogs.showToast(err.message || 'Could not generate fallback URL.');
      }
    });

    panel.querySelector('#cls-student-name')?.addEventListener('input', (e) => {
      setStudentName(e.target.value);
    });

    panel.querySelector('#cls-question-draft')?.addEventListener('input', (e) => {
      draftQuestion = e.target.value;
    });

    panel.querySelector('#btn-cls-point-tool')?.addEventListener('click', () => {
      app.setTool('pointer');
      render();
    });

    panel.querySelector('#btn-cls-ask-tool')?.addEventListener('click', () => {
      app.setTool('question');
      render();
    });

    panel.querySelector('#btn-filter-unanswered')?.addEventListener('click', () => {
      filterUnansweredOnly = !filterUnansweredOnly;
      render();
    });

    panel.querySelectorAll('[data-focus-q]').forEach((b) => {
      b.addEventListener('click', () => focusQuestion(b.dataset.focusQ));
    });

    panel.querySelectorAll('[data-reply-q]').forEach((b) => {
      b.addEventListener('click', () => {
        const qEl = page.elements.find((e) => e.id === b.dataset.replyQ);
        if (!qEl) return;
        app.dialogs.openPromptModal({
          title: 'Reply to Question',
          label: `Question from ${qEl.authorName}: "${qEl.text}"`,
          defaultValue: qEl.reply || '',
          confirmLabel: 'Save Reply',
          onConfirm: (val) => {
            qEl.reply = (val || '').trim();
            if (app.collab?.status === 'live') {
              app.collab.broadcastQuestionUpdate(qEl.id, { reply: qEl.reply });
            } else {
              app.commitChange();
            }
            app.requestRender();
            render();
          },
        });
      });
    });

    panel.querySelectorAll('[data-resolve-q]').forEach((b) => {
      b.addEventListener('click', () => {
        const qEl = page.elements.find((e) => e.id === b.dataset.resolveQ);
        if (!qEl) return;
        qEl.resolved = !qEl.resolved;
        if (app.collab?.status === 'live') {
          app.collab.broadcastQuestionUpdate(qEl.id, { resolved: qEl.resolved });
        } else {
          app.commitChange();
        }
        app.updateUI();
        app.requestRender();
        render();
      });
    });

    panel.querySelectorAll('[data-del-q]').forEach((b) => {
      b.addEventListener('click', () => {
        if (app.collab && !app.collab.canEditBoard()) {
          app.dialogs.showToast('Viewers cannot delete board questions.');
          return;
        }
        const delId = b.dataset.delQ;
        page.elements = page.elements.filter((e) => e.id !== delId);
        app.selectedIds.delete(delId);
        app.commitChange([delId]);
        app.updateUI();
        app.requestRender();
        render();
      });
    });
  }

  function toggle() {
    const willOpen = panel.classList.contains('wb-hidden');
    if (willOpen) {
      document.getElementById('wb-library-panel')?.classList.add('wb-hidden');
      document.getElementById('wb-layers-panel')?.classList.add('wb-hidden');
      app.clearPlacementPreview?.();
    }
    panel.classList.toggle('wb-hidden');
    if (!panel.classList.contains('wb-hidden')) {
      render();
      app.collab?.checkBackendHealth().then(() => {
        if (!panel.classList.contains('wb-hidden')) render();
        app.toolbarUI?.update();
      });
    }
    app.toolbarUI?.update();
  }

  return {
    update: render,
    toggle,
    openJoinBanner(room) {
      if (room && app.collab) app.collab.roomId = room;
      panel.classList.remove('wb-hidden');
      render();
    },
    getStudentName: () => studentName,
    setStudentName,
    getDraftQuestion: () => draftQuestion,
    recordPointer,
    createQuestionAt,
    focusQuestion,
  };
}
