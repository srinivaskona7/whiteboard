// ui/palette.js
import { TOOL_REGISTRY, getShortcutLabel } from './registry.js';
import { ALL_STENCILS } from '../stencils/index.js';
import { BUILTIN_TEMPLATES } from '../templates/index.js';
import { escapeXml } from '../render/svg-export.js';

export function initCommandPalette(app) {
  const backdrop = document.getElementById('wb-palette-backdrop');
  const box = document.getElementById('wb-palette-box');
  if (!backdrop || !box) return { open() {}, close() {}, isOpen: () => false };

  let query = '';
  let activeIndex = 0;

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
      { id: 'act:present', title: 'Present: Start Presentation Mode', shortcut: '', run: () => app.presentUI.enter() },
      { id: 'act:reveal', title: 'Teaching: Open Step-by-Step Reveal Timeline', shortcut: '', run: () => app.dialogs.openRevealTimelineModal() },
      { id: 'act:spotlight', title: 'Teaching: Toggle Spotlight & Magnifier', shortcut: '', run: () => app.toggleSpotlight() },
      { id: 'act:annotate', title: 'Teaching: Toggle Live Annotation Mode', shortcut: '', run: () => app.toggleAnnotationMode() },
      { id: 'act:timer', title: 'Teaching: Open Classroom Timer', shortcut: '', run: () => app.timerUI.toggle() },
      { id: 'act:ruler', title: 'Math: Insert Ruler Overlay', shortcut: '', run: () => app.insertMathOverlay('ruler') },
      { id: 'act:protractor', title: 'Math: Insert Protractor Overlay', shortcut: '', run: () => app.insertMathOverlay('protractor') },
      { id: 'act:mermaid', title: 'Diagram: Import Mermaid Flowchart / Sequence', shortcut: '', run: () => app.dialogs.openMermaidModal() },
      { id: 'act:export', title: 'File: Export PNG / SVG / Student Handout PDF', shortcut: '', run: () => app.dialogs.openExportModal() },
      { id: 'act:save', title: 'File: Save .whiteboard.json', shortcut: '', run: () => app.saveWhiteboardFile() },
      { id: 'act:open', title: 'File: Open .whiteboard.json', shortcut: '', run: () => app.openWhiteboardFilePicker() },
      { id: 'act:recovery', title: 'File: Restore Earlier Version (Recovery Snapshots)', shortcut: '', run: () => app.dialogs.openRecoveryModal() },
      { id: 'act:share', title: 'File: Share by URL Hash', shortcut: '', run: () => app.dialogs.openShareUrlModal() },
      { id: 'act:group', title: 'Selection: Group Elements', shortcut: groupKey, run: () => app.groupSelection() },
      { id: 'act:ungroup', title: 'Selection: Ungroup Elements', shortcut: ungroupKey, run: () => app.ungroupSelection() },
    ];
    cmds.push(...actions);

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

  function getFiltered() {
    const all = buildCommands();
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 32);
    return all.filter((c) => c.title.toLowerCase().includes(q) || c.shortcut.toLowerCase() === q).slice(0, 32);
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
    backdrop.classList.remove('wb-hidden');
    render();
    box.querySelector('#wb-palette-input')?.focus();
  }

  function render() {
    const items = getFiltered();
    if (activeIndex >= items.length) activeIndex = 0;

    box.innerHTML = `
      <input
        type="search"
        id="wb-palette-input"
        class="wb-palette-search"
        placeholder="Search any tool, action, shortcut, stencil, or template..."
        value="${escapeXml(query)}"
        aria-label="Command Palette Search"
      />
      <div class="wb-palette-list" role="listbox">
        ${
          items.length === 0
            ? `<div class="wb-palette-empty">No matching commands found.</div>`
            : items
                .map(
                  (it, idx) => `
              <button
                type="button"
                class="wb-palette-item ${idx === activeIndex ? 'active' : ''}"
                role="option"
                aria-selected="${idx === activeIndex}"
                data-cmd-idx="${idx}"
              >
                <span>${escapeXml(it.title)}</span>
                ${it.shortcut ? `<kbd>${escapeXml(it.shortcut)}</kbd>` : ''}
              </button>
            `
                )
                .join('')
        }
      </div>
    `;

    const input = box.querySelector('#wb-palette-input');
    input?.addEventListener('input', (e) => {
      query = e.target.value;
      activeIndex = 0;
      render();
      const nextInput = box.querySelector('#wb-palette-input');
      if (nextInput) {
        nextInput.focus();
        nextInput.setSelectionRange(query.length, query.length);
      }
    });

    input?.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      const filtered = getFiltered();
      if (ev.key === 'ArrowDown') {
        ev.preventDefault();
        activeIndex = filtered.length ? (activeIndex + 1) % filtered.length : 0;
        render();
        box.querySelector('#wb-palette-input')?.focus();
      } else if (ev.key === 'ArrowUp') {
        ev.preventDefault();
        activeIndex = filtered.length
          ? (activeIndex - 1 + filtered.length) % filtered.length
          : 0;
        render();
        box.querySelector('#wb-palette-input')?.focus();
      } else if (ev.key === 'Enter') {
        ev.preventDefault();
        const chosen = filtered[activeIndex];
        if (chosen) {
          close();
          chosen.run();
        }
      } else if (ev.key === 'Escape') {
        ev.preventDefault();
        close();
      }
    });

    box.querySelectorAll('[data-cmd-idx]').forEach((b) => {
      b.addEventListener('click', () => {
        const chosen = items[Number(b.dataset.cmdIdx)];
        if (chosen) {
          close();
          chosen.run();
        }
      });
    });
  }

  backdrop.addEventListener('click', (ev) => {
    if (ev.target === backdrop) close();
  });

  return { open, close, isOpen };
}
