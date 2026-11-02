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
} from './scene/storage.js';
import { computeNonOverlappingOrigin } from './scene/mermaid.js';
import { computeBatchStencilPlacement, autoLayoutArchitecture } from './scene/layout.js';
import { CollabClient, parseShareRoute } from './scene/collab-client.js';
import { CanvasRenderer } from './render/canvas.js';
import { THEME_ORDER } from './render/themes.js';
import { getStencilById } from './stencils/index.js';
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
import { initCommandPalette } from './ui/palette.js';
import { initDialogs } from './ui/dialogs.js';
import { ClassroomTool, initClassroomUI, parseClassroomHash } from './ui/classroom.js';

const FOCUS_TOOLS_STORAGE_KEY = 'studioboard_focus_tools_v1';

export class WhiteboardApp {
  constructor() {
    this.scene = loadSceneFromStorage();
    this.history = new HistoryManager(100);
    for (const p of this.scene.pages) this.history.initPage(p);

    this.activeTool = 'select';
    this.toolLock = false;
    this.selectedIds = new Set();
    this.clipboard = [];
    this.formatPainterStyle = null;
    this.currentStyle = { ...DEFAULT_STYLE };
    this.nextStampNumber = 1;
    this.userLibrary = loadUserLibrary();

    this.hoveredElement = null;
    this.hoveredPort = null;
    this.connectorPreview = null;
    this.placementPreview = null;
    this.smartGuides = [];
    this.marqueeBox = null;
    this.cropState = null;
    this.spacePressed = false;
    this.isPanning = false;
    this.panStart = { x: 0, y: 0 };
    this.minimapOpen = true;
    this.annotationMode = false;
    this.focusMode = false;
    this.focusToolIds = this._loadFocusTools();
    this.propsDrawerOpen = false;
    this.studentPointers = [];
    this.spotlight = { active: false, x: 500, y: 340, radius: 130, magnifier: false, dimOpacity: 0.72 };
    this.presentState = { active: false, slideIndex: 0, revealStep: 0 };

    this.canvas = document.getElementById('wb-canvas');
    this.minimapCanvas = document.getElementById('wb-minimap');
    this.canvasWrap = document.getElementById('wb-canvas-wrap');
    this.renderer = new CanvasRenderer(this.canvas, this.minimapCanvas);

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
    this.paletteUI = initCommandPalette(this);

    this.scheduleAutosave = createDebouncedAutosave((state) => {
      const el = document.getElementById('wb-autosave-status');
      if (el) {
        el.textContent =
          state === 'saved' ? 'Saved locally' : state === 'saving' ? 'Saving…' : 'Save failed';
      }
    }, 350);

    this._initTheme();
    this._bindEvents();
    setupImagePasteAndDrop(this);
    this.handleResize();
    this._initShareRouteFromHash();
    this.updateUI();
    this.requestRender();
  }

  _loadFocusTools() {
    const def = ['select', 'hand', 'pen', 'highlighter', 'eraser', 'laser', 'question'];
    try {
      const raw = localStorage.getItem(FOCUS_TOOLS_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : def;
      return Array.isArray(parsed) && parsed.length > 0 ? parsed : def;
    } catch {
      return def;
    }
  }

  setFocusTools(toolIds) {
    this.focusToolIds = Array.isArray(toolIds) && toolIds.length ? toolIds : ['select'];
    try {
      localStorage.setItem(FOCUS_TOOLS_STORAGE_KEY, JSON.stringify(this.focusToolIds));
    } catch {
      // Ignore
    }
    this.updateUI();
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
      await this.collab.joinRoomById(route.roomId, route.token);
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

  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return screenToWorldPoint(clientX, clientY, rect, this.getPage().camera);
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

  setTool(toolId) {
    if (
      !this.collab.canEditBoard() &&
      !['select', 'hand', 'laser', 'pointer', 'question'].includes(toolId)
    ) {
      this.dialogs.showToast('Read-only / Viewer mode: use Point (W) or Question (Q) to participate.');
      return;
    }
    if (this.textTool.isOpen()) this.textTool.commit();
    this.activeTool = toolId;
    this.hoveredPort = null;
    this.connectorPreview = null;
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
    this.toolbarUI.update();
    this.propsUI.update();
    this.pagesUI.update();
    this.layersUI.update();
    this.classroomUI?.update();
  }

  requestRender() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => {
      this._raf = null;
      this.renderNow();
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
    this.studentPointers = this.studentPointers.filter((p) => now - p.createdAt < 6500);
    const activeTrail = this.laserTool.prune(now);
    const remoteCursors = this.collab.getInterpolatedRemoteCursors(page.id);

    this.renderer.render(this.scene, {
      selectedIds: this.selectedIds,
      hoveredElement: this.hoveredElement,
      hoveredPort: this.hoveredPort,
      connectorPreview: this.connectorPreview,
      placementPreview: this.placementPreview,
      remoteCursors,
      smartGuides: this.smartGuides,
      marqueeBox: this.marqueeBox,
      laserTrail: activeTrail,
      studentPointers: this.studentPointers,
      classroomPointers: this.studentPointers,
      spotlight: this.spotlight,
      presentState: this.presentState,
      cropState: this.cropState,
      editingElementId: this.textTool.editingEl?.id || null,
      minimapOpen: this.minimapOpen,
      now,
    });

    if (
      activeTrail.length > 0 ||
      hasFading ||
      this.studentPointers.length > 0 ||
      remoteCursors.length > 0
    ) {
      this.requestRender();
    }
  }

  handleResize() {
    if (!this.canvasWrap) return;
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
    this.scene.pages = this.scene.pages.filter((p) => p.id !== pageId);
    if (this.scene.activePageId === pageId) this.scene.activePageId = this.scene.pages[0].id;
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

  reorderSelection(dir) {
    if (!this.collab.canEditBoard()) return;
    const page = this.getPage();
    for (const id of this.selectedIds) reorderElement(page, id, dir);
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

  placeStencil(stencilId, worldPos = null) {
    if (!this.collab.canEditBoard()) {
      this.dialogs.showToast('Viewers cannot insert elements onto the board.');
      return false;
    }
    const page = this.getPage();
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
    const pack = buildDevOpsDiagramPacks().find((p) => p.id === packId);
    if (!pack) return;
    const page = this.getPage();
    const built = pack.build();
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
    const tpl = BUILTIN_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    const page = this.getPage();
    const built = tpl.build();
    const check = validateElementsBatch(built);
    if (!check.valid) {
      this.dialogs.showToast(`Template rejected: ${check.reason}`);
      return;
    }
    page.elements.push(...built);
    updateConnectorBindings(page);
    this.commitChange();
    this.fitToContent();
    this.updateUI();
    this.dialogs.showToast(`Applied template "${tpl.name}".`);
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
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'whiteboard.library.json';
    a.click();
  }

  togglePanel(panelId) {
    const p = document.getElementById(panelId);
    if (!p) return;
    p.classList.toggle('wb-hidden');
    if (p.classList.contains('wb-hidden') && panelId === 'wb-library-panel') {
      this.clearPlacementPreview();
    }
    this.updateUI();
  }

  togglePropsDrawer() {
    const p = document.getElementById('wb-props-panel');
    if (!p) return;
    this.propsDrawerOpen = !p.classList.contains('wb-hidden');
    p.classList.toggle('wb-hidden');
    this.propsDrawerOpen = !p.classList.contains('wb-hidden');
    this.toolbarUI.update();
  }

  toggleSpotlight(magnifier = false) {
    if (this.spotlight.active && this.spotlight.magnifier === magnifier) {
      this.spotlight.active = false;
    } else {
      this.spotlight.active = true;
      this.spotlight.magnifier = Boolean(magnifier);
    }
    this.toolbarUI.update();
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

  toggleImageCrop(el) {
    if (this.cropState && this.cropState.element.id === el.id) {
      const box = this.cropState.box;
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
      this.cropState = {
        element: el,
        box: { x: el.x + 12, y: el.y + 12, w: Math.max(32, el.w - 24), h: Math.max(32, el.h - 24) },
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

  saveSceneFile() {
    try {
      saveRecoverySnapshot(this.scene, 'Pre-save Checkpoint');
      const json = serializeScene(this.scene);
      const blob = new Blob([json], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      const safeName = (this.scene.title || 'board')
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, '-');
      a.download = `${safeName}.whiteboard.json`;
      a.click();
    } catch (err) {
      this.dialogs.showToast(`Save aborted: ${err.message}`);
    }
  }

  _bindEvents() {
    window.addEventListener('resize', () => this.handleResize());
    window.addEventListener('hashchange', () => this._initShareRouteFromHash());

    this.canvas.addEventListener('pointerdown', (ev) => this._onPointerDown(ev));
    window.addEventListener('pointermove', (ev) => this._onPointerMove(ev));
    window.addEventListener('pointerup', (ev) => this._onPointerUp(ev));

    this.canvas.addEventListener(
      'wheel',
      (ev) => {
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
    window.addEventListener('keyup', (ev) => {
      if (ev.code === 'Space') this.spacePressed = false;
    });
  }

  _getToolHandler() {
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
    this.spotlight.x = ev.clientX - rect.left;
    this.spotlight.y = ev.clientY - rect.top;

    if (this.textTool.isOpen()) this.textTool.commit();

    if (ev.button === 1 || this.spacePressed || this.activeTool === 'hand') {
      if (this.collab.followingTeacher) this.collab.setFollowTeacher(false);
      this.isPanning = true;
      this.panStart = { x: ev.clientX, y: ev.clientY };
      return;
    }

    // Prevent Spotlight from accidentally drawing, selecting, or dragging objects
    if (this.spotlight.active) {
      this.requestRender();
      return;
    }

    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this._getToolHandler().onPointerDown(world, ev);
  }

  _onPointerMove(ev) {
    const rect = this.canvas.getBoundingClientRect();
    this.spotlight.x = ev.clientX - rect.left;
    this.spotlight.y = ev.clientY - rect.top;
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

    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this.collab.sendCursorUpdate(world, Array.from(this.selectedIds));
    this._getToolHandler().onPointerMove(world, ev);
  }

  _onPointerUp(ev) {
    if (this.isPanning) {
      this.isPanning = false;
      return;
    }
    if (this.spotlight.active) return;
    const world = this.screenToWorld(ev.clientX, ev.clientY);
    this._getToolHandler().onPointerUp(world, ev);
  }

  _isEditingInput(target) {
    if (this.textTool.isOpen()) return true;
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
      if (ev.key === 'Escape' && (this.paletteUI.isOpen() || this.dialogs.isOpen())) {
        ev.preventDefault();
        if (this.paletteUI.isOpen()) this.paletteUI.close();
        else this.dialogs.close();
      }
      return;
    }

    // Explicit Escape hierarchy:
    // 1. Dismiss active dialog/palette first
    // 2. Otherwise cancel current interaction or preview
    // 3. Otherwise exit active teaching mode (Spotlight, Presentation, Annotation, Laser, Focus)
    // 4. Otherwise clear selection and return to Select tool
    if (ev.key === 'Escape') {
      ev.preventDefault();
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
      if (this.connectorTool.activeConnector) {
        this.connectorTool.cancel();
        return;
      }
      if (this.selectTool.isActive()) {
        this.selectTool.cancel();
        return;
      }
      if (this.spotlight.active) {
        this.spotlight.active = false;
        this.updateUI();
        this.requestRender();
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

    if (this.presentState.active) {
      if (ev.key === 'ArrowRight' || ev.key === ' ') {
        ev.preventDefault();
        this.presentUI.stepNext();
      } else if (ev.key === 'ArrowLeft') {
        ev.preventDefault();
        this.presentUI.stepPrev();
      }
      return;
    }

    if (ev.code === 'Space') this.spacePressed = true;
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

    const key = ev.key.toLowerCase();
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
    if (!mod && map[key]) {
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
    if (!mod && (ev.key === '!' || (ev.shiftKey && ev.code === 'Digit1'))) {
      this.fitToContent();
      return;
    }
    if (!mod && (ev.key === '@' || (ev.shiftKey && ev.code === 'Digit2'))) {
      this.zoomToSelection();
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
