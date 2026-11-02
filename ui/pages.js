// ui/pages.js
import { escapeXml } from '../render/svg-export.js';

export function initPagesBar(app) {
  const bar = document.getElementById('wb-pages-bar');
  if (!bar) return { update() {} };

  function render() {
    const pages = app.scene.pages;
    const activeId = app.scene.activePageId;
    const canEdit = app.collab ? app.collab.canEditBoard() : true;

    bar.innerHTML = `
      <div class="wb-page-tabs" role="tablist" aria-label="Whiteboard Pages">
        ${pages
          .map(
            (p, idx) => `
          <div class="wb-page-tab ${p.id === activeId ? 'active' : ''}" data-page-id="${escapeXml(p.id)}">
            <button
              type="button"
              class="wb-page-select"
              role="tab"
              aria-selected="${p.id === activeId}"
              aria-label="Switch to page ${escapeXml(p.name)}${canEdit ? ' (double-click to rename)' : ''}"
              data-switch-page="${escapeXml(p.id)}"
              title="Switch to ${escapeXml(p.name)}${canEdit ? ' (Double-click to rename)' : ''}"
            >
              ${escapeXml(p.name)}
            </button>
            ${
              canEdit
                ? `<div class="wb-page-tab-actions">
                    ${idx > 0 ? `<button type="button" class="wb-page-mini" data-move-page="${idx}:-1" aria-label="Move page left" title="Move page left">‹</button>` : ''}
                    ${idx < pages.length - 1 ? `<button type="button" class="wb-page-mini" data-move-page="${idx}:1" aria-label="Move page right" title="Move page right">›</button>` : ''}
                    <button type="button" class="wb-page-mini" data-dup-page="${escapeXml(p.id)}" aria-label="Duplicate page ${escapeXml(p.name)}" title="Duplicate page">⧉</button>
                    ${pages.length > 1 ? `<button type="button" class="wb-page-mini" data-del-page="${escapeXml(p.id)}" aria-label="Delete page ${escapeXml(p.name)}" title="Delete page">✕</button>` : ''}
                  </div>`
                : ''
            }
          </div>
        `
          )
          .join('')}
      </div>
      ${
        canEdit
          ? `<button type="button" class="wb-btn wb-sm" id="btn-add-page" aria-label="Add new page" title="Add new page">+ Page</button>`
          : ''
      }
    `;

    bar.querySelectorAll('[data-switch-page]').forEach((b) => {
      b.addEventListener('click', () => {
        app.switchPage(b.dataset.switchPage);
      });
      b.addEventListener('dblclick', () => {
        if (!canEdit) return;
        const pid = b.dataset.switchPage;
        const p = app.scene.pages.find((pg) => pg.id === pid);
        if (!p) return;
        app.dialogs.openPromptModal('Rename Page', 'Page Name:', p.name, (newName) => {
          if (newName && newName.trim()) {
            p.name = newName.trim();
            app.scheduleAutosave(app.scene);
            render();
          }
        });
      });
    });

    bar.querySelectorAll('[data-move-page]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const [idxStr, dirStr] = b.dataset.movePage.split(':');
        app.reorderPage(Number(idxStr), Number(dirStr));
      });
    });

    bar.querySelectorAll('[data-dup-page]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        app.duplicatePage(b.dataset.dupPage);
      });
    });

    bar.querySelectorAll('[data-del-page]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        ev.stopPropagation();
        app.deletePage(b.dataset.delPage);
      });
    });

    bar.querySelector('#btn-add-page')?.addEventListener('click', () => {
      app.addPage();
    });
  }

  render();
  return { update: render };
}
