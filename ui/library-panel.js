// ui/library-panel.js — Fast Searchable DevOps Icon Library with Favorites, Recents, Virtualization & Batch Preview
import {
  ALL_STENCILS,
  getAllCategories,
  getStencilsByCategory,
  getStencilById,
  ICON_PACK_SOURCES,
} from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { buildDevOpsDiagramPacks } from './registry.js';
import { escapeXml } from '../render/svg-export.js';

export const FAVORITE_STENCILS_KEY = 'studioboard_fav_stencils_v1';
export const RECENT_STENCILS_KEY = 'studioboard_recent_stencils_v1';

function loadJsonList(key, fallback = []) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : fallback;
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function saveJsonList(key, list) {
  try {
    localStorage.setItem(key, JSON.stringify(list));
  } catch {
    // Ignore storage quota errors
  }
}

export function initLibraryPanel(app) {
  const panel = document.getElementById('wb-library-panel');
  if (!panel) return { update() {}, recordRecent() {} };

  let activeTab = 'stencils'; // 'stencils' | 'packs' | 'user' | 'templates'
  let activeCategory = 'all'; // 'all' | 'favorites' | 'recent' | category name
  let searchQuery = '';
  let previewDensity = 'comfortable'; // 'comfortable' | 'compact'
  let multiSelectMode = false;
  let previewLayoutMode = 'flow'; // 'grid' | 'row' | 'column' | 'flow'
  let visibleLimit = 64;
  const selectedStencils = new Set();
  const favorites = new Set(loadJsonList(FAVORITE_STENCILS_KEY, ['aws-ec2', 'aws-s3', 'k8s-pod', 'k8s-svc']));
  let recentIds = loadJsonList(RECENT_STENCILS_KEY, ['aws-ec2', 'aws-s3', 'aws-alb', 'k8s-pod']);

  function recordRecent(stencilId) {
    if (!stencilId) return;
    recentIds = [stencilId, ...recentIds.filter((id) => id !== stencilId)].slice(0, 14);
    saveJsonList(RECENT_STENCILS_KEY, recentIds);
  }

  function toggleFavorite(stencilId) {
    if (favorites.has(stencilId)) favorites.delete(stencilId);
    else favorites.add(stencilId);
    saveJsonList(FAVORITE_STENCILS_KEY, Array.from(favorites));
  }

  function syncPlacementPreview() {
    if (multiSelectMode && selectedStencils.size > 0 && app.previewBatchInsertion) {
      app.previewBatchInsertion(Array.from(selectedStencils), previewLayoutMode);
    } else if (app.clearPlacementPreview) {
      app.clearPlacementPreview();
    }
  }

  function render() {
    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>DevOps & Cloud Library (${ALL_STENCILS.length})</strong>
        <div style="display:flex;gap:4px;align-items:center;">
          <button type="button" class="wb-btn wb-sm" id="btn-lib-density" title="Toggle Compact vs Comfortable icon preview size">${previewDensity === 'compact' ? '⊞ Compact' : '⊟ Comfort'}</button>
          <button type="button" class="wb-icon-btn" id="btn-close-library" aria-label="Close Library">✕</button>
        </div>
      </div>
      <div class="wb-tabs" role="tablist">
        <button type="button" role="tab" class="wb-tab ${activeTab === 'stencils' ? 'active' : ''}" data-tab="stencils">Icons (${ALL_STENCILS.length})</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'packs' ? 'active' : ''}" data-tab="packs">Diagram Packs</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'user' ? 'active' : ''}" data-tab="user">My Library (${app.userLibrary.length})</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'templates' ? 'active' : ''}" data-tab="templates">Templates</button>
      </div>
      <div class="wb-panel-body" id="wb-library-content"></div>
    `;

    panel.querySelector('#btn-close-library')?.addEventListener('click', () => {
      app.clearPlacementPreview?.();
      panel.classList.add('wb-hidden');
    });

    panel.querySelector('#btn-lib-density')?.addEventListener('click', () => {
      previewDensity = previewDensity === 'comfortable' ? 'compact' : 'comfortable';
      render();
    });

    panel.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        render();
      });
    });

    const content = panel.querySelector('#wb-library-content');
    if (activeTab === 'stencils') renderStencilsTab(content);
    else if (activeTab === 'packs') renderDiagramPacksTab(content);
    else if (activeTab === 'user') renderUserLibraryTab(content);
    else renderTemplatesTab(content);
  }

  function renderStencilsTab(content) {
    const categories = getAllCategories();
    content.innerHTML = `
      <div class="wb-lib-controls">
        <div class="wb-lib-search-row">
          <input type="search" id="lib-search" class="wb-input" placeholder="Search EC2, AKS, GKE, LB, SG, PVC, DNS, Kafka..." value="${escapeXml(searchQuery)}" aria-label="Search Stencils"/>
          <button type="button" class="wb-btn wb-sm ${multiSelectMode ? 'active wb-primary' : ''}" id="btn-lib-multiselect" title="Select multiple icons to insert together as Grid, Row, Column, or Connected Flow">
            ☑ Multi-Select ${selectedStencils.size > 0 ? `(${selectedStencils.size})` : ''}
          </button>
        </div>
        <div class="wb-cat-pills" role="group" aria-label="Icon Categories">
          <button type="button" class="wb-cat-pill ${activeCategory === 'all' ? 'active' : ''}" data-cat="all">All</button>
          <button type="button" class="wb-cat-pill ${activeCategory === 'favorites' ? 'active' : ''}" data-cat="favorites">★ Favorites (${favorites.size})</button>
          <button type="button" class="wb-cat-pill ${activeCategory === 'recent' ? 'active' : ''}" data-cat="recent">🕒 Recent (${recentIds.length})</button>
          ${categories
            .map(
              (c) =>
                `<button type="button" class="wb-cat-pill ${activeCategory === c ? 'active' : ''}" data-cat="${escapeXml(c)}">${escapeXml(c)}</button>`
            )
            .join('')}
        </div>
        <div id="wb-lib-multiselect-bar" class="wb-lib-multiselect-bar ${multiSelectMode || selectedStencils.size > 0 ? '' : 'wb-hidden'}"></div>
      </div>
      <div id="wb-lib-results" class="wb-lib-results wb-density-${previewDensity}" role="listbox" aria-label="Architecture Icons"></div>
    `;

    const searchInput = content.querySelector('#lib-search');
    const resultsBox = content.querySelector('#wb-lib-results');
    const multiBar = content.querySelector('#wb-lib-multiselect-bar');

    const updateMultiBar = () => {
      if (!multiBar) return;
      if (!multiSelectMode && selectedStencils.size === 0) {
        multiBar.classList.add('wb-hidden');
        app.clearPlacementPreview?.();
        return;
      }
      multiBar.classList.remove('wb-hidden');
      const count = selectedStencils.size;
      const selectedList = Array.from(selectedStencils)
        .map((id) => getStencilById(id)?.name || id)
        .slice(0, 3)
        .join(' → ');
      multiBar.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;width:100%;">
          <span class="wb-muted" style="font-size:11px;"><strong>${count}</strong> selected${count ? `: ${escapeXml(selectedList)}${count > 3 ? '…' : ''}` : ' (click icons below)'}</span>
          ${count > 0 ? `<button type="button" class="wb-btn wb-sm" id="btn-clear-stencils">Clear</button>` : ''}
        </div>
        <div class="wb-btn-group" style="flex-wrap:wrap;gap:4px;width:100%;">
          <button type="button" class="wb-btn wb-sm ${previewLayoutMode === 'grid' ? 'wb-primary' : ''}" id="btn-insert-stencils-grid" ${count === 0 ? 'disabled' : ''} data-preview-mode="grid" title="Insert selected icons as a neat grid">+ Grid</button>
          <button type="button" class="wb-btn wb-sm ${previewLayoutMode === 'row' ? 'wb-primary' : ''}" id="btn-insert-stencils-row" ${count === 0 ? 'disabled' : ''} data-preview-mode="row" title="Insert selected icons in a horizontal row">→ Row</button>
          <button type="button" class="wb-btn wb-sm ${previewLayoutMode === 'column' ? 'wb-primary' : ''}" id="btn-insert-stencils-col" ${count === 0 ? 'disabled' : ''} data-preview-mode="column" title="Insert selected icons in a vertical column">↓ Column</button>
          <button type="button" class="wb-btn wb-sm ${previewLayoutMode === 'flow' ? 'wb-primary' : ''}" id="btn-insert-stencils-flow" ${count === 0 ? 'disabled' : ''} data-preview-mode="flow" title="Insert selected icons connected with smart arrows">⛓ Connected Flow</button>
        </div>
        ${count > 0 ? `<div class="wb-muted" style="font-size:10px;width:100%;">✨ Live placement preview shown on canvas · Click a layout button to commit</div>` : ''}
      `;

      const commitBatch = (layoutMode) => {
        const ids = Array.from(selectedStencils);
        if (ids.length === 0) return;
        ids.forEach((id) => recordRecent(id));
        const inserted = app.placeMultipleStencils(ids, layoutMode);
        if (inserted) {
          selectedStencils.clear();
          app.clearPlacementPreview?.();
          updateResults();
          updateMultiBar();
        }
      };

      multiBar.querySelectorAll('[data-preview-mode]').forEach((btn) => {
        btn.addEventListener('mouseenter', () => {
          previewLayoutMode = btn.dataset.previewMode;
          syncPlacementPreview();
        });
      });

      multiBar.querySelector('#btn-insert-stencils-grid')?.addEventListener('click', () => commitBatch('grid'));
      multiBar.querySelector('#btn-insert-stencils-row')?.addEventListener('click', () => commitBatch('row'));
      multiBar.querySelector('#btn-insert-stencils-col')?.addEventListener('click', () => commitBatch('column'));
      multiBar.querySelector('#btn-insert-stencils-flow')?.addEventListener('click', () => commitBatch('flow'));
      multiBar.querySelector('#btn-clear-stencils')?.addEventListener('click', () => {
        selectedStencils.clear();
        syncPlacementPreview();
        updateResults();
        updateMultiBar();
      });
    };

    const renderCardHtml = (s) => {
      const isSelected = selectedStencils.has(s.id);
      const isFav = favorites.has(s.id);
      const iconW = previewDensity === 'compact' ? 38 : 48;
      const iconH = previewDensity === 'compact' ? 38 : 44;
      const boxW = previewDensity === 'compact' ? 32 : 40;
      const boxH = previewDensity === 'compact' ? 32 : 36;
      return `
        <div class="wb-stencil-item ${isSelected ? 'selected' : ''}" role="option" tabindex="0" aria-selected="${isSelected}" draggable="true" data-stencil="${escapeXml(s.id)}" title="${escapeXml(s.name)} (${escapeXml(s.category)}) — Click to place, drag onto canvas">
          <button type="button" class="wb-fav-star ${isFav ? 'active' : ''}" data-fav-stencil="${escapeXml(s.id)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Unfavorite' : 'Favorite'}">${isFav ? '★' : '☆'}</button>
          ${isSelected ? `<span class="wb-stencil-check">✓</span>` : ''}
          <svg width="${iconW}" height="${iconH}" viewBox="0 0 ${iconW} ${iconH}" preserveAspectRatio="xMidYMid meet">
            <g color="#1e293b">${s.toSvg(4, 4, boxW, boxH, 'fill="#ffffff" stroke="#334155" stroke-width="1.5"')}</g>
          </svg>
          <span>${escapeXml(s.name)}</span>
        </div>
      `;
    };

    const updateResults = () => {
      let groups = [];
      if (activeCategory === 'favorites') {
        const favItems = ALL_STENCILS.filter((s) => favorites.has(s.id));
        groups = favItems.length ? [{ category: '★ Favorite Icons', items: favItems }] : [];
      } else if (activeCategory === 'recent') {
        const recItems = recentIds.map((id) => getStencilById(id)).filter(Boolean);
        groups = recItems.length ? [{ category: '🕒 Recently Used', items: recItems }] : [];
      } else {
        groups = getStencilsByCategory(activeCategory, searchQuery);
      }

      if (groups.length === 0) {
        resultsBox.innerHTML = `<p class="wb-muted">No matching icons for "${escapeXml(searchQuery || activeCategory)}".</p>`;
        return;
      }

      let renderedCount = 0;
      let totalCount = groups.reduce((acc, g) => acc + g.items.length, 0);
      const isWindowed = activeCategory === 'all' && !searchQuery.trim() && totalCount > visibleLimit;

      const htmlParts = [];
      for (const grp of groups) {
        const remaining = isWindowed ? Math.max(0, visibleLimit - renderedCount) : grp.items.length;
        if (remaining <= 0) break;
        const slice = grp.items.slice(0, remaining);
        renderedCount += slice.length;
        htmlParts.push(`
          <div class="wb-lib-category-section">
            <div class="wb-lib-category-header">
              <span>${escapeXml(grp.category)}</span>
              <span class="wb-lib-category-count">${grp.items.length}</span>
            </div>
            <div class="wb-stencil-grid ${previewDensity === 'compact' ? 'wb-grid-compact' : ''}">
              ${slice.map(renderCardHtml).join('')}
            </div>
          </div>
        `);
      }

      if (isWindowed && renderedCount < totalCount) {
        htmlParts.push(`
          <button type="button" class="wb-btn wb-sm" id="btn-lib-load-more" style="width:100%;margin-top:8px;">
            Show All ${totalCount} Icons (${totalCount - renderedCount} more)
          </button>
        `);
      }

      const packSummary = Object.values(ICON_PACK_SOURCES)
        .map((p) => `${p.name.split(' ')[0]} ${p.version}`)
        .join(' · ');
      htmlParts.push(`
        <div class="wb-muted" style="font-size:10px;margin-top:10px;padding-top:6px;border-top:1px solid var(--border-subtle);">
          <strong>Bundled Manifest:</strong> ${escapeXml(packSummary)} (1:1 aspect ratio preserved)
        </div>
      `);

      resultsBox.innerHTML = htmlParts.join('');

      resultsBox.querySelector('#btn-lib-load-more')?.addEventListener('click', () => {
        visibleLimit = 999;
        updateResults();
      });

      resultsBox.querySelectorAll('[data-fav-stencil]').forEach((starBtn) => {
        starBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleFavorite(starBtn.dataset.favStencil);
          render();
        });
      });

      const cards = Array.from(resultsBox.querySelectorAll('[data-stencil]'));
      cards.forEach((item, idx) => {
        const triggerSelectOrPlace = (ev) => {
          const id = item.dataset.stencil;
          if (multiSelectMode || ev.shiftKey) {
            if (selectedStencils.has(id)) selectedStencils.delete(id);
            else selectedStencils.add(id);
            multiSelectMode = true;
            const msBtn = content.querySelector('#btn-lib-multiselect');
            if (msBtn) {
              msBtn.classList.add('active', 'wb-primary');
              msBtn.textContent = `☑ Multi-Select (${selectedStencils.size})`;
            }
            syncPlacementPreview();
            updateResults();
            updateMultiBar();
            return;
          }
          recordRecent(id);
          app.placeStencil(id);
        };

        item.addEventListener('click', triggerSelectOrPlace);
        item.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') {
            ev.preventDefault();
            triggerSelectOrPlace(ev);
          } else if (ev.key === ' ') {
            ev.preventDefault();
            triggerSelectOrPlace({ shiftKey: true });
          } else if (ev.key === 'ArrowRight' && cards[idx + 1]) {
            ev.preventDefault();
            cards[idx + 1].focus();
          } else if (ev.key === 'ArrowLeft' && cards[idx - 1]) {
            ev.preventDefault();
            cards[idx - 1].focus();
          } else if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            const step = previewDensity === 'compact' ? 4 : 3;
            if (cards[idx + step]) cards[idx + step].focus();
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            const step = previewDensity === 'compact' ? 4 : 3;
            if (cards[idx - step]) cards[idx - step].focus();
          }
        });
        item.addEventListener('dragstart', (ev) => {
          recordRecent(item.dataset.stencil);
          ev.dataTransfer?.setData('text/plain', `stencil:${item.dataset.stencil}`);
        });
      });
    };

    searchInput?.addEventListener('input', (e) => {
      searchQuery = e.target.value;
      updateResults();
    });

    content.querySelector('#btn-lib-multiselect')?.addEventListener('click', () => {
      multiSelectMode = !multiSelectMode;
      if (!multiSelectMode) {
        selectedStencils.clear();
        app.clearPlacementPreview?.();
      } else {
        syncPlacementPreview();
      }
      render();
    });

    content.querySelectorAll('[data-cat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        activeCategory = pill.dataset.cat;
        content.querySelectorAll('[data-cat]').forEach((p) =>
          p.classList.toggle('active', p.dataset.cat === activeCategory)
        );
        updateResults();
      });
    });

    updateMultiBar();
    updateResults();
    syncPlacementPreview();
  }

  function renderDiagramPacksTab(content) {
    const packs = buildDevOpsDiagramPacks();
    content.innerHTML = `
      <p class="wb-muted">Insert ready-made DevOps architecture diagrams without clearing your board. Use Presentation Mode to step through each flow!</p>
      <div class="wb-template-list">
        ${packs
          .map(
            (p) => `
          <div class="wb-template-card">
            <div>
              <strong>${escapeXml(p.name)}</strong>
              <p class="wb-muted">${escapeXml(p.description)}</p>
            </div>
            <button type="button" class="wb-btn wb-sm wb-primary" data-pack-id="${escapeXml(p.id)}">+ Insert Pack</button>
          </div>
        `
          )
          .join('')}
      </div>
    `;
    content.querySelectorAll('[data-pack-id]').forEach((b) => {
      b.addEventListener('click', () => app.insertDiagramPack(b.dataset.packId));
    });
  }

  function renderUserLibraryTab(content) {
    content.innerHTML = `
      <div class="wb-lib-actions">
        <button type="button" class="wb-btn wb-sm" id="btn-save-sel-lib">+ Save Selection</button>
        <button type="button" class="wb-btn wb-sm" id="btn-export-lib">Export JSON</button>
        <button type="button" class="wb-btn wb-sm" id="btn-import-lib">Import JSON</button>
      </div>
      ${
        app.userLibrary.length === 0
          ? `<p class="wb-muted">Select any shapes on canvas and click "+ Save Selection" to create reusable components.</p>`
          : `<div class="wb-user-lib-list">
              ${app.userLibrary
                .map(
                  (item, idx) => `
                <div class="wb-user-lib-row">
                  <button type="button" class="wb-btn wb-sm" data-insert-ulib="${idx}">+ ${escapeXml(item.name)} (${item.elements.length})</button>
                  <button type="button" class="wb-icon-btn" data-del-ulib="${idx}" aria-label="Remove library item">🗑</button>
                </div>
              `
                )
                .join('')}
            </div>`
      }
    `;
    content.querySelector('#btn-save-sel-lib')?.addEventListener('click', () => app.addSelectionToLibrary());
    content.querySelector('#btn-export-lib')?.addEventListener('click', () => app.exportUserLibrary());
    content.querySelector('#btn-import-lib')?.addEventListener('click', () => {
      document.getElementById('wb-file-import-lib')?.click();
    });
    content.querySelectorAll('[data-insert-ulib]').forEach((b) => {
      b.addEventListener('click', () => app.insertUserLibraryItem(Number(b.dataset.insertUlib)));
    });
    content.querySelectorAll('[data-del-ulib]').forEach((b) => {
      b.addEventListener('click', () => app.deleteUserLibraryItem(Number(b.dataset.delUlib)));
    });
  }

  function renderTemplatesTab(content) {
    content.innerHTML = `
      <p class="wb-muted">Load a starter classroom or architecture template onto the active page.</p>
      <div class="wb-template-list">
        ${BUILTIN_TEMPLATES.map(
          (t) => `
          <div class="wb-template-card">
            <div>
              <strong>${escapeXml(t.name)}</strong>
              <p class="wb-muted">${escapeXml(t.description)}</p>
            </div>
            <button type="button" class="wb-btn wb-sm wb-primary" data-tpl-id="${t.id}">Apply</button>
          </div>
        `
        ).join('')}
      </div>
    `;
    content.querySelectorAll('[data-tpl-id]').forEach((b) => {
      b.addEventListener('click', () => app.applyTemplate(b.dataset.tplId));
    });
  }

  render();
  return { update: render, recordRecent };
}
