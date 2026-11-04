// ui/context-menu.js — pointer-anchored, keyboard-navigable right-click menus.
// Presentation only: every action delegates to an existing app command, and text
// fields keep their native menus because the canvas handler is the only one bound.
import { escapeXml } from '../render/svg-export.js';
import { WORKFLOW_INDEX } from '../templates/workflows-index.js';

const ARROW_HEAD_CHOICES = [
  ['none', 'No arrowhead'],
  ['arrow', 'Open'],
  ['triangle', 'Filled triangle'],
  ['triangle-outline', 'Outline triangle'],
  ['diamond', 'Diamond'],
  ['circle', 'Circle'],
  ['bar', 'Bar'],
];
import {
  fitTable,
  insertTableRow,
  insertTableCol,
  deleteTableRow,
  deleteTableCol,
} from '../scene/table.js';
import { SPOTLIGHT_SIZES } from '../render/canvas.js';

const MENU_WIDTH = 248;

export function initContextMenu(app) {
  const root = document.createElement('div');
  root.className = 'wb-context-menu wb-hidden';
  root.setAttribute('role', 'menu');
  root.setAttribute('aria-label', 'Context menu');
  document.body.appendChild(root);

  let items = [];
  let activeIndex = -1;
  let returnFocus = null;
  let openToLeft = false;

  function isOpen() {
    return !root.classList.contains('wb-hidden');
  }

  function close({ restoreFocus = true } = {}) {
    if (!isOpen()) return;
    root.classList.add('wb-hidden');
    root.innerHTML = '';
    items = [];
    activeIndex = -1;
    if (restoreFocus && returnFocus && typeof returnFocus.focus === 'function') {
      returnFocus.focus({ preventScroll: true });
    }
    returnFocus = null;
  }

  function itemHtml(item, idx) {
    const disabled = Boolean(item.disabled);
    const hasChildren = Array.isArray(item.children) && item.children.length > 0;
    const reason = disabled && item.reason ? ` title="${escapeXml(item.reason)}"` : '';
    return `
      <button type="button" id="ctx-item-${idx}"
        class="wb-context-item ${activeIndex === idx ? 'active' : ''} ${disabled ? 'disabled' : ''}"
        role="menuitem" data-menu-idx="${idx}"
        aria-disabled="${disabled}" ${disabled ? 'tabindex="-1"' : ''} ${reason}>
        <span class="wb-context-label">${escapeXml(item.label)}</span>
        ${item.shortcut ? `<kbd class="wb-context-shortcut">${escapeXml(item.shortcut)}</kbd>` : ''}
        ${hasChildren ? '<span class="wb-context-arrow" aria-hidden="true">›</span>' : ''}
      </button>`;
  }

  function render() {
    root.innerHTML = items
      .map((item, idx) =>
        item.type === 'separator'
          ? '<div class="wb-context-sep" role="separator"></div>'
          : itemHtml(item, idx)
      )
      .join('');
    root.querySelectorAll('[data-menu-idx]').forEach((btn) => {
      const idx = Number(btn.dataset.menuIdx);
      const item = items[idx];
      if (!item) return;
      btn.addEventListener('mouseenter', () => {
        if (!item.disabled) {
          activeIndex = idx;
          paintActive();
        }
      });
      btn.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        activate(idx);
      });
    });
    if (openToLeft) root.classList.add('align-left');
    else root.classList.remove('align-left');
    paintActive();
  }

  function paintActive() {
    root.querySelectorAll('[data-menu-idx]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.dataset.menuIdx) === activeIndex);
    });
    const active = root.querySelector(`[data-menu-idx="${activeIndex}"]`);
    active?.scrollIntoView({ block: 'nearest' });
    root.setAttribute('aria-activedescendant', active ? `ctx-item-${activeIndex}` : '');
  }

  function moveActive(delta) {
    if (items.length === 0) return;
    let next = activeIndex;
    for (let guard = 0; guard < items.length; guard++) {
      next = (next + delta + items.length) % items.length;
      if (items[next] && items[next].type !== 'separator' && !items[next].disabled) {
        activeIndex = next;
        paintActive();
        return;
      }
    }
  }

  function activate(idx) {
    const item = items[idx];
    if (!item || item.disabled || item.type === 'separator') return;
    if (Array.isArray(item.children) && item.children.length > 0) {
      openSubmenu(item.children);
      return;
    }
    const focusTarget = returnFocus;
    close({ restoreFocus: false });
    try {
      item.action?.();
    } finally {
      returnFocus = null;
      if (focusTarget && typeof focusTarget.focus === 'function') {
        focusTarget.focus({ preventScroll: true });
      }
    }
  }

  function openSubmenu(children) {
    // One level deep: replace the visible list, remember how to get back.
    const parentItems = items;
    const priorFocus = returnFocus;
    items = [
      ...children,
      { type: 'separator' },
      { label: '← Back', action: () => open(parentItems, { returnFocus: priorFocus }) },
    ];
    activeIndex = 0;
    render();
    root.querySelector('[data-menu-idx]')?.focus({ preventScroll: true });
  }

  function open(nextItems, options = {}) {
    items = nextItems || [];
    activeIndex = items.findIndex((i) => i.type !== 'separator' && !i.disabled);
    returnFocus = options.returnFocus || document.activeElement;
    const x = Number(options.x) || 0;
    const y = Number(options.y) || 0;
    openToLeft = x + MENU_WIDTH + 16 > window.innerWidth;
    root.classList.remove('wb-hidden');
    root.style.left = `${openToLeft ? Math.max(8, x - MENU_WIDTH) : x}px`;
    root.style.top = `${Math.max(8, y)}px`;
    render();
    const rect = root.getBoundingClientRect();
    if (rect.bottom > window.innerHeight - 8) {
      root.style.top = `${Math.max(8, window.innerHeight - rect.height - 8)}px`;
    }
    root.querySelector('[data-menu-idx]')?.focus({ preventScroll: true });
  }

  root.addEventListener('keydown', (ev) => {
    if (ev.key === 'ArrowDown') {
      ev.preventDefault();
      moveActive(1);
    } else if (ev.key === 'ArrowUp') {
      ev.preventDefault();
      moveActive(-1);
    } else if (ev.key === 'ArrowRight') {
      const item = items[activeIndex];
      if (item?.children?.length) activate(activeIndex);
    } else if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      activate(activeIndex);
    } else if (ev.key === 'Escape') {
      ev.preventDefault();
      ev.stopPropagation();
      close();
    } else if (ev.key === 'Tab') {
      close();
    }
  });

  document.addEventListener('pointerdown', (ev) => {
    if (isOpen() && !root.contains(ev.target)) close({ restoreFocus: false });
  });
  document.addEventListener('keydown', (ev) => {
    if (isOpen() && ev.key === 'Escape' && !root.contains(ev.target)) {
      ev.preventDefault();
      // Menu-first Esc precedence: closing the menu consumes the keypress so
      // the app-level handler (bound to window) cannot also exit spotlight or
      // anything else on the same press.
      ev.stopPropagation();
      close({ restoreFocus: false });
    }
  });
  window.addEventListener('blur', () => close({ restoreFocus: false }));
  window.addEventListener('resize', () => close({ restoreFocus: false }));
  document.addEventListener('scroll', () => close({ restoreFocus: false }), true);

  return { open, close, isOpen };
}

// Builds the menu for whatever sits under the pointer.
export function buildContextItems(app, hit, world) {
  const page = app.getPage();
  const selected = page.elements.filter((e) => app.selectedIds.has(e.id));
  const canEdit = app.collab ? app.collab.canEditBoard() : true;
  const isArrow = hit && (hit.type === 'line' || hit.type === 'arrow');
  const isTable = hit && hit.type === 'table';
  const isFreehand = hit && (hit.type === 'pen' || hit.type === 'highlighter');
  const selArrow = selected.length === 1 && (selected[0].type === 'line' || selected[0].type === 'arrow');
  const selTable = selected.length === 1 && selected[0].type === 'table';

  // Emotes are social, not board content: open to every role (viewer included),
  // like reaction:send. Anchored to the right-clicked element when there is
  // one, otherwise to the raw world point.
  const emoteItems = (anchor) => ({
    label: 'Emote 👍',
    children: ['👍', '❤️', '😂', '🎉', '❓', '👏'].map((emoji) => ({
      label: emoji,
      action: () => app.collab?.sendReaction(emoji, anchor),
    })),
  });
  const elementAnchor = (el) => {
    if (!el) return null;
    // Connectors carry endpoints instead of w/h — float above their midpoint.
    if (el.x2 !== undefined) {
      return { elementId: el.id, x: (el.x + el.x2) / 2, y: Math.min(el.y, el.y2) - 24 };
    }
    return { elementId: el.id, x: el.x + (el.w || 0) / 2, y: el.y - 24 };
  };

  // Spotlight control surface on the right-click menu. The spotlight is a
  // local overlay (never broadcast), so every role gets the same entries and
  // pointing moves only one's own view.
  const spotlightItems = (anchorWorld, anchorEl) => {
    const sp = app.spotlight || {};
    const active = Boolean(sp.active);
    return {
      label: 'Spotlight',
      children: [
        {
          label: active && sp.pinned ? 'Point spotlight here' : 'Spotlight here',
          action: () => app.pointSpotlightAt(anchorWorld),
        },
        ...(anchorEl
          ? [
              {
                label: 'Spotlight → element',
                action: () => app.pointSpotlightToElement(anchorEl),
              },
            ]
          : []),
        {
          label: 'Spotlight: select size',
          children: Object.entries(SPOTLIGHT_SIZES).map(([name, radius]) => ({
            label: `${!sp.fitRx && Math.round(sp.radius) === radius ? '✓ ' : ''}${name} (${radius}px)`,
            action: () => app.setSpotlightSize(radius),
          })),
        },
        {
          label: 'Spotlight: follow cursor',
          disabled: !active || !sp.pinned,
          reason: 'The spotlight already follows the cursor',
          action: () => app.unpinnedSpotlightFollow(),
        },
        {
          label: 'Spotlight off',
          shortcut: 'Esc',
          disabled: !active,
          reason: 'Spotlight is not on',
          action: () => app.turnSpotlightOff(),
        },
      ],
    };
  };

  const editItem = {
    label: 'Edit text / content',
    shortcut: 'F2',
    disabled: !canEdit,
    reason: 'Read-only role',
    action: () => app.textTool?.openEditorForElement(hit, world),
  };

  if (hit && isArrow) {
    const locked = Boolean(hit.locked);
    return [
      editItem,
      { type: 'separator' },
      {
        label: 'Path type',
        children: [
          ['auto', 'Auto Clean'],
          ['straight', 'Straight'],
          ['orthogonal', 'Right-Angle'],
          ['rounded-elbow', 'Rounded Elbow'],
          ['curved', 'Curved'],
        ].map(([value, label]) => ({
          label: `${hit.routing === value ? '✓ ' : ''}${label}`,
          disabled: !canEdit || locked,
          action: () => {
            hit.routing = value;
            if (hit.id) app.commitChange();
            app.updateUI();
            app.requestRender();
          },
        })),
      },
      {
        label: 'Endpoint heads',
        children: [
          {
            label: `Start: ${(ARROW_HEAD_CHOICES.find(([v]) => v === hit.startArrow) || [null, 'No arrowhead'])[1]}`,
            children: ARROW_HEAD_CHOICES.map(([v, label]) => ({
              label,
              disabled: !canEdit || locked,
              action: () => {
                hit.startArrow = v;
                app.commitChange();
                app.requestRender();
              },
            })),
          },
          {
            label: `End: ${(ARROW_HEAD_CHOICES.find(([v]) => v === hit.endArrow) || ['arrow', 'Open'])[1]}`,
            children: ARROW_HEAD_CHOICES.map(([v, label]) => ({
              label,
              disabled: !canEdit || locked,
              action: () => {
                hit.endArrow = v;
                app.commitChange();
                app.requestRender();
              },
            })),
          },
        ],
      },
      {
        label: 'Reverse direction',
        disabled: !canEdit || locked,
        action: () => {
          const x = hit.x;
          const y = hit.y;
          hit.x = hit.x2;
          hit.y = hit.y2;
          hit.x2 = x;
          hit.y2 = y;
          const s = hit.startArrow;
          hit.startArrow = hit.endArrow;
          hit.endArrow = s;
          const sb = hit.startBinding;
          hit.startBinding = hit.endBinding;
          hit.endBinding = sb;
          app.commitChange();
          app.updateUI();
          app.requestRender();
        },
      },
      {
        label: 'Reset route (Auto Clean)',
        disabled: !canEdit || locked,
        action: () => {
          hit.routing = 'auto';
          hit.manualRoute = false;
          hit.waypoints = [];
          hit.controlPoint = null;
          app.commitChange();
          app.updateUI();
          app.requestRender();
        },
      },
      { type: 'separator' },
      emoteItems(elementAnchor(hit)),
      spotlightItems(world, hit),
      { label: 'Duplicate', shortcut: 'Ctrl/⌘D', disabled: !canEdit || locked, action: () => app.duplicateSelection() },
      { label: 'Delete', shortcut: 'Del', disabled: !canEdit || locked, action: () => app.deleteSelection() },
    ];
  }

  if (hit && isTable) {
    const locked = Boolean(hit.locked);
    const t = hit;
    const mutate = (fn) => {
      fn(t);
      fitTable(app.renderer?.ctx, t);
      app.commitChange();
      app.updateUI();
      app.requestRender();
    };
    return [
      editItem,
      { type: 'separator' },
      { label: 'Insert row above', disabled: !canEdit || locked, action: () => mutate((e) => insertTableRow(e, -1)) },
      { label: 'Insert row below', disabled: !canEdit || locked, action: () => mutate((e) => insertTableRow(e, 1)) },
      { label: 'Insert column left', disabled: !canEdit || locked, action: () => mutate((e) => insertTableCol(e, -1)) },
      { label: 'Insert column right', disabled: !canEdit || locked, action: () => mutate((e) => insertTableCol(e, 1)) },
      {
        label: 'Table structure / paste TSV…',
        disabled: !canEdit || locked,
        action: () => app.dialogs?.openTableInsertModal?.(t),
      },
      {
        label: 'Delete row',
        disabled: !canEdit || locked || (t.rows || 1) <= 1,
        reason: 'A table needs at least one row',
        action: () => mutate((e) => deleteTableRow(e)),
      },
      {
        label: 'Delete column',
        disabled: !canEdit || locked || (t.cols || 1) <= 1,
        reason: 'A table needs at least one column',
        action: () => mutate((e) => deleteTableCol(e)),
      },
      {
        label: 'Toggle header row',
        disabled: !canEdit || locked,
        action: () => mutate((e) => (e.headerRow = e.headerRow === false)),
      },
      { type: 'separator' },
      emoteItems(elementAnchor(hit)),
      spotlightItems(world, hit),
      { label: 'Duplicate', disabled: !canEdit || locked, action: () => app.duplicateSelection() },
      { label: 'Delete', disabled: !canEdit || locked, action: () => app.deleteSelection() },
    ];
  }

  if (hit || selected.length > 0) {
    const multi = selected.length > 1;
    const codeTarget = hit?.type === 'code' ? hit : selected.length === 1 && selected[0].type === 'code' ? selected[0] : null;
    return [
      editItem,
      ...(codeTarget
        ? [
            {
              label: 'Open expanded code editor',
              disabled: !canEdit,
              action: () => app.dialogs?.openCodeEditorModal(codeTarget),
            },
          ]
        : []),
      { type: 'separator' },
      {
        label: isFreehand ? 'Drawing preset' : 'Copy style',
        children: isFreehand
          ? app.brushPresetItems?.() || []
          : [
              { label: 'Copy style', shortcut: 'Alt+C', disabled: !canEdit, action: () => app.copySelectedStyle() },
              { label: 'Paste style', shortcut: 'Alt+V', disabled: !canEdit || app.formatPainterStyle === null, reason: app.formatPainterStyle === null ? 'Copy a style first' : '', action: () => app.pasteSelectedStyle?.() },
            ],
      },
      { label: 'Cut', shortcut: 'Ctrl/⌘X', disabled: !canEdit, action: () => app.cutSelection() },
      { label: 'Copy', shortcut: 'Ctrl/⌘C', disabled: !canEdit, action: () => app.copySelection() },
      { label: 'Duplicate', shortcut: 'Ctrl/⌘D', disabled: !canEdit, action: () => app.duplicateSelection() },
      { type: 'separator' },
      { label: 'Group', shortcut: 'Ctrl/⌘G', disabled: !canEdit || !multi, reason: 'Select two or more objects', action: () => app.groupSelection() },
      { label: 'Ungroup', shortcut: 'Ctrl/⌘⇧G', disabled: !canEdit || !selected.some((e) => e.groupId), action: () => app.ungroupSelection() },
      {
        label: 'Arrange',
        children: [
          { label: 'Bring to front', disabled: !canEdit, action: () => app.reorderSelection?.('front') },
          { label: 'Bring forward', disabled: !canEdit, action: () => app.reorderSelection?.('forward') },
          { label: 'Send backward', disabled: !canEdit, action: () => app.reorderSelection?.('backward') },
          { label: 'Send to back', disabled: !canEdit, action: () => app.reorderSelection?.('back') },
        ],
      },
      { label: selected.every((e) => e.locked) ? 'Unlock' : 'Lock', disabled: !canEdit, action: () => app.toggleLockSelection() },
      { label: 'Add to library', disabled: !canEdit, action: () => app.addSelectionToLibrary?.() },
      { label: 'Export selection as PNG', action: () => app.exportPngDownload({ selectionOnly: true, selectedIds: app.selectedIds }) },
      { type: 'separator' },
      emoteItems(elementAnchor(hit || selected[0])),
      spotlightItems(world, hit || selected[0]),
      { type: 'separator' },
      { label: 'Delete', shortcut: 'Del', disabled: !canEdit, action: () => app.deleteSelection() },
    ];
  }

  // Empty canvas
  return [
    {
      label: 'Paste',
      shortcut: 'Ctrl/⌘V',
      disabled: !canEdit || (app.clipboard?.length || 0) === 0,
      reason: 'Nothing copied yet',
      action: () => app.pasteClipboard(),
    },
    { label: 'Select all', shortcut: 'Ctrl/⌘A', action: () => app.selectAll?.() },
    {
      label: 'Insert',
      children: [
        { label: 'Text (T)', action: () => app.setTool('text') },
        { label: 'Rectangle (R)', action: () => app.setTool('rect') },
        { label: 'Ellipse (O)', action: () => app.setTool('ellipse') },
        { label: 'Sticky note (N)', action: () => app.setTool('sticky') },
        { label: 'Table (B)', action: () => app.setTool('table') },
        { label: 'Code block (J)', action: () => app.setTool('code') },
        { label: 'Frame / slide (F2)', action: () => app.setTool('frame') },
      ],
    },
    {
      label: 'Insert workflow here',
      disabled: !canEdit,
      children: WORKFLOW_INDEX.topics.map((t) => ({
        label: `${t.name} (${t.count})`,
        children: WORKFLOW_INDEX.workflows
          .filter((w) => w.topic === t.id)
          .map((w) => ({ label: w.title, action: () => app.insertWorkflow(w.id, { at: world }) })),
      })),
    },
    {
      label: 'Drawing preset',
      children: (app.brushPresetItems?.() || []).map((it) => ({ ...it, action: it.action })),
    },
    {
      label: 'Arrow preset',
      children: (app.arrowPresetItems?.() || []).map((it) => ({ ...it })),
    },
    emoteItems({ x: world.x, y: world.y }),
    spotlightItems(world, null),
    { type: 'separator' },
    {
      label: `${app.scene.settings.snapToGrid ? '✓ ' : ''}Snap to grid`,
      disabled: !canEdit,
      action: () => app.toggleSnapToGrid?.() ?? app.setBackground?.(app.getPage().background),
    },
    {
      label: `${app.scene.settings.snapToObjects ? '✓ ' : ''}Smart guides`,
      disabled: !canEdit,
      action: () => app.toggleSmartGuides?.(),
    },
    { label: 'Canvas settings', action: () => { app.propsCanvasMode = true; app.propsDrawerOpen = true; app.propsUI?.update(); } },
    { type: 'separator' },
    { label: 'Fit to content', shortcut: '1', action: () => app.fitToContent() },
    { label: 'Reset zoom 100%', shortcut: '0', action: () => app.setZoom(1) },
    { label: 'Toggle focus mode', shortcut: '⇧F', action: () => app.toggleFocusMode() },
  ];
}
