// ui/page-navigator.js
// Page Thumbnail Navigator — visual strip of all page thumbnails so teachers
// can jump between lesson sections instantly. Appears as a slide-up panel
// or inline bar, showing each page with its element count and active state.

export function initPageNavigator(app) {
  const container = document.getElementById('wb-page-navigator');
  if (!container) return null;

  let visible = false;

  function render() {
    const pages = app.scene.pages;
    const activeId = app.scene.activePageId;
    container.innerHTML = `
      <div class="wb-pagenav-header">
        <strong>📑 Pages</strong>
        <button type="button" class="wb-icon-btn wb-pagenav-close" id="btn-pagenav-close" aria-label="Close Page Navigator">✕</button>
      </div>
      <div class="wb-pagenav-list" role="list">
        ${pages.map((p, idx) => {
          const isActive = p.id === activeId;
          const elCount = p.elements ? p.elements.length : 0;
          return `
            <button
              type="button"
              class="wb-pagenav-item ${isActive ? 'active' : ''}"
              data-page-id="${p.id}"
              aria-pressed="${isActive}"
              title="${escapeHtml(p.name)} (${elCount} element${elCount !== 1 ? 's' : ''})"
              role="listitem"
            >
              <div class="wb-pagenav-thumb">
                <div class="wb-pagenav-thumb-bg" style="background:${p.background === 'dots' ? '#f8fafc' : p.background === 'grid' ? '#e2e8f0' : '#ffffff'}">
                  ${renderThumbnailPreview(p.elements || [])}
                </div>
                <div class="wb-pagenav-thumb-overlay">
                  <span class="wb-pagenav-page-num">${idx + 1}</span>
                </div>
              </div>
              <div class="wb-pagenav-info">
                <div class="wb-pagenav-name">${escapeHtml(p.name)}</div>
                <div class="wb-pagenav-meta">${elCount} element${elCount !== 1 ? 's' : ''}</div>
              </div>
              ${isActive ? '<span class="wb-pagenav-active-dot"></span>' : ''}
            </button>`;
        }).join('')}
      </div>
      <div class="wb-pagenav-footer">
        <button type="button" class="wb-btn wb-sm wb-primary" id="btn-pagenav-add-page" title="Add New Page">+ Add Page</button>
      </div>
    `;

    container.querySelectorAll('[data-page-id]').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.switchPage(btn.dataset.pageId);
        app.haptic?.('light');
        render();
      });
    });

    container.querySelector('#btn-pagenav-close')?.addEventListener('click', () => hide());
    container.querySelector('#btn-pagenav-add-page')?.addEventListener('click', () => {
      app.addPage();
      app.haptic?.('light');
      render();
    });
  }

  function renderThumbnailPreview(elements) {
    // Render a tiny preview of the first few elements on the page
    const visible = elements.filter((e) => !e.hidden).slice(0, 6);
    if (visible.length === 0) return '<div class="wb-pagenav-empty">Empty</div>';
    return visible.map((el) => {
      const cx = el.x + (el.w || 0) / 2;
      const cy = el.y + (el.h || 0) / 2;
      const scale = 0.15;
      const tx = (cx - 200) * scale + 40;
      const ty = (cy - 150) * scale + 30;
      let html = '';
      if (el.type === 'rect' || el.type === 'rounded-rect' || el.type === 'frame') {
        html += `<rect x="${el.x * scale + 40}" y="${el.y * scale + 30}" width="${(el.w || 40) * scale}" height="${(el.h || 30) * scale}" fill="${el.fill || 'transparent'}" stroke="${el.stroke || '#1e293b'}" stroke-width="1"/>`;
      } else if (el.type === 'ellipse') {
        html += `<ellipse cx="${el.x * scale + 40}" cy="${el.y * scale + 30}" rx="${(el.w || 30) * scale / 2}" ry="${(el.h || 30) * scale / 2}" fill="${el.fill || 'transparent'}" stroke="${el.stroke || '#1e293b'}" stroke-width="1"/>`;
      } else if (el.type === 'text' || el.type === 'sticky') {
        html += `<text x="${el.x * scale + 40}" y="${el.y * scale + 45}" font-size="8" fill="${el.textColor || '#1e293b'}" font-family="sans-serif">${escapeHtml((el.text || '').substring(0, 12))}</text>`;
      } else if (el.type === 'arrow' || el.type === 'line') {
        html += `<line x1="${el.x * scale + 40}" y1="${el.y * scale + 30}" x2="${(el.x2 || el.x) * scale + 40}" y2="${(el.y2 || el.y) * scale + 30}" stroke="${el.stroke || '#1e293b'}" stroke-width="1"/>`;
      } else if (el.type === 'diamond') {
        html += `<polygon points="${el.x * scale + 40},${(el.y + el.h / 2) * scale + 30} ${(el.x + el.w / 2) * scale + 40},${el.y * scale + 30} ${el.x * scale + 40 + el.w * scale},${(el.y + el.h / 2) * scale + 30} ${(el.x + el.w / 2) * scale + 40},${(el.y + el.h) * scale + 30}" fill="${el.fill || 'transparent'}" stroke="${el.stroke || '#1e293b'}" stroke-width="1"/>`;
      }
      return html;
    }).join('');
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

  container.querySelector('#btn-pagenav-close')?.addEventListener('click', () => hide());

  // Re-render on selection/page changes — hook into app.updateUI via wrapper
  const _originalUpdateUI = app.updateUI;
  app.updateUI = function (...args) {
    _originalUpdateUI.apply(app, args);
    if (visible) render();
  };

  return { show, hide, toggle, render, isVisible: () => visible };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
