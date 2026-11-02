// ui/layers.js
import { escapeXml } from '../render/svg-export.js';

export function initLayersPanel(app) {
  const panel = document.getElementById('wb-layers-panel');
  if (!panel) return { update() {} };

  function render() {
    const page = app.getPage();
    const elements = [...page.elements].reverse();

    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>Layers (${page.elements.length})</strong>
        <button type="button" class="wb-icon-btn" id="btn-close-layers" aria-label="Close Layers Panel">✕</button>
      </div>
      <div class="wb-panel-body">
        ${
          elements.length === 0
            ? `<p class="wb-muted">No elements on this page yet.</p>`
            : `<div class="wb-layers-list">
                ${elements
                  .map((el) => {
                    const isSel = app.selectedIds.has(el.id);
                    const label = el.text ? `${el.type}: ${el.text.slice(0, 18)}` : el.name || el.type;
                    return `
                      <div class="wb-layer-row ${isSel ? 'active' : ''}" data-layer-id="${escapeXml(el.id)}">
                        <button type="button" class="wb-layer-select" data-sel-layer="${escapeXml(el.id)}">
                          ${escapeXml(label)}
                        </button>
                        <div class="wb-layer-actions">
                          <button type="button" class="wb-icon-btn" data-z-layer="${escapeXml(el.id)}:front" title="Bring to Front">⇡</button>
                          <button type="button" class="wb-icon-btn" data-z-layer="${escapeXml(el.id)}:back" title="Send to Back">⇣</button>
                          <button type="button" class="wb-icon-btn" data-lock-layer="${escapeXml(el.id)}" title="${el.locked ? 'Unlock' : 'Lock'}">
                            ${el.locked ? '🔒' : '🔓'}
                          </button>
                          <button type="button" class="wb-icon-btn" data-hide-layer="${escapeXml(el.id)}" title="${el.hidden ? 'Show' : 'Hide'}">
                            ${el.hidden ? '🙈' : '👁'}
                          </button>
                        </div>
                      </div>
                    `;
                  })
                  .join('')}
              </div>`
        }
      </div>
    `;

    panel.querySelector('#btn-close-layers')?.addEventListener('click', () => {
      panel.classList.add('wb-hidden');
    });

    panel.querySelectorAll('[data-sel-layer]').forEach((b) => {
      b.addEventListener('click', () => {
        app.selectedIds = new Set([b.dataset.selLayer]);
        app.updateUI();
        app.requestRender();
      });
    });

    panel.querySelectorAll('[data-z-layer]').forEach((b) => {
      b.addEventListener('click', () => {
        const [id, dir] = b.dataset.zLayer.split(':');
        app.reorderElementById(id, dir);
      });
    });

    panel.querySelectorAll('[data-lock-layer]').forEach((b) => {
      b.addEventListener('click', () => {
        const el = page.elements.find((e) => e.id === b.dataset.lockLayer);
        if (el) {
          el.locked = !el.locked;
          if (el.locked) app.selectedIds.delete(el.id);
          app.commitChange();
          app.updateUI();
          app.requestRender();
        }
      });
    });

    panel.querySelectorAll('[data-hide-layer]').forEach((b) => {
      b.addEventListener('click', () => {
        const el = page.elements.find((e) => e.id === b.dataset.hideLayer);
        if (el) {
          el.hidden = !el.hidden;
          if (el.hidden) app.selectedIds.delete(el.id);
          app.commitChange();
          app.updateUI();
          app.requestRender();
        }
      });
    });
  }

  render();
  return { update: render };
}
