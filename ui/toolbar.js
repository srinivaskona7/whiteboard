// ui/toolbar.js

export const PRIMARY_TOOLS = [
  { id: 'select', label: 'Select', shortcut: 'V', icon: '↖' },
  { id: 'hand', label: 'Pan / Hand', shortcut: 'H', icon: '✋' },
  { id: 'pen', label: 'Pen', shortcut: 'P', icon: '✎' },
  { id: 'highlighter', label: 'Highlighter', shortcut: 'M', icon: '🖍' },
  { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: '⌫' },
  { id: 'rect', label: 'Rectangle', shortcut: 'R', icon: '▭' },
  { id: 'rounded-rect', label: 'Rounded Rect', shortcut: 'U', icon: '▢' },
  { id: 'ellipse', label: 'Ellipse', shortcut: 'O', icon: '◯' },
  { id: 'diamond', label: 'Diamond', shortcut: 'D', icon: '◇' },
  { id: 'line', label: 'Line', shortcut: 'L', icon: '╱' },
  { id: 'arrow', label: 'Smart Arrow', shortcut: 'A', icon: '↗' },
  { id: 'text', label: 'Text', shortcut: 'T', icon: 'T' },
  { id: 'sticky', label: 'Sticky Note', shortcut: 'N', icon: '🗒' },
  { id: 'frame', label: 'Frame / Slide', shortcut: 'F2', icon: '⊞' },
  { id: 'table', label: 'Table', shortcut: 'B', icon: '▦' },
  { id: 'code', label: 'Code Block', shortcut: 'J', icon: '{ }' },
  { id: 'stamp', label: 'Classroom Stamp', shortcut: 'S', icon: '★' },
  { id: 'laser', label: 'Laser Pointer', shortcut: 'K', icon: '✦' },
];

export function initToolbar(app) {
  const dock = document.getElementById('wb-toolbar');
  const topBar = document.getElementById('wb-topbar-actions');
  const bottomBar = document.getElementById('wb-zoom-bar');
  if (!dock || !topBar || !bottomBar) return {};

  // Build Floating Tool Dock
  dock.innerHTML = PRIMARY_TOOLS.map(
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
  ).join('') + `
    <button
      type="button"
      class="wb-tool-btn"
      id="btn-insert-image"
      aria-label="Insert Image (I)"
      title="Insert Image (I)"
    >
      <span class="wb-tool-icon">🖼</span>
      <span class="wb-tool-key">I</span>
    </button>
  `;

  dock.addEventListener('click', (ev) => {
    const btn = ev.target.closest('[data-tool]');
    if (btn) {
      app.setTool(btn.dataset.tool);
      return;
    }
    if (ev.target.closest('#btn-insert-image')) {
      app.openImageFilePicker();
    }
  });

  // Build Top Action Bar
  topBar.innerHTML = `
    <button type="button" class="wb-btn" id="btn-toggle-library" aria-label="Toggle Stencil Library & Templates" title="Stencils, Reusable Library & Templates">
      📚 Library & Templates
    </button>
    <button type="button" class="wb-btn" id="btn-toggle-layers" aria-label="Toggle Layers Panel" title="Layers & Locking">
      ☰ Layers
    </button>
    <button type="button" class="wb-btn" id="btn-mermaid" aria-label="Import Mermaid Diagram" title="Paste Mermaid Flowchart / Sequence Diagram">
      🧜‍♀️ Mermaid
    </button>
    <button type="button" class="wb-btn" id="btn-annotation-mode" aria-label="Toggle Live Annotation Mode" title="Live Annotation Overlay with 3s Auto-Fading Ink">
      ✒️ Annotate
    </button>
    <button type="button" class="wb-btn" id="btn-spotlight" aria-label="Toggle Spotlight / Magnifier" title="Spotlight & Magnifier">
      🔦 Spotlight
    </button>
    <button type="button" class="wb-btn" id="btn-timer" aria-label="Toggle Classroom Timer" title="Classroom Countdown Timer">
      ⏱ Timer
    </button>
    <button type="button" class="wb-btn" id="btn-present" aria-label="Enter Presentation Mode" title="Present Frames & Step-by-Step Reveal">
      ▶ Present
    </button>
    <div class="wb-divider"></div>
    <button type="button" class="wb-btn" id="btn-save-json" aria-label="Save .whiteboard.json" title="Save .whiteboard.json">
      💾 Save
    </button>
    <button type="button" class="wb-btn" id="btn-open-json" aria-label="Open .whiteboard.json" title="Open .whiteboard.json">
      📂 Open
    </button>
    <button type="button" class="wb-btn" id="btn-export" aria-label="Export PNG or SVG" title="Export PNG / SVG">
      ⬇ Export
    </button>
    <button type="button" class="wb-btn" id="btn-share-url" aria-label="Share by URL Hash" title="Share compressed scene in URL hash">
      🔗 Share
    </button>
    <button type="button" class="wb-btn" id="btn-theme-toggle" aria-label="Toggle Light/Dark Theme" title="Toggle Light / Dark Theme">
      🌓
    </button>
    <button type="button" class="wb-btn" id="btn-fullscreen" aria-label="Toggle Full Screen (F)" title="Toggle Full Screen (F)">
      ⛶
    </button>
    <button type="button" class="wb-btn" id="btn-palette" aria-label="Command Palette (Ctrl/Cmd+K)" title="Command Palette (Ctrl/Cmd+K)">
      ⌘K
    </button>
    <button type="button" class="wb-btn" id="btn-shortcuts" aria-label="Keyboard Shortcuts (?)" title="Keyboard Shortcuts (?)">
      ?
    </button>
  `;

  topBar.addEventListener('click', (ev) => {
    const btn = ev.target.closest('button');
    if (!btn) return;
    switch (btn.id) {
      case 'btn-toggle-library':
        app.togglePanel('library');
        break;
      case 'btn-toggle-layers':
        app.togglePanel('layers');
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
        fsBtn.textContent = isFs ? '🗗' : '⛶';
        fsBtn.classList.toggle('active', isFs);
      }

      const annBtn = document.getElementById('btn-annotation-mode');
      if (annBtn) annBtn.classList.toggle('active', app.annotationMode);

      const spotBtn = document.getElementById('btn-spotlight');
      if (spotBtn) spotBtn.classList.toggle('active', app.spotlight.active);

      const themeBtn = document.getElementById('btn-theme-toggle');
      if (themeBtn) themeBtn.textContent = app.scene.theme === 'dark' ? '☀️' : '🌙';
    },
  };
}
