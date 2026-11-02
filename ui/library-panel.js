// ui/library-panel.js
import { getStencilsByCategory } from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { escapeXml } from '../render/svg-export.js';

export function initLibraryPanel(app) {
  const panel = document.getElementById('wb-library-panel');
  if (!panel) return { update() {} };

  let searchQuery = '';
  let activeTab = 'stencils'; // 'stencils' | 'reusable' | 'templates'
  const collapsedCategories = new Set();

  function render() {
    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>Library & Templates</strong>
        <button type="button" class="wb-icon-btn" id="btn-close-lib" aria-label="Close Library Panel">✕</button>
      </div>
      <div class="wb-tabs-row">
        <button type="button" class="wb-tab-btn ${activeTab === 'stencils' ? 'active' : ''}" data-lib-tab="stencils">Stencils</button>
        <button type="button" class="wb-tab-btn ${activeTab === 'reusable' ? 'active' : ''}" data-lib-tab="reusable">My Library (${app.userLibrary.length})</button>
        <button type="button" class="wb-tab-btn ${activeTab === 'templates' ? 'active' : ''}" data-lib-tab="templates">Templates</button>
      </div>
      <div class="wb-panel-body" id="wb-lib-content"></div>
    `;

    const content = panel.querySelector('#wb-lib-content');
    if (activeTab === 'stencils') {
      renderStencilsTab(content);
    } else if (activeTab === 'reusable') {
      renderReusableTab(content);
    } else {
      renderTemplatesTab(content);
    }

    panel.querySelector('#btn-close-lib')?.addEventListener('click', () => {
      panel.classList.add('wb-hidden');
    });

    panel.querySelectorAll('[data-lib-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.libTab;
        render();
      });
    });
  }

  function renderStencilsTab(content) {
    const groups = getStencilsByCategory(searchQuery);
    content.innerHTML = `
      <input
        type="search"
        id="wb-stencil-search"
        class="wb-input"
        placeholder="Search 35+ stencils (k8s, uml, flow...)"
        value="${escapeXml(searchQuery)}"
        aria-label="Search Stencils"
      />
      <div class="wb-stencil-categories">
        ${groups
          .map(({ category, items }) => {
            const isCollapsed = collapsedCategories.has(category);
            return `
              <div class="wb-stencil-cat">
                <button type="button" class="wb-cat-header" data-cat="${escapeXml(category)}">
                  <span>${isCollapsed ? '▸' : '▾'} ${escapeXml(category)} (${items.length})</span>
                </button>
                ${
                  isCollapsed
                    ? ''
                    : `<div class="wb-stencil-grid">
                        ${items
                          .map(
                            (st) => `
                          <button
                            type="button"
                            class="wb-stencil-item"
                            draggable="true"
                            data-stencil-id="${escapeXml(st.id)}"
                            title="${escapeXml(st.name)}"
                          >
                            <div class="wb-stencil-icon">${st.iconSvg}</div>
                            <span class="wb-stencil-name">${escapeXml(st.name)}</span>
                          </button>
                        `
                          )
                          .join('')}
                      </div>`
                }
              </div>
            `;
          })
          .join('')}
      </div>
    `;

    const searchInput = content.querySelector('#wb-stencil-search');
    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      renderStencilsTab(content);
      const newInput = content.querySelector('#wb-stencil-search');
      if (newInput) {
        newInput.focus();
        newInput.setSelectionRange(searchQuery.length, searchQuery.length);
      }
    });

    content.querySelectorAll('[data-cat]').forEach((b) => {
      b.addEventListener('click', () => {
        const cat = b.dataset.cat;
        if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
        else collapsedCategories.add(cat);
        renderStencilsTab(content);
      });
    });

    content.querySelectorAll('[data-stencil-id]').forEach((item) => {
      item.addEventListener('click', () => {
        app.placeStencil(item.dataset.stencilId);
      });
      item.addEventListener('dragstart', (ev) => {
        ev.dataTransfer.setData('text/plain', `stencil:${item.dataset.stencilId}`);
      });
    });
  }

  function renderReusableTab(content) {
    content.innerHTML = `
      <div class="wb-btn-group" style="margin-bottom:8px">
        <button type="button" class="wb-btn wb-sm" id="btn-lib-add-sel">➕ Add Selection</button>
        <button type="button" class="wb-btn wb-sm" id="btn-lib-export">⬇ Export .library.json</button>
        <button type="button" class="wb-btn wb-sm" id="btn-lib-import">📂 Import</button>
      </div>
      ${
        app.userLibrary.length === 0
          ? `<p class="wb-muted">Select elements on canvas and click "Add Selection" to save reusable components.</p>`
          : `<div class="wb-reusable-list">
              ${app.userLibrary
                .map(
                  (item, idx) => `
                <div class="wb-reusable-card">
                  <button type="button" class="wb-reusable-insert" data-lib-idx="${idx}">
                    <strong>${escapeXml(item.name)}</strong>
                    <span>${item.elements.length} el(s)</span>
                  </button>
                  <button type="button" class="wb-icon-btn" data-lib-del="${idx}" title="Delete">🗑</button>
                </div>
              `
                )
                .join('')}
            </div>`
      }
    `;

    content.querySelector('#btn-lib-add-sel')?.addEventListener('click', () => {
      app.addSelectionToLibrary();
      render();
    });
    content.querySelector('#btn-lib-export')?.addEventListener('click', () => {
      app.exportUserLibraryFile();
    });
    content.querySelector('#btn-lib-import')?.addEventListener('click', () => {
      app.importUserLibraryFilePicker();
    });
    content.querySelectorAll('[data-lib-idx]').forEach((b) => {
      b.addEventListener('click', () => {
        app.insertUserLibraryItem(Number(b.dataset.libIdx));
      });
    });
    content.querySelectorAll('[data-lib-del]').forEach((b) => {
      b.addEventListener('click', () => {
        app.deleteUserLibraryItem(Number(b.dataset.libDel));
        render();
      });
    });
  }

  function renderTemplatesTab(content) {
    content.innerHTML = `
      <div class="wb-template-list">
        ${BUILTIN_TEMPLATES.map(
          (tpl) => `
          <button type="button" class="wb-template-card" data-tpl-id="${escapeXml(tpl.id)}">
            <strong>${escapeXml(tpl.name)}</strong>
            <span>${escapeXml(tpl.description)}</span>
          </button>
        `
        ).join('')}
      </div>
    `;

    content.querySelectorAll('[data-tpl-id]').forEach((b) => {
      b.addEventListener('click', () => {
        app.applyTemplate(b.dataset.tplId);
      });
    });
  }

  render();
  return { update: render };
}
