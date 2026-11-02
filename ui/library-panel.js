// ui/library-panel.js
import { ALL_STENCILS, getAllCategories, getStencilsByCategory } from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { buildDevOpsDiagramPacks } from './registry.js';
import { escapeXml } from '../render/svg-export.js';

export function initLibraryPanel(app) {
  const panel = document.getElementById('wb-library-panel');
  if (!panel) return { update() {} };

  let searchQuery = '';
  let categoryFilter = 'all';
  let activeTab = 'stencils'; // 'stencils' | 'reusable' | 'templates'
  let multiSelectMode = false;
  const selectedStencilIds = new Set();
  const collapsedCategories = new Set();
  const builtInPacks = buildDevOpsDiagramPacks();

  function render() {
    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>DevOps Library, Packs & Templates</strong>
        <button type="button" class="wb-icon-btn" id="btn-close-lib" aria-label="Close Library Panel" title="Close Library Panel">✕</button>
      </div>
      <div class="wb-tabs-row">
        <button type="button" class="wb-tab-btn ${activeTab === 'stencils' ? 'active' : ''}" data-lib-tab="stencils">Icons (${ALL_STENCILS.length})</button>
        <button type="button" class="wb-tab-btn ${activeTab === 'reusable' ? 'active' : ''}" data-lib-tab="reusable">Packs (${app.userLibrary.length + builtInPacks.length})</button>
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
    const categories = getAllCategories();
    const groups = getStencilsByCategory(searchQuery, categoryFilter);
    const selCount = selectedStencilIds.size;

    content.innerHTML = `
      <div class="wb-lib-search-row">
        <input
          type="search"
          id="wb-stencil-search"
          class="wb-input"
          placeholder="Search ${ALL_STENCILS.length}+ icons (aws, aks, gke, docker, terraform, kafka...)"
          value="${escapeXml(searchQuery)}"
          aria-label="Search Stencils"
        />
      </div>
      <div class="wb-lib-toolbar-row">
        <button
          type="button"
          class="wb-btn wb-sm ${multiSelectMode ? 'active' : ''}"
          id="btn-stencil-multiselect-mode"
          aria-pressed="${multiSelectMode}"
          title="Toggle Multi-Select Mode to pick multiple DevOps icons and insert them together"
        >
          ☑ Multi-Select ${selCount > 0 ? `(${selCount})` : ''}
        </button>
        <span class="wb-muted" style="font-size:10px;">Drag icon or click to place</span>
      </div>
      ${
        selCount > 0
          ? `<div class="wb-multiselect-tray" role="region" aria-label="Selected Icons Tray">
              <div class="wb-multiselect-tray-head">
                <strong>${selCount} icon${selCount > 1 ? 's' : ''} selected</strong>
                <button type="button" class="wb-icon-btn" id="btn-clear-stencil-sel" title="Clear Selection">Clear ✕</button>
              </div>
              <div class="wb-btn-group">
                <button type="button" class="wb-btn wb-sm wb-primary" id="btn-insert-stencils-grid" title="Insert selected icons arranged in a clean grid">+ Grid (${selCount})</button>
                <button type="button" class="wb-btn wb-sm" id="btn-insert-stencils-row" title="Insert selected icons aligned in a horizontal row">→ Row</button>
                <button type="button" class="wb-btn wb-sm" id="btn-insert-stencils-flow" title="Insert selected icons connected with smart arrows">⛓ Connected Flow</button>
              </div>
            </div>`
          : ''
      }
      <div class="wb-cat-chips" role="tablist" aria-label="Filter by DevOps Category">
        <button type="button" class="wb-cat-chip ${categoryFilter === 'all' ? 'active' : ''}" data-cat-chip="all">All</button>
        ${categories
          .map(
            (cat) => `
          <button type="button" class="wb-cat-chip ${categoryFilter === cat ? 'active' : ''}" data-cat-chip="${escapeXml(cat)}">${escapeXml(cat)}</button>
        `
          )
          .join('')}
      </div>
      <div class="wb-stencil-categories">
        ${
          groups.length === 0
            ? `<div class="wb-muted" style="padding:12px 4px;text-align:center;">No icons match "${escapeXml(searchQuery)}". Try searching for aws, azure, gcp, k8s, linux, docker, git, terraform, prometheus, or postgres.</div>`
            : groups
                .map(({ category, items }) => {
                  const isCollapsed = collapsedCategories.has(category) && !searchQuery && categoryFilter === 'all';
                  return `
              <div class="wb-stencil-cat">
                <button type="button" class="wb-cat-header" data-cat="${escapeXml(category)}" aria-expanded="${!isCollapsed}">
                  <span>${isCollapsed ? '▸' : '▾'} ${escapeXml(category)} (${items.length})</span>
                  <span class="wb-cat-select-all" data-cat-add-all="${escapeXml(category)}" title="Select all in ${escapeXml(category)}">+ Select All</span>
                </button>
                ${
                  isCollapsed
                    ? ''
                    : `<div class="wb-stencil-grid">
                        ${items
                          .map((st) => {
                            const isSelected = selectedStencilIds.has(st.id);
                            return `
                          <div
                            class="wb-stencil-item ${isSelected ? 'selected' : ''}"
                            draggable="true"
                            role="button"
                            tabindex="0"
                            data-stencil-id="${escapeXml(st.id)}"
                            aria-label="Place ${escapeXml(st.name)} stencil"
                            title="${escapeXml(st.name)} (${escapeXml(st.category)}) — Click to insert, Shift+Click or checkbox to multi-select"
                          >
                            <span
                              class="wb-stencil-check ${isSelected ? 'checked' : ''}"
                              data-stencil-check="${escapeXml(st.id)}"
                              title="Select ${escapeXml(st.name)} for bulk insertion"
                              aria-label="Select ${escapeXml(st.name)}"
                            >${isSelected ? '✓' : '+'}</span>
                            <div class="wb-stencil-icon">${st.iconSvg}</div>
                            <span class="wb-stencil-name">${escapeXml(st.name)}</span>
                          </div>
                        `;
                          })
                          .join('')}
                      </div>`
                }
              </div>
            `;
                })
                .join('')
        }
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

    content.querySelector('#btn-stencil-multiselect-mode')?.addEventListener('click', () => {
      multiSelectMode = !multiSelectMode;
      renderStencilsTab(content);
    });

    content.querySelector('#btn-clear-stencil-sel')?.addEventListener('click', () => {
      selectedStencilIds.clear();
      renderStencilsTab(content);
    });

    const insertSelected = (layoutMode) => {
      const ids = Array.from(selectedStencilIds);
      if (ids.length === 0) return;
      app.placeMultipleStencils(ids, layoutMode);
      selectedStencilIds.clear();
      renderStencilsTab(content);
    };

    content.querySelector('#btn-insert-stencils-grid')?.addEventListener('click', () => insertSelected('grid'));
    content.querySelector('#btn-insert-stencils-row')?.addEventListener('click', () => insertSelected('row'));
    content.querySelector('#btn-insert-stencils-flow')?.addEventListener('click', () => insertSelected('flow'));

    content.querySelectorAll('[data-cat-chip]').forEach((chip) => {
      chip.addEventListener('click', () => {
        categoryFilter = chip.dataset.catChip;
        renderStencilsTab(content);
      });
    });

    content.querySelectorAll('[data-cat]').forEach((b) => {
      b.addEventListener('click', (ev) => {
        const addAllBtn = ev.target.closest('[data-cat-add-all]');
        if (addAllBtn) {
          ev.stopPropagation();
          const catName = addAllBtn.dataset.catAddAll;
          const grp = groups.find((g) => g.category === catName);
          if (grp) {
            const allAlready = grp.items.every((it) => selectedStencilIds.has(it.id));
            for (const it of grp.items) {
              if (allAlready) selectedStencilIds.delete(it.id);
              else selectedStencilIds.add(it.id);
            }
            renderStencilsTab(content);
          }
          return;
        }
        const cat = b.dataset.cat;
        if (collapsedCategories.has(cat)) collapsedCategories.delete(cat);
        else collapsedCategories.add(cat);
        renderStencilsTab(content);
      });
    });

    content.querySelectorAll('[data-stencil-id]').forEach((item) => {
      const id = item.dataset.stencilId;
      item.addEventListener('click', (ev) => {
        const checkBtn = ev.target.closest('[data-stencil-check]');
        if (checkBtn || ev.shiftKey || multiSelectMode) {
          ev.stopPropagation();
          if (selectedStencilIds.has(id)) selectedStencilIds.delete(id);
          else selectedStencilIds.add(id);
          renderStencilsTab(content);
          return;
        }
        app.placeStencil(id);
      });
      item.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') {
          ev.preventDefault();
          app.placeStencil(id);
        }
      });
      item.addEventListener('dragstart', (ev) => {
        if (selectedStencilIds.has(id) && selectedStencilIds.size > 1) {
          ev.dataTransfer.setData('text/plain', `stencils:${Array.from(selectedStencilIds).join(',')}`);
        } else {
          ev.dataTransfer.setData('text/plain', `stencil:${id}`);
        }
      });
    });
  }

  function renderReusableTab(content) {
    content.innerHTML = `
      <div class="wb-btn-group" style="margin-bottom:8px">
        <button type="button" class="wb-btn wb-sm" id="btn-lib-add-sel" aria-label="Save selected elements to library">➕ Save Selection</button>
        <button type="button" class="wb-btn wb-sm" id="btn-lib-export" aria-label="Export library JSON">⬇ Export</button>
        <button type="button" class="wb-btn wb-sm" id="btn-lib-import" aria-label="Import library JSON">📂 Import</button>
      </div>
      <div class="wb-prop-subtitle">Built-in DevOps & Networking Packs</div>
      <div class="wb-reusable-list" style="margin-bottom:10px;">
        ${builtInPacks
          .map(
            (pack, idx) => `
          <div class="wb-reusable-card">
            <button type="button" class="wb-reusable-insert" data-pack-idx="${idx}" aria-label="Insert ${escapeXml(pack.name)}">
              <strong>${escapeXml(pack.name)}</strong>
              <span>${pack.elements.length} connected elements (with Reveal steps)</span>
            </button>
          </div>
        `
          )
          .join('')}
      </div>
      <div class="wb-prop-subtitle">My Saved Groups (${app.userLibrary.length})</div>
      ${
        app.userLibrary.length === 0
          ? `<p class="wb-muted">Select elements on canvas and click "Save Selection" to store custom diagram groups.</p>`
          : `<div class="wb-reusable-list">
              ${app.userLibrary
                .map(
                  (item, idx) => `
                <div class="wb-reusable-card">
                  <button type="button" class="wb-reusable-insert" data-lib-idx="${idx}" aria-label="Insert saved group ${escapeXml(item.name)}">
                    <strong>${escapeXml(item.name)}</strong>
                    <span>${item.elements.length} element(s)</span>
                  </button>
                  <button type="button" class="wb-icon-btn" data-lib-del="${idx}" aria-label="Delete saved group ${escapeXml(item.name)}" title="Delete saved group">🗑</button>
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
    content.querySelectorAll('[data-pack-idx]').forEach((b) => {
      b.addEventListener('click', () => {
        const pack = builtInPacks[Number(b.dataset.packIdx)];
        if (pack) app.insertDiagramPack(pack);
      });
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
          <button type="button" class="wb-template-card" data-tpl-id="${escapeXml(tpl.id)}" aria-label="Apply template ${escapeXml(tpl.name)}">
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
