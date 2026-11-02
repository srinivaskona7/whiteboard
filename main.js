// main.js — Application Coordinator
import {
  DEFAULT_STYLE, uid, createElement, createPage, getActivePage, cloneElementsWithBindings,
  groupElements, ungroupElements, toggleFrameCollapse, reorderElement, extractStyle,
} from './scene/model.js';
import {
  getSelectionBounds, translateElement, alignElements, distributeElements, matchElementSize,
} from './scene/geometry.js';
import { hitTestScene } from './scene/hit.js';
import { HistoryManager } from './scene/history.js';
import { updateConnectorBindings } from './scene/bindings.js';
import {
  loadSceneFromLocalStorage, saveSceneToLocalStorage, createDebouncedAutosave,
  serializeScene, parseSceneJson, loadUserLibrary, saveUserLibrary,
  exportLibraryJson, importLibraryJson, decodeSceneFromHash,
} from './scene/storage.js';
import { applyThemeToDocument } from './render/themes.js';
import { CanvasRenderer } from './render/canvas.js';
import { exportToSvgString } from './render/svg-export.js';
import { getStencilById } from './stencils/index.js';
import { getTemplateById } from './templates/index.js';
import { SelectTool } from './tools/select.js';
import { DrawTool } from './tools/draw.js';
import { ConnectorTool } from './tools/connector.js';
import { TextTool } from './tools/text.js';
import { LaserTool } from './tools/laser.js';
import { StampTool } from './tools/stamp.js';
import { insertMathHelper } from './tools/math-tools.js';
import {
  insertImageFile as insertImgFileHelper, insertImageDataUrl as insertImgDataUrlHelper,
  toggleImageCrop as toggleImgCropHelper, toggleImageBackgroundLock as toggleImgBgLockHelper,
} from './tools/image.js';
import { initToolbar } from './ui/toolbar.js';
import { initPropsPanel } from './ui/props-panel.js';
import { initLibraryPanel } from './ui/library-panel.js';
import { initPagesBar } from './ui/pages.js';
import { initDialogs } from './ui/dialogs.js';
import { initCommandPalette } from './ui/palette.js';
import { initPresentUI } from './ui/present.js';
import { initLayersPanel } from './ui/layers.js';
import { initTimerUI } from './ui/timer.js';

export class WhiteboardApp {
  constructor() {
    this.canvas = document.getElementById('wb-canvas');
    this.renderer = new CanvasRenderer(this.canvas);
    this.renderer.onImageLoad = () => this.requestRender();
    const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const hashScene = decodeSceneFromHash(window.location.hash);
    this.scene = hashScene || loadSceneFromLocalStorage(prefersDark ? 'dark' : 'light');
    applyThemeToDocument(this.scene.theme);
    this.history = new HistoryManager();
    for (const p of this.scene.pages) this.history.initPage(p);
    Object.assign(this, {
      userLibrary: loadUserLibrary(), activeTool: 'select', toolLock: false,
      currentStyle: { ...DEFAULT_STYLE }, selectedIds: new Set(), clipboard: [],
      pasteCascade: 0, copiedStyle: null, hoveredElement: null, hoveredPort: null,
      marqueeBox: null, smartGuides: [], editingElementId: null,
      annotationMode: false, fadingInk: true, fadingTimer: null,
      spotlight: { active: false, magnifier: false, x: 400, y: 300, radius: 130 },
      presentState: { active: false, slideIndex: 0, revealStep: 0, maxRevealStep: 0 },
      cropState: null, isPseudoFullscreen: false, spacePressed: false,
      isPanning: false, panStart: { x: 0, y: 0, camX: 0, camY: 0 }, activeSubInteraction: null,
      selectTool: new SelectTool(this), drawTool: new DrawTool(this),
      connectorTool: new ConnectorTool(this), textTool: new TextTool(this),
      laserTool: new LaserTool(this), stampTool: new StampTool(this),
    });
    this.scheduleAutosave = createDebouncedAutosave(400, () => {
      this.dialogs?.showToast('Storage quota exceeded! Please save a .whiteboard.json file.', 'warn');
    });
    Object.assign(this, {
      dialogs: initDialogs(this), toolbarUI: initToolbar(this), propsUI: initPropsPanel(this),
      libraryUI: initLibraryPanel(this), pagesUI: initPagesBar(this), paletteUI: initCommandPalette(this),
      presentUI: initPresentUI(this), layersUI: initLayersPanel(this), timerUI: initTimerUI(this),
    });
    this._bindEvents();
    this._handleResize();
    this.updateUI();
    this.requestRender();
  }

  getPage() { return getActivePage(this.scene); }
  screenToWorld(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect(), cam = this.getPage().camera;
    return { x: (clientX - rect.left - cam.x) / cam.zoom, y: (clientY - rect.top - cam.y) / cam.zoom };
  }
  getViewportCenterWorld() {
    const cam = this.getPage().camera;
    return { x: (this.renderer.width / 2 - cam.x) / cam.zoom, y: (this.renderer.height / 2 - cam.y) / cam.zoom };
  }
  setTool(toolId) {
    if (this.textTool.isOpen()) this.textTool.commitAndClose();
    this.activeTool = toolId; this.hoveredPort = null; this.hoveredElement = null;
    this.updateUI(); this.requestRender();
  }
  commitChange() {
    const changed = this.history.commit(this.getPage());
    if (changed) { this.scheduleAutosave(this.scene); this.toolbarUI.update(); this.layersUI.update(); }
    return changed;
  }
  undo() {
    if (this.history.undo(this.getPage())) { this.selectedIds.clear(); this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender(); }
  }
  redo() {
    if (this.history.redo(this.getPage())) { this.selectedIds.clear(); this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender(); }
  }
  updateUI() { this.toolbarUI.update(); this.propsUI.update(); this.pagesUI.update(); this.layersUI.update(); }
  requestRender() {
    if (this._rafPending) return;
    this._rafPending = true;
    requestAnimationFrame(() => { this._rafPending = false; this.renderNow(); });
  }
  renderNow() {
    this.renderer.render({
      scene: this.scene, page: this.getPage(), selectedIds: this.selectedIds,
      hoveredElement: this.hoveredElement, hoveredPort: this.hoveredPort,
      marqueeBox: this.marqueeBox, smartGuides: this.smartGuides,
      laserTrail: this.laserTool.trail, spotlight: this.spotlight,
      presentState: this.presentState, cropState: this.cropState,
      editingElementId: this.editingElementId,
    });
  }

  zoomBy(factor, cx = this.renderer.width / 2, cy = this.renderer.height / 2) {
    this.setZoom(this.getPage().camera.zoom * factor, cx, cy);
  }
  setZoom(targetZoom, cx = this.renderer.width / 2, cy = this.renderer.height / 2) {
    const cam = this.getPage().camera, clamped = Math.max(0.1, Math.min(8, targetZoom));
    const worldX = (cx - cam.x) / cam.zoom, worldY = (cy - cam.y) / cam.zoom;
    cam.zoom = clamped; cam.x = cx - worldX * clamped; cam.y = cy - worldY * clamped;
    this.scheduleAutosave(this.scene); this.toolbarUI.update(); this.requestRender();
  }
  fitToContent() {
    const page = this.getPage(), visible = page.elements.filter((e) => !e.hidden);
    if (visible.length === 0) {
      page.camera = { x: 0, y: 0, zoom: 1 };
      this.updateUI(); this.requestRender(); return;
    }
    const b = getSelectionBounds(visible), pad = 80, w = this.renderer.width, h = this.renderer.height;
    const zoom = Math.max(0.1, Math.min(2.5, Math.min(w / (b.w + pad * 2), h / (b.h + pad * 2))));
    page.camera = { zoom, x: w / 2 - (b.x + b.w / 2) * zoom, y: h / 2 - (b.y + b.h / 2) * zoom };
    this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender();
  }

  toggleTheme() {
    this.scene.theme = this.scene.theme === 'dark' ? 'light' : 'dark';
    applyThemeToDocument(this.scene.theme);
    saveSceneToLocalStorage(this.scene);
    this.updateUI(); this.requestRender();
  }
  setBackground(bgType) {
    this.getPage().background = bgType;
    this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender();
  }
  async toggleFullScreen() {
    try {
      if (!document.fullscreenElement && !this.isPseudoFullscreen) {
        if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
        else this.isPseudoFullscreen = true;
      } else {
        if (document.fullscreenElement && document.exitFullscreen) await document.exitFullscreen();
        this.isPseudoFullscreen = false;
      }
    } catch { this.isPseudoFullscreen = !this.isPseudoFullscreen; }
    this.toolbarUI.update();
  }
  togglePanel(which) {
    const lib = document.getElementById('wb-library-panel'), lay = document.getElementById('wb-layers-panel');
    if (which === 'library') {
      lay?.classList.add('wb-hidden'); lib?.classList.toggle('wb-hidden'); this.libraryUI.update();
    } else {
      lib?.classList.add('wb-hidden'); lay?.classList.toggle('wb-hidden'); this.layersUI.update();
    }
  }
  toggleAnnotationMode() {
    this.annotationMode = !this.annotationMode;
    if (this.annotationMode) {
      this.setTool('pen');
      this.dialogs.showToast('Annotation mode enabled (auto-fading ink active).', 'info');
    }
    this.updateUI(); this.requestRender();
  }
  scheduleFadingCleanup() {
    if (this.fadingTimer) return;
    const step = () => {
      const page = this.getPage(), now = Date.now(), before = page.elements.length;
      page.elements = page.elements.filter((e) => !(e.fading && now - e.createdAt >= 3000));
      this.requestRender();
      this.fadingTimer = page.elements.some((e) => e.fading) ? setTimeout(step, 80) : null;
      if (page.elements.length !== before) this.layersUI.update();
    };
    this.fadingTimer = setTimeout(step, 80);
  }
  toggleSpotlight() { this.spotlight.active = !this.spotlight.active; this.updateUI(); this.requestRender(); }

  deleteSelection() {
    if (this.selectedIds.size === 0) return;
    const page = this.getPage();
    page.elements = page.elements.filter((e) => !this.selectedIds.has(e.id) || e.locked);
    this.selectedIds.clear();
    updateConnectorBindings(page);
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  copySelection() {
    const sel = this.getPage().elements.filter((e) => this.selectedIds.has(e.id));
    if (sel.length === 0) return;
    this.clipboard = cloneElementsWithBindings(sel, { x: 0, y: 0 });
    this.pasteCascade = 0;
  }
  cutSelection() { this.copySelection(); this.deleteSelection(); }
  pasteSelection() {
    if (!this.clipboard?.length) return;
    const page = this.getPage();
    this.pasteCascade += 1;
    const clones = cloneElementsWithBindings(this.clipboard, { x: 24 * this.pasteCascade, y: 24 * this.pasteCascade });
    page.elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    updateConnectorBindings(page, clones.map((c) => c.id));
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  duplicateSelection() {
    const page = this.getPage(), sel = page.elements.filter((e) => this.selectedIds.has(e.id) && !e.locked);
    if (sel.length === 0) return;
    const clones = cloneElementsWithBindings(sel, { x: 24, y: 24 });
    page.elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    updateConnectorBindings(page, clones.map((c) => c.id));
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  groupSelection() {
    if (groupElements(this.getPage(), Array.from(this.selectedIds))) {
      this.commitChange(); this.updateUI(); this.requestRender();
    }
  }
  ungroupSelection() {
    ungroupElements(this.getPage(), Array.from(this.selectedIds));
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  alignSelection(mode) {
    const page = this.getPage(), sel = page.elements.filter((e) => this.selectedIds.has(e.id));
    alignElements(sel, mode);
    updateConnectorBindings(page, sel.map((e) => e.id));
    this.commitChange(); this.requestRender();
  }
  distributeSelection(axis) {
    const page = this.getPage(), sel = page.elements.filter((e) => this.selectedIds.has(e.id));
    distributeElements(sel, axis);
    updateConnectorBindings(page, sel.map((e) => e.id));
    this.commitChange(); this.requestRender();
  }
  matchSelectionSize() {
    const page = this.getPage(), sel = page.elements.filter((e) => this.selectedIds.has(e.id));
    matchElementSize(sel, 'both');
    updateConnectorBindings(page, sel.map((e) => e.id));
    this.commitChange(); this.requestRender();
  }
  reorderSelection(direction) {
    const page = this.getPage();
    for (const id of this.selectedIds) reorderElement(page, id, direction);
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  reorderElementById(id, direction) {
    if (reorderElement(this.getPage(), id, direction)) {
      this.commitChange(); this.updateUI(); this.requestRender();
    }
  }
  toggleLockSelection() {
    for (const el of this.getPage().elements) if (this.selectedIds.has(el.id)) el.locked = !el.locked;
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  toggleFrame(frameId) {
    toggleFrameCollapse(this.getPage(), frameId);
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  copySelectedStyle() {
    const first = this.getPage().elements.find((e) => this.selectedIds.has(e.id));
    if (first) {
      this.copiedStyle = extractStyle(first);
      this.dialogs.showToast('Style copied! Click any element to apply.', 'info');
    }
  }
  placeStencil(stencilId, worldPos = null) {
    const st = getStencilById(stencilId), pt = worldPos || this.getViewportCenterWorld();
    const el = createElement('stencil', {
      stencilId: st.id, category: st.category, name: st.name,
      x: Math.round(pt.x - st.defaultW / 2), y: Math.round(pt.y - st.defaultH / 2),
      w: st.defaultW, h: st.defaultH, text: st.defaultText, stroke: this.currentStyle.stroke,
      fill: this.currentStyle.fill !== 'transparent' ? this.currentStyle.fill : '#ffffff',
    });
    this.getPage().elements.push(el);
    this.selectedIds = new Set([el.id]);
    this.commitChange(); this.setTool('select'); this.updateUI(); this.requestRender();
    return el;
  }
  applyTemplate(templateId) {
    const tpl = getTemplateById(templateId), page = this.getPage(), built = tpl.build();
    if (templateId === 'tpl-blank') page.elements = []; else page.elements.push(...built);
    this.selectedIds = new Set(built.map((e) => e.id));
    this.commitChange(); this.fitToContent();
    this.dialogs.showToast(`Applied template: ${tpl.name}`, 'success');
  }
  insertMathOverlay(kind) { return insertMathHelper(this, kind); }

  addSelectionToLibrary() {
    const sel = this.getPage().elements.filter((e) => this.selectedIds.has(e.id));
    if (sel.length === 0) { this.dialogs.showToast('Select at least one element first.', 'warn'); return; }
    const bounds = getSelectionBounds(sel);
    const item = {
      id: uid('lib'),
      name: sel[0].text ? sel[0].text.slice(0, 20) : `${sel[0].type} (${sel.length})`,
      elements: cloneElementsWithBindings(sel, { x: -bounds.x, y: -bounds.y }),
    };
    this.userLibrary.push(item);
    saveUserLibrary(this.userLibrary);
    this.libraryUI.update();
    this.dialogs.showToast(`Saved "${item.name}" to reusable library.`, 'success');
  }
  insertUserLibraryItem(index) {
    const item = this.userLibrary[index];
    if (!item) return;
    const center = this.getViewportCenterWorld();
    const clones = cloneElementsWithBindings(item.elements, { x: Math.round(center.x - 80), y: Math.round(center.y - 60) });
    this.getPage().elements.push(...clones);
    this.selectedIds = new Set(clones.map((c) => c.id));
    this.commitChange(); this.updateUI(); this.requestRender();
  }
  deleteUserLibraryItem(index) { this.userLibrary.splice(index, 1); saveUserLibrary(this.userLibrary); }
  exportUserLibraryFile() { this._downloadBlob(new Blob([exportLibraryJson(this.userLibrary)], { type: 'application/json' }), 'elements.library.json'); }
  importUserLibraryFilePicker() { document.getElementById('wb-file-import-lib')?.click(); }

  addPage(name = null) {
    const p = createPage(name || `Page ${this.scene.pages.length + 1}`);
    this.scene.pages.push(p); this.history.initPage(p); this.switchPage(p.id);
  }
  switchPage(pageId) {
    if (!this.scene.pages.some((p) => p.id === pageId)) return;
    if (this.textTool.isOpen()) this.textTool.commitAndClose();
    this.scene.activePageId = pageId;
    this.selectedIds.clear();
    this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender();
  }
  reorderPage(index, delta) {
    const target = index + delta;
    if (target < 0 || target >= this.scene.pages.length) return;
    const [p] = this.scene.pages.splice(index, 1);
    this.scene.pages.splice(target, 0, p);
    this.scheduleAutosave(this.scene); this.pagesUI.update();
  }
  duplicatePage(pageId) {
    const src = this.scene.pages.find((p) => p.id === pageId);
    if (!src) return;
    const copy = Object.assign(createPage(`${src.name} (Copy)`), {
      background: src.background, camera: { ...src.camera },
      elements: cloneElementsWithBindings(src.elements, { x: 0, y: 0 }),
    });
    this.scene.pages.push(copy); this.history.initPage(copy); this.switchPage(copy.id);
  }
  deletePage(pageId) {
    if (this.scene.pages.length <= 1) return;
    const idx = this.scene.pages.findIndex((p) => p.id === pageId);
    if (idx === -1) return;
    this.scene.pages.splice(idx, 1);
    this.history.removePage(pageId);
    if (this.scene.activePageId === pageId) this.scene.activePageId = this.scene.pages[Math.max(0, idx - 1)].id;
    this.selectedIds.clear();
    this.scheduleAutosave(this.scene); this.updateUI(); this.requestRender();
  }

  openImageFilePicker() { document.getElementById('wb-file-insert-image')?.click(); }
  insertImageFile(file, worldPos = null) { return insertImgFileHelper(this, file, worldPos); }
  insertImageDataUrl(rawDataUrl, worldPos = null) { return insertImgDataUrlHelper(this, rawDataUrl, worldPos); }
  toggleImageCrop(imgEl) { toggleImgCropHelper(this, imgEl); }
  toggleImageBackgroundLock(imgEl) { toggleImgBgLockHelper(this, imgEl); }
  saveWhiteboardFile() {
    this._downloadBlob(new Blob([serializeScene(this.scene)], { type: 'application/json' }), 'classroom-diagram.whiteboard.json');
  }
  openWhiteboardFilePicker() { document.getElementById('wb-file-open-json')?.click(); }
  loadWhiteboardJsonString(jsonStr) {
    this.scene = parseSceneJson(jsonStr);
    this.renderer.imageCache.clear();
    applyThemeToDocument(this.scene.theme);
    this.history = new HistoryManager();
    for (const p of this.scene.pages) this.history.initPage(p);
    this.selectedIds.clear();
    saveSceneToLocalStorage(this.scene);
    this.updateUI(); this.requestRender();
  }
  exportPng(options = {}) {
    const offscreen = this.renderer.exportToPngCanvas(this.scene, this.getPage(), options);
    offscreen.toBlob((blob) => { if (blob) this._downloadBlob(blob, 'whiteboard-export.png'); }, 'image/png');
  }
  async copyPngToClipboard(options = {}) {
    try {
      const offscreen = this.renderer.exportToPngCanvas(this.scene, this.getPage(), options);
      const blob = await new Promise((r) => offscreen.toBlob(r, 'image/png'));
      if (navigator.clipboard && window.ClipboardItem && blob) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        return true;
      }
    } catch { /* fallback */ }
    return false;
  }
  exportSvg(options = {}) {
    const svgStr = exportToSvgString(this.scene, this.getPage(), options);
    this._downloadBlob(new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' }), 'whiteboard-export.svg');
    return svgStr;
  }
  _downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: filename });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }
  _handleResize() { this.renderer.resize(window.innerWidth, window.innerHeight); this.requestRender(); }
  _getCurrentToolHandler() {
    if (this.activeSubInteraction) return this.activeSubInteraction;
    if (this.activeTool === 'select') return this.selectTool;
    if (this.activeTool === 'line' || this.activeTool === 'arrow') return this.connectorTool;
    if (this.activeTool === 'text') return this.textTool;
    if (this.activeTool === 'laser') return this.laserTool;
    if (this.activeTool === 'stamp') return this.stampTool;
    return this.drawTool;
  }

  _bindEvents() {
    window.addEventListener('resize', () => this._handleResize());
    document.addEventListener('fullscreenchange', () => this.toolbarUI.update());

    this.canvas.addEventListener('pointerdown', (ev) => {
      if (this.presentState.active) { this.presentUI.stepNext(); return; }
      try { this.canvas.setPointerCapture?.(ev.pointerId); } catch {}
      if (ev.button === 1 || this.spacePressed || this.activeTool === 'hand') {
        const cam = this.getPage().camera;
        this.isPanning = true;
        this.panStart = { x: ev.clientX, y: ev.clientY, camX: cam.x, camY: cam.y };
        return;
      }
      this._getCurrentToolHandler().onPointerDown(this.screenToWorld(ev.clientX, ev.clientY), ev);
    });

    this.canvas.addEventListener('pointermove', (ev) => {
      if (this.spotlight.active) {
        const rect = this.canvas.getBoundingClientRect();
        this.spotlight.x = ev.clientX - rect.left; this.spotlight.y = ev.clientY - rect.top;
        this.requestRender();
      }
      if (this.isPanning) {
        const cam = this.getPage().camera;
        cam.x = this.panStart.camX + (ev.clientX - this.panStart.x);
        cam.y = this.panStart.camY + (ev.clientY - this.panStart.y);
        this.requestRender(); return;
      }
      this._getCurrentToolHandler().onPointerMove(this.screenToWorld(ev.clientX, ev.clientY), ev);
    });

    this.canvas.addEventListener('pointerup', (ev) => {
      try { this.canvas.releasePointerCapture?.(ev.pointerId); } catch {}
      if (this.isPanning) { this.isPanning = false; this.scheduleAutosave(this.scene); return; }
      this._getCurrentToolHandler().onPointerUp(this.screenToWorld(ev.clientX, ev.clientY), ev);
      this.activeSubInteraction = null;
    });

    this.canvas.addEventListener('dblclick', (ev) => {
      if (this.presentState.active) return;
      const world = this.screenToWorld(ev.clientX, ev.clientY);
      const hit = hitTestScene(this.getPage(), world.x, world.y, { includeLocked: false });
      if (hit && hit.type !== 'pen' && hit.type !== 'highlighter' && hit.type !== 'image') {
        this.selectedIds = new Set([hit.id]);
        this.textTool.openEditorForElement(hit, world);
      }
    });

    this.canvas.addEventListener('wheel', (ev) => {
      ev.preventDefault();
      const rect = this.canvas.getBoundingClientRect();
      this.zoomBy(ev.deltaY < 0 ? 1.1 : 1 / 1.1, ev.clientX - rect.left, ev.clientY - rect.top);
    }, { passive: false });

    window.addEventListener('dragover', (ev) => ev.preventDefault());
    window.addEventListener('drop', async (ev) => {
      ev.preventDefault();
      const world = this.screenToWorld(ev.clientX, ev.clientY);
      const textData = ev.dataTransfer?.getData('text/plain');
      if (textData?.startsWith('stencil:')) { this.placeStencil(textData.slice(8), world); return; }
      const file = ev.dataTransfer?.files?.[0];
      if (!file) return;
      if (file.name.endsWith('.json')) this.loadWhiteboardJsonString(await file.text());
      else if (file.type.startsWith('image/')) await this.insertImageFile(file, world);
    });

    window.addEventListener('paste', async (ev) => {
      for (const item of ev.clipboardData?.items || []) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) await this.insertImageFile(file);
          return;
        }
      }
    });

    document.getElementById('wb-file-open-json')?.addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (f) { this.loadWhiteboardJsonString(await f.text()); ev.target.value = ''; }
    });
    document.getElementById('wb-file-insert-image')?.addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (f) { await this.insertImageFile(f); ev.target.value = ''; }
    });
    document.getElementById('wb-file-import-lib')?.addEventListener('change', async (ev) => {
      const f = ev.target.files?.[0];
      if (f) {
        try {
          const imported = importLibraryJson(await f.text());
          this.userLibrary.push(...imported);
          saveUserLibrary(this.userLibrary);
          this.libraryUI.update();
          this.dialogs.showToast(`Imported ${imported.length} library item(s).`, 'success');
        } catch (err) { this.dialogs.showToast(err.message, 'warn'); }
        ev.target.value = '';
      }
    });

    window.addEventListener('keydown', (ev) => this._onKeyDown(ev));
    window.addEventListener('keyup', (ev) => { if (ev.code === 'Space') this.spacePressed = false; });
  }

  _onKeyDown(ev) {
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' ||
      document.activeElement?.isContentEditable || this.textTool.isOpen();

    if (ev.code === 'Space' && !isTyping) this.spacePressed = true;
    if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'k') {
      ev.preventDefault();
      if (this.paletteUI.isOpen()) this.paletteUI.close(); else this.paletteUI.open();
      return;
    }
    if (this.paletteUI.isOpen() || this.dialogs.isOpen()) {
      if (ev.key === 'Escape') { this.paletteUI.close(); this.dialogs.close(); }
      return;
    }
    if (isTyping) return;
    if (this.presentState.active) {
      if (ev.key === 'Escape') this.presentUI.exit();
      else if (ev.key === 'ArrowRight' || ev.key === ' ') this.presentUI.stepNext();
      else if (ev.key === 'ArrowLeft') this.presentUI.stepPrev();
      return;
    }

    const cmd = ev.ctrlKey || ev.metaKey, key = ev.key.toLowerCase();
    if (cmd && key === 'z') { ev.preventDefault(); if (ev.shiftKey) this.redo(); else this.undo(); return; }
    if (cmd && key === 'y') { ev.preventDefault(); this.redo(); return; }
    if (cmd && key === 'a') {
      ev.preventDefault();
      this.selectedIds = new Set(this.getPage().elements.filter((e) => !e.hidden && !e.locked).map((e) => e.id));
      this.updateUI(); this.requestRender(); return;
    }
    if (cmd && key === 'c') { ev.preventDefault(); this.copySelection(); return; }
    if (cmd && key === 'x') { ev.preventDefault(); this.cutSelection(); return; }
    if (cmd && key === 'v') { ev.preventDefault(); this.pasteSelection(); return; }
    if (cmd && key === 'd') { ev.preventDefault(); this.duplicateSelection(); return; }
    if (cmd && key === 'g') { ev.preventDefault(); if (ev.shiftKey) this.ungroupSelection(); else this.groupSelection(); return; }
    if (ev.key === 'Delete' || ev.key === 'Backspace') { ev.preventDefault(); this.deleteSelection(); return; }

    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key) && this.selectedIds.size > 0) {
      ev.preventDefault();
      const step = ev.shiftKey ? 10 : 2;
      const dx = ev.key === 'ArrowLeft' ? -step : ev.key === 'ArrowRight' ? step : 0;
      const dy = ev.key === 'ArrowUp' ? -step : ev.key === 'ArrowDown' ? step : 0;
      const page = this.getPage(), sel = page.elements.filter((e) => this.selectedIds.has(e.id) && !e.locked);
      for (const el of sel) translateElement(el, dx, dy);
      updateConnectorBindings(page, sel.map((e) => e.id));
      this.commitChange(); this.requestRender(); return;
    }

    const toolMap = {
      v: 'select', h: 'hand', p: 'pen', m: 'highlighter', e: 'eraser', r: 'rect', u: 'rounded-rect',
      o: 'ellipse', d: 'diamond', l: 'line', a: 'arrow', t: 'text', n: 'sticky', b: 'table', j: 'code', k: 'laser', s: 'stamp',
    };
    if (!cmd && ev.key === 'F2') { this.setTool('frame'); return; }
    if (!cmd && toolMap[key]) { this.setTool(toolMap[key]); return; }
    if (!cmd && key === 'i') { this.openImageFilePicker(); return; }
    if (!cmd && key === 'f') { this.toggleFullScreen(); return; }
    if (ev.key === '+' || ev.key === '=') this.zoomBy(1.2);
    else if (ev.key === '-') this.zoomBy(1 / 1.2);
    else if (ev.key === '0') this.setZoom(1);
    else if (ev.key === '1') this.fitToContent();
    else if (ev.key === ']') this.reorderSelection('front');
    else if (ev.key === '[') this.reorderSelection('back');
    else if (ev.key === '?') this.dialogs.openShortcutsModal();
    else if (ev.key === 'Escape') {
      this.selectedIds.clear(); this.cropState = null; this.spotlight.active = false; this.setTool('select');
    }
  }
}

window.addEventListener('DOMContentLoaded', () => { window.__WHITEBOARD_APP__ = new WhiteboardApp(); });
