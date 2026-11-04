// ui/library-panel.js — Fast Searchable DevOps Icon Library with Favorites, Recents, Virtualization & Batch Preview
import {
  ALL_STENCILS,
  getAllCategories,
  getStencilsByCategory,
  getStencilById,
  scoreStencilSearchMatch,
  ensureIconPackLoaded,
  isStencilLoaded,
  ICON_PACK_ID_PREFIX,
  ICON_PACK_SOURCES,
  getIconProvenance,
} from '../stencils/index.js';
import { LUCIDE_STENCILS } from '../stencils/lucide-icons.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { buildDevOpsDiagramPacks } from './registry.js';
import { escapeXml } from '../render/svg-export.js';
import { saveWorkspacePreferences } from '../scene/storage.js';

export const FAVORITE_STENCILS_KEY = 'studioboard_fav_stencils_v1';
export const RECENT_STENCILS_KEY = 'studioboard_recent_stencils_v1';

// Icon preview sizes per level: svg size, hit-box size, grid class and the
// arrow-key focus step, which must match the grid column count.
const ICON_SIZE_LEVELS = ['compact', 'comfortable', 'large'];
const ICON_SIZE_PRESETS = {
  compact: { label: 'Compact', iconW: 38, iconH: 34, box: 32, gridClass: 'wb-grid-compact', focusStep: 4 },
  comfortable: { label: 'Comfortable', iconW: 48, iconH: 44, box: 40, gridClass: '', focusStep: 3 },
  large: { label: 'Large', iconW: 64, iconH: 58, box: 56, gridClass: 'wb-grid-large', focusStep: 2 },
};

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

  let activeTab = 'stencils'; // 'stencils' | 'lucide' | 'iconpack' | 'packs' | 'user' | 'templates'
  let activeCategory = 'all'; // 'all' | 'favorites' | 'recent' | category name
  let lucideActiveCategory = 'all'; // 'all' | 'icons/<sub>'
  let lucideSearchQuery = '';
  let lucideVisibleLimit = 64;
  let iconPackModule = null; // cached lazy import of stencils/icon-pack-icons.js
  let packRenderToken = 0; // guards async tab renders against tab switches
  let packActiveGroup = 'all'; // 'all' | pack group slug
  let packSearchQuery = '';
  let packVisibleLimit = 64;
  let searchQuery = '';
  let iconSize = ICON_SIZE_LEVELS.includes(app.workspacePrefs?.libraryIconSize)
    ? app.workspacePrefs.libraryIconSize
    : 'comfortable'; // 'compact' | 'comfortable' | 'large'
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

  // Saved recents/favourites may reference lazy icon-pack ids; loading the
  // pack lets the Recent/Favorite pills show them instead of skipping them.
  {
    const needsPack = [...recentIds, ...favorites].some((id) => typeof id === 'string' && id.startsWith(ICON_PACK_ID_PREFIX));
    if (needsPack) {
      ensureIconPackLoaded().then(
        () => {
          if (!panel.classList.contains('wb-hidden')) render();
        },
        () => {} // the DevOps Pack tab surfaces load errors on its own
      );
    }
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

  function stepIconSize(direction) {
    const idx = ICON_SIZE_LEVELS.indexOf(iconSize);
    const next = ICON_SIZE_LEVELS[Math.max(0, Math.min(ICON_SIZE_LEVELS.length - 1, idx + direction))];
    if (next === iconSize) return;
    iconSize = next;
    app.workspacePrefs = { ...app.workspacePrefs, libraryIconSize: next };
    saveWorkspacePreferences(app.workspacePrefs);
    render();
  }

  function render() {
    const size = ICON_SIZE_PRESETS[iconSize];
    panel.innerHTML = `
      <div class="wb-panel-header">
        <strong>DevOps & Cloud Library (${ALL_STENCILS.length})</strong>
        <div style="display:flex;gap:4px;align-items:center;">
          <button type="button" class="wb-btn wb-sm" id="btn-lib-size-down" title="Icon size: ${size.label} (smaller)" ${iconSize === 'compact' ? 'disabled' : ''}>−</button>
          <button type="button" class="wb-btn wb-sm" id="btn-lib-size-up" title="Icon size: ${size.label} (larger)" ${iconSize === 'large' ? 'disabled' : ''}>+</button>
          <button type="button" class="wb-icon-btn" id="btn-close-library" aria-label="Close Library">✕</button>
        </div>
      </div>
      <div class="wb-tabs" role="tablist">
        <button type="button" role="tab" class="wb-tab ${activeTab === 'stencils' ? 'active' : ''}" data-tab="stencils">Icons (${ALL_STENCILS.length})</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'lucide' ? 'active' : ''}" data-tab="lucide">Lucide Icons (${LUCIDE_STENCILS.length})</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'iconpack' ? 'active' : ''}" data-tab="iconpack">DevOps Pack (2015)</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'packs' ? 'active' : ''}" data-tab="packs">Diagram Packs</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'user' ? 'active' : ''}" data-tab="user">My Library (${app.userLibrary.length})</button>
        <button type="button" role="tab" class="wb-tab ${activeTab === 'templates' ? 'active' : ''}" data-tab="templates">Templates</button>
      </div>
      <div class="wb-panel-body" id="wb-library-content"></div>
    `;

    panel.querySelector('#btn-close-library')?.addEventListener('click', () => {
      app.clearPlacementPreview?.();
      panel.classList.add('wb-hidden');
      app.toolbarUI?.update();
    });

    panel.querySelector('#btn-lib-size-down')?.addEventListener('click', () => stepIconSize(-1));
    panel.querySelector('#btn-lib-size-up')?.addEventListener('click', () => stepIconSize(1));

    panel.querySelectorAll('[data-tab]').forEach((b) => {
      b.addEventListener('click', () => {
        activeTab = b.dataset.tab;
        render();
      });
    });

    const content = panel.querySelector('#wb-library-content');
    if (activeTab === 'stencils') renderStencilsTab(content);
    else if (activeTab === 'lucide') renderLucideIconsTab(content);
    else if (activeTab === 'iconpack') renderIconPackTab(content);
    else if (activeTab === 'packs') renderDiagramPacksTab(content);
    else if (activeTab === 'user') renderUserLibraryTab(content);
    else renderTemplatesTab(content);
  }

  function renderStencilsTab(content) {
    // pack/* categories belong to the DevOps Pack tab (38 groups would flood
    // this strip); the pack icons stay reachable here via the All search.
    const categories = getAllCategories().filter((c) => !c.startsWith('pack/'));
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
      <div id="wb-lib-results" class="wb-lib-results wb-density-${iconSize}" role="listbox" aria-label="Architecture Icons"></div>
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
      const provenance = getIconProvenance(s);
      const isFav = favorites.has(s.id);
      const iconW = ICON_SIZE_PRESETS[iconSize].iconW;
      const iconH = ICON_SIZE_PRESETS[iconSize].iconH;
      const boxW = ICON_SIZE_PRESETS[iconSize].box;
      const boxH = ICON_SIZE_PRESETS[iconSize].box;
      return `
        <div class="wb-stencil-item ${isSelected ? 'selected' : ''}" role="option" tabindex="0" aria-selected="${isSelected}" draggable="true" data-stencil="${escapeXml(s.id)}" title="${escapeXml(s.name)} (${escapeXml(s.category)}) · ${escapeXml(provenance.provider)} ${escapeXml(provenance.version)} · ${escapeXml(provenance.license || 'project license')}${provenance.attribution ? ` · ${escapeXml(provenance.attribution)}` : ''}, reviewed ${escapeXml(provenance.reviewedAt || 'not recorded')} — Click to place, drag onto canvas">
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
        // getStencilById falls back to the first stencil for unknown ids, so
        // an unloaded lazy `pk-` id would render — and place — the WRONG
        // icon. Skip ids that have no registry entry yet; the pack loads on
        // panel init when recents/favourites reference it, and they reappear.
        const recItems = recentIds
          .map((id) => (isStencilLoaded(id) ? getStencilById(id) : null))
          .filter(Boolean);
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
            <div class="wb-stencil-grid ${ICON_SIZE_PRESETS[iconSize].gridClass}">
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
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
            if (cards[idx + step]) cards[idx + step].focus();
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
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

  function renderLucideIconsTab(content) {
    const subcategories = Array.from(new Set(LUCIDE_STENCILS.map((s) => s.category)));
    const subLabel = (cat) =>
      cat
        .replace('icons/', '')
        .split('-')
        .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
        .join(' ');
    const subCount = (cat) => LUCIDE_STENCILS.filter((s) => s.category === cat).length;

    content.innerHTML = `
      <div class="wb-lib-controls">
        <div class="wb-lib-search-row">
          <input type="search" id="lucide-search" class="wb-input" placeholder="Search Lucide icons: git, wifi, camera, lock, arrow..." value="${escapeXml(lucideSearchQuery)}" aria-label="Search Lucide Icons"/>
        </div>
        <div class="wb-cat-pills" role="group" aria-label="Lucide Icon Categories">
          <button type="button" class="wb-cat-pill ${lucideActiveCategory === 'all' ? 'active' : ''}" data-lcat="all">All (${LUCIDE_STENCILS.length})</button>
          ${subcategories
            .map(
              (c) =>
                `<button type="button" class="wb-cat-pill ${lucideActiveCategory === c ? 'active' : ''}" data-lcat="${escapeXml(c)}">${escapeXml(subLabel(c))} (${subCount(c)})</button>`
            )
            .join('')}
        </div>
      </div>
      <div id="lucide-results" class="wb-lib-results wb-density-${iconSize}" role="listbox" aria-label="Lucide Icons"></div>
    `;

    const searchInput = content.querySelector('#lucide-search');
    const resultsBox = content.querySelector('#lucide-results');

    const renderCardHtml = (s) => {
      const isFav = favorites.has(s.id);
      const size = ICON_SIZE_PRESETS[iconSize];
      return `
        <div class="wb-stencil-item" role="option" tabindex="0" draggable="true" data-stencil="${escapeXml(s.id)}" title="${escapeXml(s.name)} (${escapeXml(s.category)}) · Lucide v1.68.0 · ISC License — Click to place, drag onto canvas">
          <button type="button" class="wb-fav-star ${isFav ? 'active' : ''}" data-fav-stencil="${escapeXml(s.id)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Unfavorite' : 'Favorite'}">${isFav ? '★' : '☆'}</button>
          <svg width="${size.iconW}" height="${size.iconH}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><g color="#1e293b">${s.svgInner}</g></svg>
          <span>${escapeXml(s.name)}</span>
        </div>
      `;
    };

    const updateResults = () => {
      const tokens = lucideSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const inCategory = LUCIDE_STENCILS.filter(
        (s) => lucideActiveCategory === 'all' || s.category === lucideActiveCategory
      );
      const matched = inCategory
        .map((s) => ({ s, score: scoreStencilSearchMatch(s, tokens) }))
        .filter((m) => m.score > 0);
      if (tokens.length > 0) matched.sort((a, b) => b.score - a.score);

      const groups = new Map();
      for (const { s } of matched) {
        if (!groups.has(s.category)) groups.set(s.category, []);
        groups.get(s.category).push(s);
      }

      if (groups.size === 0) {
        resultsBox.innerHTML = `<p class="wb-muted">No matching Lucide icons for "${escapeXml(lucideSearchQuery || subLabel(lucideActiveCategory))}".</p>`;
        return;
      }

      const totalCount = matched.length;
      const isWindowed = lucideActiveCategory === 'all' && tokens.length === 0 && totalCount > lucideVisibleLimit;
      const htmlParts = [];
      let renderedCount = 0;
      for (const [cat, items] of groups) {
        const remaining = isWindowed ? Math.max(0, lucideVisibleLimit - renderedCount) : items.length;
        if (remaining <= 0) break;
        const slice = items.slice(0, remaining);
        renderedCount += slice.length;
        htmlParts.push(`
          <div class="wb-lib-category-section">
            <div class="wb-lib-category-header">
              <span>${escapeXml(subLabel(cat))}</span>
              <span class="wb-lib-category-count">${items.length}</span>
            </div>
            <div class="wb-stencil-grid ${ICON_SIZE_PRESETS[iconSize].gridClass}">
              ${slice.map(renderCardHtml).join('')}
            </div>
          </div>
        `);
      }

      if (isWindowed && renderedCount < totalCount) {
        htmlParts.push(`
          <button type="button" class="wb-btn wb-sm" id="lucide-load-more" style="width:100%;margin-top:8px;">
            Show All ${totalCount} Icons (${totalCount - renderedCount} more)
          </button>
        `);
      }

      htmlParts.push(`
        <div class="wb-muted" style="font-size:10px;margin-top:10px;padding-top:6px;border-top:1px solid var(--border-subtle);">
          <strong>Lucide Icons:</strong> lucide-static v1.68.0 · ISC License · geometry baked in at build time (zero runtime dependencies)
        </div>
      `);

      resultsBox.innerHTML = htmlParts.join('');

      resultsBox.querySelector('#lucide-load-more')?.addEventListener('click', () => {
        lucideVisibleLimit = 999;
        updateResults();
      });

      resultsBox.querySelectorAll('[data-fav-stencil]').forEach((starBtn) => {
        starBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleFavorite(starBtn.dataset.favStencil);
          updateResults();
        });
      });

      const cards = Array.from(resultsBox.querySelectorAll('[data-stencil]'));
      cards.forEach((item, idx) => {
        item.addEventListener('click', () => {
          recordRecent(item.dataset.stencil);
          app.placeStencil(item.dataset.stencil);
        });
        item.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            recordRecent(item.dataset.stencil);
            app.placeStencil(item.dataset.stencil);
          } else if (ev.key === 'ArrowRight' && cards[idx + 1]) {
            ev.preventDefault();
            cards[idx + 1].focus();
          } else if (ev.key === 'ArrowLeft' && cards[idx - 1]) {
            ev.preventDefault();
            cards[idx - 1].focus();
          } else if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
            if (cards[idx + step]) cards[idx + step].focus();
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
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
      lucideSearchQuery = e.target.value;
      lucideVisibleLimit = 64;
      updateResults();
    });

    content.querySelectorAll('[data-lcat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        lucideActiveCategory = pill.dataset.lcat;
        content.querySelectorAll('[data-lcat]').forEach((p) =>
          p.classList.toggle('active', p.dataset.lcat === lucideActiveCategory)
        );
        updateResults();
      });
    });

    updateResults();
  }

  // DevOps, Cloud, Networking & Teaching Icon Pack (2015 icons, 38 groups).
  // The pack module (~2.6 MB) is imported lazily on first open — it registers
  // its stencils into the shared registry, so placement, canvas render, SVG
  // export and the All search all pick them up from then on.
  async function renderIconPackTab(content) {
    packRenderToken++;
    const token = packRenderToken;
    content.innerHTML = `<p class="wb-muted">Loading icon pack (2.6 MB, first open only)…</p>`;
    let m;
    try {
      m = iconPackModule || (await ensureIconPackLoaded());
    } catch (err) {
      content.innerHTML = `<p class="wb-muted">Icon pack failed to load: ${escapeXml(String(err?.message || err))}</p>`;
      return;
    }
    iconPackModule = m;
    if (token !== packRenderToken || activeTab !== 'iconpack') return;
    const stencils = m.PACK_STENCILS;
    const groupBySlug = Object.fromEntries(m.PACK_GROUPS.map((g) => [g.slug, g]));
    const groupLabel = (slug) => groupBySlug[slug]?.label || slug;

    content.innerHTML = `
      <div class="wb-lib-controls">
        <div class="wb-lib-search-row">
          <input type="search" id="pack-search" class="wb-input" placeholder="Search pack icons: EC2, kubectl, ansible, firewall, chaos…" value="${escapeXml(packSearchQuery)}" aria-label="Search Icon Pack"/>
        </div>
        <div class="wb-cat-pills" role="group" aria-label="Icon Pack Groups">
          <button type="button" class="wb-cat-pill ${packActiveGroup === 'all' ? 'active' : ''}" data-pcat="all">All (${stencils.length})</button>
          ${m.PACK_GROUPS
            .map(
              (g) =>
                `<button type="button" class="wb-cat-pill ${packActiveGroup === g.slug ? 'active' : ''}" data-pcat="${escapeXml(g.slug)}">${escapeXml(g.label)} (${g.count})</button>`
            )
            .join('')}
        </div>
      </div>
      <div id="pack-results" class="wb-lib-results wb-density-${iconSize}" role="listbox" aria-label="Icon Pack"></div>
    `;

    const searchInput = content.querySelector('#pack-search');
    const resultsBox = content.querySelector('#pack-results');
    const size = ICON_SIZE_PRESETS[iconSize];

    const renderCardHtml = (s) => {
      const isFav = favorites.has(s.id);
      // Embed the baked 64x64 markup directly — defs ids are per-icon
      // namespaced, so several previews can coexist in one DOM.
      const svg = s.svgInner.replace('<svg ', `<svg width="${size.iconH}" height="${size.iconH}" `);
      return `
        <div class="wb-stencil-item" role="option" tabindex="0" draggable="true" data-stencil="${escapeXml(s.id)}" title="${escapeXml(s.name)} (${escapeXml(groupLabel(s.category.slice('pack/'.length)))}) · DevOps, Cloud & Teaching Icon Pack — Click to place, drag onto canvas">
          <button type="button" class="wb-fav-star ${isFav ? 'active' : ''}" data-fav-stencil="${escapeXml(s.id)}" aria-label="${isFav ? 'Remove from favorites' : 'Add to favorites'}" title="${isFav ? 'Unfavorite' : 'Favorite'}">${isFav ? '★' : '☆'}</button>
          ${svg}
          <span>${escapeXml(s.name)}</span>
        </div>
      `;
    };

    const updateResults = () => {
      const tokens = packSearchQuery.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const inGroup = stencils.filter((s) => packActiveGroup === 'all' || s.category === `pack/${packActiveGroup}`);
      const matched = inGroup
        .map((s) => ({ s, score: scoreStencilSearchMatch(s, tokens) }))
        .filter((m2) => m2.score > 0);
      if (tokens.length > 0) matched.sort((a, b) => b.score - a.score);

      const groups = new Map();
      for (const { s } of matched) {
        const slug = s.category.slice('pack/'.length);
        if (!groups.has(slug)) groups.set(slug, []);
        groups.get(slug).push(s);
      }

      if (groups.size === 0) {
        resultsBox.innerHTML = `<p class="wb-muted">No matching pack icons for "${escapeXml(packSearchQuery || groupLabel(packActiveGroup))}".</p>`;
        return;
      }

      const totalCount = matched.length;
      const isWindowed = packActiveGroup === 'all' && tokens.length === 0 && totalCount > packVisibleLimit;
      const htmlParts = [];
      let renderedCount = 0;
      for (const [slug, items] of groups) {
        const remaining = isWindowed ? Math.max(0, packVisibleLimit - renderedCount) : items.length;
        if (remaining <= 0) break;
        const slice = items.slice(0, remaining);
        renderedCount += slice.length;
        htmlParts.push(`
          <div class="wb-lib-category-section">
            <div class="wb-lib-category-header">
              <span>${escapeXml(groupLabel(slug))}</span>
              <span class="wb-lib-category-count">${items.length}</span>
            </div>
            <div class="wb-stencil-grid ${ICON_SIZE_PRESETS[iconSize].gridClass}">
              ${slice.map(renderCardHtml).join('')}
            </div>
          </div>
        `);
      }

      if (isWindowed && renderedCount < totalCount) {
        htmlParts.push(`
          <button type="button" class="wb-btn wb-sm" id="pack-load-more" style="width:100%;margin-top:8px;">
            Show All ${totalCount} Icons (${totalCount - renderedCount} more)
          </button>
        `);
      }

      htmlParts.push(`
        <div class="wb-muted" style="font-size:10px;margin-top:10px;padding-top:6px;border-top:1px solid var(--border-subtle);">
          <strong>DevOps Pack:</strong> 2015 icons · 38 groups · user-supplied offline pack, license unstated · gradients baked in, rasterized on demand
        </div>
      `);

      resultsBox.innerHTML = htmlParts.join('');

      resultsBox.querySelector('#pack-load-more')?.addEventListener('click', () => {
        packVisibleLimit = 999;
        updateResults();
      });

      resultsBox.querySelectorAll('[data-fav-stencil]').forEach((starBtn) => {
        starBtn.addEventListener('click', (ev) => {
          ev.stopPropagation();
          toggleFavorite(starBtn.dataset.favStencil);
          updateResults();
        });
      });

      const cards = Array.from(resultsBox.querySelectorAll('[data-stencil]'));
      cards.forEach((item, idx) => {
        item.addEventListener('click', () => {
          recordRecent(item.dataset.stencil);
          app.placeStencil(item.dataset.stencil);
        });
        item.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') {
            ev.preventDefault();
            recordRecent(item.dataset.stencil);
            app.placeStencil(item.dataset.stencil);
          } else if (ev.key === 'ArrowRight' && cards[idx + 1]) {
            ev.preventDefault();
            cards[idx + 1].focus();
          } else if (ev.key === 'ArrowLeft' && cards[idx - 1]) {
            ev.preventDefault();
            cards[idx - 1].focus();
          } else if (ev.key === 'ArrowDown') {
            ev.preventDefault();
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
            if (cards[idx + step]) cards[idx + step].focus();
          } else if (ev.key === 'ArrowUp') {
            ev.preventDefault();
            const step = ICON_SIZE_PRESETS[iconSize].focusStep;
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
      packSearchQuery = e.target.value;
      packVisibleLimit = 64;
      updateResults();
    });

    content.querySelectorAll('[data-pcat]').forEach((pill) => {
      pill.addEventListener('click', () => {
        packActiveGroup = pill.dataset.pcat;
        packVisibleLimit = 64;
        content.querySelectorAll('[data-pcat]').forEach((p) =>
          p.classList.toggle('active', p.dataset.pcat === packActiveGroup)
        );
        updateResults();
      });
    });

    updateResults();
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
      <button type="button" class="wb-btn wb-sm" id="lib-config-btn">Diagram configuration…</button>
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
    content.querySelector('#lib-config-btn')?.addEventListener('click', () => app.dialogs.openDiagramConfigModal());
  }

  render();
  return { update: render, recordRecent };
}
