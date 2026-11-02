// ui/classroom.js — Shareable Classroom Links, Student Join, Component Pointers & Attached Question Pins
import { createElement, uid } from '../scene/model.js';
import { hitTestScene } from '../scene/hit.js';
import { encodeSceneToHash, decodeSceneFromHash } from '../scene/storage.js';
import { escapeXml } from '../render/svg-export.js';

export const STUDENT_NAME_KEY = 'studioboard_student_name_v1';

export function buildClassroomShareHash(scene, roomCode = 'DEVOPS-101') {
  const { hash, bytes } = encodeSceneToHash(scene);
  const rawB64 = hash.replace(/^#scene=/, '');
  return {
    hash: `#classroom=1&room=${encodeURIComponent(roomCode)}&scene=${rawB64}`,
    bytes,
  };
}

export function parseClassroomHash(hashStr = '') {
  if (!hashStr || (!hashStr.startsWith('#classroom=') && !hashStr.startsWith('#scene='))) {
    return null;
  }
  if (hashStr.startsWith('#scene=')) {
    return { isClassroom: false, room: '', scene: decodeSceneFromHash(hashStr) };
  }
  const params = new URLSearchParams(hashStr.slice(1));
  const isClassroom = params.get('classroom') === '1';
  const room = params.get('room') || 'DEVOPS-101';
  const sceneB64 = params.get('scene') || '';
  const scene = sceneB64 ? decodeSceneFromHash(`#scene=${sceneB64}`) : null;
  return { isClassroom, room, scene };
}

export function pointAtBoardLocation(page, world, { authorName = 'Student', color = '#ec4899' } = {}) {
  const hit = hitTestScene(page, world.x, world.y, { includeLocked: true });
  const target =
    hit && hit.type !== 'question' && hit.type !== 'line' && hit.type !== 'arrow' ? hit : null;
  return {
    id: uid('ptr'),
    authorName: authorName.trim() || 'Student',
    color,
    x: world.x,
    y: world.y,
    targetElementId: target ? target.id : null,
    targetElementName: target ? target.text || target.stencilId || target.type : '',
    time: Date.now(),
  };
}

export function attachQuestionToBoard(
  page,
  world,
  { authorName = 'Student', questionText = 'How does this component work?' } = {}
) {
  const hit = hitTestScene(page, world.x, world.y, { includeLocked: true });
  const target =
    hit && hit.type !== 'question' && hit.type !== 'line' && hit.type !== 'arrow' ? hit : null;
  const x = target ? target.x + Math.max(0, target.w - 30) : Math.round(world.x);
  const y = target ? target.y - 36 : Math.round(world.y);
  const qEl = createElement('question', {
    x,
    y,
    w: 220,
    h: 76,
    authorName: authorName.trim() || 'Student',
    text: questionText.trim() || 'Question about this component',
    targetElementId: target ? target.id : null,
    targetElementName: target ? target.text || target.stencilId || target.type : '',
    offsetX: target ? x - target.x : 0,
    offsetY: target ? y - target.y : 0,
  });
  page.elements.push(qEl);
  return qEl;
}

export class ClassroomTool {
  constructor(app) {
    this.app = app;
  }

  onPointerDown(world) {
    const page = this.app.getPage();
    const authorName = this.app.classroomUI?.getStudentName() || 'Student';

    if (this.app.activeTool === 'pointer') {
      const ping = pointAtBoardLocation(page, world, { authorName });
      this.app.classroomUI?.recordPointer(ping, true);
      return;
    }

    if (this.app.activeTool === 'question') {
      const hit = hitTestScene(page, world.x, world.y, { includeLocked: true });
      const targetLabel =
        hit && hit.type !== 'question' ? hit.text || hit.stencilId || hit.type : 'this board location';
      const draft = this.app.classroomUI?.getDraftQuestion();
      if (draft) {
        this.app.classroomUI.createQuestionAt(world, draft);
        return;
      }
      this.app.dialogs.openPromptModal({
        title: `Ask Question (${authorName})`,
        label: `Attach question to ${targetLabel}:`,
        defaultValue: 'How does traffic fail over if this component goes down?',
        confirmLabel: 'Pin Question to Board',
        onConfirm: (val) => {
          if (!val || !val.trim()) return;
          this.app.classroomUI?.createQuestionAt(world, val.trim());
        },
      });
    }
  }

  onPointerMove() {}
  onPointerUp() {}
}

export function initClassroomUI(app) {
  const panel = document.getElementById('wb-classroom-panel');
  let studentName = '';
  try {
    studentName = localStorage.getItem(STUDENT_NAME_KEY) || 'Alex Rivera';
  } catch {
    studentName = 'Alex Rivera';
  }
  let roomCode = 'DEVOPS-101';
  let draftQuestion = '';
  const pointers = [];
  let channel = null;

  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel('studioboard_classroom');
      channel.onmessage = (ev) => {
        const msg = ev.data;
        if (!msg) return;
        if (msg.type === 'pointer' && msg.pointer) {
          pointers.push({ ...msg.pointer, time: Date.now() });
          app.classroomPointers = pointers;
          startPulseLoop();
          render();
        } else if (msg.type === 'question' && msg.question) {
          const page = app.getPage();
          if (!page.elements.some((e) => e.id === msg.question.id)) {
            page.elements.push(msg.question);
            app.commitChange();
            app.requestRender();
            render();
          }
        }
      };
    } catch {
      channel = null;
    }
  }

  let pulseTimer = null;
  function startPulseLoop() {
    if (pulseTimer) return;
    pulseTimer = setInterval(() => {
      const now = Date.now();
      const active = pointers.filter((p) => now - p.time <= 12000);
      pointers.length = 0;
      pointers.push(...active);
      app.classroomPointers = pointers;
      app.requestRender();
      if (pointers.length === 0) {
        clearInterval(pulseTimer);
        pulseTimer = null;
      }
    }, 60);
  }

  function setStudentName(name) {
    studentName = (name || '').trim() || 'Student';
    try {
      localStorage.setItem(STUDENT_NAME_KEY, studentName);
    } catch {
      // Ignore storage errors
    }
    app.toolbarUI?.update();
    render();
  }

  function recordPointer(ping, broadcast = true) {
    pointers.push(ping);
    app.classroomPointers = pointers;
    startPulseLoop();
    if (broadcast && channel) {
      channel.postMessage({ type: 'pointer', pointer: ping });
    }
    const targetDesc = ping.targetElementName ? `component "${ping.targetElementName}"` : `(${Math.round(ping.x)}, ${Math.round(ping.y)})`;
    app.dialogs?.showToast(`👆 ${ping.authorName} pointed to ${targetDesc}`);
    render();
  }

  function createQuestionAt(world, questionText) {
    const page = app.getPage();
    const qEl = attachQuestionToBoard(page, world, {
      authorName: studentName,
      questionText,
    });
    draftQuestion = '';
    app.selectedIds = new Set([qEl.id]);
    app.commitChange();
    if (channel) {
      channel.postMessage({ type: 'question', question: qEl });
    }
    app.dialogs?.showToast(
      `❓ ${studentName} attached a question${qEl.targetElementName ? ` to ${qEl.targetElementName}` : ''}`
    );
    if (!app.toolLock) app.setTool('select');
    app.updateUI();
    app.requestRender();
    render();
    return qEl;
  }

  function focusQuestion(qId) {
    const page = app.getPage();
    const qEl = page.elements.find((e) => e.id === qId);
    if (!qEl) return;
    const target = qEl.targetElementId
      ? page.elements.find((e) => e.id === qEl.targetElementId) || qEl
      : qEl;
    const cx = target.x + (target.w || 120) / 2;
    const cy = target.y + (target.h || 80) / 2;
    page.camera.zoom = Math.max(1, page.camera.zoom);
    page.camera.x = app.renderer.width / 2 - cx * page.camera.zoom;
    page.camera.y = app.renderer.height / 2 - cy * page.camera.zoom;
    app.selectedIds = new Set([qEl.id, ...(qEl.targetElementId ? [qEl.targetElementId] : [])]);
    recordPointer(
      {
        id: uid('ptr'),
        authorName: studentName,
        color: '#2563eb',
        x: cx,
        y: cy,
        targetElementId: qEl.targetElementId || qEl.id,
        targetElementName: qEl.targetElementName || qEl.text,
        time: Date.now(),
      },
      false
    );
    app.updateUI();
    app.requestRender();
  }

  function render() {
    if (!panel) return;
    const page = app.getPage();
    const questions = page.elements.filter((e) => e.type === 'question' && !e.hidden);
    const { hash } = buildClassroomShareHash(app.scene, roomCode);
    const shareUrl = `${window.location.origin}${window.location.pathname}${hash}`;

    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>🎓 Live Classroom & Student Q&A (${questions.length})</strong>
        <button type="button" class="wb-icon-btn" id="btn-close-classroom" aria-label="Close Classroom Panel">✕</button>
      </div>
      <div class="wb-panel-body">
        <div class="wb-prop-section">
          <div class="wb-prop-title">1. Shareable Classroom Link</div>
          <div class="wb-classroom-share-box">
            <input type="text" id="wb-classroom-link-input" class="wb-input" readonly value="${escapeXml(shareUrl)}" aria-label="Shareable Classroom Link"/>
            <button type="button" class="wb-btn wb-sm wb-primary" id="btn-copy-classroom-link">🔗 Copy Student Link</button>
          </div>
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">2. Join with Your Name</div>
          <div class="wb-classroom-join-row">
            <input type="text" id="wb-student-name-input" class="wb-input" placeholder="Enter your name..." value="${escapeXml(studentName)}" aria-label="Participant Name"/>
            <button type="button" class="wb-btn wb-sm" id="btn-save-student-name">Join</button>
          </div>
          <div class="wb-btn-group" style="margin-top:6px;">
            <button type="button" class="wb-btn wb-sm ${app.activeTool === 'pointer' ? 'active' : ''}" id="btn-tool-pointer" title="Click any component on the board to point/ping with your name">👆 Point at Component</button>
            <button type="button" class="wb-btn wb-sm ${app.activeTool === 'question' ? 'active' : ''}" id="btn-tool-question" title="Click any component or location to attach a question pin">❓ Pin Question on Board</button>
          </div>
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">3. Quick Question Pin</div>
          <input type="text" id="wb-quick-question-input" class="wb-input" placeholder="Type question, then click board or 'Pin to Selected'..." value="${escapeXml(draftQuestion)}" aria-label="Question Text"/>
          <button type="button" class="wb-btn wb-sm" id="btn-pin-question-now" style="margin-top:4px;">📌 Pin Question to Selected / Center</button>
        </div>

        <div class="wb-prop-section">
          <div class="wb-prop-title">Board Questions (${questions.length})</div>
          ${
            questions.length === 0
              ? `<p class="wb-muted">No student questions yet. Choose "Pin Question on Board" and click any component!</p>`
              : `<div class="wb-question-list">
                  ${questions
                    .map(
                      (q) => `
                    <div class="wb-question-card ${q.resolved ? 'resolved' : ''}">
                      <div class="wb-question-head">
                        <strong>${escapeXml(q.authorName || 'Student')}</strong>
                        ${q.targetElementName ? `<span class="wb-question-target">on ${escapeXml(q.targetElementName)}</span>` : ''}
                      </div>
                      <div class="wb-question-body">${escapeXml(q.text)}</div>
                      ${q.reply ? `<div class="wb-question-reply">↳ Teacher: ${escapeXml(q.reply)}</div>` : ''}
                      <div class="wb-btn-group" style="margin-top:4px;">
                        <button type="button" class="wb-btn wb-sm" data-q-focus="${escapeXml(q.id)}">🎯 Locate</button>
                        <button type="button" class="wb-btn wb-sm" data-q-reply="${escapeXml(q.id)}">💬 Reply</button>
                        <button type="button" class="wb-btn wb-sm" data-q-resolve="${escapeXml(q.id)}">${q.resolved ? '↩ Reopen' : '✓ Resolve'}</button>
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
    });

    panel.querySelector('#btn-copy-classroom-link')?.addEventListener('click', async () => {
      const { hash: newHash } = buildClassroomShareHash(app.scene, roomCode);
      window.history.replaceState(null, '', newHash);
      const url = `${window.location.origin}${window.location.pathname}${newHash}`;
      const inp = panel.querySelector('#wb-classroom-link-input');
      if (inp) inp.value = url;
      try {
        await navigator.clipboard.writeText(url);
        app.dialogs?.showToast('Shareable Classroom Link copied to clipboard!');
      } catch {
        inp?.select();
        app.dialogs?.showToast('Classroom URL updated in address bar.');
      }
    });

    panel.querySelector('#btn-save-student-name')?.addEventListener('click', () => {
      const val = panel.querySelector('#wb-student-name-input')?.value;
      setStudentName(val);
      app.dialogs?.showToast(`Joined classroom as "${studentName}"`);
    });

    panel.querySelector('#wb-student-name-input')?.addEventListener('change', (e) => {
      setStudentName(e.target.value);
    });

    panel.querySelector('#wb-quick-question-input')?.addEventListener('input', (e) => {
      draftQuestion = e.target.value;
    });

    panel.querySelector('#btn-tool-pointer')?.addEventListener('click', () => {
      app.setTool('pointer');
      app.dialogs?.showToast(`Click any component on the board to point as ${studentName}`);
    });

    panel.querySelector('#btn-tool-question')?.addEventListener('click', () => {
      app.setTool('question');
      app.dialogs?.showToast(`Click any component or location on the board to attach a question`);
    });

    panel.querySelector('#btn-pin-question-now')?.addEventListener('click', () => {
      const txt = panel.querySelector('#wb-quick-question-input')?.value?.trim() || 'Question about this component';
      const selected = page.elements.find((e) => app.selectedIds.has(e.id));
      const world = selected
        ? { x: selected.x + selected.w / 2, y: selected.y + selected.h / 2 }
        : app.getViewportCenterWorld();
      createQuestionAt(world, txt);
    });

    panel.querySelectorAll('[data-q-focus]').forEach((b) => {
      b.addEventListener('click', () => focusQuestion(b.dataset.qFocus));
    });

    panel.querySelectorAll('[data-q-resolve]').forEach((b) => {
      b.addEventListener('click', () => {
        const q = page.elements.find((e) => e.id === b.dataset.qResolve);
        if (q) {
          q.resolved = !q.resolved;
          app.commitChange();
          app.requestRender();
          render();
        }
      });
    });

    panel.querySelectorAll('[data-q-reply]').forEach((b) => {
      b.addEventListener('click', () => {
        const q = page.elements.find((e) => e.id === b.dataset.qReply);
        if (!q) return;
        app.dialogs.openPromptModal({
          title: 'Reply to Student Question',
          label: `Reply to ${q.authorName}:`,
          defaultValue: q.reply || '',
          confirmLabel: 'Save Reply',
          onConfirm: (val) => {
            q.reply = (val || '').trim();
            q.resolved = Boolean(q.reply);
            app.commitChange();
            app.requestRender();
            render();
          },
        });
      });
    });
  }

  render();

  return {
    update: render,
    toggle() {
      if (!panel) return;
      panel.classList.toggle('wb-hidden');
      if (!panel.classList.contains('wb-hidden')) render();
    },
    open() {
      if (!panel) return;
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
