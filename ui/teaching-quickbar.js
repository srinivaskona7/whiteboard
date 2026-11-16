// ui/teaching-quickbar.js
// Teaching Quick-Action Bar — floating toolbar with one-tap classroom actions:
// Mark Correct / Incorrect, Highlight Answer, Hide All / Reveal All, Next / Prev Page.
// Designed for teachers who need to gesture at the board while teaching.

export function initTeachingQuickbar(app) {
  const container = document.getElementById('wb-teaching-quickbar');
  if (!container) return null;

  let visible = false;

  const TEACHING_STYLES = [
    { id: 'correct', label: 'Correct ✓', stroke: '#16a34a', fill: '#dcfce7', textColor: '#166534', badge: '✓' },
    { id: 'incorrect', label: 'Incorrect ✗', stroke: '#dc2626', fill: '#fee2e2', textColor: '#991b1b', badge: '✗' },
    { id: 'highlight', label: 'Highlight ★', stroke: '#ca8a04', fill: '#fef3c7', textColor: '#92400e', badge: '★' },
    { id: 'neutral', label: 'Neutral', stroke: '#64748b', fill: '#f1f5f9', textColor: '#475569', badge: '—' },
  ];

  function applyStyleToSelection(styleId) {
    const style = TEACHING_STYLES.find((s) => s.id === styleId);
    if (!style) return;
    const page = app.getPage();
    const targets = page.elements.filter((e) => app.selectedIds.has(e.id) && !e.locked);
    if (targets.length === 0) {
      app.dialogs?.showToast('Select elements first to apply a teaching style.', 'info');
      return;
    }
    for (const el of targets) {
      el.stroke = style.stroke;
      el.fill = style.fill;
      el.textColor = style.textColor;
      if (el.type === 'text' || el.type === 'sticky') {
        el.textColor = style.textColor;
      }
    }
    app.commitChange();
    app.updateUI();
    app.requestRender();
    app.haptic?.('light');
    app.dialogs?.showToast(`Applied "${style.label}" to ${targets.length} element(s).`, 'success');
  }

  function hideAllElements() {
    const page = app.getPage();
    let hidden = 0;
    for (const el of page.elements) {
      if (!el.hidden) { el.hidden = true; hidden++; }
    }
    if (hidden > 0) app.commitChange();
    app.updateUI();
    app.requestRender();
    app.haptic?.('light');
    app.dialogs?.showToast(`Hidden ${hidden} element(s). Use "Reveal All" to bring them back.`, 'info');
  }

  function revealAllElements() {
    const page = app.getPage();
    let revealed = 0;
    for (const el of page.elements) {
      if (el.hidden) { el.hidden = false; revealed++; }
    }
    if (revealed > 0) app.commitChange();
    app.updateUI();
    app.requestRender();
    app.haptic?.('light');
    app.dialogs?.showToast(`Revealed ${revealed} element(s).`, 'success');
  }

  function render() {
    const page = app.getPage();
    const selectedCount = app.getSelectedElements().length;
    const hiddenCount = page.elements.filter((e) => e.hidden).length;
    const totalCount = page.elements.length;

    container.innerHTML = `
      <div class="wb-quickbar-header">
        <strong>⚡ Teaching Actions</strong>
        <button type="button" class="wb-icon-btn wb-quickbar-close" id="btn-quickbar-close" aria-label="Close Teaching Bar">✕</button>
      </div>
      <div class="wb-quickbar-section">
        <div class="wb-quickbar-section-title">Mark Selection</div>
        <div class="wb-quickbar-row">
          ${TEACHING_STYLES.map((s) => `
            <button type="button" class="wb-quickbar-btn wb-quickbar-style-${s.id}" data-style="${s.id}" title="${s.label}">
              <span class="wb-quickbar-badge">${s.badge}</span>
              <span class="wb-quickbar-label">${escapeHtml(s.label)}</span>
            </button>`).join('')}
        </div>
      </div>
      <div class="wb-quickbar-section">
        <div class="wb-quickbar-section-title">Visibility</div>
        <div class="wb-quickbar-row">
          <button type="button" class="wb-quickbar-btn wb-quickbar-hide" id="btn-quickbar-hide" title="Hide All Elements">
            <span class="wb-quickbar-badge">🙈</span>
            <span class="wb-quickbar-label">Hide All</span>
          </button>
          <button type="button" class="wb-quickbar-btn wb-quickbar-reveal" id="btn-quickbar-reveal" title="Reveal All Elements">
            <span class="wb-quickbar-badge">👁</span>
            <span class="wb-quickbar-label">Reveal All</span>
          </button>
        </div>
        <div class="wb-quickbar-meta" style="font-size:10px;color:var(--text-muted);margin-top:4px;">
          ${hiddenCount}/${totalCount} hidden
        </div>
      </div>
      <div class="wb-quickbar-section">
        <div class="wb-quickbar-section-title">Navigation</div>
        <div class="wb-quickbar-row">
          <button type="button" class="wb-quickbar-btn wb-quickbar-prev" id="btn-quickbar-prev" title="Previous Page" ${page.id === app.scene.pages[0]?.id ? 'disabled' : ''}>
            <span class="wb-quickbar-badge">◀</span>
            <span class="wb-quickbar-label">Prev</span>
          </button>
          <button type="button" class="wb-quickbar-btn wb-quickbar-next" id="btn-quickbar-next" title="Next Page" ${page.id === app.scene.pages[app.scene.pages.length - 1]?.id ? 'disabled' : ''}>
            <span class="wb-quickbar-badge">▶</span>
            <span class="wb-quickbar-label">Next</span>
          </button>
        </div>
        <div class="wb-quickbar-meta" style="font-size:10px;color:var(--text-muted);margin-top:4px;">
          Page ${app.scene.pages.findIndex((p) => p.id === page.id) + 1}/${app.scene.pages.length}
        </div>
      </div>
      <div class="wb-quickbar-footer">
        <span class="wb-quickbar-selected">${selectedCount} selected</span>
      </div>
    `;

    // Bind style buttons
    container.querySelectorAll('[data-style]').forEach((btn) => {
      btn.addEventListener('click', () => {
        applyStyleToSelection(btn.dataset.style);
      });
    });

    // Bind visibility buttons
    container.querySelector('#btn-quickbar-hide')?.addEventListener('click', () => {
      hideAllElements();
      render();
    });
    container.querySelector('#btn-quickbar-reveal')?.addEventListener('click', () => {
      revealAllElements();
      render();
    });

    // Bind navigation buttons
    container.querySelector('#btn-quickbar-prev')?.addEventListener('click', () => {
      const idx = app.scene.pages.findIndex((p) => p.id === page.id);
      if (idx > 0) app.switchPage(app.scene.pages[idx - 1].id);
      render();
    });
    container.querySelector('#btn-quickbar-next')?.addEventListener('click', () => {
      const idx = app.scene.pages.findIndex((p) => p.id === page.id);
      if (idx < app.scene.pages.length - 1) app.switchPage(app.scene.pages[idx + 1].id);
      render();
    });

    container.querySelector('#btn-quickbar-close')?.addEventListener('click', () => {
      hide();
    });
  }

  function show() {
    visible = true;
    container.classList.remove('wb-hidden');
    render();
  }

  function hide() {
    visible = false;
    container.classList.add('wb-hidden');
  }

  function toggle() {
    if (visible) hide();
    else show();
  }

  // Re-render on selection/page changes — hook into app.updateUI via wrapper
  const _originalUpdateUI = app.updateUI;
  app.updateUI = function (...args) {
    _originalUpdateUI.apply(app, args);
    if (visible) render();
  };

  container.querySelector('#btn-quickbar-close')?.addEventListener('click', () => hide());

  return { show, hide, toggle, render, isVisible: () => visible };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
