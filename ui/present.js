// ui/present.js
import { escapeXml } from '../render/svg-export.js';

export function initPresentUI(app) {
  const overlay = document.getElementById('wb-present-bar');
  if (!overlay) return { enter() {}, exit() {}, stepNext() {}, stepPrev() {} };

  function getOrderedSlides() {
    const page = app.getPage();
    return page.elements
      .filter((e) => e.type === 'frame' && !e.hidden)
      .sort((a, b) => (a.slideOrder || 1) - (b.slideOrder || 1));
  }

  function getMaxRevealStep() {
    const page = app.getPage();
    return page.elements.reduce((max, el) => Math.max(max, el.revealStep || 0), 0);
  }

  function focusSlide(slideEl) {
    if (!slideEl) return;
    const pad = 64;
    const w = app.renderer.width;
    const h = app.renderer.height;
    const zoom = Math.min(w / (slideEl.w + pad * 2), h / (slideEl.h + pad * 2), 3);
    const page = app.getPage();
    page.camera.zoom = zoom;
    page.camera.x = w / 2 - (slideEl.x + slideEl.w / 2) * zoom;
    page.camera.y = h / 2 - (slideEl.y + slideEl.h / 2) * zoom;
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
    if (app.presentState.revealStep > 0) {
      app.presentState.revealStep -= 1;
    } else if (slides.length > 0 && app.presentState.slideIndex > 0) {
      app.presentState.slideIndex -= 1;
      focusSlide(slides[app.presentState.slideIndex]);
    }
    renderBar();
    app.requestRender();
  }

  function renderBar() {
    if (!app.presentState.active) return;
    const slides = getOrderedSlides();
    const maxStep = getMaxRevealStep();
    const sIdx = app.presentState.slideIndex;

    overlay.innerHTML = `
      <div class="wb-present-controls">
        <button type="button" class="wb-btn wb-sm" id="btn-pres-prev" aria-label="Previous Slide or Step">◀ Prev</button>
        <span class="wb-present-status">
          Slide ${slides.length ? `${sIdx + 1}/${slides.length}` : '1/1'}
          ${maxStep > 0 ? ` • Reveal Step ${app.presentState.revealStep}/${maxStep}` : ''}
        </span>
        <button type="button" class="wb-btn wb-sm" id="btn-pres-next" aria-label="Next Slide or Step">Next ▶</button>
        <button type="button" class="wb-btn wb-sm wb-danger" id="btn-pres-exit" aria-label="Exit Presentation (Esc)">Exit (Esc)</button>
      </div>
      ${
        slides.length > 0
          ? `<div class="wb-slide-strip">
              ${slides
                .map(
                  (s, idx) => `
                <button
                  type="button"
                  class="wb-slide-pill ${idx === sIdx ? 'active' : ''}"
                  data-pres-slide="${idx}"
                >
                  #${idx + 1} ${escapeXml(s.text || 'Frame')}
                </button>
              `
                )
                .join('')}
            </div>`
          : ''
      }
    `;

    overlay.querySelector('#btn-pres-prev')?.addEventListener('click', stepPrev);
    overlay.querySelector('#btn-pres-next')?.addEventListener('click', stepNext);
    overlay.querySelector('#btn-pres-exit')?.addEventListener('click', exit);
    overlay.querySelectorAll('[data-pres-slide]').forEach((b) => {
      b.addEventListener('click', () => {
        const idx = Number(b.dataset.presSlide);
        app.presentState.slideIndex = idx;
        focusSlide(slides[idx]);
        renderBar();
        app.requestRender();
      });
    });
  }

  return { enter, exit, stepNext, stepPrev, renderBar };
}
