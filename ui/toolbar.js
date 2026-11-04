// ui/toolbar.js — Top Bar, Workspace Presets, Compact Primary Toolset, Insert Menu, Spotlight Banner & Zoom Controls
import { TOOL_REGISTRY, ICONS, getShortcutLabel } from './registry.js';
import { WORKSPACE_PRESETS } from '../scene/storage.js';
import { escapeXml } from '../render/svg-export.js';
import { ARROW_QUICK_PRESETS } from '../scene/arrow-presets.js';
import { BRUSH_PRESETS, getBrushPreset } from '../scene/brushes.js';
import { PALETTE_STROKE_COLORS } from '../render/themes.js';
import { totalVotes } from '../scene/voting.js';
import { arrowPresetPreview } from './arrow-preview.js';

export const PRIMARY_TOOL_IDS = [
  'select',
  'hand',
  'pen',
  'highlighter',
  'eraser',
  'arrow',
  'sticky',
  'spotlight',
  'vote',
  'rect',
  'text',
  'laser',
  'pointer',
  'question',
];

export const PRIMARY_TOOLS = TOOL_REGISTRY.filter((t) => PRIMARY_TOOL_IDS.includes(t.id));

export function initToolbar(app) {
  const dock = document.getElementById('wb-toolbar');
  const topBar = document.getElementById('wb-topbar');
  const bottomBar = document.getElementById('wb-bottombar');
  const modeBanner = document.getElementById('wb-mode-banner');

  function renderTopBar() {
    if (!topBar) return;
    const preset = app.activePreset || 'diagram';
    const undoKey = getShortcutLabel('undo');
    const redoKey = getShortcutLabel('redo');
    const paletteKey = getShortcutLabel('palette');
    topBar.innerHTML = `
      <div class="wb-top-left">
        <button type="button" class="wb-brand-btn" id="btn-brand-home" title="StudioBoard — Reset View">
          <span class="wb-brand-logo">${ICONS.logo}</span>
          <span class="wb-brand-title">StudioBoard</span>
        </button>
        <input type="text" id="wb-doc-title" class="wb-doc-title-input" value="" aria-label="Document Title" title="Click to rename lesson/board" />
        <span id="wb-autosave-status" class="wb-status-pill" aria-live="polite" title="Local storage save status">Saved locally</span>
        <button type="button" id="wb-conn-status" class="wb-status-pill wb-conn-pill" title="Collaboration connection status">Local board</button>
      </div>

      <div class="wb-top-center">
        <div class="wb-preset-selector" id="wb-preset-selector" role="group" aria-label="Workspace Preset">
          <span class="wb-preset-label wb-hide-md">Preset:</span>
          ${Object.values(WORKSPACE_PRESETS)
            .map(
              (p) => `
            <button
              type="button"
              class="wb-preset-btn ${preset === p.id ? 'active' : ''}"
              data-preset="${p.id}"
              aria-pressed="${preset === p.id}"
              title="${escapeXml(p.description)}"
            >${escapeXml(p.label)}</button>
          `
            )
            .join('')}
        </div>
        <span class="wb-sep"></span>
        <button type="button" class="wb-btn" id="btn-undo" aria-label="Undo (${escapeXml(undoKey)})" title="Undo (${escapeXml(undoKey)})">${ICONS.undo}</button>
        <button type="button" class="wb-btn" id="btn-redo" aria-label="Redo (${escapeXml(redoKey)})" title="Redo (${escapeXml(redoKey)})">${ICONS.redo}</button>
        <span class="wb-sep"></span>
        <button type="button" class="wb-btn" id="btn-library" aria-label="Toggle Stencil & Template Library" title="DevOps & Cloud Icon Library">${ICONS.library} <span class="wb-hide-lg">Library</span></button>
        <button type="button" class="wb-btn" id="btn-layers" aria-label="Toggle Layers Panel" title="Layers & Z-Order">${ICONS.layers} <span class="wb-hide-lg">Layers</span></button>
        <button type="button" class="wb-btn" id="btn-classroom" aria-label="Toggle Live Classroom & Questions" title="Live Classroom Share, Pointers & Student Questions">${ICONS.classroom} <span class="wb-hide-md" id="wb-classroom-label">Classroom</span></button>
        <button type="button" class="wb-btn" id="btn-props-toggle" aria-label="Toggle Inspector Panel" title="Toggle Style & Properties Inspector">${ICONS.sliders} <span class="wb-hide-lg">Inspector</span></button>
        <button type="button" class="wb-btn wb-hide-lg ${preset === 'diagram' ? 'wb-hidden' : ''}" id="btn-quick-present" title="Enter Lesson Presentation Mode (F6)">${ICONS.present} <span class="wb-hide-sm">Present</span></button>
        <button type="button" class="wb-btn wb-hide-lg ${preset === 'diagram' ? 'wb-hidden' : ''}" id="btn-quick-timer" title="Toggle Class Countdown / Stopwatch">${ICONS.timer} <span class="wb-hide-sm">Timer</span></button>

        <div class="wb-dropdown">
          <button type="button" class="wb-btn" id="btn-teaching-menu" aria-haspopup="true" title="Teaching & Classroom Tools">${ICONS.teaching} <span class="wb-hide-md">Teaching ▾</span></button>
          <div class="wb-dropdown-menu wb-hidden" id="menu-teaching">
            <button type="button" class="wb-menu-item" id="btn-present">${ICONS.present} Presentation Mode (F6)</button>
            <button type="button" class="wb-menu-item" id="btn-reveal-timeline">${ICONS.timeline} Step-by-Step Reveal Timeline</button>
            <button type="button" class="wb-menu-item" id="btn-spotlight">${ICONS.spotlight} Spotlight (F7)</button>
            <button type="button" class="wb-menu-item" id="btn-magnifier">${ICONS.spotlight} Magnifier Lens 2x</button>
            <button type="button" class="wb-menu-item" id="btn-annotation-mode">${ICONS.annotation} Live Annotation Mode (F8)</button>
            <button type="button" class="wb-menu-item" id="btn-dot-vote">${ICONS.vote} Dot Voting (Shift+V)</button>
            <button type="button" class="wb-menu-item" id="btn-timer">${ICONS.timer} Countdown / Stopwatch</button>
            <button type="button" class="wb-menu-item" id="btn-focus-mode">${ICONS.focus} Teaching Focus Mode (F10)</button>
            <button type="button" class="wb-menu-item" id="btn-customize-focus">${ICONS.sliders} Customize Pinned Tools…</button>
          </div>
        </div>
      </div>

      <div class="wb-top-right">
        <button type="button" class="wb-btn" id="btn-palette" aria-label="Command Palette (${escapeXml(paletteKey)})" title="Command Palette (${escapeXml(paletteKey)})">${ICONS.search} <span class="wb-hide-md">${escapeXml(paletteKey)}</span></button>
        <button type="button" class="wb-btn" id="btn-theme" aria-label="Toggle Theme" title="Cycle Light / Dark Theme">${ICONS.theme}</button>

        <div class="wb-dropdown">
          <button type="button" class="wb-btn wb-primary" id="btn-board-menu" aria-haspopup="true" title="Board File, Share & Export Actions">${ICONS.menu} <span class="wb-hide-sm">Board ▾</span></button>
          <div class="wb-dropdown-menu wb-dropdown-right wb-hidden" id="menu-board">
            <button type="button" class="wb-menu-item" id="btn-save-json">${ICONS.save} Save Board (.whiteboard.json)</button>
            <button type="button" class="wb-menu-item" id="btn-open-json">${ICONS.folder} Open Board JSON…</button>
            <button type="button" class="wb-menu-item" id="btn-export">${ICONS.download} Export PNG / SVG / PDF…</button>
            <button type="button" class="wb-menu-item" id="btn-share-url">${ICONS.share} Short Share Links & Live Room…</button>
            <button type="button" class="wb-menu-item" id="btn-mermaid">${ICONS.mermaid} Mermaid Diagram → Editable Nodes…</button>
            <button type="button" class="wb-menu-item" id="btn-auto-layout-board">⇄ Auto-Layout Architecture Diagram</button>
            <button type="button" class="wb-menu-item" id="btn-recovery">${ICONS.history} Recovery Snapshots & Checkpoints…</button>
            <button type="button" class="wb-menu-item" id="btn-shortcuts">${ICONS.keyboard} Keyboard Shortcuts (?)</button>
          </div>
        </div>
      </div>
    `;

    const bindDropdown = (btnId, menuId) => {
      const btn = topBar.querySelector(btnId);
      const menu = topBar.querySelector(menuId);
      btn?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        document.querySelectorAll('.wb-dropdown-menu').forEach((m) => {
          if (m !== menu) m.classList.add('wb-hidden');
        });
        menu?.classList.toggle('wb-hidden');
      });
    };
    bindDropdown('#btn-teaching-menu', '#menu-teaching');
    bindDropdown('#btn-board-menu', '#menu-board');
    document.addEventListener('click', () => {
      document.querySelectorAll('.wb-dropdown-menu').forEach((m) => m.classList.add('wb-hidden'));
    });

    topBar.querySelectorAll('[data-preset]').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.setWorkspacePreset(btn.dataset.preset);
      });
    });

    topBar.querySelector('#btn-brand-home')?.addEventListener('click', () => app.resetZoom());
    const titleInput = topBar.querySelector('#wb-doc-title');
    if (titleInput) {
      titleInput.value = app.scene.title || 'StudioBoard Lesson';
      titleInput.addEventListener('change', (e) => {
        app.scene.title = e.target.value.trim() || 'StudioBoard Lesson';
        app.scheduleAutosave(app.scene);
        app.collab?.broadcastSceneChange();
      });
    }

    topBar.querySelector('#wb-conn-status')?.addEventListener('click', () => app.classroomUI.toggle());
    topBar.querySelector('#btn-undo')?.addEventListener('click', () => app.undo());
    topBar.querySelector('#btn-redo')?.addEventListener('click', () => app.redo());
    topBar.querySelector('#btn-library')?.addEventListener('click', () => app.togglePanel('wb-library-panel'));
    topBar.querySelector('#btn-layers')?.addEventListener('click', () => app.togglePanel('wb-layers-panel'));
    topBar.querySelector('#btn-classroom')?.addEventListener('click', () => app.classroomUI.toggle());
    topBar.querySelector('#btn-props-toggle')?.addEventListener('click', () => app.togglePropsDrawer());
    topBar.querySelector('#btn-quick-present')?.addEventListener('click', () => app.presentUI.enter());
    topBar.querySelector('#btn-quick-timer')?.addEventListener('click', () => app.timerUI.toggle());
    topBar.querySelector('#btn-timer')?.addEventListener('click', () => app.timerUI.toggle());
    topBar.querySelector('#btn-present')?.addEventListener('click', () => app.presentUI.enter());
    topBar.querySelector('#btn-reveal-timeline')?.addEventListener('click', () => app.dialogs.openRevealTimelineModal());
    topBar.querySelector('#btn-spotlight')?.addEventListener('click', () => app.toggleSpotlight(false));
    topBar.querySelector('#btn-magnifier')?.addEventListener('click', () => app.toggleSpotlight(true));
    topBar.querySelector('#btn-annotation-mode')?.addEventListener('click', () => app.toggleAnnotationMode());
    topBar.querySelector('#btn-dot-vote')?.addEventListener('click', () => app.votingUI.toggle());
    topBar.querySelector('#btn-focus-mode')?.addEventListener('click', () => app.toggleFocusMode());
    topBar.querySelector('#btn-customize-focus')?.addEventListener('click', () => app.dialogs.openFocusToolsModal());
    topBar.querySelector('#btn-palette')?.addEventListener('click', () => app.paletteUI.open());
    topBar.querySelector('#btn-theme')?.addEventListener('click', () => app.cycleTheme());
    topBar.querySelector('#btn-mermaid')?.addEventListener('click', () => app.dialogs.openMermaidModal());
    topBar.querySelector('#btn-auto-layout-board')?.addEventListener('click', () => app.autoLayoutSelection('LR'));
    topBar.querySelector('#btn-save-json')?.addEventListener('click', () => app.saveSceneFile());
    topBar.querySelector('#btn-open-json')?.addEventListener('click', () => document.getElementById('wb-file-open-json')?.click());
    topBar.querySelector('#btn-export')?.addEventListener('click', () => app.dialogs.openExportModal());
    topBar.querySelector('#btn-share-url')?.addEventListener('click', () => app.dialogs.openShareUrlModal());
    topBar.querySelector('#btn-recovery')?.addEventListener('click', () => app.dialogs.openRecoveryModal());
    topBar.querySelector('#btn-shortcuts')?.addEventListener('click', () => app.dialogs.openShortcutsModal());
  }

  // ── Dock helpers: brush drawer, arrow tabs ────────────────────────────────
  const HIGHLIGHTER_INKS = ['#facc15', '#4ade80', '#60a5fa', '#f472b6', '#fb923c', '#a78bfa'];

  const ARROW_ROUTINGS = [
    { id: 'straight', label: 'Straight', path: 'M4 18 L20 6' },
    { id: 'orthogonal', label: 'Orthogonal', path: 'M4 18 H12 V6 H20' },
    { id: 'curved', label: 'Curved', path: 'M4 18 Q12 2 20 14' },
    { id: 'rounded-elbow', label: 'Rounded elbow', path: 'M4 18 H9 A3 3 0 0 0 12 15 V9 A3 3 0 0 1 15 6 H20' },
  ];

  const ARROW_HEADS = [
    { id: 'none', label: 'None', glyph: '—' },
    { id: 'arrow', label: 'Arrow', glyph: '→' },
    { id: 'triangle', label: 'Triangle', glyph: '▶' },
    { id: 'diamond', label: 'Diamond', glyph: '◆' },
    { id: 'circle', label: 'Circle', glyph: '●' },
    { id: 'bar', label: 'Bar', glyph: '|' },
  ];

  function inkToolActive() {
    return app.activeTool === 'pen' || app.activeTool === 'highlighter';
  }

  function selectedInk() {
    const page = app.getPage?.();
    if (!page) return [];
    return page.elements.filter(
      (el) =>
        app.selectedIds.has(el.id) &&
        (el.type === 'pen' || el.type === 'highlighter') &&
        !el.locked
    );
  }

  function currentBrushPreset() {
    return getBrushPreset(app.currentBrush) || BRUSH_PRESETS[0];
  }

  // What the arrow tabs should show: the selected connector first, then any
  // override still waiting for the next arrow, then the plain defaults.
  function arrowStyleSeed() {
    const page = app.getPage?.();
    const selected = page?.elements?.find(
      (e) => app.selectedIds.has(e.id) && (e.type === 'arrow' || e.type === 'line')
    );
    const pending = app.pendingArrowStyle || {};
    const style = app.currentStyle || {};
    return {
      routing: selected?.routing || pending.routing || style.routing || 'orthogonal',
      startArrow: selected?.startArrow || pending.startArrow || style.startArrow || 'none',
      endArrow: selected?.endArrow || pending.endArrow || style.endArrow || 'arrow',
      cornerRadius: selected?.cornerRadius || pending.cornerRadius || 14,
      presetId: app.pendingArrowPreset || '',
    };
  }

  function arrowPopoverMarkup() {
    const s = arrowStyleSeed();
    const tabBtn = (id, label, active) => `
      <button type="button" class="wb-arrow-tab ${active ? 'active' : ''}" role="tab"
        data-arrow-tab="${id}" aria-selected="${active}">${label}</button>`;
    return `
      <div class="wb-arrow-tabs" role="tablist" aria-label="Arrow options">
        ${tabBtn('presets', 'Presets', true)}
        ${tabBtn('route', 'Route', false)}
        ${tabBtn('heads', 'Heads', false)}
      </div>
      <div class="wb-arrow-tab-panel" data-arrow-panel="presets">
        ${ARROW_QUICK_PRESETS.map(
          (p, i) => `
          <button type="button" class="wb-menu-item wb-arrow-card" data-arrow-preset="${p.id}" title="${escapeXml(p.description)}">
            ${arrowPresetPreview(p, i)}
            <span>${escapeXml(p.name)}</span>
          </button>`
        ).join('')}
        <button type="button" class="wb-menu-item" id="btn-arrow-insert-sample" title="Insert a ready-made arrow without dragging">
          + <span>Insert sample arrow</span>
        </button>
      </div>
      <div class="wb-arrow-tab-panel wb-hidden" data-arrow-panel="route">
        <div class="wb-prop-title" style="margin:2px 0 4px;">Path type</div>
        <div class="wb-arrow-option-grid">
          ${ARROW_ROUTINGS.map(
            (r) => `
            <button type="button" class="wb-arrow-option ${s.routing === r.id ? 'active' : ''}"
              data-arrow-routing="${r.id}" aria-pressed="${s.routing === r.id}" title="${r.label}">
              <svg viewBox="0 0 24 24" width="26" height="16" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${r.path}"/></svg>
              <span>${r.label}</span>
            </button>`
          ).join('')}
        </div>
        <label class="wb-prop-row">
          <span>Corner radius (${Math.round(s.cornerRadius)}px)</span>
          <input type="range" id="wb-arrow-radius" min="2" max="48" value="${Math.round(s.cornerRadius)}"
            ${s.routing === 'rounded-elbow' ? '' : 'disabled'}/>
        </label>
      </div>
      <div class="wb-arrow-tab-panel wb-hidden" data-arrow-panel="heads">
        <div class="wb-prop-title" style="margin:2px 0 4px;">Start head</div>
        <div class="wb-arrow-option-grid">
          ${ARROW_HEADS.map(
            (h) => `
            <button type="button" class="wb-arrow-option ${s.startArrow === h.id ? 'active' : ''}"
              data-arrow-start="${h.id}" aria-pressed="${s.startArrow === h.id}" title="${h.label}">
              <b aria-hidden="true">${h.glyph}</b><span>${h.label}</span>
            </button>`
          ).join('')}
        </div>
        <div class="wb-prop-title" style="margin:6px 0 4px;">End head</div>
        <div class="wb-arrow-option-grid">
          ${ARROW_HEADS.map(
            (h) => `
            <button type="button" class="wb-arrow-option ${s.endArrow === h.id ? 'active' : ''}"
              data-arrow-end="${h.id}" aria-pressed="${s.endArrow === h.id}" title="${h.label}">
              <b aria-hidden="true">${h.glyph}</b><span>${h.label}</span>
            </button>`
          ).join('')}
        </div>
        <button type="button" class="wb-menu-item" id="wb-arrow-swap-heads" title="Swap start and end heads">⇄ Swap heads</button>
      </div>
    `;
  }

  // The drawer only exists while an ink tool is active, so switching to any
  // other tool collapses it (the dock is rebuilt on every tool change).
  function brushDrawerMarkup() {
    if (!inkToolActive()) return '';
    const preset = currentBrushPreset();
    const width = app.brushOverrides?.strokeWidth ?? preset.strokeWidth;
    const opacity = Math.round((app.brushOverrides?.opacity ?? preset.opacity) * 100);
    const smoothing = app.brushSmoothing || preset.smoothing || 'adaptive';
    const inks = preset.kind === 'highlighter' ? HIGHLIGHTER_INKS : PALETTE_STROKE_COLORS;
    const ink = app.currentStyle?.stroke || (preset.kind === 'highlighter' ? '#facc15' : '#1e293b');
    const label = app.activeTool === 'highlighter' ? 'Highlighter' : 'Freehand';
    return `
      <div class="wb-brush-drawer" id="wb-brush-drawer" role="group" aria-label="${label} brush options">
        <div class="wb-brush-drawer-head">
          <strong>${label}</strong>
          <span class="wb-muted">${escapeXml(preset.name)}</span>
        </div>
        <div class="wb-brush-drawer-presets" role="radiogroup" aria-label="Brush preset">
          ${BRUSH_PRESETS.map(
            (p) => `
            <button type="button" class="wb-brush-chip ${p.id === preset.id ? 'active' : ''}"
              data-drawer-brush="${p.id}" role="radio" aria-checked="${p.id === preset.id}"
              title="${escapeXml(p.description)}">${escapeXml(p.name)}</button>`
          ).join('')}
        </div>
        <div class="wb-brush-drawer-colors" role="group" aria-label="Ink colour">
          ${inks
            .map(
              (c) =>
                `<button type="button" class="wb-color-swatch ${ink === c ? 'active' : ''}"
                  style="background:${c}" data-drawer-color="${c}" aria-label="Ink colour ${c}"></button>`
            )
            .join('')}
          <input type="color" id="wb-drawer-color" value="${ink}" aria-label="Custom ink colour"/>
        </div>
        <label class="wb-brush-drawer-row">
          <span>Size</span>
          <input type="range" id="wb-drawer-size" min="1" max="40" value="${Math.round(width)}" aria-label="Brush size"/>
          <b data-drawer-value="size">${Math.round(width)}px</b>
        </label>
        <label class="wb-brush-drawer-row">
          <span>Opacity</span>
          <input type="range" id="wb-drawer-opacity" min="5" max="100" value="${opacity}" aria-label="Brush opacity"/>
          <b data-drawer-value="opacity">${opacity}%</b>
        </label>
        <label class="wb-brush-drawer-row">
          <span>Stabilize</span>
          <select id="wb-drawer-smoothing" aria-label="Stroke stabilization">
            <option value="off" ${smoothing === 'off' ? 'selected' : ''}>Off</option>
            <option value="adaptive" ${smoothing === 'adaptive' ? 'selected' : ''}>Adaptive</option>
            <option value="stabilizer" ${smoothing === 'stabilizer' ? 'selected' : ''}>Stabilizer</option>
          </select>
        </label>
      </div>
    `;
  }

  function bindBrushDrawer(drawer) {
    drawer.querySelectorAll('[data-drawer-brush]').forEach((btn) => {
      btn.addEventListener('click', () => {
        app.setBrushPreset(btn.dataset.drawerBrush, { applyToSelection: selectedInk().length > 0 });
      });
    });

    const setInkColour = (colour) => {
      if (!colour) return;
      const ink = selectedInk();
      if (ink.length > 0) {
        for (const el of ink) el.stroke = colour;
        app.commitChange();
      }
      app.currentStyle = { ...app.currentStyle, stroke: colour };
      drawer
        .querySelectorAll('[data-drawer-color]')
        .forEach((s) => s.classList.toggle('active', s.dataset.drawerColor === colour));
      app.requestRender();
    };
    drawer.querySelectorAll('[data-drawer-color]').forEach((swatch) => {
      swatch.addEventListener('click', () => setInkColour(swatch.dataset.drawerColor));
    });
    drawer.querySelector('#wb-drawer-color')?.addEventListener('input', (e) => setInkColour(e.target.value));

    drawer.querySelector('#wb-drawer-size')?.addEventListener('input', (e) => {
      const v = Number(e.target.value) || 2;
      app.setBrushOverrides?.({ strokeWidth: v }, { silent: true });
      const ink = selectedInk();
      if (ink.length > 0) {
        for (const el of ink) el.strokeWidth = v;
        app.commitChange();
      }
      const out = drawer.querySelector('[data-drawer-value="size"]');
      if (out) out.textContent = `${Math.round(v)}px`;
      app.requestRender();
    });

    drawer.querySelector('#wb-drawer-opacity')?.addEventListener('input', (e) => {
      const pct = Number(e.target.value) || 100;
      const v = Math.max(0.05, pct / 100);
      app.setBrushOverrides?.({ opacity: v }, { silent: true });
      const ink = selectedInk();
      if (ink.length > 0) {
        for (const el of ink) el.opacity = v;
        app.commitChange();
      }
      const out = drawer.querySelector('[data-drawer-value="opacity"]');
      if (out) out.textContent = `${pct}%`;
      app.requestRender();
    });

    drawer.querySelector('#wb-drawer-smoothing')?.addEventListener('change', (e) => {
      app.setBrushSmoothing(e.target.value);
    });
  }

  function bindBrushDrawerSafely(dock) {
    const drawer = dock.querySelector('#wb-brush-drawer');
    if (drawer) bindBrushDrawer(drawer);
  }

  let lastDockSignature = '';

  function renderDock(forceRebuild = false) {
    if (!dock) return;
    const canEdit = app.collab ? app.collab.canEditBoard() : true;
    const collabStatus = app.collab?.status || 'local';
    const rawPinnedIds = !canEdit
      ? collabStatus === 'snapshot'
        ? ['select', 'hand']
        : ['select', 'hand', 'pointer', 'question']
      : app.focusMode
        ? app.focusToolIds || ['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'question']
        : app.getPinnedTools
          ? app.getPinnedTools()
          : PRIMARY_TOOL_IDS;
    const pinnedIds = rawPinnedIds.filter((id) => (app.collab ? app.collab.canUseTool(id) : true));
    // Tool, spotlight and brush state are part of the signature so the brush
    // drawer appears/collapses with the active tool instead of lingering.
    const sig = [
      canEdit ? 1 : 0,
      collabStatus,
      app.focusMode ? 1 : 0,
      app.activeTool || '',
      app.spotlight?.active ? 1 : 0,
      app.currentBrush || '',
      app.pendingArrowPreset || '',
      pinnedIds.join(','),
    ].join('|');

    if (!forceRebuild && sig === lastDockSignature && dock.querySelector('.wb-tool-list')) {
      const pinnedSet = new Set(pinnedIds);
      const advancedTools = TOOL_REGISTRY.filter((t) => !pinnedSet.has(t.id) && t.id !== 'arrow');
      dock.querySelectorAll('[data-tool]').forEach((btn) => {
        const isAct =
          btn.dataset.tool === 'spotlight'
            ? Boolean(app.spotlight?.active)
            : btn.dataset.tool === 'vote'
              ? Boolean(app.votingUI?.isActive?.())
              : btn.dataset.tool === app.activeTool;
        btn.classList.toggle('active', isAct);
        btn.setAttribute('aria-pressed', String(isAct));
      });
      dock.querySelectorAll('[data-insert-tool]').forEach((btn) => {
        const isAct = btn.dataset.insertTool === app.activeTool;
        btn.classList.toggle('active', isAct);
      });
      const moreBtn = dock.querySelector('#btn-insert-more');
      if (moreBtn) {
        moreBtn.classList.toggle(
          'active',
          advancedTools.some((t) => t.id === app.activeTool)
        );
      }
      const lockBtn = dock.querySelector('#btn-tool-lock');
      if (lockBtn) {
        lockBtn.classList.toggle('active', Boolean(app.toolLock));
        lockBtn.setAttribute('aria-pressed', String(Boolean(app.toolLock)));
      }
      return;
    }

    lastDockSignature = sig;
    const pinnedSet = new Set(pinnedIds);
    // The arrow is always drawn as the split button below, so it never also
    // appears as a plain pinned button or in the + menu.
    const visibleTools = TOOL_REGISTRY.filter((t) => pinnedSet.has(t.id) && t.id !== 'arrow');
    const advancedTools = canEdit
      ? TOOL_REGISTRY.filter((t) => !pinnedSet.has(t.id) && t.id !== 'arrow')
      : [];

    dock.innerHTML = `
      <div class="wb-tool-list" role="toolbar" aria-label="Drawing Tools">
        ${visibleTools
          .map((t) => {
            // Spotlight and dot voting are modes: their buttons reflect the
            // mode state, not the active placement tool.
            const isActive =
              t.id === 'spotlight'
                ? Boolean(app.spotlight?.active)
                : t.id === 'vote'
                  ? Boolean(app.votingUI?.isActive?.())
                  : app.activeTool === t.id;
            return `
          <button
            type="button"
            class="wb-tool-btn ${isActive ? 'active' : ''}"
            data-tool="${t.id}"
            aria-label="${t.label} (${t.shortcut})"
            aria-pressed="${isActive}"
            title="${t.label} (${t.shortcut})"
          >
            <span class="wb-tool-icon">${t.icon}</span>
            <span class="wb-tool-key">${t.shortcut}</span>
          </button>
        `;
          })
          .join('')}
        ${
          canEdit
            ? `<div class="wb-split-wrap">
                <button
                  type="button"
                  class="wb-tool-btn wb-split-main ${app.activeTool === 'arrow' ? 'active' : ''}"
                  id="btn-quick-arrow"
                  data-quick-arrow="simple-sketch"
                  aria-label="Arrow tool"
                  title="Arrow tool with the current preset — drag on the canvas (Alt: open arrow tabs)"
                >
                  <span class="wb-tool-icon">${(TOOL_REGISTRY.find((t) => t.id === 'arrow') || {}).icon || '↗'}</span>
                  <span class="wb-tool-key">↗</span>
                </button>
                <button
                  type="button"
                  class="wb-tool-btn wb-split-caret"
                  id="btn-quick-arrow-more"
                  aria-haspopup="menu"
                  aria-expanded="false"
                  aria-label="Arrow options"
                  title="Arrow options — presets, route and heads"
                >▾</button>
                <div class="wb-insert-popover wb-arrow-popover wb-hidden" id="wb-arrow-popover" role="menu" aria-label="Arrow options"></div>
              </div>`
            : ''
        }
        ${
          !canEdit
            ? `<button type="button" class="wb-tool-btn" id="btn-focus-qa" aria-label="Classroom Participation" title="Open Classroom Participation & Questions">${ICONS.classroom}<span class="wb-tool-key">QA</span></button>`
            : !app.focusMode
              ? `<div class="wb-insert-wrap">
                  <button
                    type="button"
                    class="wb-tool-btn ${advancedTools.some((t) => t.id === app.activeTool) ? 'active' : ''}"
                    id="btn-insert-more"
                    aria-label="Insert More Tools, Shapes, Media & Customize Dock"
                    title="More Tools, Shapes, Media & Customize Dock (+)"
                  >
                    <span class="wb-tool-icon">${ICONS.plus || '+'}</span>
                    <span class="wb-tool-key">+</span>
                  </button>
                  <div class="wb-insert-popover wb-hidden" id="wb-insert-popover" role="menu">
                    <div class="wb-prop-title" style="margin-bottom:4px;">More Tools & Media</div>
                    ${advancedTools
                      .map(
                        (t) => `
                      <button type="button" class="wb-menu-item ${app.activeTool === t.id ? 'active' : ''}" data-insert-tool="${t.id}">
                        ${t.icon} <span>${escapeXml(t.label)}</span> <kbd style="margin-left:auto;font-size:10px;opacity:0.7;">${escapeXml(t.shortcut)}</kbd>
                      </button>
                    `
                      )
                      .join('')}
                    <hr style="border:none;border-top:1px solid var(--border-subtle);margin:4px 0;"/>
                    <button type="button" class="wb-menu-item" data-insert-math="ruler">📏 Ruler Overlay</button>
                    <button type="button" class="wb-menu-item" data-insert-math="protractor">📐 Protractor Overlay</button>
                    <button type="button" class="wb-menu-item" id="btn-insert-mermaid-quick">${ICONS.mermaid} Mermaid Diagram…</button>
                    <hr style="border:none;border-top:1px solid var(--border-subtle);margin:4px 0;"/>
                    <button type="button" class="wb-menu-item" id="btn-popover-customize-tools">${ICONS.sliders} Customize Pinned Tools…</button>
                  </div>
                </div>`
              : `<button type="button" class="wb-tool-btn" id="btn-focus-qa" aria-label="Classroom Questions" title="Open Classroom Questions">${ICONS.classroom}<span class="wb-tool-key">QA</span></button>
                 <button type="button" class="wb-tool-btn" id="btn-focus-customize" aria-label="Customize Focus Tools" title="Customize Focus Tools">${ICONS.sliders}</button>`
        }
      </div>
      ${
        canEdit
          ? `<div class="wb-dock-footer">
              <button
                type="button"
                class="wb-tool-btn"
                id="btn-customize-dock"
                aria-label="Customize Pinned Tools"
                title="Customize Pinned Tools for ${escapeXml(WORKSPACE_PRESETS[app.activePreset]?.label || 'Preset')}"
              >
                <span class="wb-tool-icon">${ICONS.sliders}</span>
              </button>
              <button
                type="button"
                class="wb-tool-btn ${app.toolLock ? 'active' : ''}"
                id="btn-tool-lock"
                aria-label="Lock active tool (Shift+Q)"
                aria-pressed="${app.toolLock}"
                title="Keep current tool active after drawing (Shift+Q)"
              >
                <span class="wb-tool-icon">${ICONS.lock}</span>
              </button>
            </div>`
          : ''
      }
      ${brushDrawerMarkup()}
    `;

    dock.querySelectorAll('[data-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const toolId = btn.dataset.tool;
        if (toolId === 'image') {
          document.getElementById('wb-file-image')?.click();
        } else {
          app.setTool(toolId);
        }
      });
    });

    const insertBtn = dock.querySelector('#btn-insert-more');
    const insertPop = dock.querySelector('#wb-insert-popover');
    insertBtn?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      insertPop?.classList.toggle('wb-hidden');
    });

    const arrowPop = dock.querySelector('#wb-arrow-popover');
    const arrowCaret = dock.querySelector('#btn-quick-arrow-more');

    // Keep the tabs' active marks in step with what was just applied without
    // rebuilding the dock (which would close the popover mid-edit).
    const refreshArrowTabState = () => {
      if (!arrowPop) return;
      const s = arrowStyleSeed();
      arrowPop.querySelectorAll('[data-arrow-routing]').forEach((btn) => {
        const on = btn.dataset.arrowRouting === s.routing;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      arrowPop.querySelectorAll('[data-arrow-start]').forEach((btn) => {
        const on = btn.dataset.arrowStart === s.startArrow;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      arrowPop.querySelectorAll('[data-arrow-end]').forEach((btn) => {
        const on = btn.dataset.arrowEnd === s.endArrow;
        btn.classList.toggle('active', on);
        btn.setAttribute('aria-pressed', String(on));
      });
      const radius = arrowPop.querySelector('#wb-arrow-radius');
      if (radius) {
        radius.value = Math.round(s.cornerRadius);
        radius.disabled = s.routing !== 'rounded-elbow';
        const lab = radius.closest('.wb-prop-row')?.querySelector('span');
        if (lab) lab.textContent = `Corner radius (${Math.round(s.cornerRadius)}px)`;
      }
    };

    const bindArrowPopover = () => {
      if (!arrowPop) return;
      arrowPop.querySelectorAll('[data-arrow-tab]').forEach((tab) => {
        tab.addEventListener('click', (ev) => {
          ev.stopPropagation();
          const name = tab.dataset.arrowTab;
          arrowPop.querySelectorAll('[data-arrow-tab]').forEach((t) => {
            const on = t.dataset.arrowTab === name;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', String(on));
          });
          arrowPop.querySelectorAll('[data-arrow-panel]').forEach((panel) => {
            panel.classList.toggle('wb-hidden', panel.dataset.arrowPanel !== name);
          });
        });
      });
      arrowPop.querySelectorAll('[data-arrow-preset]').forEach((btn) => {
        btn.addEventListener('click', () => {
          toggleArrowPop(false);
          // With arrows selected this restyles them; otherwise it arms the tool.
          app.applyArrowPresetToSelection(btn.dataset.arrowPreset);
          renderDock();
        });
      });
      arrowPop.querySelectorAll('[data-arrow-routing]').forEach((btn) => {
        btn.addEventListener('click', () => {
          app.applyArrowStyle({ routing: btn.dataset.arrowRouting });
          refreshArrowTabState();
        });
      });
      arrowPop.querySelector('#wb-arrow-radius')?.addEventListener('change', (ev) => {
        app.applyArrowStyle({ cornerRadius: Number(ev.target.value) || 14 });
        refreshArrowTabState();
      });
      arrowPop.querySelectorAll('[data-arrow-start]').forEach((btn) => {
        btn.addEventListener('click', () => {
          app.applyArrowStyle({ startArrow: btn.dataset.arrowStart });
          refreshArrowTabState();
        });
      });
      arrowPop.querySelectorAll('[data-arrow-end]').forEach((btn) => {
        btn.addEventListener('click', () => {
          app.applyArrowStyle({ endArrow: btn.dataset.arrowEnd });
          refreshArrowTabState();
        });
      });
      arrowPop.querySelector('#wb-arrow-swap-heads')?.addEventListener('click', () => {
        const s = arrowStyleSeed();
        app.applyArrowStyle({ startArrow: s.endArrow, endArrow: s.startArrow });
        refreshArrowTabState();
      });
      arrowPop.querySelector('#btn-arrow-insert-sample')?.addEventListener('click', (ev) => {
        ev.stopPropagation();
        toggleArrowPop(false);
        app.insertSimpleArrow(app.pendingArrowPreset);
        renderDock();
      });
    };

    // Content is rendered on open so the tabs always reflect the current
    // selection rather than the state from the last dock rebuild.
    const toggleArrowPop = (open) => {
      const next = open ?? arrowPop?.classList.contains('wb-hidden');
      if (next && arrowPop) {
        arrowPop.innerHTML = arrowPopoverMarkup();
        bindArrowPopover();
      }
      arrowPop?.classList.toggle('wb-hidden', !next);
      arrowCaret?.setAttribute('aria-expanded', String(Boolean(next)));
    };
    dock.querySelector('#btn-quick-arrow')?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (ev.altKey) {
        toggleArrowPop();
        return;
      }
      toggleArrowPop(false);
      app.armArrowTool();
      renderDock();
    });
    arrowCaret?.addEventListener('click', (ev) => {
      ev.stopPropagation();
      toggleArrowPop();
    });
    if (!dock.dataset.arrowDismissBound) {
      dock.dataset.arrowDismissBound = '1';
      document.addEventListener('pointerdown', (ev) => {
        const pop = document.getElementById('wb-arrow-popover');
        if (!pop || pop.classList.contains('wb-hidden')) return;
        if (ev.target.closest?.('.wb-split-wrap')) return;
        pop.classList.add('wb-hidden');
        document.getElementById('btn-quick-arrow-more')?.setAttribute('aria-expanded', 'false');
      });
    }

    bindBrushDrawerSafely(dock);

    dock.querySelectorAll('[data-insert-tool]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const tid = btn.dataset.insertTool;
        insertPop?.classList.add('wb-hidden');
        if (tid === 'image') {
          document.getElementById('wb-file-image')?.click();
        } else {
          app.setTool(tid);
        }
      });
    });

    dock.querySelectorAll('[data-insert-math]').forEach((btn) => {
      btn.addEventListener('click', () => {
        insertPop?.classList.add('wb-hidden');
        app.insertMathOverlay(btn.dataset.insertMath);
      });
    });

    dock.querySelector('#btn-insert-mermaid-quick')?.addEventListener('click', () => {
      insertPop?.classList.add('wb-hidden');
      app.dialogs.openMermaidModal();
    });

    dock.querySelector('#btn-popover-customize-tools')?.addEventListener('click', () => {
      insertPop?.classList.add('wb-hidden');
      app.dialogs.openFocusToolsModal(app.activePreset);
    });

    dock.querySelector('#btn-customize-dock')?.addEventListener('click', () => {
      app.dialogs.openFocusToolsModal(app.activePreset);
    });

    dock.querySelector('#btn-focus-qa')?.addEventListener('click', () => app.classroomUI.toggle());
    dock.querySelector('#btn-focus-customize')?.addEventListener('click', () => app.dialogs.openFocusToolsModal(app.activePreset));

    dock.querySelector('#btn-tool-lock')?.addEventListener('click', () => {
      app.toolLock = !app.toolLock;
      renderDock();
    });
  }

  function renderModeBanner() {
    if (!modeBanner) return;
    const pills = [];

    if (app.spotlight.active) {
      const pct = Math.round((app.spotlight.dimOpacity ?? 0.72) * 100);
      pills.push(`
        <div class="wb-floating-mode-pill wb-spotlight-pill" id="wb-spotlight-banner" role="region" aria-label="Spotlight Controls">
          <strong>Spotlight on · Esc to exit</strong>
          <div class="wb-btn-group">
            <button type="button" class="wb-btn wb-sm ${!app.spotlight.magnifier ? 'active wb-primary' : ''}" id="btn-spot-mode-dim">Spotlight</button>
            <button type="button" class="wb-btn wb-sm ${app.spotlight.magnifier ? 'active wb-primary' : ''}" id="btn-spot-mode-mag">Magnifier 2x</button>
          </div>
          <label class="wb-spot-slider" title="Spotlight Radius">
            <span>Radius ${Math.round(app.spotlight.radius)}px</span>
            <input type="range" id="spot-radius-slider" min="60" max="280" value="${Math.round(app.spotlight.radius)}" aria-label="Spotlight Radius"/>
          </label>
          <label class="wb-spot-slider" title="Backdrop Dimming">
            <span>Dim ${pct}%</span>
            <input type="range" id="spot-dim-slider" min="25" max="90" value="${pct}" aria-label="Spotlight Dimming"/>
          </label>
          <button type="button" class="wb-btn wb-sm wb-danger" id="btn-exit-spotlight" aria-label="Exit Spotlight">✕ Close</button>
        </div>
      `);
    }

    if (app.activeTool === 'laser') {
      pills.push(`
        <div class="wb-floating-mode-pill">
          <span>🔴 Laser Pointer active · Esc to exit</span>
          <button type="button" class="wb-btn wb-sm" id="btn-exit-laser">✕ Exit</button>
        </div>
      `);
    }

    if (app.annotationMode) {
      pills.push(`
        <div class="wb-floating-mode-pill">
          <span>✨ Fading Annotation Mode (3s ink) · Esc to exit</span>
          <button type="button" class="wb-btn wb-sm" id="btn-exit-annotation">✕ Exit</button>
        </div>
      `);
    }

    if (app.votingUI?.isActive?.()) {
      const dots = totalVotes(app.getPage().elements);
      pills.push(`
        <div class="wb-floating-mode-pill">
          <span>🔵 Dot voting open · ${dots} vote${dots === 1 ? '' : 's'} · click items to vote</span>
          ${
            app.votingUI.canControl()
              ? `<button type="button" class="wb-btn wb-sm wb-primary" id="btn-stop-vote" title="Close voting and show the top-3 results">Stop & Results</button>
                 <button type="button" class="wb-btn wb-sm wb-danger" id="btn-reset-votes" title="Clear every vote on this page">Reset</button>`
              : ''
          }
        </div>
      `);
    }

    if (app.focusMode) {
      const pages = app.scene.pages;
      const curIdx = pages.findIndex((p) => p.id === app.scene.activePageId);
      pills.push(`
        <div class="wb-floating-mode-pill">
          <span>🎯 Teaching Focus · Page ${curIdx + 1}/${pages.length}</span>
          <button type="button" class="wb-btn wb-sm" id="btn-focus-prev-page" ${curIdx <= 0 ? 'disabled' : ''}>◀ Prev</button>
          <button type="button" class="wb-btn wb-sm" id="btn-focus-next-page" ${curIdx >= pages.length - 1 ? 'disabled' : ''}>Next ▶</button>
          <button type="button" class="wb-btn wb-sm" id="btn-exit-focus">✕ Exit Focus</button>
        </div>
      `);
    }

    if (app.collab?.followingTeacher) {
      pills.push(`
        <div class="wb-floating-mode-pill wb-follow-pill">
          <span>👁 Following Teacher Camera</span>
          <button type="button" class="wb-btn wb-sm wb-danger" id="btn-banner-stop-follow">Stop Following</button>
        </div>
      `);
    }

    if (app.updateAvailable) {
      pills.push(`
        <div class="wb-floating-mode-pill" id="wb-update-banner" role="status">
          <span>🔄 Update available (${escapeXml(app.updateVersionLabel || 'latest')}) · Current board is saved</span>
          <button type="button" class="wb-btn wb-sm wb-primary" id="btn-apply-app-update">Save & Reload</button>
          <button type="button" class="wb-btn wb-sm" id="btn-dismiss-app-update">Later</button>
        </div>
      `);
    }

    if (pills.length === 0) {
      modeBanner.classList.add('wb-hidden');
      modeBanner.innerHTML = '';
      return;
    }

    modeBanner.classList.remove('wb-hidden');
    modeBanner.innerHTML = pills.join('');

    modeBanner.querySelector('#btn-spot-mode-dim')?.addEventListener('click', () => {
      app.spotlight.magnifier = false;
      renderModeBanner();
      app.requestRender();
    });
    modeBanner.querySelector('#btn-spot-mode-mag')?.addEventListener('click', () => {
      app.spotlight.magnifier = true;
      renderModeBanner();
      app.requestRender();
    });
    modeBanner.querySelector('#spot-radius-slider')?.addEventListener('input', (e) => {
      app.spotlight.radius = Number(e.target.value);
      renderModeBanner();
      app.requestRender();
    });
    modeBanner.querySelector('#spot-dim-slider')?.addEventListener('input', (e) => {
      app.spotlight.dimOpacity = Number(e.target.value) / 100;
      renderModeBanner();
      app.requestRender();
    });
    modeBanner.querySelector('#btn-exit-spotlight')?.addEventListener('click', () => {
      app.spotlight.active = false;
      app.updateUI();
      app.requestRender();
    });
    modeBanner.querySelector('#btn-exit-laser')?.addEventListener('click', () => app.setTool('select'));
    modeBanner.querySelector('#btn-exit-annotation')?.addEventListener('click', () => app.toggleAnnotationMode());
    modeBanner.querySelector('#btn-stop-vote')?.addEventListener('click', () => app.votingUI.stop());
    modeBanner.querySelector('#btn-reset-votes')?.addEventListener('click', () => app.votingUI.reset());
    modeBanner.querySelector('#btn-exit-focus')?.addEventListener('click', () => app.toggleFocusMode());
    modeBanner.querySelector('#btn-focus-prev-page')?.addEventListener('click', () => {
      const idx = app.scene.pages.findIndex((p) => p.id === app.scene.activePageId);
      if (idx > 0) app.switchPage(app.scene.pages[idx - 1].id);
    });
    modeBanner.querySelector('#btn-focus-next-page')?.addEventListener('click', () => {
      const idx = app.scene.pages.findIndex((p) => p.id === app.scene.activePageId);
      if (idx < app.scene.pages.length - 1) app.switchPage(app.scene.pages[idx + 1].id);
    });
    modeBanner.querySelector('#btn-banner-stop-follow')?.addEventListener('click', () => {
      app.collab?.setFollowTeacher(false);
    });
    modeBanner.querySelector('#btn-apply-app-update')?.addEventListener('click', () => {
      app.applyAppUpdate?.();
    });
    modeBanner.querySelector('#btn-dismiss-app-update')?.addEventListener('click', () => {
      app.updateAvailable = false;
      renderModeBanner();
    });
  }

  function renderBottomBar(forceRebuild = false) {
    if (!bottomBar) return;
    const zoomPct = Math.round((app.getCamera ? app.getCamera().zoom : app.getPage().camera.zoom) * 100);
    const existingReset = bottomBar.querySelector('#btn-zoom-reset');
    const existingMinimap = bottomBar.querySelector('#btn-minimap');
    const existingView = bottomBar.querySelector('#btn-view-notebook');
    if (!forceRebuild && existingReset && existingMinimap && existingView) {
      existingReset.textContent = `${zoomPct}%`;
      existingMinimap.classList.toggle('active', Boolean(app.minimapOpen));
      const mode = app.viewMode || 'diagram';
      bottomBar.querySelector('#btn-view-diagram')?.classList.toggle('active', mode === 'diagram');
      bottomBar.querySelector('#btn-view-notebook')?.classList.toggle('active', mode === 'notebook');
      return;
    }
    bottomBar.innerHTML = `
      <div class="wb-view-controls" role="group" aria-label="Workspace View">
        <button type="button" class="wb-btn wb-sm ${(app.viewMode || 'diagram') === 'diagram' ? 'active' : ''}" id="btn-view-diagram" title="Diagram view — freeform page workspace">▦ Diagram</button>
        <button type="button" class="wb-btn wb-sm ${app.viewMode === 'notebook' ? 'active' : ''}" id="btn-view-notebook" title="Notebook view — vertically stacked lesson pages">▤ Notebook</button>
      </div>
      <div class="wb-zoom-controls">
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-out" aria-label="Zoom Out (-)">−</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-reset" aria-label="Reset Zoom to 100%">${zoomPct}%</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-in" aria-label="Zoom In (+)">+</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-fit" title="Fit Entire Board (Shift+1)">Fit Board</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-sel" title="Zoom to Selection (Shift+2)">Zoom Sel</button>
        <button type="button" class="wb-btn wb-sm ${app.minimapOpen ? 'active' : ''}" id="btn-minimap" title="Toggle Minimap">Map</button>
      </div>
    `;
    bottomBar.querySelector('#btn-view-diagram')?.addEventListener('click', () => app.setViewMode('diagram'));
    bottomBar.querySelector('#btn-view-notebook')?.addEventListener('click', () => app.setViewMode('notebook'));
    bottomBar.querySelector('#btn-zoom-out')?.addEventListener('click', () => {
      if (app.viewMode === 'notebook') {
        app.notebookView?.setScale((app.notebookView.getScale?.() || 0.55) / 1.15);
      } else {
        app.zoomBy(1 / 1.2);
      }
    });
    bottomBar.querySelector('#btn-zoom-in')?.addEventListener('click', () => {
      if (app.viewMode === 'notebook') {
        app.notebookView?.setScale((app.notebookView.getScale?.() || 0.55) * 1.15);
      } else {
        app.zoomBy(1.2);
      }
    });
    bottomBar.querySelector('#btn-zoom-reset')?.addEventListener('click', () => {
      if (app.viewMode === 'notebook') app.notebookView?.setScale(0.55);
      else app.resetZoom();
    });
    bottomBar.querySelector('#btn-zoom-fit')?.addEventListener('click', () => app.fitToContent());
    bottomBar.querySelector('#btn-zoom-sel')?.addEventListener('click', () => app.zoomToSelection());
    bottomBar.querySelector('#btn-minimap')?.addEventListener('click', () => {
      app.minimapOpen = !app.minimapOpen;
      renderBottomBar();
      app.requestRender();
    });
  }

  renderTopBar();
  renderDock();
  renderModeBanner();
  renderBottomBar();

  return {
    update() {
      const preset = app.activePreset || 'diagram';
      topBar?.querySelectorAll('[data-preset]').forEach((btn) => {
        const isAct = btn.dataset.preset === preset;
        btn.classList.toggle('active', isAct);
        btn.setAttribute('aria-pressed', String(isAct));
      });
      topBar?.querySelector('#btn-quick-present')?.classList.toggle('wb-hidden', preset === 'diagram');
      topBar?.querySelector('#btn-quick-timer')?.classList.toggle('wb-hidden', preset === 'diagram');
      renderDock();
      renderModeBanner();
      renderBottomBar();
      const page = app.getPage();
      const undoBtn = topBar?.querySelector('#btn-undo');
      const redoBtn = topBar?.querySelector('#btn-redo');
      const libBtn = topBar?.querySelector('#btn-library');
      const layersBtn = topBar?.querySelector('#btn-layers');
      const clsBtn = topBar?.querySelector('#btn-classroom');
      const spotBtn = topBar?.querySelector('#btn-spotlight');
      const annBtn = topBar?.querySelector('#btn-annotation-mode');
      const propsBtn = topBar?.querySelector('#btn-props-toggle');
      const clsLabel = topBar?.querySelector('#wb-classroom-label');
      const titleInput = topBar?.querySelector('#wb-doc-title');
      const connPill = topBar?.querySelector('#wb-conn-status');

      const isPanelOpen = (id) => {
        const el = document.getElementById(id);
        return Boolean(el && !el.classList.contains('wb-hidden'));
      };

      const canEdit = app.collab ? app.collab.canEditBoard() : true;
      const hasPageUndo = Array.isArray(app.pageUndoStack) && app.pageUndoStack.length > 0;
      if (undoBtn) {
        undoBtn.disabled = !canEdit || (!app.history.canUndo(page.id) && !hasPageUndo);
        undoBtn.classList.toggle('wb-hidden', !canEdit);
      }
      if (redoBtn) {
        redoBtn.disabled = !canEdit || !app.history.canRedo(page.id);
        redoBtn.classList.toggle('wb-hidden', !canEdit);
      }
      if (libBtn) {
        const open = isPanelOpen('wb-library-panel');
        libBtn.classList.toggle('active', open);
        libBtn.setAttribute('aria-pressed', String(open));
        libBtn.classList.toggle('wb-hidden', !canEdit);
      }
      topBar?.querySelector('#btn-mermaid')?.classList.toggle('wb-hidden', !canEdit);
      topBar?.querySelector('#btn-auto-layout-board')?.classList.toggle('wb-hidden', !canEdit);
      topBar?.querySelector('#btn-open-json')?.classList.toggle('wb-hidden', !canEdit);
      topBar?.querySelector('#btn-recovery')?.classList.toggle('wb-hidden', !canEdit);
      if (titleInput) {
        titleInput.readOnly = !canEdit;
      }
      if (layersBtn) {
        const open = isPanelOpen('wb-layers-panel');
        layersBtn.classList.toggle('active', open);
        layersBtn.setAttribute('aria-pressed', String(open));
      }
      if (clsBtn) {
        const open = isPanelOpen('wb-classroom-panel');
        clsBtn.classList.toggle('active', open);
        clsBtn.setAttribute('aria-pressed', String(open));
      }
      if (spotBtn) spotBtn.classList.toggle('active', app.spotlight.active && !app.spotlight.magnifier);
      if (annBtn) annBtn.classList.toggle('active', app.annotationMode);
      if (propsBtn) {
        const open = isPanelOpen('wb-props-panel');
        propsBtn.classList.toggle('active', open);
        propsBtn.setAttribute('aria-pressed', String(open));
      }
      if (titleInput && document.activeElement !== titleInput) {
        titleInput.value = app.scene.title || 'StudioBoard Lesson';
      }
      if (connPill && app.collab) {
        connPill.textContent = app.collab.statusMessage || 'Local board';
        connPill.classList.toggle('wb-conn-live', app.collab.status === 'live');
        connPill.classList.toggle('wb-conn-offline', app.collab.status === 'offline' || app.collab.status === 'error');
      }
      if (clsLabel) {
        const qCount = page.elements.filter((e) => e.type === 'question' && !e.resolved && !e.hidden).length;
        clsLabel.textContent = qCount > 0 ? `Classroom (${qCount})` : 'Classroom';
      }
    },
  };
}
