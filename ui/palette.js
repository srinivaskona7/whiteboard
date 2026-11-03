// ui/palette.js
import { TOOL_REGISTRY, getShortcutLabel } from './registry.js';
import { ALL_STENCILS, SEARCH_ALIASES } from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { BRUSH_PRESETS } from '../scene/brushes.js';
import { ARROW_QUICK_PRESETS } from '../scene/arrow-presets.js';
import { escapeXml } from '../render/svg-export.js';
import {
  SEARCH_SCOPES,
  SEARCH_FILTERS,
  buildSearchEntries,
  searchEntriesDetailed,
  loadSearchPrefs,
  saveSearchPrefs,
  pushRecent,
  pushRecentQuery,
  toggleFavourite,
  toggleFavouriteQuery,
} from '../scene/search.js';

export function initCommandPalette(app) {
  const backdrop = document.getElementById('wb-palette-backdrop');
  const box = document.getElementById('wb-palette-box');
  if (!backdrop || !box) return { open() {}, close() {}, isOpen: () => false };

  let query = '';
  let activeIndex = 0;
  let scope = 'all';
  let filter = 'any';
  let entries = [];
  let prefs = loadSearchPrefs();
  let searchTimer = null;
  let items = [];
  let totalCount = 0;
  const ROW_H = 56;

  // A student surface must never index or show teacher-private notes.
  const isStudentSurface = () => (app.collab ? !app.collab.canEditBoard() : false);

  function buildCommands() {
    const cmds = [];
    const canEdit = app.collab ? app.collab.canEditBoard() : true;

    for (const t of TOOL_REGISTRY) {
      if (!canEdit && app.collab && !app.collab.canUseTool(t.id)) continue;
      cmds.push({
        id: `tool:${t.id}`,
        title: `Tool: ${t.label}`,
        shortcut: t.shortcut,
        run: () => app.setTool(t.id),
      });
    }

    const undoKey = getShortcutLabel('undo');
    const redoKey = getShortcutLabel('redo');
    const groupKey = getShortcutLabel('group');
    const ungroupKey = getShortcutLabel('ungroup');

    if (!canEdit) {
      cmds.push(
        { id: 'act:fit', title: 'View: Fit to Content', shortcut: '1', run: () => app.fitToContent() },
        { id: 'act:zoom100', title: 'View: Reset Zoom 100%', shortcut: '0', run: () => app.setZoom(1) },
        { id: 'act:theme', title: 'Theme: Toggle Light / Dark Mode', shortcut: '', run: () => app.toggleTheme() },
        { id: 'act:export', title: 'File: Export PNG / SVG / Student Handout PDF', shortcut: '', run: () => app.dialogs.openExportModal() },
        { id: 'act:save', title: 'File: Save .whiteboard.json', shortcut: '', run: () => app.saveWhiteboardFile() }
      );
      return cmds;
    }

    const actions = [
      { id: 'act:image', title: 'Insert: Image from File', shortcut: 'I', run: () => app.openImageFilePicker() },
      { id: 'act:tablet-test', title: 'Drawing: Tablet Test & Pressure Calibration…', shortcut: '', run: () => app.dialogs.openTabletTestModal() },
      { id: 'act:table-insert', title: 'Insert: Table… (rows, columns, TSV paste)', shortcut: 'B', run: () => app.dialogs.openTableInsertModal() },
      { id: 'act:undo', title: 'Action: Undo', shortcut: undoKey, run: () => app.undo() },
      { id: 'act:redo', title: 'Action: Redo', shortcut: redoKey, run: () => app.redo() },
      { id: 'act:fit', title: 'View: Fit to Content', shortcut: '1', run: () => app.fitToContent() },
      { id: 'act:zoom100', title: 'View: Reset Zoom 100%', shortcut: '0', run: () => app.setZoom(1) },
      { id: 'act:theme', title: 'Theme: Toggle Light / Dark Mode', shortcut: '', run: () => app.toggleTheme() },
      { id: 'act:dots', title: 'Background: Quiet Dots Grid', shortcut: '', run: () => app.setBackground('dots') },
      { id: 'act:grid', title: 'Background: Line Grid', shortcut: '', run: () => app.setBackground('grid') },
      { id: 'act:plain', title: 'Background: Plain', shortcut: '', run: () => app.setBackground('plain') },
      { id: 'act:fullscreen', title: 'View: Toggle Full Screen', shortcut: 'F', run: () => app.toggleFullScreen() },
      { id: 'act:focus', title: 'Teaching: Toggle Teaching Focus Mode', shortcut: '⇧F', run: () => app.toggleFocusMode() },
      { id: 'act:view-diagram', title: 'View: Switch to Diagram Workspace', shortcut: '', run: () => app.setViewMode('diagram') },
      { id: 'act:view-notebook', title: 'View: Switch to Vertical Notebook (Lesson Pages)', shortcut: '', run: () => app.setViewMode('notebook') },
      { id: 'act:lesson10', title: 'File: Add 10 Lesson Pages and Open Notebook', shortcut: '', run: () => { app.addPages(10); app.setViewMode('notebook'); } },
      { id: 'act:present', title: 'Present: Start Presentation Mode', shortcut: '', run: () => app.presentUI.enter() },
      { id: 'act:reveal', title: 'Teaching: Open Step-by-Step Reveal Timeline', shortcut: '', run: () => app.dialogs.openRevealTimelineModal() },
      { id: 'act:animation', title: 'Teaching: Open animation timeline (play, step, markers)', shortcut: '', run: () => app.animationUI.toggle() },
      { id: 'act:spotlight', title: 'Teaching: Toggle Spotlight & Magnifier', shortcut: '', run: () => app.toggleSpotlight() },
      { id: 'act:annotate', title: 'Teaching: Toggle Live Annotation Mode', shortcut: '', run: () => app.toggleAnnotationMode() },
      { id: 'act:timer', title: 'Teaching: Open Classroom Timer', shortcut: '', run: () => app.timerUI.toggle() },
      { id: 'act:ruler', title: 'Math: Insert Ruler Overlay', shortcut: '', run: () => app.insertMathOverlay('ruler') },
      { id: 'act:protractor', title: 'Math: Insert Protractor Overlay', shortcut: '', run: () => app.insertMathOverlay('protractor') },
      { id: 'act:mermaid', title: 'Diagram: Import Mermaid Flowchart / Sequence', shortcut: '', run: () => app.dialogs.openMermaidModal() },
      { id: 'act:diagram-config', title: 'Diagram configuration: Configure a cloud architecture…', shortcut: '', run: () => app.dialogs.openDiagramConfigModal() },
      { id: 'act:export', title: 'File: Export PNG / SVG / Student Handout PDF', shortcut: '', run: () => app.dialogs.openExportModal() },
      { id: 'act:save', title: 'File: Save .whiteboard.json', shortcut: '', run: () => app.saveWhiteboardFile() },
      { id: 'act:open', title: 'File: Open .whiteboard.json', shortcut: '', run: () => app.openWhiteboardFilePicker() },
      { id: 'act:recovery', title: 'File: Restore Earlier Version (Recovery Snapshots)', shortcut: '', run: () => app.dialogs.openRecoveryModal() },
      { id: 'act:share', title: 'File: Share by URL Hash', shortcut: '', run: () => app.dialogs.openShareUrlModal() },
      { id: 'act:group', title: 'Selection: Group Elements', shortcut: groupKey, run: () => app.groupSelection() },
      { id: 'act:ungroup', title: 'Selection: Ungroup Elements', shortcut: ungroupKey, run: () => app.ungroupSelection() },
      {
        id: 'act:code-editor',
        title: 'Edit: Open Expanded Code Editor for Selected Block',
        shortcut: '',
        run: () => {
          const page = app.getPage();
          const el = page.elements.find((e) => app.selectedIds.has(e.id) && e.type === 'code');
          if (el) app.dialogs?.openCodeEditorModal(el);
          else app.dialogs?.showToast('Select a code block first.');
        },
      },
      { id: 'act:select-all', title: 'Selection: Select All Objects', shortcut: 'Ctrl/⌘A', run: () => app.selectAll() },
    ];
    cmds.push(...actions);

    for (const preset of BRUSH_PRESETS) {
      cmds.push({
        id: `brush:${preset.id}`,
        title: `Drawing Preset: ${preset.name}`,
        shortcut: '',
        run: () => app.setBrushPreset(preset.id),
      });
    }

    for (const arrowPreset of ARROW_QUICK_PRESETS) {
      cmds.push({
        id: `arrow:${arrowPreset.id}`,
        title: `Arrow Preset: ${arrowPreset.name}`,
        shortcut: '',
        run: () => app.applyArrowPresetToSelection(arrowPreset.id),
      });
    }

    for (const st of ALL_STENCILS) {
      cmds.push({
        id: `stencil:${st.id}`,
        title: `Stencil (${st.category}): ${st.name}`,
        shortcut: '',
        run: () => app.placeStencil(st.id),
      });
    }

    for (const tpl of BUILTIN_TEMPLATES) {
      cmds.push({
        id: `tpl:${tpl.id}`,
        title: `Template: ${tpl.name}`,
        shortcut: '',
        run: () => app.applyTemplate(tpl.id),
      });
    }

    return cmds;
  }

  function refreshIndex() {
    entries = buildSearchEntries({
      commands: buildCommands(),
      stencils: ALL_STENCILS,
      templates: BUILTIN_TEMPLATES,
      pages: app.scene?.pages || [],
      activePageId: app.getPage?.()?.id || null,
      aliases: SEARCH_ALIASES,
    });
  }

  function attachRun(item) {
    if (item.run) return item;
    if (item.kind === 'stencil') return { ...item, run: () => app.placeStencil(item.data.id) };
    if (item.kind === 'template') return { ...item, run: () => app.applyTemplate(item.data.id) };
    if (item.kind === 'element' || item.kind === 'note') {
      return {
        ...item,
        run: () => {
          const { pageId, elementId } = item.data || {};
          if (pageId) app.switchPage(pageId);
          app.selectedIds = new Set(elementId ? [elementId] : []);
          app.updateUI?.();
          app.requestRender?.();
        },
      };
    }
    if (item.kind === 'group') {
      return {
        ...item,
        run: () => {
          const { pageId, elementIds } = item.data || {};
          if (pageId) app.switchPage(pageId);
          app.selectedIds = new Set(elementIds || []);
          app.updateUI?.();
          app.requestRender?.();
        },
      };
    }
    return item;
  }

  function getFiltered() {
    const result = searchEntriesDetailed(entries, query, {
      scope,
      filter,
      // No cap: the windowed renderer already bounds DOM cost, and a cap made
      // every match past the 40th unreachable no matter what the count said.
      limit: entries.length,
      studentMode: isStudentSurface(),
    });
    items = result.items.map(attachRun);
    totalCount = result.total;
    if (!query.trim()) {
      // Surface favourites and recents ahead of the generic list on an empty query.
      const pinned = new Set([...(prefs.favourites || []), ...(prefs.recents || [])]);
      items = items
        .slice()
        .sort((a, b) => Number(pinned.has(b.id)) - Number(pinned.has(a.id)));
    }
    return items;
  }

  function isOpen() {
    return !backdrop.classList.contains('wb-hidden');
  }

  function close() {
    backdrop.classList.add('wb-hidden');
    box.innerHTML = '';
  }

  function open() {
    query = '';
    activeIndex = 0;
    prefs = loadSearchPrefs();
    refreshIndex();
    backdrop.classList.remove('wb-hidden');
    render();
    box.querySelector('#wb-palette-input')?.focus();
  }

  function choose(item) {
    if (!item) return;
    prefs = pushRecentQuery(prefs, query);
    prefs = pushRecent(prefs, item.id);
    saveSearchPrefs(prefs);
    close();
    item.run?.();
  }

  function rowHtml(it, idx, favouriteSet) {
    return `
      <div
        class="wb-palette-item ${idx === activeIndex ? 'active' : ''}"
        id="wb-palette-opt-${idx}"
        role="option"
        aria-selected="${idx === activeIndex}"
        data-cmd-idx="${idx}"
      >
        <span class="wb-palette-main">
          <span class="wb-palette-title">${escapeXml(it.title)}</span>
          ${it.subtitle ? `<span class="wb-palette-subtitle">${escapeXml(it.subtitle)}</span>` : ''}
          ${it.preview ? `<span class="wb-palette-preview">${escapeXml(it.preview)}</span>` : ''}
        </span>
        ${it.matchedTerms?.length ? `<span class="wb-palette-match">${escapeXml(it.matchedTerms.join(', '))}</span>` : ''}
        <button type="button" class="wb-palette-fav ${favouriteSet.has(it.id) ? 'active' : ''}" data-fav="${escapeXml(it.id)}" aria-label="${favouriteSet.has(it.id) ? 'Remove from favourites' : 'Add to favourites'}" aria-pressed="${favouriteSet.has(it.id)}">★</button>
        ${it.data?.shortcut ? `<kbd>${escapeXml(it.data.shortcut)}</kbd>` : ''}
      </div>
    `;
  }

  // Only the rows inside the scroll window are in the DOM, so a large board
  // does not build hundreds of nodes per keystroke.
  function paintRows() {
    const list = box.querySelector('#wb-palette-results');
    if (!list) return;
    if (items.length === 0) {
      list.innerHTML = `<div class="wb-palette-empty">No matches. Try a shorter word or a different scope.</div>`;
      return;
    }
    const favouriteSet = new Set(prefs.favourites || []);
    const height = list.clientHeight || 360;
    const first = Math.max(0, Math.floor(list.scrollTop / ROW_H) - 4);
    const last = Math.min(items.length, first + Math.ceil(height / ROW_H) + 8);
    const topPad = first * ROW_H;
    const bottomPad = Math.max(0, (items.length - last) * ROW_H);
    list.innerHTML = `
      <div style="height:${topPad}px" aria-hidden="true"></div>
      ${items.slice(first, last).map((it, i) => rowHtml(it, first + i, favouriteSet)).join('')}
      <div style="height:${bottomPad}px" aria-hidden="true"></div>
    `;
  }

  function scrollActiveIntoView() {
    const list = box.querySelector('#wb-palette-results');
    if (!list) return;
    const top = activeIndex * ROW_H;
    const bottom = top + ROW_H;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
  }

  function render() {
    getFiltered();
    if (activeIndex >= items.length) activeIndex = 0;
    const favouriteSet = new Set(prefs.favourites || []);
    const savedQueries = [
      ...(prefs.favouriteQueries || []),
      ...(prefs.recentQueries || []),
    ].filter((q, i, arr) => arr.indexOf(q) === i);
    const canFavouriteQuery = Boolean(query.trim());

    box.innerHTML = `
      <input
        type="search"
        id="wb-palette-input"
        class="wb-palette-search"
        placeholder="Search tools, commands, icons, templates, objects or lesson notes..."
        value="${escapeXml(query)}"
        aria-label="Search actions, library, board objects and lesson notes"
        role="combobox"
        aria-expanded="true"
        aria-controls="wb-palette-results"
        aria-activedescendant="${items[activeIndex] ? `wb-palette-opt-${activeIndex}` : ''}"
      />
      <div class="wb-palette-chips" role="group" aria-label="Search scope">
        ${SEARCH_SCOPES.map(
          (sc) =>
            `<button type="button" class="wb-chip ${scope === sc.id ? 'active' : ''}" data-scope="${sc.id}" aria-pressed="${scope === sc.id}">${sc.label}</button>`
        ).join('')}
      </div>
      <div class="wb-palette-chips" role="group" aria-label="Result type filter">
        ${SEARCH_FILTERS.map(
          (f) =>
            `<button type="button" class="wb-chip ${filter === f.id ? 'active' : ''}" data-filter="${f.id}" aria-pressed="${filter === f.id}">${f.label}</button>`
        ).join('')}
      </div>
      ${
        savedQueries.length
          ? `<div class="wb-palette-chips wb-palette-saved" role="group" aria-label="Saved searches">
              ${savedQueries
                .map(
                  (q) =>
                    `<button type="button" class="wb-chip ${prefs.favouriteQueries?.includes(q) ? 'active' : ''}" data-query="${escapeXml(q)}" title="Run saved search">${prefs.favouriteQueries?.includes(q) ? '★ ' : ''}${escapeXml(q)}</button>`
                )
                .join('')}
            </div>`
          : ''
      }
      <div class="wb-palette-count" aria-live="polite">
        ${totalCount} match${totalCount === 1 ? '' : 'es'}${query.trim() ? ` for “${escapeXml(query.trim())}”` : ''}
        ${
          canFavouriteQuery
            ? `<button type="button" class="wb-chip wb-palette-save" id="wb-palette-save-search" aria-pressed="${prefs.favouriteQueries?.includes(query.trim())}">${prefs.favouriteQueries?.includes(query.trim()) ? '★ Saved' : '☆ Save search'}</button>`
            : ''
        }
      </div>
      <div class="wb-palette-list" id="wb-palette-results" role="listbox" aria-label="Search results" tabindex="0"></div>
    `;

    paintRows();
    const list = box.querySelector('#wb-palette-results');
    list?.addEventListener('scroll', paintRows, { passive: true });

    const input = box.querySelector('#wb-palette-input');
    input?.addEventListener('input', (e) => {
      query = e.target.value;
      activeIndex = 0;
      clearTimeout(searchTimer);
      // Debounce so long boards do not re-rank on every keystroke.
      searchTimer = setTimeout(() => {
        render();
        const nextInput = box.querySelector('#wb-palette-input');
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(query.length, query.length);
        }
      }, 90);
    });

    input?.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        activeIndex = items.length ? (activeIndex + 1) % items.length : 0;
        paintRows();
        scrollActiveIntoView();
        input.setAttribute('aria-activedescendant', items[activeIndex] ? `wb-palette-opt-${activeIndex}` : '');
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        activeIndex = items.length
          ? (activeIndex - 1 + items.length) % items.length
          : 0;
        paintRows();
        scrollActiveIntoView();
        input.setAttribute('aria-activedescendant', items[activeIndex] ? `wb-palette-opt-${activeIndex}` : '');
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        choose(items[activeIndex]);
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });

    // One delegated handler survives every windowed repaint.
    list?.addEventListener('click', (ev) => {
      const star = ev.target.closest('[data-fav]');
      if (star) {
        ev.stopPropagation();
        prefs = toggleFavourite(prefs, star.dataset.fav);
        saveSearchPrefs(prefs);
        paintRows();
        return;
      }
      const row = ev.target.closest('[data-cmd-idx]');
      if (row) choose(items[Number(row.dataset.cmdIdx)]);
    });

    box.querySelectorAll('[data-scope]').forEach((chip) => {
      chip.addEventListener('click', () => {
        scope = chip.dataset.scope;
        activeIndex = 0;
        render();
        box.querySelector('#wb-palette-input')?.focus();
      });
    });

    box.querySelectorAll('[data-filter]').forEach((chip) => {
      chip.addEventListener('click', () => {
        filter = chip.dataset.filter;
        activeIndex = 0;
        render();
        box.querySelector('#wb-palette-input')?.focus();
      });
    });

    box.querySelectorAll('[data-query]').forEach((chip) => {
      chip.addEventListener('click', () => {
        query = chip.dataset.query || '';
        activeIndex = 0;
        render();
        box.querySelector('#wb-palette-input')?.focus();
      });
    });

    box.querySelector('#wb-palette-save-search')?.addEventListener('click', () => {
      prefs = toggleFavouriteQuery(prefs, query);
      saveSearchPrefs(prefs);
      render();
      box.querySelector('#wb-palette-input')?.focus();
    });
  }

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  return { open, close, isOpen };
}
