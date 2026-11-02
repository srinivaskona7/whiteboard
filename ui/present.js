// ui/present.js — Lesson Presentation Mode, Named Frame Thumbnails, Progressive Reveal & Teacher Notes
import { escapeXml } from '../render/svg-export.js';
import { isFrameIncludedInPresentation, getContainerChildren } from '../scene/model.js';

export function initPresentUI(app) {
  const overlay = document.getElementById('wb-present-bar');
  if (!overlay) return { enter() {}, exit() {}, stepNext() {}, stepPrev() {}, renderBar() {} };

  let showNotesPanel = false;

  function isTeacherOrLocal() {
    const role = app.collab?.role;
    if (
      (app.collab?.status === 'live' ||
        app.collab?.status === 'connecting' ||
        app.collab?.status === 'readonly-snapshot') &&
      (role === 'viewer' || role === 'questioner')
    ) {
      return false;
    }
    return true;
  }

  function getOrderedSlides() {
    const page = app.getPage();
    return page.elements
      .filter((e) => isFrameIncludedInPresentation(e))
      .sort((a, b) => (a.slideOrder || 1) - (b.slideOrder || 1));
  }

  function getExcludedFrameCount() {
    const page = app.getPage();
    return page.elements.filter(
      (e) => e.type === 'frame' && !e.hidden && !isFrameIncludedInPresentation(e)
    ).length;
  }

  function getMaxRevealStep() {
    const page = app.getPage();
    return page.elements.reduce((max, el) => Math.max(max, el.revealStep || 0), 0);
  }

  function focusSlide(slideEl) {
    if (!slideEl) return;
    const pad = 64;
    const w = app.renderer.width || 1280;
    const h = app.renderer.height || 800;
    const zoom = Math.min(w / (slideEl.w + pad * 2), h / (slideEl.h + pad * 2), 3);
    const page = app.getPage();
    page.camera.zoom = zoom;
    page.camera.x = w / 2 - (slideEl.x + slideEl.w / 2) * zoom;
    page.camera.y = h / 2 - (slideEl.y + slideEl.h / 2) * zoom;
    if (app.collab?.status === 'live' && app.collab?.role === 'teacher') {
      app.collab.broadcastTeacherCamera();
    }
  }

  function enter() {
    const slides = getOrderedSlides();
    const maxStep = getMaxRevealStep();
    app.presentState = {
      active: true,
      slideIndex: 0,
      revealStep: 0,
      maxRevealStep: maxStep,
    };
    app.selectedIds.clear();
    document.body.classList.add('wb-presenting');
    if (slides.length > 0) {
      focusSlide(slides[0]);
    } else {
      app.fitToContent();
    }
    overlay.classList.remove('wb-hidden');
    renderBar();
    app.requestRender();
  }

  function exit() {
    app.presentState = { active: false, slideIndex: 0, revealStep: 0, maxRevealStep: 0 };
    document.body.classList.remove('wb-presenting');
    overlay.classList.add('wb-hidden');
    app.updateUI();
    app.requestRender();
  }

  function stepNext() {
    if (!app.presentState.active) return;
    const slides = getOrderedSlides();
    const maxStep = getMaxRevealStep();
    app.presentState.maxRevealStep = maxStep;
    if (app.presentState.revealStep < maxStep) {
      app.presentState.revealStep += 1;
    } else if (slides.length > 0 && app.presentState.slideIndex < slides.length - 1) {
      app.presentState.slideIndex += 1;
      focusSlide(slides[app.presentState.slideIndex]);
    }
    renderBar();
    app.requestRender();
  }

  function stepPrev() {
    if (!app.presentState.active) return;
    const slides = getOrderedSlides();
    app.presentState.maxRevealStep = getMaxRevealStep();
    if (app.presentState.revealStep > 0) {
      app.presentState.revealStep -= 1;
    } else if (slides.length > 0 && app.presentState.slideIndex > 0) {
      app.presentState.slideIndex -= 1;
      focusSlide(slides[app.presentState.slideIndex]);
    }
    renderBar();
    app.requestRender();
  }

  function moveSlideOrder(slideIndex, delta) {
    const slides = getOrderedSlides();
    const targetIdx = slideIndex + delta;
    if (targetIdx < 0 || targetIdx >= slides.length) return;
    // Normalize slideOrder values 1..N then swap
    slides.forEach((s, idx) => {
      s.slideOrder = idx + 1;
    });
    const temp = slides[slideIndex].slideOrder;
    slides[slideIndex].slideOrder = slides[targetIdx].slideOrder;
    slides[targetIdx].slideOrder = temp;
    app.presentState.slideIndex = targetIdx;
    app.commitChange();
    renderBar();
    app.requestRender();
  }

  function renderBar() {
    if (!app.presentState.active) return;
    const page = app.getPage();
    const slides = getOrderedSlides();
    const excludedCount = getExcludedFrameCount();
    const maxStep = getMaxRevealStep();
    app.presentState.maxRevealStep = maxStep;
    if (slides.length > 0 && app.presentState.slideIndex >= slides.length) {
      app.presentState.slideIndex = slides.length - 1;
    }
    const sIdx = app.presentState.slideIndex;
    const currentSlide = slides[sIdx] || null;
    const canShowNotes = isTeacherOrLocal();
    const activeSlideNotes = currentSlide?.teacherNotes || '';
    const pageNotes = page.teacherNotes || '';
    const hasAnyNotes = Boolean(activeSlideNotes.trim() || pageNotes.trim());

    overlay.innerHTML = `
      ${
        canShowNotes && showNotesPanel
          ? `<div class="wb-present-notes-drawer" id="wb-present-notes-panel" role="region" aria-label="Teacher Presentation Notes">
              <div class="wb-prop-row" style="margin:0 0 6px 0;">
                <strong>📝 Teacher Notes (Private — Hidden from Students)</strong>
                <button type="button" class="wb-icon-btn" id="btn-close-pres-notes" title="Hide Teacher Notes">✕</button>
              </div>
              <div style="display:grid;grid-template-columns:${currentSlide ? '1fr 1fr' : '1fr'};gap:8px;">
                ${
                  currentSlide
                    ? `<label style="display:flex;flex-direction:column;gap:3px;font-size:11px;">
                        <span class="wb-muted">Frame Notes: <strong>${escapeXml(currentSlide.text || 'Slide')}</strong></span>
                        <textarea id="pres-frame-notes-input" class="wb-textarea" rows="3" placeholder="Speaker notes for this frame...">${escapeXml(activeSlideNotes)}</textarea>
                      </label>`
                    : ''
                }
                <label style="display:flex;flex-direction:column;gap:3px;font-size:11px;">
                  <span class="wb-muted">Page Notes: <strong>${escapeXml(page.name || 'Page')}</strong></span>
                  <textarea id="pres-page-notes-input" class="wb-textarea" rows="3" placeholder="Lesson notes for this page...">${escapeXml(pageNotes)}</textarea>
                </label>
              </div>
            </div>`
          : ''
      }
      <div class="wb-present-controls">
        <button type="button" class="wb-btn wb-sm" id="btn-pres-prev" aria-label="Previous Slide or Step" title="Previous Slide / Step (←)">◀ Prev</button>
        <span class="wb-present-status" id="wb-present-status">
          ${
            slides.length > 0
              ? `Slide ${sIdx + 1}/${slides.length}: ${escapeXml(currentSlide?.text || 'Frame')}`
              : `Board Overview (No active slide frames${excludedCount > 0 ? `, ${excludedCount} excluded` : ''})`
          }
          ${maxStep > 0 ? ` • Step ${app.presentState.revealStep}/${maxStep}` : ''}
        </span>
        <button type="button" class="wb-btn wb-sm" id="btn-pres-next" aria-label="Next Slide or Step" title="Next Slide / Step (→ / Space)">Next ▶</button>
        <span class="wb-sep"></span>
        <button type="button" class="wb-btn wb-sm ${app.activeTool === 'laser' ? 'active' : ''}" id="btn-pres-laser" title="Laser Pointer (L)">🔴 Laser</button>
        <button type="button" class="wb-btn wb-sm ${app.activeTool === 'pen' ? 'active' : ''}" id="btn-pres-pen" title="Annotate with Pen (P)">✏️ Pen</button>
        <button type="button" class="wb-btn wb-sm ${app.spotlight.active && !app.spotlight.magnifier ? 'active' : ''}" id="btn-pres-spotlight" title="Toggle Spotlight Dimmer (F7)">🔦 Spotlight</button>
        <button type="button" class="wb-btn wb-sm ${app.spotlight.active && app.spotlight.magnifier ? 'active' : ''}" id="btn-pres-magnifier" title="Toggle 2x Magnifier Lens">🔍 Magnifier</button>
        <button type="button" class="wb-btn wb-sm" id="btn-pres-timer" title="Toggle Class Timer">⏱ Timer</button>
        ${
          canShowNotes
            ? `<button type="button" class="wb-btn wb-sm ${showNotesPanel ? 'active' : ''}" id="btn-pres-notes" title="Toggle Private Teacher Notes">📝 Notes${hasAnyNotes ? ' •' : ''}</button>`
            : ''
        }
        <button type="button" class="wb-btn wb-sm wb-danger" id="btn-pres-exit" aria-label="Exit Presentation (Esc)">Exit (Esc)</button>
      </div>
      ${
        slides.length > 0
          ? `<div class="wb-slide-strip" role="tablist" aria-label="Presentation Frames">
              ${slides
                .map((s, idx) => {
                  const childCount = getContainerChildren(page, s.id).length;
                  return `
                    <div class="wb-slide-thumb-wrap ${idx === sIdx ? 'active' : ''}">
                      <button
                        type="button"
                        class="wb-slide-pill ${idx === sIdx ? 'active' : ''}"
                        data-pres-slide="${idx}"
                        role="tab"
                        aria-selected="${idx === sIdx}"
                      >
                        <span class="wb-slide-num">#${idx + 1}</span>
                        <span class="wb-slide-title">${escapeXml(s.text || s.name || 'Frame')}</span>
                        <span class="wb-slide-meta">${childCount} items${s.teacherNotes ? ' • 📝' : ''}</span>
                      </button>
                      ${
                        idx === sIdx && slides.length > 1
                          ? `<div class="wb-slide-reorder">
                              <button type="button" class="wb-page-mini" data-move-slide="-1" ${idx === 0 ? 'disabled' : ''} title="Move frame earlier in presentation">◀</button>
                              <button type="button" class="wb-page-mini" data-move-slide="1" ${idx === slides.length - 1 ? 'disabled' : ''} title="Move frame later in presentation">▶</button>
                            </div>`
                          : ''
                      }
                    </div>
                  `;
                })
                .join('')}
            </div>`
          : ''
      }
    `;

    overlay.querySelector('#btn-pres-prev')?.addEventListener('click', stepPrev);
    overlay.querySelector('#btn-pres-next')?.addEventListener('click', stepNext);
    overlay.querySelector('#btn-pres-exit')?.addEventListener('click', exit);
    overlay.querySelector('#btn-pres-laser')?.addEventListener('click', () => {
      app.setTool(app.activeTool === 'laser' ? 'select' : 'laser');
      renderBar();
    });
    overlay.querySelector('#btn-pres-pen')?.addEventListener('click', () => {
      app.setTool(app.activeTool === 'pen' ? 'select' : 'pen');
      renderBar();
    });
    overlay.querySelector('#btn-pres-spotlight')?.addEventListener('click', () => {
      app.toggleSpotlight(false);
      renderBar();
    });
    overlay.querySelector('#btn-pres-magnifier')?.addEventListener('click', () => {
      app.toggleSpotlight(true);
      renderBar();
    });
    overlay.querySelector('#btn-pres-timer')?.addEventListener('click', () => {
      app.timerUI.toggle();
    });
    overlay.querySelector('#btn-pres-notes')?.addEventListener('click', () => {
      showNotesPanel = !showNotesPanel;
      renderBar();
    });
    overlay.querySelector('#btn-close-pres-notes')?.addEventListener('click', () => {
      showNotesPanel = false;
      renderBar();
    });
    overlay.querySelector('#pres-frame-notes-input')?.addEventListener('change', (e) => {
      if (currentSlide) {
        currentSlide.teacherNotes = e.target.value;
        app.commitChange();
      }
    });
    overlay.querySelector('#pres-page-notes-input')?.addEventListener('change', (e) => {
      page.teacherNotes = e.target.value;
      app.scheduleAutosave(app.scene);
    });
    overlay.querySelectorAll('[data-pres-slide]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.presSlide);
        app.presentState.slideIndex = idx;
        focusSlide(slides[idx]);
        renderBar();
        app.requestRender();
      });
    });
    overlay.querySelectorAll('[data-move-slide]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        moveSlideOrder(sIdx, Number(b.dataset.moveSlide));
      });
    });
  }

  return { enter, exit, stepNext, stepPrev, renderBar, getOrderedSlides };
}

