// ui/notebook.js — vertical multi-page Notebook view over the one canonical document model.
//
// The notebook is a layout/navigation projection, not a second document. The real editing
// canvas is moved into the active page sheet, so every existing tool, hit-test, binding and
// history path keeps working unchanged. Non-active pages are static previews rendered from
// the same page data.
import { escapeXml } from '../render/svg-export.js';
import { CanvasRenderer } from '../render/canvas.js';

const MIN_SCALE = 0.25;
const MAX_SCALE = 2;
const DEFAULT_SCALE = 0.55;
const GAP = 28;

export function initNotebookView(app) {
  const host = document.getElementById('wb-notebook');
  if (!host) {
    return {
      enter() {},
      exit() {},
      update() {},
      activatePage() {},
      handleResize() {},
      isActive: () => false,
    };
  }

  const previewRenderer = new CanvasRenderer(document.createElement('canvas'));
  let scale = DEFAULT_SCALE;
  let builtSignature = '';
  let builtActiveId = '';
  let previewTimer = null;
  let building = false;
  let observer = null;

  const isActive = () => app.viewMode === 'notebook';
  const currentPage = () => app.getPage();
  // Notebook camera is a view concern only; it never mutates the persisted document camera.
  const getCamera = () => ({ x: 0, y: 0, zoom: scale });

  function pageSignature() {
    return app.scene.pages.map((p) => `${p.id}:${p.name}`).join('|');
  }

  function canEdit() {
    return app.collab ? app.collab.canEditBoard() : true;
  }

  function activeSheetEl() {
    return host.querySelector(`.wb-nb-sheet[data-page-id="${cssEscape(app.scene.activePageId)}"]`);
  }

  function cssEscape(str) {
    return String(str).replace(/["\\]/g, '\\$&');
  }

  // Return the live editing canvas to the plain viewport container.
  function detachLiveCanvas() {
    if (app.canvas.parentElement !== app.canvasWrap) {
      app.canvasWrap.appendChild(app.canvas);
    }
  }



  function renderPreview(page, canvas) {
    try {
      previewRenderer.renderPageToCanvas(app.scene, page, canvas, {
        scale,
        width: page.width || 1280,
        height: page.height || 720,
      });
    } catch {
      // A preview failure must never break the live notebook editor.
    }
  }

  function build(preserveScroll = true) {
    if (!isActive() || building) return;
    building = true;
    const anchor = preserveScroll ? host.scrollTop : 0;
    const activeId = app.scene.activePageId;

    detachLiveCanvas();
    builtSignature = pageSignature();
    builtActiveId = activeId;

    const pages = app.scene.pages;
    const editable = canEdit();
    const sheetW = Math.round((pages[0]?.width || 1280) * scale);
    const sheetH = Math.round((pages[0]?.height || 720) * scale);

    host.innerHTML = `
      <div class="wb-nb-toolbar" role="toolbar" aria-label="Notebook controls">
        <span class="wb-nb-count">${pages.length} page${pages.length === 1 ? '' : 's'}</span>
        <span class="wb-sep"></span>
        <button type="button" class="wb-btn wb-sm" id="nb-zoom-out" aria-label="Zoom notebook out">−</button>
        <span class="wb-nb-zoom" aria-live="polite">${Math.round(scale * 100)}%</span>
        <button type="button" class="wb-btn wb-sm" id="nb-zoom-in" aria-label="Zoom notebook in">+</button>
        <span class="wb-sep"></span>
        <label class="wb-nb-jump">
          <span class="wb-muted">Jump</span>
          <select id="nb-jump" aria-label="Jump to page">
            ${pages
              .map(
                (p, idx) =>
                  `<option value="${escapeXml(p.id)}" ${p.id === activeId ? 'selected' : ''}>${idx + 1}. ${escapeXml(p.name)}</option>`
              )
              .join('')}
          </select>
        </label>
        ${editable ? `<button type="button" class="wb-btn wb-sm" id="nb-add-pages" title="Add an empty page after the last one">+ Page</button>
        <button type="button" class="wb-btn wb-sm" id="nb-add-lesson" title="Append nine more pages (10-page lesson starter)">+ 10-Page Lesson</button>` : ''}
      </div>
      <div class="wb-nb-scroll" id="nb-scroll">
        ${pages
          .map((page, idx) => {
            const active = page.id === activeId;
            return `
              <section class="wb-nb-sheet ${active ? 'active' : ''}" data-page-id="${escapeXml(page.id)}" data-index="${idx}" aria-label="Page ${idx + 1}: ${escapeXml(page.name)}">
                <header class="wb-nb-sheet-head">
                  <span class="wb-nb-num">#${idx + 1}</span>
                  <button type="button" class="wb-nb-name" data-nb-goto="${escapeXml(page.id)}" title="Activate this page for writing/editing">${escapeXml(page.name)}</button>
                  ${
                    editable
                      ? `<span class="wb-nb-actions">
                          <button type="button" class="wb-page-mini" data-nb-move="${idx}:-1" ${idx === 0 ? 'disabled' : ''} aria-label="Move page up" title="Move page up">↑</button>
                          <button type="button" class="wb-page-mini" data-nb-move="${idx}:1" ${idx === pages.length - 1 ? 'disabled' : ''} aria-label="Move page down" title="Move page down">↓</button>
                          <button type="button" class="wb-page-mini" data-nb-dup="${escapeXml(page.id)}" aria-label="Duplicate page" title="Duplicate page">⧉</button>
                          ${pages.length > 1 ? `<button type="button" class="wb-page-mini" data-nb-del="${escapeXml(page.id)}" aria-label="Delete page" title="Delete page">✕</button>` : ''}
                        </span>`
                      : ''
                  }
                </header>
                <div class="wb-nb-sheet-body" style="width:${sheetW}px;height:${sheetH}px;">
                  ${
                    active
                      ? '<div class="wb-nb-live-slot" data-nb-live></div>'
                      : `<canvas class="wb-nb-preview" data-nb-preview="${escapeXml(page.id)}"></canvas>`
                  }
                </div>
              </section>
            `;
          })
          .join('')}
        <div class="wb-nb-end" aria-hidden="true">End of notebook</div>
      </div>
    `;

    // Move the real interactive canvas into the active sheet.
    const slot = host.querySelector('[data-nb-live]');
    if (slot) {
      slot.appendChild(app.canvas);
      app.renderer.resize(sheetW, sheetH);
    }

    // Render static previews for every non-active page.
    host.querySelectorAll('[data-nb-preview]').forEach((canvas) => {
      const page = pages.find((p) => p.id === canvas.dataset.nbPreview);
      if (page) renderPreview(page, canvas);
    });

    bindControls();
    setupObserver();
    host.scrollTop = anchor;
    building = false;
    app.requestRender();
  }

  function bindControls() {
    host.querySelector('#nb-zoom-in')?.addEventListener('click', () => setScale(scale * 1.15));
    host.querySelector('#nb-zoom-out')?.addEventListener('click', () => setScale(scale / 1.15));
    host.querySelector('#nb-jump')?.addEventListener('change', (e) => activatePage(e.target.value));
    host.querySelector('#nb-add-pages')?.addEventListener('click', () => {
      if (!canEdit()) return;
      app.addPage();
      activatePage(app.scene.activePageId);
    });
    host.querySelector('#nb-add-lesson')?.addEventListener('click', () => {
      if (!canEdit()) return;
      app.addPages(9);
      activatePage(app.scene.activePageId);
    });

    host.querySelectorAll('[data-nb-goto]').forEach((b) => {
      b.addEventListener('click', () => activatePage(b.dataset.nbGoto));
    });
    host.querySelectorAll('[data-nb-move]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const [idxStr, dirStr] = b.dataset.nbMove.split(':');
        app.reorderPage(Number(idxStr), Number(dirStr));
      });
    });
    host.querySelectorAll('[data-nb-dup]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        app.duplicatePage(b.dataset.nbDup);
        activatePage(app.scene.activePageId);
      });
    });
    host.querySelectorAll('[data-nb-del]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        app.deletePage(b.dataset.nbDel);
        activatePage(app.scene.activePageId);
      });
    });
  }

  function setupObserver() {
    observer?.disconnect();
    if (typeof IntersectionObserver !== 'function') return;
    observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        host.querySelectorAll('.wb-nb-sheet').forEach((s) => {
          s.classList.toggle('in-view', s === visible.target);
        });
      },
      { root: host, threshold: [0.25, 0.6] }
    );
    host.querySelectorAll('.wb-nb-sheet').forEach((s) => observer.observe(s));
  }

  function scrollToActive(behavior = 'smooth') {
    const sheet = activeSheetEl();
    if (!sheet) return;
    sheet.scrollIntoView({ block: 'center', behavior });
  }

  function activatePage(pageId) {
    if (!pageId) return;
    if (pageId === app.scene.activePageId) {
      scrollToActive();
      return;
    }
    if (!app.scene.pages.some((p) => p.id === pageId)) return;
    app.switchPage(pageId);
    // switchPage triggers updateUI -> update() -> build()
    scrollToActive();
  }

  function setScale(nextScale) {
    const clamped = Math.max(MIN_SCALE, Math.min(MAX_SCALE, nextScale));
    if (Math.abs(clamped - scale) < 0.001) return;
    const anchor = host.scrollTop || 0;
    scale = clamped;
    build(false);
    host.scrollTop = anchor;
  }

  function enter() {
    app.viewMode = 'notebook';
    host.classList.remove('wb-hidden');
    app.canvasWrap.classList.add('wb-notebook-active');
    build(false);
    scrollToActive('instant');
  }

  function exit() {
    app.viewMode = 'diagram';
    detachLiveCanvas();
    observer?.disconnect();
    observer = null;
    host.classList.add('wb-hidden');
    app.canvasWrap.classList.remove('wb-notebook-active');
    host.innerHTML = '';
    builtSignature = '';
    builtActiveId = '';
    app.handleResize();
    app.requestRender();
  }

  function schedulePreviews() {
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      previewTimer = null;
      if (!isActive()) return;
      host.querySelectorAll('[data-nb-preview]').forEach((canvas) => {
        const page = app.scene.pages.find((p) => p.id === canvas.dataset.nbPreview);
        if (page) renderPreview(page, canvas);
      });
    }, 140);
  }

  function update() {
    if (!isActive()) return;
    const sig = pageSignature();
    const activeId = app.scene.activePageId;
    if (sig !== builtSignature || activeId !== builtActiveId) {
      build(true);
      return;
    }
    // Keep the single-page jump selector truthful after a rename.
    const jump = host.querySelector('#nb-jump');
    if (jump) {
      const option = jump.querySelector(`option[value="${cssEscape(activeId)}"]`);
      if (option) jump.value = activeId;
    }
    schedulePreviews();
  }

  function handleResize() {
    const page = currentPage();
    if (!page) return;
    app.renderer.resize(
      Math.round((page.width || 1280) * scale),
      Math.round((page.height || 720) * scale)
    );
  }

  return {
    enter,
    exit,
    update,
    activatePage,
    handleResize,
    setScale,
    getScale: () => scale,
    getCamera,
    isActive,
    scrollToActive,
  };
}
