// ui/animation.js — one playback clock for declarative teaching tracks.
import { escapeXml } from '../render/svg-export.js';
import {
  createTrack,
  normalizeSteps,
  validateTrack,
  trackDuration,
  stepStartMs,
  sampleTrack,
} from '../scene/animation.js';

export function initAnimationUI(app) {
  const bar = document.getElementById('wb-anim-bar');
  if (!bar) return { open() {}, close() {}, toggle() {}, rebuildFromReveal() {}, stop() {}, isOpen: () => false };

  let playing = false;
  let elapsed = 0;
  let speed = 1;
  let raf = null;
  let lastTs = 0;
  let open = false;

  const reducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false;

  const isPresenter = () => {
    const role = app.collab?.role;
    const live = app.collab?.status === 'live' || app.collab?.status === 'connecting';
    return !live || role === 'teacher' || !role;
  };

  let normalizedFor = null;
  function currentTrack() {
    const page = app.getPage();
    const raw = page?.animationTrack;
    if (!raw) return null;
    if (normalizedFor === raw) return raw;
    try {
      // Tracks can arrive from an older document; normalize before playback so
      // a missing duration cannot turn the clock into NaN.
      raw.steps = normalizeSteps(raw.steps || []);
      normalizedFor = raw;
      return raw;
    } catch (err) {
      app.dialogs?.showToast(err?.message || 'This animation track is invalid.', 'error');
      return null;
    }
  }

  function setTrack(track) {
    const page = app.getPage();
    if (!page) return;
    const check = validateTrack(track, page);
    if (!check.ok) {
      app.dialogs?.showToast(check.errors[0], 'error');
      return null;
    }
    page.animationTrack = track;
    elapsed = 0;
    playing = false;
    app.animationState = null;
    // The track is board state: persist it, let undo take it back, and let
    // collaborators see it — otherwise a built track vanishes on reload.
    app.history?.commit?.(page);
    app.scheduleAutosave?.(app.scene);
    app.collab?.broadcastSceneChange?.();
    renderBar();
    app.requestRender();
    return track;
  }

  function rebuildFromReveal() {
    const page = app.getPage();
    if (!page || !Array.isArray(page.elements)) {
      app.dialogs?.showToast('Open a board page first.', 'info');
      return null;
    }
    const steps = [];
    const revealEls = (page.elements || [])
      .filter((e) => (e.revealStep || 0) > 0)
      .sort((a, b) => a.revealStep - b.revealStep || String(a.id).localeCompare(String(b.id)));
    const byStep = new Map();
    for (const el of revealEls) {
      if (!byStep.has(el.revealStep)) byStep.set(el.revealStep, []);
      byStep.get(el.revealStep).push(el.id);
    }
    for (const [stepNo, ids] of [...byStep.entries()].sort((a, b) => a[0] - b[0])) {
      for (const id of ids) {
        steps.push({
          id: `reveal-${stepNo}-${id}`,
          action: 'reveal',
          targetId: id,
          duration: 900,
          narration: `Step ${stepNo}`,
        });
      }
    }
    const arrows = (page.elements || []).filter((e) => e.type === 'arrow');
    arrows.forEach((edge, idx) => {
      steps.push({
        id: `request-${edge.id}`,
        action: idx % 2 === 0 ? 'request' : 'response',
        edgeId: edge.id,
        duration: 1200,
        narration: idx % 2 === 0 ? 'Request along the connector' : 'Response back along the same path',
      });
    });
    if (steps.length === 0) {
      app.dialogs?.showToast('Set reveal steps on elements or add arrows first.', 'info');
      return null;
    }
    const track = setTrack(createTrack({ id: `track-${page.id}`, name: 'Lesson walkthrough', steps }));
    if (track) {
      open = true;
      bar.classList.remove('wb-hidden');
      renderBar();
    }
    return track;
  }

  function sample() {
    const track = currentTrack();
    if (!track) return null;
    return sampleTrack(track, elapsed, { reducedMotion: reducedMotion(), page: app.getPage() });
  }

  function pushState() {
    const state = sample();
    app.animationState = state;
    applyCameraStep(state);
    app.requestRender();
    renderBar();
  }

  let lastCameraStep = null;
  // Camera moves are playback state, not board edits. Remember the teacher's
  // view so Stop returns them to where they were before the track ran.
  let cameraSnapshot = null;

  function rememberCamera() {
    const page = app.getPage();
    if (!page?.camera) return;
    cameraSnapshot = { pageId: page.id, x: page.camera.x, y: page.camera.y, zoom: page.camera.zoom };
  }

  function restoreCamera() {
    if (!cameraSnapshot) return;
    const page =
      (app.scene?.pages || []).find((p) => p.id === cameraSnapshot.pageId) || app.getPage();
    if (page?.camera) {
      page.camera.x = cameraSnapshot.x;
      page.camera.y = cameraSnapshot.y;
      page.camera.zoom = cameraSnapshot.zoom;
    }
    cameraSnapshot = null;
    lastCameraStep = null;
    app.requestRender();
  }

  function applyCameraStep(state) {
    if (!state?.camera || state.camera === lastCameraStep) return;
    const page = app.getPage();
    // A camera snapshot belongs to one page. If the teacher switched pages
    // mid-playback, moving the new page's camera would make the restore land
    // somewhere the snapshot never described.
    if (cameraSnapshot && cameraSnapshot.pageId !== page?.id) return;
    const target = page?.elements?.find((e) => e.id === state.camera);
    if (!target) return;
    // Stepping with Prev/Next reaches this path without going through play(),
    // so the snapshot has to be taken here too or Stop cannot restore.
    if (!cameraSnapshot) rememberCamera();
    lastCameraStep = state.camera;
    const w = app.renderer.width || 1280;
    const h = app.renderer.height || 800;
    const zoom = Math.min(w / (target.w + 160), h / (target.h + 160), 2.5);
    page.camera.zoom = Math.max(0.2, zoom);
    page.camera.x = w / 2 - (target.x + target.w / 2) * page.camera.zoom;
    page.camera.y = h / 2 - (target.y + target.h / 2) * page.camera.zoom;
  }

  function tick(ts) {
    try {
      tickInner(ts);
    } catch (err) {
      playing = false;
      cancelAnimationFrame(raf);
      app.dialogs?.showToast(err?.message || 'Animation stopped after an error.', 'error');
      renderBar();
    }
  }

  function tickInner(ts) {
    if (!playing) return;
    const track = currentTrack();
    if (!track) {
      playing = false;
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = Math.min(120, ts - lastTs) * speed;
    lastTs = ts;
    elapsed += dt;
    if (elapsed >= trackDuration(track)) {
      elapsed = trackDuration(track);
      playing = false;
      pushState();
      return;
    }
    pushState();
    raf = requestAnimationFrame(tick);
  }

  function play() {
    if (!isPresenter()) return;
    const track = currentTrack();
    if (!track) return;
    if (elapsed >= trackDuration(track)) elapsed = 0;
    if (elapsed === 0) lastCameraStep = null;
    if (!cameraSnapshot) rememberCamera();
    playing = true;
    lastTs = 0;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(tick);
    renderBar();
  }

  function pause() {
    playing = false;
    cancelAnimationFrame(raf);
    renderBar();
  }

  function stop() {
    playing = false;
    cancelAnimationFrame(raf);
    elapsed = 0;
    app.animationState = null;
    restoreCamera();
    app.requestRender();
    renderBar();
  }

  function goToStep(delta) {
    const track = currentTrack();
    if (!track) return;
    const state = sampleTrack(track, elapsed, { page: app.getPage() });
    const nextIndex = Math.max(0, Math.min(track.steps.length - 1, state.stepIndex + delta));
    elapsed = stepStartMs(track, nextIndex);
    pushState();
  }

  function renderBar() {
    if (!open) {
      bar.classList.add('wb-hidden');
      bar.innerHTML = '';
      return;
    }
    bar.classList.remove('wb-hidden');
    const track = currentTrack();
    const presenter = isPresenter();
    const duration = track ? trackDuration(track) : 0;
    const state = track ? sampleTrack(track, elapsed, { reducedMotion: reducedMotion(), page: app.getPage() }) : null;
    bar.innerHTML = `
      <div class="wb-anim-row">
        <strong class="wb-anim-title">Teaching animation</strong>
        <span class="wb-anim-progress">${state && state.stepIndex >= 0 ? `Step ${state.stepIndex + 1}/${track.steps.length}` : 'Not started'} · ${(elapsed / 1000).toFixed(1)}s / ${(duration / 1000).toFixed(1)}s</span>
        <span class="wb-anim-narration">${escapeXml(state?.narration || '')}</span>
        <div class="wb-anim-controls">
          <button type="button" class="wb-btn wb-sm" data-anim="prev" ${presenter ? '' : 'disabled'} aria-label="Previous step">◀</button>
          <button type="button" class="wb-btn wb-sm" data-anim="play" ${presenter ? '' : 'disabled'} aria-label="${playing ? 'Pause' : 'Play'}">${playing ? '⏸' : '▶'}</button>
          <button type="button" class="wb-btn wb-sm" data-anim="next" ${presenter ? '' : 'disabled'} aria-label="Next step">▶|</button>
          <button type="button" class="wb-btn wb-sm" data-anim="restart" ${presenter ? '' : 'disabled'} aria-label="Restart">↺</button>
          <button type="button" class="wb-btn wb-sm" data-anim="stop" ${presenter ? '' : 'disabled'} aria-label="Stop and reset">■</button>
          <label class="wb-anim-speed">Speed
            <select id="anim-speed" ${presenter ? '' : 'disabled'}>
              ${[0.5, 1, 1.5, 2].map((s) => `<option value="${s}" ${s === speed ? 'selected' : ''}>${s}×</option>`).join('')}
            </select>
          </label>
          <button type="button" class="wb-btn wb-sm" data-anim="build" ${presenter ? '' : 'disabled'}>Build track from reveal steps</button>
          ${track ? `<button type="button" class="wb-btn wb-sm" data-anim="clear" ${presenter ? '' : 'disabled'}>Clear track</button>` : ''}
          <button type="button" class="wb-btn wb-sm" data-anim="close" aria-label="Close animation controls">✕</button>
        </div>
      </div>
      ${reducedMotion() ? '<div class="wb-muted" style="font-size:11px;">Reduced motion is on: steps jump to their end state without interpolation.</div>' : ''}
    `;
    bar.querySelectorAll('[data-anim]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.anim;
        if (action === 'play') (playing ? pause() : play());
        else if (action === 'prev') goToStep(-1);
        else if (action === 'next') goToStep(1);
        else if (action === 'restart') {
          elapsed = 0;
          play();
        } else if (action === 'stop') stop();
        else if (action === 'build') rebuildFromReveal();
        else if (action === 'clear') {
          const page = app.getPage();
          if (page) {
            delete page.animationTrack;
            app.history?.commit?.(page);
            app.scheduleAutosave?.(app.scene);
            app.collab?.broadcastSceneChange?.();
          }
          stop();
          renderBar();
        } else if (action === 'close') close();
      });
    });
    bar.querySelector('#anim-speed')?.addEventListener('change', (e) => {
      speed = Number(e.target.value) || 1;
      renderBar();
    });
  }

  function show() {
    open = true;
    renderBar();
  }

  function close() {
    pause();
    open = false;
    bar.classList.add('wb-hidden');
    bar.innerHTML = '';
    app.animationState = null;
    restoreCamera();
    app.requestRender();
  }

  function toggle() {
    if (open) close();
    else show();
  }

  document.addEventListener('keydown', (e) => {
    if (!open || !isPresenter()) return;
    if (e.target && /input|textarea|select/i.test(e.target.tagName)) return;
    if (e.key === ' ') {
      e.preventDefault();
      playing ? pause() : play();
    }
  });

  return { open: show, close, toggle, rebuildFromReveal, stop, isOpen: () => open };
}
