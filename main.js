// main.js — StudioBoard Application Coordinator
import {
  DEFAULT_STYLE,
  uid,
  createElement,
  createPage,
  getActivePage,
  cloneElementsWithBindings,
  groupElements,
  ungroupElements,
  toggleFrameCollapse,
  reorderElement,
  extractStyle,
  handleAnchorDeletion,
} from './scene/model.js';
import {
  getSelectionBounds,
  getElementBounds,
  alignElements,
  distributeElements,
  matchElementSize,
  arrangeElements,
  translateElement,
  screenToWorldPoint,
  getUsableViewportCenterWorld,
  validateElementsBatch,
} from './scene/geometry.js';
import { bindConnectorEndpoint, updateConnectorBindings } from './scene/bindings.js';
import { getBrushPreset, BRUSH_PRESETS } from './scene/brushes.js';
import { ARROW_QUICK_PRESETS, applyArrowQuickPreset } from './scene/arrow-presets.js';
import { pasteTsvIntoTable, fitTable } from './scene/table.js';
import { hitTestScene } from './scene/hit.js';
import { HistoryManager } from './scene/history.js';
import {
  loadSceneFromStorage,
  createDebouncedAutosave,
  serializeScene,
  parseSceneJson,
  decodeSceneFromHash,
  loadUserLibrary,
  saveUserLibrary,
  saveThemePreference,
  saveRecoverySnapshot,
  loadWorkspacePreferences,
  saveWorkspacePreferences,
  DEFAULT_PRESET_TOOLS,
  WORKSPACE_PRESETS,
  STORAGE_KEY,
} from './scene/storage.js';
import { computeNonOverlappingOrigin } from './scene/mermaid.js';
import { computeBatchStencilPlacement, autoLayoutArchitecture } from './scene/layout.js';
import { buildQuickAdd } from './scene/quick-add.js';
import { canWrap, wrapTextIntoShape, unwrapShapeText } from './scene/text-wrap.js';
import { CollabClient, parseShareRoute } from './scene/collab-client.js';
import { CanvasRenderer, spotlightEscapeAction } from './render/canvas.js';
import { THEME_ORDER } from './render/themes.js';
import { getStencilById, isStencilLoaded, ensureIconPackLoaded } from './stencils/index.js';
import { BUILTIN_TEMPLATES } from './templates/index.js';
import { SelectTool } from './tools/select.js';
import { DrawTool, ShapeTool, EraserTool } from './tools/draw.js';
import { ConnectorTool } from './tools/connector.js';
import { TextTool } from './tools/text.js';
import { LaserTool } from './tools/laser.js';
import { StampTool } from './tools/stamp.js';
import { MathOverlayTool } from './tools/math-tools.js';
import { handleImageFiles, setupImagePasteAndDrop } from './tools/image.js';
import { buildDevOpsDiagramPacks } from './ui/registry.js';
import { initToolbar } from './ui/toolbar.js';
import { initPropsPanel } from './ui/props-panel.js';
import { initPagesBar } from './ui/pages.js';
import { initLayersPanel } from './ui/layers.js';
import { initLibraryPanel } from './ui/library-panel.js';
import { initPresentUI } from './ui/present.js';
import { initTimerUI } from './ui/timer.js';
import { initVotingUI } from './ui/voting.js';
import { initCommandPalette } from './ui/palette.js';
import { initAnimationUI } from './ui/animation.js';
import { initNotebookView } from './ui/notebook.js';
import { initContextMenu, buildContextItems } from './ui/context-menu.js';
import { initCursorChatUI } from './ui/cursor-chat.js';
import { initDialogs } from './ui/dialogs.js';
import { ClassroomTool, initClassroomUI, parseClassroomHash } from './ui/classroom.js';

const FOCUS_TOOLS_STORAGE_KEY = 'studioboard_focus_tools_v1';

export class WhiteboardApp {
  constructor() {
    // 1. Persistent document state
    this.scene = loadSceneFromStorage();
    this.history = new HistoryManager(100);
    for (const p of this.scene.pages) this.history.initPage(p);

    // 2. Local workspace preferences (separate from document schema)
    this.workspacePrefs = loadWorkspacePreferences();
    this.activePreset = this.workspacePrefs.preset || 'diagram';
    this.pinnedToolsByPreset = {
      teach: [...(this.workspacePrefs.pinnedToolsByPreset?.teach || DEFAULT_PRESET_TOOLS.teach)],
      diagram: [...(this.workspacePrefs.pinnedToolsByPreset?.diagram || DEFAULT_PRESET_TOOLS.diagram)],
      collaborate: [
        ...(this.workspacePrefs.pinnedToolsByPreset?.collaborate || DEFAULT_PRESET_TOOLS.collaborate),
      ],
    };
    this.userLibrary = loadUserLibrary();

    // 3. Transient UI & pointer interaction state
    this.activeTool = 'select';
    // Tool lock is the one "transient" flag that persists: it lives in the
    // workspace prefs, and the accessor below keeps later writes in sync.
    this._toolLock = this.workspacePrefs.toolLockEnabled;
    this.selectedIds = new Set();
    this.clipboard = [];
    this.formatPainterStyle = null;
    this.currentStyle = { ...DEFAULT_STYLE };
    this.nextStampNumber = 1;
    this.hoveredElement = null;
    this.hoveredPort = null;
    this.connectorPreview = null;
    this.placementPreview = null;
    this.smartGuides = [];
    this.marqueeBox = null;
    this.cropState = null;
    this.activeSubInteraction = null;
    this.spacePressed = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.minimapOpen = Boolean(this.workspacePrefs.minimapOpen);
    this.propsDrawerOpen = true;
    this.propsPinned = Boolean(this.workspacePrefs.inspectorPinned);
    this.propsCanvasMode = false;
    this.currentBrush = this.workspacePrefs.brush || 'technical';
    this.brushSmoothing = this.workspacePrefs.brushSmoothing || 'adaptive';
    this.brushOverrides = { ...(this.workspacePrefs.brushOverrides || {}) };
    this.eraserSettings = {
      size: Number(this.workspacePrefs.eraserSize) || 12,
      mode: this.workspacePrefs.eraserMode || 'object',
      scope: this.workspacePrefs.eraserScope || 'all',
    };
    this.eraserCursor = { x: 0, y: 0, active: false };
    // Route / head overrides chosen in the dock's arrow tabs; they apply on top
    // of the next preset so a preset alone never erases a deliberate choice.
    this.pendingArrowStyle = {};

    // 4. Ephemeral teaching & presentation state
    this.annotationMode = false;
    this.focusMode = false;
    this.focusToolIds = this._loadFocusTools();
    this.studentPointers = [];
    this.spotlight = {
      active: false,
      x: 500,
      y: 340,
      radius: 180,
      // An element fit stores its own rx/ry (plus the radius it was computed
      // at) so wide elements get a wide ellipse instead of a cropped circle.
      fitRx: null,
      fitRy: null,
      fitBase: null,
      // A pointed spotlight stops following the cursor until the next
      // "follow cursor" choice or a mode toggle.
      pinned: false,
      magnifier: false,
      magnifierScale: 2,
      dimOpacity: 0.72,
      dimBackground: true,
    };
    this.presentState = { active: false, slideIndex: 0, revealStep: 0 };
    this.viewMode = 'diagram'; // 'diagram' | 'notebook' — a projection over the same document
    this._lastFatalErrorTime = 0;

    this.canvas = document.getElementById('wb-canvas');
    this.minimapCanvas = document.getElementById('wb-minimap');
    this.canvasWrap = document.getElementById('wb-canvas-wrap');
    this.renderer = new CanvasRenderer(this.canvas, this.minimapCanvas);
    this.renderer.onRenderError = (scope, err) => {
      console.warn(`[StudioBoard] Overlay/element isolated error (${scope}):`, err);
    };

    this.selectTool = new SelectTool(this);
    this.drawTool = new DrawTool(this);
    this.shapeTool = new ShapeTool(this);
    this.eraserTool = new EraserTool(this);
    this.connectorTool = new ConnectorTool(this);
    this.textTool = new TextTool(this);
    this.laserTool = new LaserTool(this);
    this.stampTool = new StampTool(this);
    this.mathTool = new MathOverlayTool(this);
    this.classroomTool = new ClassroomTool(this);

    this.collab = new CollabClient(this);
    this.dialogs = initDialogs(this);
    this.classroomUI = initClassroomUI(this);
    this.toolbarUI = initToolbar(this);
    this.propsUI = initPropsPanel(this);
    this.pagesUI = initPagesBar(this);
    this.layersUI = initLayersPanel(this);
    this.libraryUI = initLibraryPanel(this);
    this.presentUI = initPresentUI(this);
    this.timerUI = initTimerUI(this);
    this.votingUI = initVotingUI(this);
    this.notebookView = initNotebookView(this);
    this.paletteUI = initCommandPalette(this);
    this.animationUI = initAnimationUI(this);
    this.contextMenu = initContextMenu(this);
    this.cursorChat = initCursorChatUI(this);

    this.scheduleAutosave = createDebouncedAutosave(
      350,
      (quotaErr) => {
        const el = document.getElementById('wb-autosave-status');
        if (el) {
          el.textContent = 'Save failed (Quota)';
          el.dataset.state = 'error';
        }
        this.dialogs?.showToast(
          quotaErr?.message || 'Browser storage is full. Export .whiteboard.json to back up your board.'
        );
      },
      (state) => {
        const el = document.getElementById('wb-autosave-status');
        if (el) {
          el.dataset.state = state;
          el.textContent =
            state === 'saved' ? 'Saved locally' : state === 'saving' ? 'Saving…' : 'Save failed';
        }
      }
    );

    this._initTheme();
    this._bindEvents();
    setupImagePasteAndDrop(this);
    this._updateCanvasCursor();
    this.setWorkspacePreset(this.activePreset, { applyDefaultPanels: true, silent: true });
    this.handleResize();
    this._initShareRouteFromHash();
    this.updateUI();
    this.requestRender();
  }

  get fadingInk() {
    return this.annotationMode;
  }

  set fadingInk(val) {
    this.annotationMode = Boolean(val);
  }

  get copiedStyle() {
    return this.formatPainterStyle;
  }

  set copiedStyle(val) {
    this.formatPainterStyle = val;
  }

  scheduleFadingCleanup() {
    this.requestRender();
  }

  notifyUpdateAvailable(versionLabel = 'New version') {
    this.updateAvailable = true;
    this.updateVersionLabel = versionLabel;
    this.toolbarUI?.update();
    this.dialogs?.showToast(
      'Update available — your board stays safe. Click "Save & Reload" in the banner when ready.',
      'info'
    );
  }

  applyAppUpdate() {
    saveRecoverySnapshot(this.scene, 'Before App Update Reload');
    this.flushAutosave?.();
    this.updateAvailable = false;
    this.toolbarUI?.update();
    if (typeof window !== 'undefined' && window.location?.reload) {
      window.location.reload();
    }
  }

  getPinnedTools(presetId = this.activePreset) {
    const key = WORKSPACE_PRESETS[presetId] ? presetId : 'diagram';
    const list = this.pinnedToolsByPreset?.[key];
    return Array.isArray(list) && list.length > 0 ? list : [...DEFAULT_PRESET_TOOLS[key]];
  }

  setWorkspacePreset(presetId, { applyDefaultPanels = true, silent = false } = {}) {
    if (!WORKSPACE_PRESETS[presetId]) return false;
    this.activePreset = presetId;
    // Workshops start from a sensible arrow look: hand-drawn while teaching,
    // crisp while diagramming. An explicit choice by the teacher is kept.
    const defaults = new Set(
      Object.values(WORKSPACE_PRESETS).map((p) => p.defaultArrowPreset).filter(Boolean)
    );
    if (!this.pendingArrowPreset || defaults.has(this.pendingArrowPreset)) {
      this.pendingArrowPreset = WORKSPACE_PRESETS[presetId].defaultArrowPreset || null;
      this.pendingArrowStyle = {};
    }
    if (typeof document !== 'undefined' && document.body) {
      document.body.dataset.preset = presetId;
    }

    if (applyDefaultPanels && typeof document !== 'undefined') {
      const libPanel = document.getElementById('wb-library-panel');
      const layersPanel = document.getElementById('wb-layers-panel');
      const clsPanel = document.getElementById('wb-classroom-panel');
      const propsPanel = document.getElementById('wb-props-panel');

      if (presetId === 'teach') {
        libPanel?.classList.add('wb-hidden');
        layersPanel?.classList.add('wb-hidden');
        clsPanel?.classList.add('wb-hidden');
        propsPanel?.classList.add('wb-hidden');
        this.propsDrawerOpen = false;
      } else if (presetId === 'diagram') {
        clsPanel?.classList.add('wb-hidden');
        propsPanel?.classList.remove('wb-hidden');
        this.propsDrawerOpen = true;
      } else if (presetId === 'collaborate') {
        libPanel?.classList.add('wb-hidden');
        layersPanel?.classList.add('wb-hidden');
        clsPanel?.classList.remove('wb-hidden');
        propsPanel?.classList.add('wb-hidden');
        this.propsDrawerOpen = false;
      }
      this.clearPlacementPreview();
    }

    this.workspacePrefs = {
      ...this.workspacePrefs,
      preset: presetId,
      pinnedToolsByPreset: this.pinnedToolsByPreset,
    };
    saveWorkspacePreferences(this.workspacePrefs);

    this.updateUI();
    this.handleResize();
    this.requestRender();
    if (!silent) {
      this.dialogs?.showToast(`Workspace preset: ${WORKSPACE_PRESETS[presetId].label}`, 'info');
    }
    return true;
  }

  setPinnedToolsForPreset(presetId, toolIds) {
    const key = WORKSPACE_PRESETS[presetId] ? presetId : this.activePreset;
    const clean = Array.isArray(toolIds) && toolIds.length > 0 ? toolIds : ['select'];
    this.pinnedToolsByPreset[key] = [...clean];
    if (key === 'teach') {
      this.focusToolIds = [...clean];
      try {
        localStorage.setItem(FOCUS_TOOLS_STORAGE_KEY, JSON.stringify(this.focusToolIds));
      } catch {
        // Ignore
      }
    }
    this.workspacePrefs = {
      ...this.workspacePrefs,
      pinnedToolsByPreset: this.pinnedToolsByPreset,
    };
    saveWorkspacePreferences(this.workspacePrefs);
    this.updateUI();
  }

  resetPresetTools(presetId = this.activePreset) {
    const key = WORKSPACE_PRESETS[presetId] ? presetId : 'diagram';
    this.pinnedToolsByPreset[key] = [...DEFAULT_PRESET_TOOLS[key]];
    if (key === 'teach') {
      this.focusToolIds = [...DEFAULT_PRESET_TOOLS.teach];
      try {
        localStorage.setItem(FOCUS_TOOLS_STORAGE_KEY, JSON.stringify(this.focusToolIds));
      } catch {
        // Ignore
      }
    }
    this.workspacePrefs = {
      ...this.workspacePrefs,
      pinnedToolsByPreset: this.pinnedToolsByPreset,
    };
    saveWorkspacePreferences(this.workspacePrefs);
    this.updateUI();
    return this.pinnedToolsByPreset[key];
  }

  _loadFocusTools() {
    const def = [...DEFAULT_PRESET_TOOLS.teach];
    try {
      const raw = localStorage.getItem(FOCUS_TOOLS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : def;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : def;
    } catch {
      return def;
    }
  }

  setFocusTools(toolIds) {
    this.setPinnedToolsForPreset(this.activePreset, toolIds);
  }

  async _initShareRouteFromHash() {
    await this.collab.checkBackendHealth();
    this.updateUI();
    const hash = window.location.hash || '';
    if (!hash) return;

    const route = parseShareRoute(hash);
    if (route.mode === 'snapshot') {
      await this.collab.loadSnapshotById(route.boardId);
      return;
    }
    if (route.mode === 'room') {
      await this.collab.joinRoomById(route.roomId, route.token, route.roleHint);
      this.classroomUI.openJoinBanner(route.roomId);
      return;
    }

    const cls = parseClassroomHash(hash);
    if (cls?.isClassroom) {
      if (cls.scene) {
        this.scene = cls.scene;
        for (const p of this.scene.pages) this.history.initPage(p);
      }
      this.classroomUI.openJoinBanner(cls.room);
      this.dialogs.showToast(`🎓 Joined offline classroom snapshot: ${cls.room}`);
      return;
    }

    if (hash.startsWith('#scene=')) {
      try {
        const fromHash = decodeSceneFromHash(hash);
        if (fromHash) {
          this.scene = fromHash;
          for (const p of this.scene.pages) this.history.initPage(p);
          this.dialogs.showToast('Loaded shared board from URL hash.');
        }
      } catch {
        // Ignore malformed hash
      }
    }
  }

  getPage() {
    return getActivePage(this.scene);
  }

  getSelectedElements() {
    const page = this.getPage();
    return page.elements.filter((e) => this.selectedIds.has(e.id) && !e.hidden);
  }

  // Active view camera. Notebook view supplies its own zoom without mutating the document.
  getCamera() {
    if (!this.presentState.active && this.viewMode === 'notebook' && this.notebookView?.getCamera) {
      return this.notebookView.getCamera();
    }
    return this.getPage().camera;
  }

  getRenderPage() {
    const page = this.getPage();
    if (!this.presentState.active && this.viewMode === 'notebook' && this.notebookView?.getCamera) {
      return { ...page, camera: this.notebookView.getCamera() };
    }
    return page;
  }

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorldPoint(clientX, clientY, rect, this.getCamera());
  }

  getOpenPanelInsets() {
    let left = 64;
    let right = 16;
    const leftPanels = ['wb-library-panel', 'wb-layers-panel', 'wb-classroom-panel'];
    for (const id of leftPanels) {
      const p = document.getElementById(id);
      if (p && !p.classList.contains('wb-hidden')) {
        left = Math.max(left, (p.getBoundingClientRect().right || 388) + 12);
      }
    }
    const rightPanel = document.getElementById('wb-props-panel');
    if (rightPanel && !rightPanel.classList.contains('wb-hidden') && !this.focusMode) {
      const w = rightPanel.getBoundingClientRect().width || 244;
      if (window.innerWidth > 768) right = Math.max(right, w + 16);
    }
    return { left, right, top: 56, bottom: 52 };
  }

  getUsableViewportCenter() {
    return getUsableViewportCenterWorld(
      this.renderer.width || window.innerWidth || 1280,
      this.renderer.height || window.innerHeight || 800,
      this.getPage().camera,
      this.getOpenPanelInsets()
    );
  }

  getViewportCenterWorld() {
    return this.getUsableViewportCenter();
  }

  _updateCanvasCursor() {
    if (!this.canvas) return;
    if (this.isPanning) {
      this.canvas.style.cursor = 'grabbing';
      return;
    }
    if (this.spacePressed || this.activeTool === 'hand') {
      this.canvas.style.cursor = 'grab';
      return;
    }
    const cursorMap = {
      select: 'default',
      text: 'text',
      eraser: 'cell',
      laser: 'crosshair',
      pointer: 'pointer',
      question: 'help',
    };
    this.canvas.style.cursor = cursorMap[this.activeTool] || 'crosshair';
  }

  cancelActiveInteractions() {
    if (this.activeSubInteraction) {
      this.activeSubInteraction = null;
    }
    if (this.connectorTool?.activeConnector) {
      this.connectorTool.cancel();
    }
    if (this.selectTool?.isActive()) {
      this.selectTool.cancel();
    }
    if (this.drawTool?.activeElement || this.drawTool?.isErasing) {
      // Drop the in-progress stroke rather than leaving a half-finished element live.
      const el = this.drawTool.activeElement;
      const page = this.getPage();
      if (el && page.elements.includes(el)) {
        page.elements.splice(page.elements.indexOf(el), 1);
        this.history?.commit?.(page);
      }
      this.drawTool.activeElement = null;
      this.drawTool.isErasing = false;
      this.drawTool.rawPoints = [];
      this.requestRender();
    }
    if (this.laserTool?.isDown) {
      this.laserTool.onPointerUp();
    }
    this.isPanning = false;
    this.marqueeBox = null;
    this.smartGuides = [];
    this.connectorPreview = null;
    this._updateCanvasCursor();
  }

  setTool(toolId) {
    if (!this.collab.canUseTool(toolId)) {
      const msg =
        this.collab.status === 'snapshot'
          ? 'Read-only snapshot: only Select (V) and Hand (H) navigation are enabled.'
          : 'Viewer / Questioner mode: use Select (V), Hand (H), Point (W), or Pin Question (Q) to participate.';
      this.dialogs.showToast(msg, 'info');
      return;
    }
    if (this.textTool.isOpen()) this.textTool.commit();
    // Spotlight is a presentation mode, not a placement tool: it toggles and
    // leaves the current drawing tool alone.
    if (toolId === 'spotlight') {
      this.toggleSpotlight(false);
      return;
    }
    // Dot voting is a classroom mode too: the button toggles it and leaves the
    // current drawing tool alone.
    if (toolId === 'vote') {
      this.votingUI.toggle();
      return;
    }
    this.cancelActiveInteractions();
    this.activeTool = toolId;
    // Each ink tool keeps its own natural preset instead of inheriting whichever
    // brush was last used by the other one (Highlighter must not draw Technical).
    const brushKind = getBrushPreset(this.currentBrush)?.kind;
    if (toolId === 'highlighter' && brushKind !== 'highlighter') {
      this.currentBrush = 'highlighter';
    } else if (toolId === 'pen' && brushKind === 'highlighter') {
      const preferred = getBrushPreset(this.workspacePrefs.brush);
      this.currentBrush = preferred && preferred.kind !== 'highlighter' ? preferred.id : 'technical';
    }
    this.hoveredPort = null;
    this._updateCanvasCursor();
    this.toolbarUI.update();
    this.propsUI.update();
    this.requestRender();
  }

  commitChange(deletedIds = []) {
    const page = this.getPage();
    if (deletedIds.length > 0) {
      handleAnchorDeletion(page, deletedIds);
    }
    const now = Date.now();
    for (const el of page.elements) {
      if (!el.updatedAt) el.updatedAt = now;
    }
    this.history.record(page);
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange(deletedIds);
    this.toolbarUI.update();
    this.layersUI.update();
  }

  undo() {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    if (this.history.undo(page)) {
      this.selectedIds.clear();
      this.scheduleAutosave(this.scene);
      this.collab.broadcastSceneChange();
      this.updateUI();
      this.requestRender();
      return;
    }
    if (Array.isArray(this.pageUndoStack) && this.pageUndoStack.length > 0) {
      const op = this.pageUndoStack.pop();
      if (op.type === 'delete-page' && op.page) {
        const idx = Math.max(0, Math.min(this.scene.pages.length, Number(op.index) || 0));
        this.scene.pages.splice(idx, 0, op.page);
        this.history.initPage(op.page);
        this.scene.activePageId = op.page.id;
        this.selectedIds.clear();
        this.scheduleAutosave(this.scene);
        this.collab.broadcastSceneChange();
        this.updateUI();
        this.requestRender();
        this.dialogs?.showToast(`Restored page "${op.page.name}".`, 'info');
      }
    }
  }

  redo() {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    if (this.history.redo(page)) {
      this.selectedIds.clear();
      this.scheduleAutosave(this.scene);
      this.collab.broadcastSceneChange();
      this.updateUI();
      this.requestRender();
    }
  }

  updateUI() {
    // An explicit selection is context, not a pinned token: once the user selects an
    // object the Inspector follows that selection and collapses again when it is cleared.
    if (this.selectedIds.size > 0) this.propsCanvasMode = false;
    const chip = document.getElementById('wb-canvas-settings-chip');
    if (chip) {
      const showChip =
        !this.propsContextVisible() &&
        (this.activeTool === 'select' || this.activeTool === 'hand') &&
        !this.presentState?.active &&
        this.viewMode !== 'notebook';
      chip.classList.toggle('wb-hidden', !showChip);
    }
    this.toolbarUI.update();
    this.propsUI.update();
    this.pagesUI.update();
    this.layersUI.update();
    this.classroomUI?.update();
    this.notebookView?.update();
  }

  setViewMode(mode) {
    const next = mode === 'notebook' ? 'notebook' : 'diagram';
    if (next === this.viewMode) return;
    if (next === 'notebook') {
      this.notebookView?.enter();
    } else {
      this.notebookView?.exit();
    }
    this.toolbarUI.update();
    this.updateUI();
    this.requestRender();
  }

  _handleFatalRenderError(err) {
    const now = Date.now();
    if (now - this._lastFatalErrorTime > 4000) {
      this._lastFatalErrorTime = now;
      console.error('[StudioBoard] Render loop recovered from error:', err);
      this.dialogs?.showToast('Recovered from a transient render error. Your board data is safe.');
    }
  }

  requestRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      let needsAnotherFrame = false;
      try {
        needsAnotherFrame = Boolean(this.renderNow());
      } catch (err) {
        this._handleFatalRenderError(err);
      } finally {
        this._raf = null;
        if (needsAnotherFrame) {
          this.requestRender();
        }
      }
    });
  }

  renderNow() {
    const now = Date.now();
    const page = this.getPage();
    let hasFading = false;
    const beforeLen = page.elements.length;
    page.elements = page.elements.filter((el) => {
      if (!el.fading || !el.createdAt) return true;
      if (now - el.createdAt > 3000) return false;
      hasFading = true;
      return true;
    });
    if (page.elements.length !== beforeLen) this.scheduleAutosave(this.scene);
    this.studentPointers = this.studentPointers.filter(
      (p) => now - (p.createdAt ?? p.time ?? now) < 6500
    );
    const activeTrail =
      typeof this.laserTool?.prune === 'function' ? this.laserTool.prune(now) : [];
    const remoteCursors = this.collab.getInterpolatedRemoteCursors(page.id);
    // Ephemeral social layer: cursor chat bubbles (15s life) for the active
    // page only, and emotes anchored to an element or world point (~8s rise).
    const cursorChats = this.collab.activeCursorChats().filter((c) => c.pageId === page.id);
    const anchoredReactions = this.collab.recentReactions.filter(
      (r) =>
        // Element anchors resolve on the active page at draw time; world-point
        // anchors float at raw coordinates and must not leak onto other pages.
        (r.elementId || r.pageId === page.id || (!r.pageId && !r.elementId)) &&
        ((Number.isFinite(r.x) && Number.isFinite(r.y)) || r.elementId) &&
        now - (r.receivedAt ?? r.createdAt ?? now) < 8000
    );

    this.renderer.render(this.scene, {
      page: this.getRenderPage(),
      selectedIds: this.selectedIds,
      hoveredElement: this.hoveredElement,
      hoveredPort: this.hoveredPort,
      connectorPreview: this.connectorPreview,
      placementPreview: this.placementPreview,
      remoteCursors,
      cursorChats,
      anchoredReactions,
      smartGuides: this.smartGuides,
      marqueeBox: this.marqueeBox,
      laserTrail: activeTrail,
      studentPointers: this.studentPointers,
      classroomPointers: this.studentPointers,
      spotlight: this.spotlight,
      presentState: this.presentState,
      animationState: this.animationState || null,
      cropState: this.cropState,
      eraserCursor: this.activeTool === 'eraser' ? this.eraserCursor : null,
      eraserSize: this.eraserSettings?.size || 12,
      editingElementId: this.textTool.editingEl?.id || null,
      minimapOpen: this.minimapOpen,
      // Whether the quick-add dots are live: select tool, editing allowed.
      quickAddEnabled: this.activeTool === 'select' && this.collab.canEditBoard(),
      now,
    });

    return (
      activeTrail.length > 0 ||
      hasFading ||
      this.studentPointers.length > 0 ||
      remoteCursors.length > 0 ||
      cursorChats.length > 0 ||
      anchoredReactions.length > 0
    );
  }

  handleResize() {
    if (!this.canvasWrap) return;
    if (this.viewMode === 'notebook' && this.notebookView) {
      this.notebookView.handleResize();
      this.requestRender();
      return;
    }
    const rect = this.canvasWrap.getBoundingClientRect();
    this.renderer.resize(Math.max(300, rect.width), Math.max(200, rect.height));
    this.requestRender();
  }

  zoomBy(factor, centerScreen = null) {
    if (this.collab.followingTeacher) this.collab.setFollowTeacher(false);
    const page = this.getPage();
    const cam = page.camera;
    const cx = centerScreen ? centerScreen.x : this.renderer.width / 2;
    const cy = centerScreen ? centerScreen.y : this.renderer.height / 2;
    const wx = (cx - cam.x) / cam.zoom;
    const wy = (cy - cam.y) / cam.zoom;
    cam.zoom = Math.max(0.1, Math.min(8, cam.zoom * factor));
    cam.x = cx - wx * cam.zoom;
    cam.y = cy - wy * cam.zoom;
    this.collab.broadcastTeacherCamera();
    this.toolbarUI.update();
    this.requestRender();
  }

  setZoom(targetZoom = 1, centerScreen = null) {
    const cam = this.getPage().camera;
    const factor = (Number(targetZoom) || 1) / (cam.zoom || 1);
    this.zoomBy(factor, centerScreen);
  }

  resetZoom() {
    if (this.collab.followingTeacher) this.collab.setFollowTeacher(false);
    const cam = this.getPage().camera;
    cam.zoom = 1;
    cam.x = 0;
    cam.y = 0;
    this.collab.broadcastTeacherCamera();
    this.toolbarUI.update();
    this.requestRender();
  }

  _fitElementsBounds(elements) {
    const b = getSelectionBounds(elements);
    if (!b || b.w === 0 || b.h === 0) return false;
    const insets = this.getOpenPanelInsets();
    const availW = Math.max(160, this.renderer.width - insets.left - insets.right - 48);
    const availH = Math.max(140, this.renderer.height - insets.top - insets.bottom - 48);
    const zoom = Math.max(0.15, Math.min(2.5, Math.min(availW / b.w, availH / b.h)));
    const page = this.getPage();
    const centerScreenX = insets.left + availW / 2 + 24;
    const centerScreenY = insets.top + availH / 2 + 24;
    page.camera.zoom = zoom;
    page.camera.x = Math.round(centerScreenX - (b.x + b.w / 2) * zoom);
    page.camera.y = Math.round(centerScreenY - (b.y + b.h / 2) * zoom);
    this.collab.broadcastTeacherCamera();
    this.toolbarUI.update();
    this.requestRender();
    return true;
  }

  fitToContent() {
    const page = this.getPage();
    const visible = page.elements.filter((e) => !e.hidden);
    if (!this._fitElementsBounds(visible)) {
      this.resetZoom();
    }
  }

  zoomToSelection() {
    const selected = this.getSelectedElements();
    if (selected.length === 0) {
      this.dialogs.showToast('Select one or more elements to Zoom to Selection.');
      return false;
    }
    return this._fitElementsBounds(selected);
  }

  addPage() {
    if (!this.collab.canEditBoard()) return;
    const n = this.scene.pages.length + 1;
    const p = createPage(`Page ${n}`);
    this.scene.pages.push(p);
    this.history.initPage(p);
    this.scene.activePageId = p.id;
    this.selectedIds.clear();
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange();
    this.updateUI();
    this.requestRender();
  }

  addPages(count = 1) {
    if (!this.collab.canEditBoard()) return;
    const total = Math.max(1, Math.min(50, Number(count) || 1));
    let last = null;
    for (let i = 0; i < total; i++) {
      const n = this.scene.pages.length + 1;
      const p = createPage(`Page ${n}`);
      this.scene.pages.push(p);
      this.history.initPage(p);
      last = p;
    }
    if (last) this.scene.activePageId = last.id;
    this.selectedIds.clear();
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange();
    this.updateUI();
    this.requestRender();
  }

  duplicatePage(pageId) {
    if (!this.collab.canEditBoard()) return;
    const src = this.scene.pages.find((p) => p.id === pageId);
    if (!src) return;
    const copy = createPage(`${src.name} (Copy)`);
    copy.background = src.background;
    copy.elements = cloneElementsWithBindings(src.elements, 0, 0);
    this.scene.pages.push(copy);
    this.history.initPage(copy);
    this.scene.activePageId = copy.id;
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange();
    this.updateUI();
    this.requestRender();
  }

  deletePage(pageId) {
    if (!this.collab.canEditBoard() || this.scene.pages.length <= 1) return;
    const deletedIdx = this.scene.pages.findIndex((p) => p.id === pageId);
    if (deletedIdx === -1) return;
    const targetPage = this.scene.pages[deletedIdx];
    saveRecoverySnapshot(this.scene, `Before deleting page: ${targetPage.name}`);
    if (!this.pageUndoStack) this.pageUndoStack = [];
    this.pageUndoStack.push({
      type: 'delete-page',
      page: structuredClone(targetPage),
      index: deletedIdx,
    });
    this.scene.pages.splice(deletedIdx, 1);
    if (this.scene.activePageId === pageId) {
      const nearestIdx = Math.min(deletedIdx, this.scene.pages.length - 1);
      this.scene.activePageId = this.scene.pages[nearestIdx].id;
    }
    this.selectedIds.clear();
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange();
    this.updateUI();
    this.requestRender();
  }

  switchPage(pageId) {
    this.scene.activePageId = pageId;
    this.selectedIds.clear();
    this.collab.broadcastTeacherCamera();
    this.updateUI();
    this.requestRender();
  }

  reorderPage(idx, dir) {
    if (!this.collab.canEditBoard()) return;
    const pages = this.scene.pages;
    const targetIdx = idx + dir;
    if (idx < 0 || idx >= pages.length || targetIdx < 0 || targetIdx >= pages.length) return;
    const [moved] = pages.splice(idx, 1);
    pages.splice(targetIdx, 0, moved);
    this.scheduleAutosave(this.scene);
    this.collab.broadcastSceneChange();
    this.updateUI();
    this.requestRender();
  }

  deleteSelection() {
    if (!this.collab.canEditBoard()) {
      this.dialogs.showToast('Viewers cannot delete protected board content.');
      return;
    }
    if (this.selectedIds.size === 0) return;
    const page = this.getPage();
    const deleted = [];
    for (const e of page.elements) {
      if (this.selectedIds.has(e.id) && !e.locked) deleted.push(e.id);
    }
    if (deleted.length === 0) return;
    handleAnchorDeletion(page, deleted);
    const delSet = new Set(deleted);
    page.elements = page.elements.filter((e) => !delSet.has(e.id));
    this.selectedIds.clear();
    updateConnectorBindings(page);
    this.commitChange(deleted);
    this.updateUI();
    this.requestRender();
  }

  duplicateSelection() {
    if (!this.collab.canEditBoard()) return;
    const selected = this.getSelectedElements();
    if (selected.length === 0) return;
    const page = this.getPage();
    const clones = cloneElementsWithBindings(selected, 28, 28);
    const check = validateElementsBatch(clones);
    if (!check.valid) return;
    page.elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  copySelection() {
    const selected = this.getSelectedElements();
    if (selected.length > 0) this.clipboard = cloneElementsWithBindings(selected, 0, 0);
  }

  cutSelection() {
    if (!this.collab.canEditBoard()) return;
    if (this.selectedIds.size === 0) return;
    this.copySelection();
    this.deleteSelection();
  }

  pasteClipboard() {
    if (!this.collab.canEditBoard() || this.clipboard.length === 0) return;
    const page = this.getPage();
    const clones = cloneElementsWithBindings(this.clipboard, 32, 32);
    const check = validateElementsBatch(clones);
    if (!check.valid) return;
    page.elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  groupSelection() {
    if (!this.collab.canEditBoard()) return;
    if (groupElements(this.getPage(), Array.from(this.selectedIds))) {
      this.commitChange();
      this.updateUI();
      this.requestRender();
    }
  }

  ungroupSelection() {
    if (!this.collab.canEditBoard()) return;
    ungroupElements(this.getPage(), Array.from(this.selectedIds));
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  alignSelection(mode) {
    if (!this.collab.canEditBoard()) return;
    const sel = this.getSelectedElements();
    alignElements(sel, mode);
    updateConnectorBindings(this.getPage());
    this.commitChange();
    this.requestRender();
  }

  distributeSelection(axis) {
    if (!this.collab.canEditBoard()) return;
    const sel = this.getSelectedElements();
    distributeElements(sel, axis);
    updateConnectorBindings(this.getPage());
    this.commitChange();
    this.requestRender();
  }

  arrangeSelection(mode = 'grid') {
    if (!this.collab.canEditBoard()) return;
    const sel = this.getSelectedElements();
    if (sel.length < 2) return;
    arrangeElements(sel, mode, 52, 42);
    updateConnectorBindings(this.getPage());
    this.commitChange();
    this.requestRender();
  }

  autoLayoutSelection(direction = 'LR') {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    const ok = autoLayoutArchitecture(page, this.selectedIds, direction);
    if (ok) {
      this.commitChange();
      this.requestRender();
      this.dialogs.showToast(`⇄ Applied ${direction === 'TB' ? 'Top-to-Bottom' : 'Left-to-Right'} Architecture Auto-Layout.`);
    } else {
      this.dialogs.showToast('Need at least 2 unlocked nodes to run Architecture Auto-Layout.');
    }
  }

  connectSelectionFlow() {
    if (!this.collab.canEditBoard()) return;
    const sel = this.getSelectedElements().filter(
      (e) => e.type !== 'line' && e.type !== 'arrow' && e.type !== 'pen' && e.type !== 'highlighter'
    );
    if (sel.length < 2) return;
    const page = this.getPage();
    const sorted = [...sel].sort((a, b) => (Math.abs(a.x - b.x) > 40 ? a.x - b.x : a.y - b.y));
    const createdConns = [];
    for (let i = 0; i < sorted.length - 1; i++) {
      const a = sorted[i];
      const b = sorted[i + 1];
      const conn = createElement('arrow', {
        x: Math.round(a.x + a.w),
        y: Math.round(a.y + a.h / 2),
        x2: Math.round(b.x),
        y2: Math.round(b.y + b.h / 2),
        routing: 'orthogonal',
        startArrow: 'none',
        endArrow: 'arrow',
        stroke: this.currentStyle.stroke || '#334155',
        strokeWidth: 2,
      });
      bindConnectorEndpoint(conn, 'start', a, 'auto');
      bindConnectorEndpoint(conn, 'end', b, 'auto');
      createdConns.push(conn);
    }
    const check = validateElementsBatch(createdConns);
    if (!check.valid) {
      this.dialogs.showToast(`Connection rejected: ${check.reason}`);
      return;
    }
    page.elements.push(...createdConns);
    updateConnectorBindings(page);
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  matchSelectionSize() {
    if (!this.collab.canEditBoard()) return;
    const sel = this.getSelectedElements();
    matchElementSize(sel, 'both');
    updateConnectorBindings(this.getPage());
    this.commitChange();
    this.requestRender();
  }

  // Quick-add: duplicate the element in a cardinal direction and connect the
  // pair with an arrow bound to both (the "+" dots on the selection).
  applyQuickAdd(source, direction) {
    if (!this.collab.canEditBoard()) return false;
    const page = this.getPage();
    const built = buildQuickAdd(page, source, direction, this.currentStyle);
    if (!built.ok) {
      this.dialogs.showToast(`Quick add unavailable: ${built.reason}`);
      return false;
    }
    // A frame duplicates as the frame only; copying its children along is a
    // later feature.
    const clone = built.clone;
    const arrow = createElement('arrow', built.arrowSpec);
    const check = validateElementsBatch([clone, arrow]);
    if (!check.valid) {
      this.dialogs.showToast(`Quick add rejected: ${check.reason}`);
      return false;
    }
    // Auto ports so the arrow keeps facing each shape as either is dragged.
    bindConnectorEndpoint(arrow, 'start', source, 'auto');
    bindConnectorEndpoint(arrow, 'end', clone, 'auto');
    page.elements.push(clone, arrow);
    updateConnectorBindings(page, [clone.id, arrow.id]);
    this.selectedIds = new Set([clone.id]);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return true;
  }

  // Shift+Q / dock padlock: keep the active tool instead of one-shotting the
  // shape, connector and text tools back to Select after each element. The
  // dock button assigns app.toolLock directly, so the property write is the
  // one funnel every toggle passes through — persist there, and the pref can
  // never drift from the flag.
  get toolLock() {
    return this._toolLock;
  }

  set toolLock(value) {
    this._toolLock = Boolean(value);
    this.workspacePrefs = { ...this.workspacePrefs, toolLockEnabled: this._toolLock };
    saveWorkspacePreferences(this.workspacePrefs);
    this.toolbarUI?.update();
  }

  toggleToolLock() {
    this.toolLock = !this.toolLock;
    this.dialogs?.showToast(
      this.toolLock ? 'Tool lock on — tools stay active' : 'Tool lock off',
      'info'
    );
  }

  // Alt+W: fold the selected standalone text into the shape under it, or
  // detach a labelled shape's text back out into a standalone element.
  toggleTextWrap() {
    if (this.presentState.active) return;
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    const sel = this.getSelectedElements();
    if (sel.length !== 1) return;
    const el = sel[0];

    if (el.type === 'text') {
      // Topmost first: the shape visually on top is the one the text reads as.
      for (let i = page.elements.length - 1; i >= 0; i--) {
        const shape = page.elements[i];
        if (shape.id === el.id || !canWrap(el, shape)) continue;
        const res = wrapTextIntoShape(el, shape, this.currentStyle);
        if (!res.ok) continue;
        page.elements = page.elements.filter((e) => e.id !== res.removedId);
        this.selectedIds.clear();
        this.commitChange([res.removedId]);
        this.updateUI();
        this.requestRender();
        this.dialogs.showToast('Text wrapped into shape.');
        return;
      }
      this.dialogs.showToast('Place the text over a shape to wrap it.');
      return;
    }

    const res = unwrapShapeText(el, this.currentStyle);
    if (!res.ok) {
      this.dialogs.showToast(res.reason);
      return;
    }
    // The unwrap spec carries the colour in `stroke`, but text rendering reads
    // `textColor` — set both so the unwrapped text keeps its look.
    const text = createElement('text', { ...res.element, textColor: res.element.stroke });
    page.elements.push(text);
    this.selectedIds = new Set([text.id]);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    this.dialogs.showToast('Shape label unwrapped into text.');
  }

  reorderSelection(dir) {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    for (const id of this.selectedIds) reorderElement(page, id, dir);
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  reorderElementById(elId, dir) {
    if (!this.collab.canEditBoard()) return;
    reorderElement(this.getPage(), elId, dir);
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  toggleLockSelection() {
    if (!this.collab.canEditBoard()) return;
    for (const el of this.getSelectedElements()) el.locked = !el.locked;
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  toggleFrame(frameId) {
    if (!this.collab.canEditBoard()) return;
    toggleFrameCollapse(this.getPage(), frameId);
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  activateFormatPainter() {
    const sel = this.getSelectedElements();
    if (sel.length > 0) {
      this.formatPainterStyle = extractStyle(sel[0]);
      this.dialogs.showToast('Format Painter active — click an element to apply.');
    }
  }

  copySelectedStyle() {
    this.activateFormatPainter();
  }

  selectAll() {
    const page = this.getPage();
    this.selectedIds = new Set(
      page.elements.filter((e) => !e.locked && !e.hidden).map((e) => e.id)
    );
    this.updateUI();
    this.requestRender();
  }

  toggleSnapToGrid() {
    if (!this.collab.canEditBoard()) return;
    this.scene.settings.snapToGrid = !this.scene.settings.snapToGrid;
    this.scheduleAutosave(this.scene);
    this.updateUI();
    this.dialogs?.showToast(
      `Snap to grid ${this.scene.settings.snapToGrid ? 'enabled' : 'disabled'}.`
    );
  }

  toggleSmartGuides() {
    if (!this.collab.canEditBoard()) return;
    this.scene.settings.snapToObjects = !this.scene.settings.snapToObjects;
    this.scheduleAutosave(this.scene);
    this.updateUI();
    this.dialogs?.showToast(
      `Smart guides ${this.scene.settings.snapToObjects ? 'enabled' : 'disabled'}.`
    );
  }

  pasteSelectedStyle() {
    if (!this.formatPainterStyle) return;
    const page = this.getPage();
    const targets = page.elements.filter((e) => this.selectedIds.has(e.id) && !e.locked);
    for (const el of targets) {
      const style = this.formatPainterStyle;
      for (const key of ['stroke', 'fill', 'strokeWidth', 'strokeStyle', 'opacity', 'fontFamily', 'fontSize', 'textColor', 'textAlign', 'roundness', 'sloppy', 'routing', 'startArrow', 'endArrow']) {
        if (style[key] !== undefined) el[key] = style[key];
      }
    }
    if (targets.length > 0) this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  brushPresetItems() {
    return BRUSH_PRESETS.map((p) => ({
      label: `${this.currentBrush === p.id ? '✓ ' : ''}${p.name}`,
      action: () => this.setBrushPreset(p.id),
    }));
  }

  arrowPresetItems() {
    return ARROW_QUICK_PRESETS.map((p) => ({
      label: p.name,
      action: () => this.applyArrowPresetToSelection(p.id),
    }));
  }

  setBackground(bg = 'dots') {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    page.background = bg;
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  placeStencil(stencilId, worldPos = null) {
    if (!this.collab.canEditBoard()) {
      this.dialogs.showToast('Viewers cannot insert elements onto the board.');
      return false;
    }
    const page = this.getPage();
    // A lazy icon-pack id whose chunk has not landed yet would resolve to the
    // fallback stencil and place the WRONG icon — kick the load and bail.
    if (
      typeof stencilId === 'string' &&
      stencilId.startsWith('pk-') &&
      !isStencilLoaded(stencilId)
    ) {
      ensureIconPackLoaded().then(
        () => {
          this.requestRender();
          this.insertStencilFromLibrary(stencilId, worldPos);
        },
        () => {
          this.dialogs.showToast('Icon pack failed to load — placement cancelled.');
        }
      );
      return false;
    }
    const st = getStencilById(stencilId);
    if (!st) {
      this.dialogs.showToast('Insertion rejected: unknown stencil ID.');
      return false;
    }
    const origin =
      worldPos && Number.isFinite(worldPos.x) && Number.isFinite(worldPos.y)
        ? { x: Math.round(worldPos.x), y: Math.round(worldPos.y) }
        : computeNonOverlappingOrigin(page, this.getUsableViewportCenter());

    const isBoundary = Boolean(st.isBoundary);
    const w = isBoundary ? st.defaultW || 380 : st.isCard ? 156 : 140;
    const h = isBoundary ? st.defaultH || 250 : st.isCard ? 114 : 96;

    const el = createElement('stencil', {
      ...this.currentStyle,
      x: origin.x,
      y: origin.y,
      w,
      h,
      stencilId: st.id,
      category: st.category,
      name: st.name,
      text: st.defaultText || st.name,
      stroke: st.color || this.currentStyle.stroke,
      fill: isBoundary
        ? st.boundaryFill || 'rgba(37, 99, 235, 0.05)'
        : st.isCard
          ? '#ffffff'
          : this.currentStyle.fill,
      fontSize: isBoundary ? 13 : st.isCard ? 13 : 16,
      isBoundary,
      isContainer: isBoundary,
      moveChildren: true,
    });

    const check = validateElementsBatch([el]);
    if (!check.valid) {
      this.dialogs.showToast(`Insertion rejected: ${check.reason}`);
      return false;
    }

    page.elements.push(el);
    this.selectedIds = new Set([el.id]);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return true;
  }

  insertStencilFromLibrary(stencilId, worldPos = null) {
    return this.placeStencil(stencilId, worldPos);
  }

  previewBatchInsertion(stencilIds = [], layoutMode = 'grid') {
    const page = this.getPage();
    if (!Array.isArray(stencilIds) || stencilIds.length === 0) {
      this.clearPlacementPreview();
      return;
    }
    const origin = computeNonOverlappingOrigin(page, this.getUsableViewportCenter());
    const batch = computeBatchStencilPlacement(
      page,
      stencilIds,
      layoutMode,
      origin,
      this.currentStyle,
      getStencilById
    );
    this.placementPreview = batch.valid ? batch : null;
    this.requestRender();
  }

  clearPlacementPreview() {
    if (this.placementPreview) {
      this.placementPreview = null;
      this.requestRender();
    }
  }

  placeMultipleStencils(stencilIds = [], layoutMode = 'grid', worldPos = null) {
    if (!this.collab.canEditBoard()) {
      this.dialogs.showToast('Viewers cannot insert elements onto the board.');
      return false;
    }
    const page = this.getPage();
    const origin =
      worldPos && Number.isFinite(worldPos.x) && Number.isFinite(worldPos.y)
        ? worldPos
        : computeNonOverlappingOrigin(page, this.getUsableViewportCenter());

    const batch = computeBatchStencilPlacement(
      page,
      stencilIds,
      layoutMode,
      origin,
      this.currentStyle,
      getStencilById
    );
    if (!batch.valid) {
      this.dialogs.showToast(`Insertion rejected: ${batch.reason}`);
      return false;
    }

    page.elements.push(...batch.elements);
    updateConnectorBindings(page);
    this.placementPreview = null;
    this.selectedIds = new Set(batch.elements.map((e) => e.id));
    this.commitChange();
    this.updateUI();
    this.requestRender();
    this.dialogs.showToast(
      `Inserted ${batch.nodes.length} DevOps components${layoutMode === 'flow' ? ' with connected flow' : ''}.`
    );
    return true;
  }

  insertDiagramPack(packId) {
    if (!this.collab.canEditBoard()) return;
    const pack = buildDevOpsDiagramPacks().find((p) => p.id === packId || `tpl-${p.id}` === packId);
    if (!pack) return;
    const page = this.getPage();
    const built = typeof pack.build === 'function' ? pack.build() : cloneElementsWithBindings(pack.elements || [], 0, 0);
    const bBounds = getSelectionBounds(built) || { x: 0, y: 0 };
    const origin = computeNonOverlappingOrigin(page, this.getUsableViewportCenter());
    const dx = Math.round(origin.x - bBounds.x);
    const dy = Math.round(origin.y - bBounds.y);
    for (const el of built) translateElement(el, dx, dy);
    const check = validateElementsBatch(built);
    if (!check.valid) {
      this.dialogs.showToast(`Pack insertion rejected: ${check.reason}`);
      return;
    }
    page.elements.push(...built);
    updateConnectorBindings(page);
    this.selectedIds = new Set(built.map((e) => e.id));
    this.commitChange();
    this.fitToContent();
    this.updateUI();
    this.dialogs.showToast(`Inserted "${pack.name}".`);
  }

  applyTemplate(tplId) {
    if (!this.collab.canEditBoard()) return;
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === tplId || t.packId === tplId);
    if (!tpl) {
      this.insertDiagramPack(tplId);
      return;
    }
    saveRecoverySnapshot(this.scene, `Before Template: ${tpl.name}`);
    const page = this.getPage();
    const built = tpl.build();
    const check = validateElementsBatch(built);
    if (!check.valid) {
      this.dialogs.showToast(`Template rejected: ${check.reason}`);
      return;
    }
    // Place the template clear of existing content so an inserted lesson never lands on top
    // of what the teacher already drew. An empty page keeps the template's authored position.
    if (page.elements.some((e) => e && !e.hidden)) {
      const tb = getSelectionBounds(built);
      if (tb && Number.isFinite(tb.minX) && Number.isFinite(tb.minY)) {
        const origin = computeNonOverlappingOrigin(page, this.getUsableViewportCenter());
        const dx = origin.x - tb.minX;
        const dy = origin.y - tb.minY;
        for (const el of built) translateElement(el, dx, dy);
      }
    }
    page.elements.push(...built);
    updateConnectorBindings(page);
    this.commitChange();
    this.fitToContent();
    this.updateUI();
    this.dialogs.showToast(`Applied template "${tpl.name}".`);
  }

  insertTemplate(tplId) {
    return this.applyTemplate(tplId);
  }

  insertMathOverlay(kind = 'ruler') {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    const origin = computeNonOverlappingOrigin(page, this.getUsableViewportCenter());
    const el = createElement('math', { x: origin.x, y: origin.y, mathKind: kind });
    page.elements.push(el);
    this.selectedIds = new Set([el.id]);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return el;
  }

  insertMathTool(kind = 'ruler') {
    return this.insertMathOverlay(kind);
  }

  addSelectionToLibrary() {
    const sel = this.getSelectedElements();
    if (sel.length === 0) return;
    this.dialogs.openPromptModal({
      title: 'Save to My Library',
      label: 'Component Name:',
      defaultValue: `Reusable (${sel.length})`,
      confirmLabel: 'Save Component',
      onConfirm: (name) => {
        if (!name) return;
        this.userLibrary.push({
          id: uid('ulib'),
          name,
          elements: cloneElementsWithBindings(sel, 0, 0),
        });
        saveUserLibrary(this.userLibrary);
        this.libraryUI.update();
        this.dialogs.showToast(`Saved "${name}" to My Library.`);
      },
    });
  }

  insertUserLibraryItem(idx) {
    if (!this.collab.canEditBoard()) return;
    const item = this.userLibrary[idx];
    if (!item) return;
    const clones = cloneElementsWithBindings(item.elements, 40, 40);
    const check = validateElementsBatch(clones);
    if (!check.valid) {
      this.dialogs.showToast(`Library item rejected: ${check.reason}`);
      return;
    }
    this.getPage().elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  deleteUserLibraryItem(idx) {
    this.userLibrary.splice(idx, 1);
    saveUserLibrary(this.userLibrary);
    this.libraryUI.update();
  }

  exportUserLibrary() {
    const blob = new Blob([JSON.stringify(this.userLibrary, null, 2)], { type: 'application/json' });
    this.downloadBlob(blob, 'whiteboard.library.json');
  }

  togglePanel(panelId) {
    const p = document.getElementById(panelId);
    if (!p) return;
    const willOpen = p.classList.contains('wb-hidden');
    if (willOpen) {
      for (const id of ['wb-library-panel', 'wb-layers-panel', 'wb-classroom-panel']) {
        if (id !== panelId) document.getElementById(id)?.classList.add('wb-hidden');
      }
      if (panelId !== 'wb-library-panel') this.clearPlacementPreview();
    }
    p.classList.toggle('wb-hidden');
    if (p.classList.contains('wb-hidden') && panelId === 'wb-library-panel') {
      this.clearPlacementPreview();
    }
    this.updateUI();
  }

  propsContextVisible() {
    if (!this.propsDrawerOpen) return false;
    if (this.propsPinned) return true;
    if (this.selectedIds.size > 0) return true;
    if (this.activeTool !== 'select' && this.activeTool !== 'hand') return true;
    return Boolean(this.propsCanvasMode);
  }

  setPropsDrawerOpen(open) {
    this.propsDrawerOpen = Boolean(open);
    this.propsCanvasMode =
      this.propsDrawerOpen &&
      this.selectedIds.size === 0 &&
      (this.activeTool === 'select' || this.activeTool === 'hand');
    const p = document.getElementById('wb-props-panel');
    if (p) {
      p.classList.toggle('wb-hidden', !this.propsContextVisible());
    }
    this.workspacePrefs = {
      ...this.workspacePrefs,
      inspectorOpen: this.propsDrawerOpen,
    };
    saveWorkspacePreferences(this.workspacePrefs);
    this.propsUI?.update();
    this.toolbarUI?.update();
  }

  togglePropsDrawer() {
    this.setPropsDrawerOpen(!this.propsDrawerOpen);
  }

  togglePropsPinned() {
    this.propsPinned = !this.propsPinned;
    this.workspacePrefs = { ...this.workspacePrefs, inspectorPinned: this.propsPinned };
    saveWorkspacePreferences(this.workspacePrefs);
    this.propsUI?.update();
    this.toolbarUI?.update();
  }

  setBrushPreset(presetId, options = {}) {
    const preset = getBrushPreset(presetId);
    if (!preset) return;
    this.currentBrush = preset.id;
    this.brushSmoothing = preset.smoothing || this.brushSmoothing;
    this.brushOverrides = {};
    this.currentStyle = {
      ...this.currentStyle,
      brush: preset.id,
      strokeWidth: preset.strokeWidth,
      opacity: preset.opacity,
    };
    if (options.applyToSelection) {
      const page = this.getPage();
      const targets = page.elements.filter(
        (e) => this.selectedIds.has(e.id) && (e.type === 'pen' || e.type === 'highlighter')
      );
      for (const el of targets) {
        el.brush = preset.id;
        el.strokeWidth = preset.strokeWidth;
        el.opacity = preset.opacity;
        el.smoothing = preset.smoothing;
      }
      if (targets.length > 0) this.commitChange();
    }
    this.workspacePrefs = {
      ...this.workspacePrefs,
      brush: preset.id,
      brushSmoothing: this.brushSmoothing,
      // Picking a preset discards any tuning from the previous one; persist that
      // so reloading does not resurrect stale overrides.
      brushOverrides: {},
    };
    saveWorkspacePreferences(this.workspacePrefs);
    this.updateUI();
    this.requestRender();
  }

  applyArrowPresetToSelection(presetId) {
    // A preset is a complete, documented combination: choosing one discards
    // route/head overrides from the tabs instead of half-applying both.
    this.pendingArrowStyle = {};
    const page = this.getPage();
    const targets = page.elements.filter(
      (e) => this.selectedIds.has(e.id) && (e.type === 'line' || e.type === 'arrow') && !e.locked
    );
    if (targets.length === 0) {
      // Nothing selected: make the preset the default for the next arrow drawn.
      this.pendingArrowPreset = presetId;
      this.setTool('arrow');
      this.dialogs?.showToast(
        `Arrow preset ready: ${ARROW_QUICK_PRESETS.find((p) => p.id === presetId)?.name || presetId}.`
      );
      return false;
    }
    for (const el of targets) applyArrowQuickPreset(el, presetId);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return true;
  }

  // Fine-grained arrow settings from the dock's Route / Heads tabs. Applied to
  // the selected connectors immediately, and remembered for the next arrow.
  applyArrowStyle(patch = {}) {
    const clean = {};
    if (patch.routing !== undefined) clean.routing = patch.routing;
    if (patch.startArrow !== undefined) clean.startArrow = patch.startArrow;
    if (patch.endArrow !== undefined) clean.endArrow = patch.endArrow;
    if (patch.cornerRadius !== undefined) {
      clean.cornerRadius = Math.max(2, Math.min(48, Number(patch.cornerRadius) || 14));
    }
    if (Object.keys(clean).length === 0) return false;
    this.pendingArrowStyle = { ...(this.pendingArrowStyle || {}), ...clean };
    const page = this.getPage();
    const targets = page.elements.filter(
      (e) => this.selectedIds.has(e.id) && (e.type === 'line' || e.type === 'arrow') && !e.locked
    );
    if (targets.length === 0) {
      this.toolbarUI?.update?.();
      this.requestRender();
      return false;
    }
    for (const el of targets) Object.assign(el, clean);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return true;
  }

  // Preset selection arms the arrow tool; it never drops an object by itself.
  // Drag on the canvas to place the arrow with the chosen look.
  armArrowTool(presetId = null) {
    if (!this.collab.canEditBoard()) {
      this.dialogs?.showToast?.('Viewers cannot insert elements onto the board.');
      return false;
    }
    const chosen = presetId || this.pendingArrowPreset || 'simple-sketch';
    this.pendingArrowPreset = chosen;
    this.setTool('arrow');
    const name = ARROW_QUICK_PRESETS.find((p) => p.id === chosen)?.name || chosen;
    this.dialogs?.showToast?.(
      `Arrow tool ready: ${name}. Drag to draw, or use Insert sample for a ready-made arrow.`
    );
    return true;
  }

  // Explicit "Insert sample": a ready-made arrow placed clear of existing objects.
  insertSimpleArrow(presetId = null) {
    const chosen = presetId || this.pendingArrowPreset || 'simple-sketch';
    if (!this.collab.canEditBoard()) {
      this.dialogs?.showToast?.('Viewers cannot insert elements onto the board.');
      return null;
    }
    const page = this.getPage();
    const origin = computeNonOverlappingOrigin(page, this.getViewportCenterWorld());
    const el = createElement('arrow', {
      x: Math.round(origin.x - 90),
      y: Math.round(origin.y),
      x2: Math.round(origin.x + 90),
      y2: Math.round(origin.y),
    });
    applyArrowQuickPreset(el, chosen);
    Object.assign(el, this.pendingArrowStyle || {});
    page.elements.push(el);
    this.selectedIds = new Set([el.id]);
    this.commitChange();
    this.updateUI();
    this.requestRender();
    return el;
  }

  setBrushOverrides(next = {}, { silent = false } = {}) {
    const clean = { ...(this.brushOverrides || {}) };
    for (const [key, value] of Object.entries(next)) {
      if (value === null) delete clean[key];
      else if (Number.isFinite(value)) clean[key] = value;
    }
    this.brushOverrides = clean;
    this.workspacePrefs = { ...this.workspacePrefs, brushOverrides: clean };
    saveWorkspacePreferences(this.workspacePrefs);
    if (!silent) this.updateUI();
    this.requestRender();
  }

  setBrushSmoothing(mode) {
    if (!['off', 'adaptive', 'stabilizer'].includes(mode)) return;
    this.brushSmoothing = mode;
    this.workspacePrefs = { ...this.workspacePrefs, brushSmoothing: mode };
    saveWorkspacePreferences(this.workspacePrefs);
    this.updateUI();
  }

  setEraserSetting(key, value, options = {}) {
    if (!['size', 'mode', 'scope'].includes(key)) return;
    this.eraserSettings = { ...this.eraserSettings, [key]: value };
    this.workspacePrefs = {
      ...this.workspacePrefs,
      eraserSize: this.eraserSettings.size,
      eraserMode: this.eraserSettings.mode,
      eraserScope: this.eraserSettings.scope,
    };
    saveWorkspacePreferences(this.workspacePrefs);
    if (!options.silent) this.updateUI();
    this.requestRender();
  }

  toggleSpotlight(magnifier = false) {
    if (this.spotlight.active && this.spotlight.magnifier === Boolean(magnifier)) {
      this.turnSpotlightOff();
    } else {
      // Activating from off always starts clean: a stale pin or element fit
      // left by a raw `active = false` (e.g. the banner exit button) must not
      // freeze the lens away from the cursor on the next activation.
      if (!this.spotlight.active) this.clearSpotlightPin();
      this.spotlight.active = true;
      this.spotlight.magnifier = Boolean(magnifier);
    }
    this.toolbarUI.update();
    this.requestRender();
  }

  turnSpotlightOff() {
    this.spotlight.active = false;
    this.clearSpotlightPin();
    this.presentUI?.renderBar?.();
    this.updateUI();
    this.requestRender();
  }

  // Pinned spotlights live in WORLD coordinates (pinWorld / pinElementId) and
  // are re-projected to screen every render — a pin baked in screen coords
  // would drift as soon as the camera pans or zooms. Plain circle pins keep
  // the element fit fields clear so the size presets stay exact.
  clearSpotlightPin() {
    this.spotlight.pinned = false;
    this.spotlight.pinWorld = null;
    this.spotlight.pinElementId = null;
    this.spotlight.fitRx = null;
    this.spotlight.fitRy = null;
    this.spotlight.fitBase = null;
  }

  // Point the spotlight at a right-clicked world point. Pinned so it stays
  // there instead of resuming the cursor follow on the next pointer move.
  pointSpotlightAt(world) {
    const cam = this.getCamera();
    this.clearSpotlightPin();
    this.spotlight.pinWorld = { x: world.x, y: world.y };
    this.spotlight.x = world.x * cam.zoom + cam.x;
    this.spotlight.y = world.y * cam.zoom + cam.y;
    this.spotlight.pinned = true;
    this.spotlight.active = true;
    this.toolbarUI.update();
    this.requestRender();
  }

  // Point the spotlight at an element: the lens re-fits to the element's
  // CURRENT bounds on every render, so moving or resizing the element keeps
  // it inside the spotlight.
  pointSpotlightToElement(el) {
    if (!el) return;
    this.clearSpotlightPin();
    this.spotlight.pinElementId = el.id;
    this.spotlight.pinned = true;
    this.spotlight.active = true;
    this.toolbarUI.update();
    this.requestRender();
  }

  // Preset sizes are plain circles: they replace any element fit so the
  // chosen radius is exactly what renders.
  setSpotlightSize(radius) {
    this.spotlight.radius = Math.max(20, Number(radius) || 180);
    // While an element pin is active the lens re-fits from the element's
    // bounds every render, so a preset radius would silently do nothing —
    // and the menu still shows a ✓ for it. Convert the pin to a plain
    // circle at the element's current center so the preset takes effect.
    if (this.spotlight.pinned && this.spotlight.pinElementId) {
      const el = this.getPage()?.elements.find((e) => e.id === this.spotlight.pinElementId);
      if (el) {
        const b = getElementBounds(el);
        this.spotlight.pinWorld = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
      }
      this.spotlight.pinElementId = null;
    }
    this.spotlight.fitRx = null;
    this.spotlight.fitRy = null;
    this.spotlight.fitBase = null;
    this.toolbarUI.update();
    this.requestRender();
  }

  // Resume the cursor follow after a pinned "point" placement.
  unpinnedSpotlightFollow() {
    this.clearSpotlightPin();
    this.requestRender();
  }

  toggleAnnotationMode() {
    this.annotationMode = !this.annotationMode;
    if (this.annotationMode && this.activeTool !== 'pen' && this.activeTool !== 'highlighter') {
      this.setTool('pen');
    }
    this.toolbarUI.update();
    this.requestRender();
  }

  toggleFocusMode() {
    this.focusMode = !this.focusMode;
    document.body.classList.toggle('wb-focus-mode', this.focusMode);
    if (this.focusMode) {
      this.clearPlacementPreview();
    }
    this.toolbarUI.update();
    this.handleResize();
  }

  toggleFullScreen() {
    try {
      if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    } catch {
      // Ignore fullscreen API restriction in embedded contexts
    }
  }

  toggleFullscreen() {
    this.toggleFullScreen();
  }

  toggleImageCrop(el) {
    if (this.cropState && this.cropState.element.id === el.id) {
      const box = this.cropState.box || this.cropState.rect;
      const sx = (el.naturalWidth || el.w) / el.w;
      const sy = (el.naturalHeight || el.h) / el.h;
      el.crop = {
        x: Math.max(0, (box.x - el.x) * sx),
        y: Math.max(0, (box.y - el.y) * sy),
        w: Math.max(16, box.w * sx),
        h: Math.max(16, box.h * sy),
      };
      el.x = box.x;
      el.y = box.y;
      el.w = box.w;
      el.h = box.h;
      this.cropState = null;
      this.commitChange();
    } else {
      const rect = {
        x: el.x + 12,
        y: el.y + 12,
        w: Math.max(32, el.w - 24),
        h: Math.max(32, el.h - 24),
      };
      this.cropState = {
        element: el,
        box: rect,
        rect,
      };
    }
    this.propsUI.update();
    this.requestRender();
  }

  toggleImageBackgroundLock(el) {
    el.isBackground = !el.isBackground;
    el.locked = el.isBackground;
    if (el.isBackground) {
      reorderElement(this.getPage(), el.id, 'back');
      this.selectedIds.delete(el.id);
    }
    this.commitChange();
    this.updateUI();
    this.requestRender();
  }

  _initTheme() {
    document.documentElement.setAttribute('data-theme', this.scene.theme || 'light');
  }

  cycleTheme() {
    const idx = THEME_ORDER.indexOf(this.scene.theme);
    const next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
    this.scene.theme = next;
    document.documentElement.setAttribute('data-theme', next);
    saveThemePreference(next);
    this.scheduleAutosave(this.scene);
    this.requestRender();
  }

  toggleTheme() {
    this.cycleTheme();
  }

  downloadBlob(blob, filename = 'download') {
    const a = document.createElement('a');
    const url = URL.createObjectURL(blob);
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL?.(url), 1500);
  }

  exportPngDownload(options = {}) {
    try {
      const offscreen = this.renderer.exportToPngCanvas(this.scene, this.getPage(), options);
      const safeName = (this.getPage().name || 'page')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      if (typeof offscreen.toBlob === 'function') {
        offscreen.toBlob((blob) => {
          if (blob) {
            this.downloadBlob(blob, `${safeName}.png`);
            this.dialogs.showToast('Downloaded PNG export.', 'success');
          }
        }, 'image/png');
      } else if (typeof offscreen.toDataURL === 'function') {
        const a = document.createElement('a');
        a.href = offscreen.toDataURL('image/png');
        a.download = `${safeName}.png`;
        a.click();
        this.dialogs.showToast('Downloaded PNG export.', 'success');
      }
    } catch (err) {
      this.dialogs.showToast(`PNG export failed: ${err.message}`);
    }
  }

  async copyPngToClipboard(options = {}) {
    try {
      const offscreen = this.renderer.exportToPngCanvas(this.scene, this.getPage(), options);
      if (navigator.clipboard?.write && typeof ClipboardItem !== 'undefined' && typeof offscreen.toBlob === 'function') {
        const blob = await new Promise((resolve) => offscreen.toBlob(resolve, 'image/png'));
        if (blob) {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
          this.dialogs.showToast('Copied PNG to clipboard.', 'success');
          return true;
        }
      }
      this.exportPngDownload(options);
      return false;
    } catch {
      this.exportPngDownload(options);
      return false;
    }
  }

  // Ordered multi-page PDF handout: one printed sheet per page, in page order.
  // Teacher notes are never rendered into the canvas, so they cannot leak into the print.
  printHandout(options = {}) {
    const { scale = 2 } = options;
    const pages = this.scene.pages;
    if (!pages.length) return;
    document.getElementById('wb-print-root')?.remove();
    const root = document.createElement('div');
    root.id = 'wb-print-root';
    root.setAttribute('aria-hidden', 'true');
    pages.forEach((page, idx) => {
      const sheet = document.createElement('section');
      sheet.className = 'wb-print-sheet';
      const canvas = document.createElement('canvas');
      try {
        this.renderer.renderPageToCanvas(this.scene, page, canvas, {
          scale,
          width: page.width || 1280,
          height: page.height || 720,
          showGrid: false,
        });
      } catch {
        // A single bad page must not abort the rest of the handout.
      }
      const label = document.createElement('div');
      label.className = 'wb-print-label';
      label.textContent = `${idx + 1} / ${pages.length} — ${page.name || 'Page'}`;
      sheet.appendChild(canvas);
      sheet.appendChild(label);
      root.appendChild(sheet);
    });
    document.body.appendChild(root);
    const cleanup = () => {
      root.remove();
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    // Give the print root one frame to lay out before the dialog snapshots the DOM.
    setTimeout(() => window.print(), 120);
    return pages.length;
  }

  openImageFilePicker() {
    document.getElementById('wb-file-image')?.click();
  }

  openWhiteboardFilePicker() {
    document.getElementById('wb-file-open-json')?.click();
  }

  saveSceneFile() {
    try {
      saveRecoverySnapshot(this.scene, 'Pre-save Checkpoint');
      const json = serializeScene(this.scene);
      const blob = new Blob([json], { type: 'application/json' });
      const safeName = (this.scene.title || 'board')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      this.downloadBlob(blob, `${safeName}.whiteboard.json`);
    } catch (err) {
      this.dialogs.showToast(`Save aborted: ${err.message}`);
    }
  }

  saveWhiteboardFile() {
    this.saveSceneFile();
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('hashchange', () => this._initShareRouteFromHash());
    // Never lose a note/edit typed inside the autosave debounce window on reload or tab close.
    const flushPendingSave = () => {
      if (this.textTool?.isOpen()) this.textTool.commit();
      if (typeof this.scheduleAutosave?.flush === 'function') this.scheduleAutosave.flush();
    };
    window.addEventListener('pagehide', flushPendingSave);
    window.addEventListener('beforeunload', flushPendingSave);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') flushPendingSave();
    });
    window.addEventListener('blur', () => {
      this.spacePressed = false;
      this.cancelActiveInteractions();
      this.requestRender();
    });

    this.canvas.addEventListener('pointerdown', (ev) => this._onPointerDown(ev));
    this.canvas.addEventListener('dblclick', (ev) => this._onDoubleClick(ev));
    this.canvas.addEventListener('contextmenu', (ev) => this._onContextMenu(ev));
    document.getElementById('wb-canvas-settings-chip')?.addEventListener('click', () => {
      this.propsCanvasMode = true;
      this.propsDrawerOpen = true;
      this.updateUI();
    });
    window.addEventListener('pointermove', (ev) => this._onPointerMove(ev));
    window.addEventListener('pointerup', (ev) => this._onPointerUp(ev));
    window.addEventListener('pointercancel', (ev) => {
      this._releasePointerCapture(ev);
      this.cancelActiveInteractions();
      this.requestRender();
    });

    this.canvas.addEventListener(
      'wheel',
      (ev) => {
        // In Notebook view a plain wheel/trackpad scrolls the page stack natively.
        // Ctrl/Cmd + wheel is an explicit notebook zoom gesture.
        if (this.viewMode === 'notebook') {
          if (ev.ctrlKey || ev.metaKey) {
            ev.preventDefault();
            const current = this.notebookView?.getScale?.() || 0.55;
            this.notebookView?.setScale(current * (ev.deltaY < 0 ? 1.1 : 1 / 1.1));
          }
          return;
        }
        ev.preventDefault();
        if (this.collab.followingTeacher) this.collab.setFollowTeacher(false);
        const rect = this.canvas.getBoundingClientRect();
        const sx = ev.clientX - rect.left;
        const sy = ev.clientY - rect.top;
        if (ev.ctrlKey || ev.metaKey) {
          this.zoomBy(ev.deltaY < 0 ? 1.1 : 1 / 1.1, { x: sx, y: sy });
        } else {
          const cam = this.getPage().camera;
          cam.x -= ev.deltaX;
          cam.y -= ev.deltaY;
          this.collab.broadcastTeacherCamera();
          this.requestRender();
        }
      },
      { passive: false }
    );

    this.canvasWrap.addEventListener('dragover', (ev) => ev.preventDefault());
    this.canvasWrap.addEventListener('drop', (ev) => {
      const data = ev.dataTransfer?.getData('text/plain') || '';
      if (data.startsWith('stencil:')) {
        ev.preventDefault();
        const world = this.screenToWorld(ev.clientX, ev.clientY);
        this.placeStencil(data.slice('stencil:'.length), { x: world.x - 78, y: world.y - 57 });
      }
    });

    document.getElementById('wb-file-open-json')?.addEventListener('change', async (e) => {
      if (!this.collab.canEditBoard()) {
        this.dialogs.showToast('Cannot overwrite board in read-only / viewer mode.');
        e.target.value = '';
        return;
      }
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        saveRecoverySnapshot(this.scene, 'Before Open File');
        this.scene = parseSceneJson(await f.text());
        for (const p of this.scene.pages) this.history.initPage(p);
        this.selectedIds.clear();
        this._initTheme();
        this.scheduleAutosave(this.scene);
        this.collab.broadcastSceneChange();
        this.updateUI();
        this.requestRender();
        this.dialogs.showToast(`Opened "${f.name}".`);
      } catch (err) {
        this.dialogs.showToast(`Failed to open JSON: ${err.message}`);
      }
      e.target.value = '';
    });

    document.getElementById('wb-file-image')?.addEventListener('change', (e) => {
      if (!this.collab.canEditBoard()) {
        this.dialogs.showToast('Image insertion is disabled in read-only / viewer mode.');
        e.target.value = '';
        return;
      }
      if (e.target.files?.length) handleImageFiles(this, e.target.files);
      e.target.value = '';
    });

    document.getElementById('wb-file-import-lib')?.addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      if (!f) return;
      try {
        const list = JSON.parse(await f.text());
        if (Array.isArray(list)) {
          this.userLibrary.push(...list);
          saveUserLibrary(this.userLibrary);
          this.libraryUI.update();
          this.dialogs.showToast('Imported user library items.');
        }
      } catch (err) {
        this.dialogs.showToast(err.message);
      }
      e.target.value = '';
    });

    window.addEventListener('keydown', (ev) => this._onKeyDown(ev));
    // Another tab wrote the board. Never overwrite silently: surface it and let
    // the teacher decide, while keeping this tab's work in memory.
    window.addEventListener('storage', (ev) => {
      if (ev.key !== STORAGE_KEY || !ev.newValue) return;
      const stillSaved = ev.newValue === ev.oldValue;
      if (stillSaved) return;
      const el = document.getElementById('wb-autosave-status');
      if (el) {
        el.textContent = 'Changed in another tab';
        el.dataset.state = 'conflict';
        el.title = 'Another browser tab saved this board. Reload to take their version, or export yours first.';
      }
      if (!this._conflictToastAt || Date.now() - this._conflictToastAt > 8000) {
        this._conflictToastAt = Date.now();
        this.dialogs?.showToast?.(
          'This board changed in another tab. Export or reload before editing further.',
          'warn'
        );
      }
    });
    // Spreadsheet paste: tab/newline-separated text fills the selected table
    // instead of being ignored. Text fields keep the native paste behaviour.
    window.addEventListener('paste', (ev) => {
      const t = ev.target;
      const inField =
        t &&
        (t.tagName === 'INPUT' ||
          t.tagName === 'TEXTAREA' ||
          t.isContentEditable ||
          t.closest?.('.wb-modal-box, .wb-props-panel, .wb-context-menu'));
      if (inField) return;
      if (this.editingElementId) return;
      if (!this.collab.canEditBoard()) return;
      const selected = this.getPage().elements.filter((e) => this.selectedIds.has(e.id));
      if (selected.length !== 1 || selected[0].type !== 'table' || selected[0].locked) return;
      const text = ev.clipboardData?.getData('text/plain') || '';
      if (!/[\t\n]/.test(text)) return;
      ev.preventDefault();
      const start = this.lastTableCell?.elId === selected[0].id ? this.lastTableCell : { row: 0, col: 0 };
      const res = pasteTsvIntoTable(selected[0], text, start.row, start.col);
      // Grow the table to fit the pasted content rather than clipping it.
      fitTable(this.renderer?.ctx, selected[0]);
      this.commitChange();
      this.updateUI();
      this.requestRender();
      this.dialogs?.showToast?.(`Pasted ${res.filled} cell(s) into the table.`, 'success');
    });
    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'Space') {
        this.spacePressed = false;
        this._updateCanvasCursor();
      }
    });
  }

  _getToolHandler() {
    if (this.activeSubInteraction) return this.activeSubInteraction;
    const t = this.activeTool;
    if (t === 'select') return this.selectTool;
    if (t === 'pen' || t === 'highlighter') return this.drawTool;
    if (t === 'eraser') return this.eraserTool;
    if (t === 'line' || t === 'arrow') return this.connectorTool;
    if (t === 'text') return this.textTool;
    if (t === 'laser') return this.laserTool;
    if (t === 'stamp') return this.stampTool;
    if (t === 'math') return this.mathTool;
    if (t === 'pointer' || t === 'question') return this.classroomTool;
    return this.shapeTool;
  }

  _onPointerDown(ev) {
    const rect = this.canvas.getBoundingClientRect();
    // A pinned (right-click pointed) spotlight keeps its position instead of
    // following the cursor.
    if (!(this.spotlight.active && this.spotlight.pinned)) {
      this.spotlight.x = ev.clientX - rect.left;
      this.spotlight.y = ev.clientY - rect.top;
    }
    // The cursor chat input opens at the last canvas pointer position.
    this._lastCanvasPointer = { x: ev.clientX, y: ev.clientY };

    if (this.textTool.isOpen()) this.textTool.commit();

    // Capture so a stroke still receives moves/up when the pointer leaves the canvas.
    if (typeof ev.pointerId === 'number' && this.canvas.setPointerCapture) {
      try {
        this.canvas.setPointerCapture(ev.pointerId);
        this._capturedPointerId = ev.pointerId;
      } catch {
        // Capture is best-effort; window-level listeners remain the fallback.
      }
    }

    if (ev.button === 1 || this.spacePressed || this.activeTool === 'hand') {
      if (this.collab.followingTeacher) this.collab.setFollowTeacher(false);
      this.isPanning = true;
      this._canvasPointerActive = true;
      this.panStart = { x: ev.clientX, y: ev.clientY };
      this._updateCanvasCursor();
      return;
    }

    // Prevent Spotlight from accidentally drawing, selecting, or dragging objects
    if (this.spotlight.active) {
      this.requestRender();
      return;
    }

    // Dot voting is a mode: a click casts a vote instead of selecting or drawing.
    if (this.votingUI?.isActive?.()) {
      const world = this.screenToWorld(ev.clientX, ev.clientY);
      const hit = hitTestScene(this.getPage(), world.x, world.y, { includeLocked: true, tolerance: 10 });
      if (hit) this.votingUI.castVoteOn(hit);
      return;
    }

    this._canvasPointerActive = true;
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this._getToolHandler().onPointerDown(world, ev);
  }

  _onPointerMove(ev) {
    const rect = this.canvas.getBoundingClientRect();
    if (!(this.spotlight.active && this.spotlight.pinned)) {
      this.spotlight.x = ev.clientX - rect.left;
      this.spotlight.y = ev.clientY - rect.top;
    }
    if (this.spotlight.active) {
      this.requestRender();
      return;
    }

    if (this.isPanning) {
      const cam = this.getPage().camera;
      cam.x += ev.clientX - this.panStart.x;
      cam.y += ev.clientY - this.panStart.y;
      this.panStart = { x: ev.clientX, y: ev.clientY };
      this.collab.broadcastTeacherCamera();
      this.requestRender();
      return;
    }

    if (!this._canvasPointerActive && ev.target !== this.canvas) {
      return;
    }

    this._lastCanvasPointer = { x: ev.clientX, y: ev.clientY };
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this.collab.sendCursorUpdate(world, Array.from(this.selectedIds));
    this._getToolHandler().onPointerMove(world, ev);
  }

  _releasePointerCapture(ev = {}) {
    const id = ev.pointerId ?? this._capturedPointerId;
    if (id == null) return;
    try {
      if (this.canvas.hasPointerCapture?.(id)) this.canvas.releasePointerCapture(id);
    } catch {
      // Already released by the browser.
    }
    this._capturedPointerId = null;
  }

  _onPointerUp(ev) {
    this._releasePointerCapture(ev);
    if (this.isPanning) {
      this.isPanning = false;
      this._canvasPointerActive = false;
      this._updateCanvasCursor();
      return;
    }
    if (!this._canvasPointerActive) {
      return;
    }
    this._canvasPointerActive = false;
    if (this.spotlight.active) return;
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this._getToolHandler().onPointerUp(world, ev);
  }

  // Double-click a shape/connector/label/table cell/code block to edit its text in place.
  // Enter/Edit Text in the Inspector is the keyboard-accessible equivalent.
  _onContextMenu(ev) {
    if (this.presentState.active) return;
    ev.preventDefault();
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    const page = this.getPage();
    const hit = hitTestScene(page, world.x, world.y, { includeLocked: true, tolerance: 10 });
    if (hit && !this.selectedIds.has(hit.id)) {
      this.selectedIds = new Set([hit.id]);
      this.textTool?.commit?.();
      this.updateUI();
      this.requestRender();
    }
    const items = buildContextItems(this, hit, world);
    this.contextMenu?.open(items, {
      x: ev.clientX,
      y: ev.clientY,
      // The canvas itself has no tabindex, so restore focus to its wrapper.
      returnFocus: this.canvasWrap || this.canvas,
    });
  }

  _onDoubleClick(ev) {
    if (this.presentState.active) return;
    if (this.collab && !this.collab.canEditBoard()) return;
    if (this.textTool.isOpen()) return;
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    const hit = hitTestScene(this.getPage(), world.x, world.y, {
      includeLocked: false,
      tolerance: 12,
    });
    if (!hit) {
      // Double-click on empty canvas starts a new text box — the standard
      // whiteboard gesture. Restricted to the selection/text tools so the
      // drawing tools keep their double-taps for inking.
      if (this.activeTool !== 'select' && this.activeTool !== 'text') return;
      ev.preventDefault();
      ev.stopPropagation();
      this.dialogs?.close?.();
      this.textTool.onPointerDown(world);
      this.updateUI();
      return;
    }
    if (hit.locked) return;
    const EDITABLE = new Set([
      'text',
      'rect',
      'rounded-rect',
      'ellipse',
      'diamond',
      'sticky',
      'code',
      'table',
      'line',
      'arrow',
      'stencil',
      'image',
      'frame',
    ]);
    if (!EDITABLE.has(hit.type) && !hit.isBoundary) return;
    ev.preventDefault();
    ev.stopPropagation();
    this.dialogs?.close?.();
    this.selectedIds = new Set([hit.id]);
    this.textTool.openEditorForElement(hit, world);
    this.updateUI();
  }

  _isEditingInput(target) {
    if (this.textTool.isOpen()) return true;
    if (this.cursorChat?.isOpen()) return true;
    if (!target || typeof target !== 'object') return false;
    const tag = (target.tagName || '').toUpperCase();
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      Boolean(target.isContentEditable)
    );
  }

  _onKeyDown(ev) {
    // Do not intercept Escape, letter shortcuts, or arrow keys while editing text or typing in inputs
    if (this._isEditingInput(ev.target)) {
      if (ev.key === 'Escape') {
        ev.preventDefault();
        if (this.paletteUI.isOpen()) this.paletteUI.close();
        else if (this.dialogs.isOpen()) this.dialogs.close();
        else if (this.textTool.isOpen()) this.textTool.commit();
      }
      return;
    }

    // Keyboard route to the context menu for devices without a usable secondary button.
    if ((ev.key === 'F10' && ev.shiftKey) || ev.key === 'ContextMenu') {
      ev.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      const sel = this.getPage().elements.filter((e) => this.selectedIds.has(e.id));
      let clientX = rect.left + rect.width / 2;
      let clientY = rect.top + rect.height / 2;
      if (sel.length > 0) {
        const b = getSelectionBounds(sel);
        const cam = this.getCamera();
        if (b) {
          clientX = rect.left + (b.minX + b.w / 2) * cam.zoom + cam.x;
          clientY = rect.top + (b.minY + b.h / 2) * cam.zoom + cam.y;
        }
      }
      this._onContextMenu({ preventDefault() {}, clientX, clientY });
      return;
    }

    // Explicit Escape hierarchy:
    // 0. An open context menu consumes Esc (close menu only)
    // 1. Dismiss active dialog/palette first
    // 2. Otherwise cancel current interaction or preview
    // 3. Otherwise exit active teaching mode (Spotlight, Presentation, Annotation, Laser, Focus)
    // 4. Otherwise clear selection and return to Select tool
    if (ev.key === 'Escape') {
      ev.preventDefault();
      // spotlightEscapeAction encodes the menu-vs-spotlight precedence table:
      // one Esc press never closes the menu and the spotlight together.
      const escAction = spotlightEscapeAction({
        menuOpen: this.contextMenu?.isOpen?.() || false,
        spotlightActive: this.spotlight.active,
      });
      if (escAction === 'close-menu') {
        this.contextMenu.close();
        return;
      }
      if (this.paletteUI.isOpen()) {
        this.paletteUI.close();
        return;
      }
      if (this.dialogs.isOpen()) {
        this.dialogs.close();
        return;
      }
      if (this.placementPreview) {
        this.clearPlacementPreview();
        return;
      }
      if (this.cropState) {
        this.cropState = null;
        this.updateUI();
        this.requestRender();
        return;
      }
      if (this.activeSubInteraction || this.connectorTool.activeConnector) {
        this.activeSubInteraction = null;
        this.connectorTool.cancel();
        return;
      }
      if (this.selectTool.isActive()) {
        this.selectTool.cancel();
        return;
      }
      if (escAction === 'spotlight-off') {
        this.turnSpotlightOff();
        return;
      }
      if (this.presentState.active) {
        this.presentUI.exit();
        return;
      }
      if (this.annotationMode) {
        this.toggleAnnotationMode();
        return;
      }
      if (this.votingUI?.isActive?.()) {
        this.votingUI.stop();
        return;
      }
      if (this.activeTool === 'laser') {
        this.setTool('select');
        return;
      }
      if (this.focusMode) {
        this.toggleFocusMode();
        return;
      }
      this.selectedIds.clear();
      this.setTool('select');
      return;
    }

    // Accessible fallback for double-click editing: F2 or Enter edits the selected element.
    if ((ev.key === 'F2' || ev.key === 'Enter') && !this.presentState.active) {
      const target = this.getSelectedElements()[0];
      if (target && !target.locked) {
        ev.preventDefault();
        this.textTool.openEditorForElement(target);
        return;
      }
    }

    if (this.presentState.active) {
      if (ev.key === 'ArrowRight' || ev.key === ' ' || ev.key === 'PageDown') {
        ev.preventDefault();
        this.presentUI.stepNext();
      } else if (ev.key === 'ArrowLeft' || ev.key === 'PageUp') {
        ev.preventDefault();
        this.presentUI.stepPrev();
      } else if (!ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'l') {
        ev.preventDefault();
        this.setTool(this.activeTool === 'laser' ? 'select' : 'laser');
        this.presentUI.renderBar();
      } else if (!ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'p') {
        ev.preventDefault();
        this.setTool(this.activeTool === 'pen' ? 'select' : 'pen');
        this.presentUI.renderBar();
      } else if (!ev.ctrlKey && !ev.metaKey && ev.key.toLowerCase() === 'v') {
        ev.preventDefault();
        this.setTool('select');
        this.presentUI.renderBar();
      }
      return;
    }

    if (ev.code === 'Space') {
      this.spacePressed = true;
      this._updateCanvasCursor();
    }
    const mod = ev.ctrlKey || ev.metaKey;

    if (mod && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      this.paletteUI.open();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'z') {
      ev.preventDefault();
      if (ev.shiftKey) this.redo();
      else this.undo();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'y') {
      ev.preventDefault();
      this.redo();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'c') {
      ev.preventDefault();
      this.copySelection();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'x') {
      ev.preventDefault();
      this.cutSelection();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'v') {
      ev.preventDefault();
      this.pasteClipboard();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'd') {
      ev.preventDefault();
      this.duplicateSelection();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'a') {
      ev.preventDefault();
      this.selectedIds = new Set(
        this.getPage()
          .elements.filter((e) => !e.hidden && !e.locked)
          .map((e) => e.id)
      );
      this.updateUI();
      this.requestRender();
      return;
    }
    if (mod && ev.key.toLowerCase() === 'g') {
      ev.preventDefault();
      if (ev.shiftKey) this.ungroupSelection();
      else this.groupSelection();
      return;
    }
    if (ev.key === 'Delete' || ev.key === 'Backspace') {
      ev.preventDefault();
      this.deleteSelection();
      return;
    }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key) && this.selectedIds.size > 0) {
      if (!this.collab.canEditBoard()) return;
      ev.preventDefault();
      const step = ev.shiftKey ? 10 : 1;
      const dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0;
      const dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
      for (const el of this.getSelectedElements()) {
        if (!el.locked) translateElement(el, dx, dy);
      }
      updateConnectorBindings(this.getPage());
      this.commitChange();
      this.requestRender();
      return;
    }

    if (!mod && (ev.key === '[' || ev.key === ']')) {
      ev.preventDefault();
      this.reorderSelection(ev.key === '[' ? 'back' : 'front');
      return;
    }

    const key = ev.key.toLowerCase();
    if (!mod && ev.shiftKey && key === 'q') {
      ev.preventDefault();
      this.toggleToolLock();
      return;
    }
    if (!mod && key === 'f') {
      ev.preventDefault();
      if (ev.shiftKey) this.toggleFocusMode();
      else this.toggleFullScreen();
      return;
    }
    if (!mod && !ev.shiftKey && key === 'i') {
      ev.preventDefault();
      this.openImageFilePicker();
      return;
    }
    // V alone is Select, so dot voting takes the shifted pair.
    if (!mod && ev.shiftKey && key === 'v') {
      ev.preventDefault();
      this.votingUI?.toggle();
      return;
    }
    // Alt+W toggles text wrap: W alone stays the Point tool, so the wrap needs
    // the Alt modifier without ctrl/meta. Match on KeyW too — Alt on Mac
    // remaps the printed character.
    if (!mod && ev.altKey && (key === 'w' || ev.code === 'KeyW')) {
      ev.preventDefault();
      this.toggleTextWrap();
      return;
    }

    const map = {
      v: 'select',
      h: 'hand',
      p: 'pen',
      m: 'highlighter',
      e: 'eraser',
      r: 'rect',
      u: 'rounded-rect',
      o: 'ellipse',
      d: 'diamond',
      l: 'line',
      a: 'arrow',
      t: 'text',
      n: 'sticky',
      b: 'table',
      j: 'code',
      s: 'stamp',
      k: 'laser',
      w: 'pointer',
      q: 'question',
    };
    if (!mod && !ev.shiftKey && map[key]) {
      this.setTool(map[key]);
      return;
    }
    if (ev.key === 'F2') {
      this.setTool('frame');
      return;
    }
    if (ev.key === 'F6') {
      ev.preventDefault();
      this.presentUI.enter();
      return;
    }
    if (ev.key === 'F7') {
      ev.preventDefault();
      this.toggleSpotlight(false);
      return;
    }
    if (ev.key === 'F8') {
      ev.preventDefault();
      this.toggleAnnotationMode();
      return;
    }
    if (ev.key === 'F10') {
      ev.preventDefault();
      this.toggleFocusMode();
      return;
    }
    if (!mod && (ev.key === '+' || ev.key === '=')) {
      ev.preventDefault();
      this.zoomBy(1.2);
      return;
    }
    if (!mod && ev.key === '-') {
      ev.preventDefault();
      this.zoomBy(1 / 1.2);
      return;
    }
    if (!mod && ev.key === '0') {
      ev.preventDefault();
      this.resetZoom();
      return;
    }
    if (!mod && (ev.key === '1' || ev.key === '!' || (ev.shiftKey && ev.code === 'Digit1'))) {
      ev.preventDefault();
      this.fitToContent();
      return;
    }
    if (!mod && (ev.key === '2' || ev.key === '@' || (ev.shiftKey && ev.code === 'Digit2'))) {
      ev.preventDefault();
      this.zoomToSelection();
      return;
    }
    // Cursor chat: open the floating input at the last canvas pointer
    // position. Reachable in every role — viewers chat too.
    if (!mod && ev.key === '/') {
      ev.preventDefault();
      this.cursorChat?.open();
      return;
    }
    if (!mod && ev.key === '?') {
      this.dialogs.openShortcutsModal();
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__WHITEBOARD_APP__ = new WhiteboardApp();
});
