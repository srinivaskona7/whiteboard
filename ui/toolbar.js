// ui/toolbar.js — Top Bar, Compact Primary Toolset, Insert Menu, Spotlight Banner & Zoom Controls
import { TOOL_REGISTRY, ICONS } from './registry.js';
import { escapeXml } from '../render/svg-export.js';

export const PRIMARY_TOOL_IDS = [
  'select',
  'hand',
  'pen',
  'highlighter',
  'eraser',
  'rect',
  'arrow',
  'text',
  'sticky',
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
        <button type="button" class="wb-btn" id="btn-undo" aria-label="Undo (Ctrl+Z)" title="Undo (Ctrl/Cmd+Z)">${ICONS.undo}</button>
        <button type="button" class="wb-btn" id="btn-redo" aria-label="Redo (Ctrl+Shift+Z)" title="Redo (Ctrl+Shift+Z)">${ICONS.redo}</button>
        <span class="wb-sep"></span>
        <button type="button" class="wb-btn" id="btn-library" aria-label="Toggle Stencil & Template Library" title="DevOps & Cloud Icon Library">${ICONS.library} <span class="wb-hide-sm">Library</span></button>
        <button type="button" class="wb-btn" id="btn-layers" aria-label="Toggle Layers Panel" title="Layers & Z-Order">${ICONS.layers} <span class="wb-hide-sm">Layers</span></button>
        <button type="button" class="wb-btn" id="btn-classroom" aria-label="Toggle Live Classroom & Questions" title="Live Classroom Share, Pointers & Student Questions">${ICONS.classroom} <span class="wb-hide-sm" id="wb-classroom-label">Classroom</span></button>
        <button type="button" class="wb-btn" id="btn-props-toggle" aria-label="Toggle Inspector Panel" title="Toggle Style & Properties Inspector (I)">${ICONS.sliders} <span class="wb-hide-sm">Inspector</span></button>

        <div class="wb-dropdown">
          <button type="button" class="wb-btn" id="btn-teaching-menu" aria-haspopup="true" title="Teaching & Classroom Tools">${ICONS.teaching} <span class="wb-hide-sm">Teaching ▾</span></button>
          <div class="wb-dropdown-menu wb-hidden" id="menu-teaching">
            <button type="button" class="wb-menu-item" id="btn-present">${ICONS.present} Presentation Mode (F6)</button>
            <button type="button" class="wb-menu-item" id="btn-reveal-timeline">${ICONS.timeline} Step-by-Step Reveal Timeline</button>
            <button type="button" class="wb-menu-item" id="btn-spotlight">${ICONS.spotlight} Spotlight (F7)</button>
            <button type="button" class="wb-menu-item" id="btn-magnifier">${ICONS.spotlight} Magnifier Lens 2x</button>
            <button type="button" class="wb-menu-item" id="btn-annotation-mode">${ICONS.annotation} Live Annotation Mode (F8)</button>
            <button type="button" class="wb-menu-item" id="btn-timer">${ICONS.timer} Countdown / Stopwatch</button>
            <button type="button" class="wb-menu-item" id="btn-focus-mode">${ICONS.focus} Teaching Focus Mode (F10)</button>
            <button type="button" class="wb-menu-item" id="btn-customize-focus">${ICONS.sliders} Customize Focus Tools…</button>
          </div>
        </div>
      </div>

      <div class="wb-top-right">
        <button type="button" class="wb-btn" id="btn-palette" aria-label="Command Palette (Ctrl+K)" title="Command Palette (Ctrl/Cmd+K)">${ICONS.search} <span class="wb-hide-md">⌘K</span></button>
        <button type="button" class="wb-btn" id="btn-theme" aria-label="Toggle Theme" title="Cycle Light / Dark / Chalkboard / Blueprint Theme">${ICONS.theme}</button>

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
    topBar.querySelector('#btn-timer')?.addEventListener('click', () => app.timerUI.toggle());
    topBar.querySelector('#btn-present')?.addEventListener('click', () => app.presentUI.enter());
    topBar.querySelector('#btn-reveal-timeline')?.addEventListener('click', () => app.dialogs.openRevealTimelineModal());
    topBar.querySelector('#btn-spotlight')?.addEventListener('click', () => app.toggleSpotlight(false));
    topBar.querySelector('#btn-magnifier')?.addEventListener('click', () => app.toggleSpotlight(true));
    topBar.querySelector('#btn-annotation-mode')?.addEventListener('click', () => app.toggleAnnotationMode());
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

  function renderDock() {
    if (!dock) return;
    const focusSet = new Set(
      app.focusToolIds || ['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'question']
    );
    const visibleTools = app.focusMode
      ? TOOL_REGISTRY.filter((t) => focusSet.has(t.id))
      : PRIMARY_TOOLS;

    const advancedTools = TOOL_REGISTRY.filter((t) => !PRIMARY_TOOL_IDS.includes(t.id));

    dock.innerHTML = `
      <div class="wb-tool-list" role="toolbar" aria-label="Drawing Tools">
        ${visibleTools
          .map(
            (t) => `
          <button
            type="button"
            class="wb-tool-btn ${app.activeTool === t.id ? 'active' : ''}"
            data-tool="${t.id}"
            aria-label="${t.label} (${t.shortcut})"
            aria-pressed="${app.activeTool === t.id}"
            title="${t.label} (${t.shortcut})"
          >
            <span class="wb-tool-icon">${t.icon}</span>
            <span class="wb-tool-key">${t.shortcut}</span>
          </button>
        `
          )
          .join('')}
        ${
          !app.focusMode
            ? `<div class="wb-insert-wrap">
                <button
                  type="button"
                  class="wb-tool-btn ${advancedTools.some((t) => t.id === app.activeTool) ? 'active' : ''}"
                  id="btn-insert-more"
                  aria-label="Insert Advanced Shapes, Images, Tables, Code, Stamps & Math"
                  title="Insert Shapes, Images, Tables, Code, Stamps & Math (+)"
                >
                  <span class="wb-tool-icon">${ICONS.plus || '+'}</span>
                  <span class="wb-tool-key">+</span>
                </button>
                <div class="wb-insert-popover wb-hidden" id="wb-insert-popover" role="menu">
                  <div class="wb-prop-title" style="margin-bottom:4px;">Insert Shapes & Media</div>
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
                </div>
              </div>`
            : `<button type="button" class="wb-tool-btn" id="btn-focus-qa" aria-label="Classroom Questions" title="Open Classroom Questions">${ICONS.classroom}<span class="wb-tool-key">QA</span></button>
               <button type="button" class="wb-tool-btn" id="btn-focus-customize" aria-label="Customize Focus Tools" title="Customize Focus Tools">${ICONS.sliders}</button>`
        }
      </div>
      <div class="wb-dock-footer">
        <button
          type="button"
          class="wb-tool-btn ${app.toolLock ? 'active' : ''}"
          id="btn-tool-lock"
          aria-label="Lock active tool (Q)"
          aria-pressed="${app.toolLock}"
          title="Keep current tool active after drawing"
        >
          <span class="wb-tool-icon">${ICONS.lock}</span>
        </button>
      </div>
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

    dock.querySelector('#btn-focus-qa')?.addEventListener('click', () => app.classroomUI.toggle());
    dock.querySelector('#btn-focus-customize')?.addEventListener('click', () => app.dialogs.openFocusToolsModal());

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
        <div class="wb-floating-mode-pill">
          <span>👁 Following Teacher Camera</span>
          <button type="button" class="wb-btn wb-sm wb-danger" id="btn-banner-stop-follow">Stop Following</button>
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
  }

  function renderBottomBar() {
    if (!bottomBar) return;
    const zoomPct = Math.round(app.getPage().camera.zoom * 100);
    bottomBar.innerHTML = `
      <div class="wb-zoom-controls">
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-out" aria-label="Zoom Out (-)">−</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-reset" aria-label="Reset Zoom to 100%">${zoomPct}%</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-in" aria-label="Zoom In (+)">+</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-fit" title="Fit Entire Board (Shift+1)">Fit Board</button>
        <button type="button" class="wb-btn wb-sm" id="btn-zoom-sel" title="Zoom to Selection (Shift+2)">Zoom Sel</button>
        <button type="button" class="wb-btn wb-sm ${app.minimapOpen ? 'active' : ''}" id="btn-minimap" title="Toggle Minimap">Map</button>
      </div>
    `;
    bottomBar.querySelector('#btn-zoom-out')?.addEventListener('click', () => app.zoomBy(1 / 1.2));
    bottomBar.querySelector('#btn-zoom-in')?.addEventListener('click', () => app.zoomBy(1.2));
    bottomBar.querySelector('#btn-zoom-reset')?.addEventListener('click', () => app.resetZoom());
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
      renderDock();
      renderModeBanner();
      renderBottomBar();
      const page = app.getPage();
      const undoBtn = topBar?.querySelector('#btn-undo');
      const redoBtn = topBar?.querySelector('#btn-redo');
      const spotBtn = topBar?.querySelector('#btn-spotlight');
      const annBtn = topBar?.querySelector('#btn-annotation-mode');
      const propsBtn = topBar?.querySelector('#btn-props-toggle');
      const clsLabel = topBar?.querySelector('#wb-classroom-label');
      const titleInput = topBar?.querySelector('#wb-doc-title');
      const connPill = topBar?.querySelector('#wb-conn-status');

      if (undoBtn) undoBtn.disabled = !app.history.canUndo(page.id);
      if (redoBtn) redoBtn.disabled = !app.history.canRedo(page.id);
      if (spotBtn) spotBtn.classList.toggle('active', app.spotlight.active && !app.spotlight.magnifier);
      if (annBtn) annBtn.classList.toggle('active', app.annotationMode);
      if (propsBtn) propsBtn.classList.toggle('active', Boolean(app.propsDrawerOpen));
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
