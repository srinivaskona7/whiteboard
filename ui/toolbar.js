// ui/toolbar.js
import { TOOL_REGISTRY, ICONS } from './registry.js';

export const PRIMARY_TOOLS = TOOL_REGISTRY;

export function initToolbar(app) {
  const dock = document.getElementById('wb-toolbar');
  const topBar = document.getElementById('wb-topbar-actions');
  const bottomBar = document.getElementById('wb-zoom-bar');
  if (!dock || !topBar || !bottomBar) return {};

  const dockTools = TOOL_REGISTRY.filter((t) => t.group === 'dock');
  const insertTools = TOOL_REGISTRY.filter((t) => t.group === 'insert');

  // Build Reduced Floating Tool Dock + Insert (+) Popover
  dock.innerHTML = `
    <div class="wb-dock-scroll" role="group" aria-label="Primary Drawing Tools">
      ${dockTools
        .map(
          (t) => `
        <button
          type="button"
          class="wb-tool-btn"
          data-tool="${t.id}"
          aria-label="${t.label} (${t.shortcut})"
          title="${t.label} (${t.shortcut})"
        >
          <span class="wb-tool-icon">${t.icon}</span>
          <span class="wb-tool-key">${t.shortcut}</span>
        </button>
      `
        )
        .join('')}
      <button
        type="button"
        class="wb-tool-btn"
        data-tool="laser"
        aria-label="Laser Pointer (K)"
        title="Laser Pointer (K)"
      >
        <span class="wb-tool-icon">${ICONS.laser}</span>
        <span class="wb-tool-key">K</span>
      </button>
      <div class="wb-dock-divider"></div>
      <button
        type="button"
        class="wb-tool-btn"
        id="btn-dock-insert"
        aria-label="Insert More Tools (Table, Code, Frame, Image, Stamp)"
        aria-expanded="false"
        title="Insert Table, Code, Frame, Image, Stamp & Math Tools"
      >
        <span class="wb-tool-icon">${ICONS.plus}</span>
        <span class="wb-tool-key">+</span>
      </button>
    </div>
    <div id="wb-insert-popover" class="wb-popover wb-hidden" role="menu" aria-label="Insert Tools Menu">
      <div class="wb-popover-title">Insert Elements</div>
      ${insertTools
        .map(
          (t) => `
        <button type="button" class="wb-popover-item" role="menuitem" data-tool="${t.id}" aria-label="${t.label} (${t.shortcut})">
          <span class="wb-popover-icon">${t.icon}</span>
          <span class="wb-popover-label">${t.label}</span>
          <kbd>${t.shortcut}</kbd>
        </button>
      `
        )
        .join('')}
      <button type="button" class="wb-popover-item" role="menuitem" id="btn-insert-image" aria-label="Insert Image (I)">
        <span class="wb-popover-icon">${ICONS.image}</span>
        <span class="wb-popover-label">Insert Image</span>
        <kbd>I</kbd>
      </button>
      <button type="button" class="wb-popover-item" role="menuitem" id="btn-insert-mermaid" aria-label="Import Mermaid Diagram">
        <span class="wb-popover-icon">${ICONS.mermaid}</span>
        <span class="wb-popover-label">Mermaid Diagram</span>
      </button>
      <div class="wb-popover-sep"></div>
      <button type="button" class="wb-popover-item" role="menuitem" data-insert-math="ruler" aria-label="Insert Ruler Overlay">
        <span class="wb-popover-label">📏 Ruler Overlay</span>
      </button>
      <button type="button" class="wb-popover-item" role="menuitem" data-insert-math="protractor" aria-label="Insert Protractor Overlay">
        <span class="wb-popover-label">📐 Protractor Overlay</span>
      </button>
    </div>
  `;

  const insertPopover = dock.querySelector('#wb-insert-popover');
  const insertBtn = dock.querySelector('#btn-dock-insert');

  const closeInsertPopover = () => {
    insertPopover?.classList.add('wb-hidden');
    insertBtn?.setAttribute('aria-expanded', 'false');
  };

  dock.addEventListener('click', (ev) => {
    if (ev.target.closest('#btn-dock-insert')) {
      const hidden = insertPopover.classList.toggle('wb-hidden');
      insertBtn.setAttribute('aria-expanded', String(!hidden));
      return;
    }
    const toolBtn = ev.target.closest('[data-tool]');
    if (toolBtn) {
      app.setTool(toolBtn.dataset.tool);
      closeInsertPopover();
      return;
    }
    if (ev.target.closest('#btn-insert-image')) {
      closeInsertPopover();
      app.openImageFilePicker();
      return;
    }
    if (ev.target.closest('#btn-insert-mermaid')) {
      closeInsertPopover();
      app.dialogs.openMermaidModal();
      return;
    }
    const mathBtn = ev.target.closest('[data-insert-math]');
    if (mathBtn) {
      closeInsertPopover();
      app.insertMathOverlay(mathBtn.dataset.insertMath);
    }
  });

  // Build Top Action Bar with Teaching Menu, File Actions, and Style Drawer Trigger
  topBar.innerHTML = `
    <button type="button" class="wb-btn" id="btn-toggle-library" aria-label="Toggle Stencil Library & Templates" title="Stencils, DevOps Diagram Packs & Templates">
      ${ICONS.library} <span class="wb-btn-label">Library</span>
    </button>
    <button type="button" class="wb-btn" id="btn-toggle-layers" aria-label="Toggle Layers Panel" title="Layers & Locking">
      ${ICONS.layers} <span class="wb-btn-label">Layers</span>
    </button>
    <button type="button" class="wb-btn" id="btn-toggle-classroom" aria-label="Toggle Live Classroom Links, Student Join & Q&A" title="Live Classroom Shareable Link, Student Name Join, Component Pointers & Board Questions">
      ${ICONS.classroom} <span class="wb-btn-label" id="wb-classroom-btn-label">Classroom</span>
    </button>
    <button type="button" class="wb-btn wb-hide-mobile" id="btn-mermaid" aria-label="Import Mermaid Diagram" title="Paste Mermaid Flowchart or Sequence Diagram">
      ${ICONS.mermaid} <span class="wb-btn-label">Mermaid</span>
    </button>

    <div class="wb-menu-wrap">
      <button type="button" class="wb-btn" id="btn-teaching-menu" aria-label="Teaching & Presentation Menu" aria-expanded="false" title="Teaching Tools: Annotate, Spotlight, Timer, Reveal Timeline & Focus Mode">
        ${ICONS.teaching} <span class="wb-btn-label">Teaching ▾</span>
      </button>
      <div id="wb-teaching-popover" class="wb-popover wb-popover-top wb-hidden" role="menu" aria-label="Teaching Menu">
        <button type="button" class="wb-popover-item" role="menuitem" id="btn-annotation-mode" aria-label="Toggle Live Annotation Mode">
          <span class="wb-popover-icon">${ICONS.pen}</span>
          <span class="wb-popover-label">Live Annotate (3s Fading Ink)</span>
        </button>
        <button type="button" class="wb-popover-item" role="menuitem" id="btn-spotlight" aria-label="Toggle Spotlight and Magnifier">
          <span class="wb-popover-icon">${ICONS.spotlight}</span>
          <span class="wb-popover-label">Spotlight & Magnifier</span>
        </button>
        <button type="button" class="wb-popover-item" role="menuitem" id="btn-timer" aria-label="Toggle Classroom Countdown Timer">
          <span class="wb-popover-icon">${ICONS.timer}</span>
          <span class="wb-popover-label">Classroom Timer</span>
        </button>
        <button type="button" class="wb-popover-item" role="menuitem" id="btn-reveal-timeline" aria-label="Open Step-by-Step Reveal Timeline">
          <span class="wb-popover-icon">${ICONS.present}</span>
          <span class="wb-popover-label">Reveal Step Timeline</span>
        </button>
        <button type="button" class="wb-popover-item" role="menuitem" id="btn-focus-mode" aria-label="Toggle Teaching Focus Mode (Shift+F)">
          <span class="wb-popover-icon">${ICONS.teaching}</span>
          <span class="wb-popover-label">Teaching Focus Mode</span>
          <kbd>⇧F</kbd>
        </button>
      </div>
    </div>

    <button type="button" class="wb-btn wb-primary-soft" id="btn-present" aria-label="Enter Presentation Mode" title="Present Frames & Step-by-Step Reveal">
      ${ICONS.present} <span class="wb-btn-label">Present</span>
    </button>

    <div class="wb-divider wb-hide-mobile"></div>

    <button type="button" class="wb-btn wb-hide-mobile" id="btn-save-json" aria-label="Save Whiteboard File (.whiteboard.json)" title="Save .whiteboard.json">
      ${ICONS.save} <span class="wb-btn-label">Save</span>
    </button>
    <button type="button" class="wb-btn wb-hide-mobile" id="btn-open-json" aria-label="Open Whiteboard File (.whiteboard.json)" title="Open .whiteboard.json">
      ${ICONS.open} <span class="wb-btn-label">Open</span>
    </button>
    <button type="button" class="wb-btn" id="btn-export" aria-label="Export PNG, SVG, or Student Handout PDF" title="Export PNG / SVG / Print Handout">
      ${ICONS.export} <span class="wb-btn-label">Export</span>
    </button>
    <button type="button" class="wb-btn wb-hide-mobile" id="btn-share-url" aria-label="Share by URL Hash" title="Share compressed scene in URL hash">
      ${ICONS.share} <span class="wb-btn-label">Share</span>
    </button>
    <button type="button" class="wb-btn wb-hide-mobile" id="btn-recovery" aria-label="Version Recovery History" title="Restore Earlier Board Snapshots">
      ${ICONS.history}
    </button>

    <button type="button" class="wb-btn" id="btn-toggle-props" aria-label="Toggle Inspector & Canvas Settings" title="Toggle Inspector & Background Settings">
      ${ICONS.settings} <span class="wb-btn-label">Inspector</span>
    </button>
    <button type="button" class="wb-btn wb-icon-only" id="btn-theme-toggle" aria-label="Toggle Light or Dark Theme" title="Toggle Light / Dark Theme">
      ${ICONS.moon}
    </button>
    <button type="button" class="wb-btn wb-icon-only wb-hide-mobile" id="btn-fullscreen" aria-label="Toggle Full Screen (F)" title="Toggle Full Screen (F)">
      ${ICONS.fullscreen}
    </button>
    <button type="button" class="wb-btn wb-icon-only" id="btn-palette" aria-label="Open Command Palette (Ctrl/Cmd+K)" title="Command Palette (Ctrl/Cmd+K)">
      ${ICONS.palette}
    </button>
    <button type="button" class="wb-btn wb-icon-only" id="btn-shortcuts" aria-label="Keyboard Shortcuts Help (?)" title="Keyboard Shortcuts (?)">
      ${ICONS.help}
    </button>
  `;

  const teachingPopover = topBar.querySelector('#wb-teaching-popover');
  const teachingBtn = topBar.querySelector('#btn-teaching-menu');

  const closeTeachingMenu = () => {
    teachingPopover?.classList.add('wb-hidden');
    teachingBtn?.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('pointerdown', (ev) => {
    if (!ev.target.closest('#wb-toolbar')) closeInsertPopover();
    if (!ev.target.closest('.wb-menu-wrap')) closeTeachingMenu();
  });

  topBar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.id === 'btn-teaching-menu') {
      const hidden = teachingPopover.classList.toggle('wb-hidden');
      teachingBtn.setAttribute('aria-expanded', String(!hidden));
      return;
    }
    closeTeachingMenu();
    switch (btn.id) {
      case 'btn-toggle-library':
        app.togglePanel('library');
        break;
      case 'btn-toggle-layers':
        app.togglePanel('layers');
        break;
      case 'btn-toggle-classroom':
        app.togglePanel('classroom');
        break;
      case 'btn-mermaid':
        app.dialogs.openMermaidModal();
        break;
      case 'btn-annotation-mode':
        app.toggleAnnotationMode();
        break;
      case 'btn-spotlight':
        app.toggleSpotlight();
        break;
      case 'btn-timer':
        app.timerUI.toggle();
        break;
      case 'btn-reveal-timeline':
        app.dialogs.openRevealTimelineModal();
        break;
      case 'btn-focus-mode':
        app.toggleFocusMode();
        break;
      case 'btn-present':
        app.presentUI.enter();
        break;
      case 'btn-save-json':
        app.saveWhiteboardFile();
        break;
      case 'btn-open-json':
        app.openWhiteboardFilePicker();
        break;
      case 'btn-export':
        app.dialogs.openExportModal();
        break;
      case 'btn-share-url':
        app.dialogs.openShareUrlModal();
        break;
      case 'btn-recovery':
        app.dialogs.openRecoveryModal();
        break;
      case 'btn-toggle-props':
        app.togglePropsDrawer();
        break;
      case 'btn-theme-toggle':
        app.toggleTheme();
        break;
      case 'btn-fullscreen':
        app.toggleFullScreen();
        break;
      case 'btn-palette':
        app.paletteUI.open();
        break;
      case 'btn-shortcuts':
        app.dialogs.openShortcutsModal();
        break;
    }
  });

  // Build Bottom Zoom / Undo Bar
  bottomBar.innerHTML = `
    <button type="button" class="wb-btn wb-icon-only" id="btn-undo" aria-label="Undo (Ctrl/Cmd+Z)" title="Undo (Ctrl/Cmd+Z)">↶</button>
    <button type="button" class="wb-btn wb-icon-only" id="btn-redo" aria-label="Redo (Ctrl/Cmd+Y)" title="Redo (Ctrl/Cmd+Y)">↷</button>
    <div class="wb-divider"></div>
    <button type="button" class="wb-btn wb-icon-only" id="btn-zoom-out" aria-label="Zoom Out (-)" title="Zoom Out (-)">−</button>
    <button type="button" class="wb-btn" id="btn-zoom-reset" aria-label="Reset Zoom to 100% (0)" title="Reset Zoom (0)">100%</button>
    <button type="button" class="wb-btn wb-icon-only" id="btn-zoom-in" aria-label="Zoom In (+)" title="Zoom In (+)">+</button>
    <button type="button" class="wb-btn" id="btn-zoom-fit" aria-label="Fit to Content (1)" title="Fit to Content (1)">Fit</button>
  `;

  bottomBar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    if (btn.id === 'btn-undo') app.undo();
    else if (btn.id === 'btn-redo') app.redo();
    else if (btn.id === 'btn-zoom-out') app.zoomBy(1 / 1.2);
    else if (btn.id === 'btn-zoom-in') app.zoomBy(1.2);
    else if (btn.id === 'btn-zoom-reset') app.setZoom(1);
    else if (btn.id === 'btn-zoom-fit') app.fitToContent();
  });

  return {
    update() {
      const page = app.getPage();
      dock.querySelectorAll('[data-tool]').forEach((b) => {
        b.classList.toggle('active', b.dataset.tool === app.activeTool);
      });
      const activeInsertTool = insertTools.find((t) => t.id === app.activeTool);
      if (insertBtn) {
        insertBtn.classList.toggle('active', Boolean(activeInsertTool));
      }

      const zoomBtn = document.getElementById('btn-zoom-reset');
      if (zoomBtn) {
        zoomBtn.textContent = `${Math.round(page.camera.zoom * 100)}%`;
      }
      const undoBtn = document.getElementById('btn-undo');
      const redoBtn = document.getElementById('btn-redo');
      if (undoBtn) undoBtn.disabled = !app.history.canUndo(page);
      if (redoBtn) redoBtn.disabled = !app.history.canRedo(page);

      const fsBtn = document.getElementById('btn-fullscreen');
      if (fsBtn) {
        const isFs = Boolean(document.fullscreenElement || app.isPseudoFullscreen);
        fsBtn.classList.toggle('active', isFs);
      }

      const teachBtn = document.getElementById('btn-teaching-menu');
      if (teachBtn) {
        teachBtn.classList.toggle(
          'active',
          Boolean(app.annotationMode || app.spotlight.active || app.focusMode)
        );
      }

      const propsBtn = document.getElementById('btn-toggle-props');
      if (propsBtn) {
        propsBtn.classList.toggle('active', Boolean(app.propsDrawerOpen || app.selectedIds.size > 0));
      }

      const themeBtn = document.getElementById('btn-theme-toggle');
      if (themeBtn) {
        themeBtn.innerHTML = app.scene.theme === 'dark' ? ICONS.sun : ICONS.moon;
      }

      const titleInput = document.getElementById('wb-doc-title');
      if (titleInput && document.activeElement !== titleInput) {
        titleInput.value = app.scene.title || 'StudioBoard Lesson';
      }

      const clsLabel = document.getElementById('wb-classroom-btn-label');
      if (clsLabel) {
        const qCount = page.elements.filter((e) => e.type === 'question' && !e.resolved && !e.hidden).length;
        clsLabel.textContent = qCount > 0 ? `Classroom (${qCount})` : 'Classroom';
      }
    },
  };
}
