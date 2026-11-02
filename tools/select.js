// tools/select.js
import {
  expandSelectionWithGroups,
  cloneElementsWithBindings,
  getContainerChildren,
  toggleFrameCollapse,
  applyStyle,
} from '../scene/model.js';
import {
  getElementBounds,
  getSelectionBounds,
  boxesIntersect,
  translateElement,
  snapAngle,
  snapPointToGrid,
  computeSmartGuides,
  unrotatePoint,
} from '../scene/geometry.js';
import {
  hitTestHandle,
  hitTestScene,
  hitTestFrameCollapseButton,
  hitTestHyperlinkBadge,
} from '../scene/hit.js';
import {
  findHoverPort,
  bindConnectorEndpoint,
  unbindConnectorEndpoint,
  updateConnectorBindings,
} from '../scene/bindings.js';
import { projectPointOntoConnectorT } from '../scene/routing.js';

export class SelectTool {
  constructor(app) {
    this.app = app;
    this.mode = null; // 'move' | 'resize' | 'rotate' | 'marquee' | 'connector-handle' | 'crop'
    this.startWorld = { x: 0, y: 0 };
    this.lastWorld = { x: 0, y: 0 };
    this.activeHandle = null;
    this.targetElement = null;
    this.initialBox = null;
    this.movingElements = [];
    this.didMutate = false;
  }

  onPointerDown(world, ev) {
    const page = this.app.getPage();
    const zoom = page.camera.zoom;

    // 0. If in crop mode, check if dragging inside crop target
    if (this.app.cropState && this.app.cropState.element) {
      this.mode = 'crop';
      this.startWorld = { ...world };
      this.app.cropState.rect = {
        x: world.x,
        y: world.y,
        w: 10,
        h: 10,
      };
      this.app.requestRender();
      return;
    }

    // 1. Check if clicking a handle of a single selected element
    if (this.app.selectedIds.size === 1) {
      const onlyId = Array.from(this.app.selectedIds)[0];
      const selEl = page.elements.find((e) => e.id === onlyId);
      if (selEl && !selEl.locked) {
        const handle = hitTestHandle(selEl, world.x, world.y, zoom, page);
        if (handle) {
          this.startWorld = { ...world };
          this.lastWorld = { ...world };
          this.targetElement = selEl;
          this.activeHandle = handle;
          this.didMutate = false;
          if (selEl.type === 'line' || selEl.type === 'arrow') {
            this.mode = 'connector-handle';
          } else if (handle.id === 'rotate') {
            this.mode = 'rotate';
          } else {
            this.mode = 'resize';
            this.initialBox = { x: selEl.x, y: selEl.y, w: selEl.w, h: selEl.h };
          }
          return;
        }
      }
    }

    // 2. Check if clicking a connection port to start a smart connector directly
    if (
      this.app.hoveredPort &&
      Math.hypot(world.x - this.app.hoveredPort.x, world.y - this.app.hoveredPort.y) <= 16 / zoom
    ) {
      this.app.connectorTool.startFromPort(this.app.hoveredPort, world);
      this.app.activeSubInteraction = this.app.connectorTool;
      return;
    }

    // 3. Hit test scene elements
    const hit = hitTestScene(page, world.x, world.y, { includeLocked: false });

    if (hit) {
      // Frame collapse button check
      if (hit.type === 'frame' && hitTestFrameCollapseButton(hit, world.x, world.y)) {
        toggleFrameCollapse(page, hit.id);
        this.app.commitChange();
        this.app.requestRender();
        return;
      }

      // Hyperlink open on Ctrl/Cmd+click or clicking link badge
      if (
        hit.link &&
        (ev.ctrlKey || ev.metaKey || hitTestHyperlinkBadge(hit, world.x, world.y))
      ) {
        window.open(hit.link, '_blank', 'noopener,noreferrer');
        return;
      }

      // Format painter paste if active
      if (this.app.copiedStyle) {
        applyStyle(hit, this.app.copiedStyle);
        this.app.copiedStyle = null;
        this.app.commitChange();
        this.app.updateUI();
        this.app.requestRender();
        return;
      }

      const groupExpanded = expandSelectionWithGroups(page, [hit.id]);

      if (ev.shiftKey) {
        for (const id of groupExpanded) {
          if (this.app.selectedIds.has(id)) this.app.selectedIds.delete(id);
          else this.app.selectedIds.add(id);
        }
      } else if (!this.app.selectedIds.has(hit.id)) {
        this.app.selectedIds = new Set(groupExpanded);
      }

      // Alt-drag duplicates current selection immediately
      if (ev.altKey) {
        const origEls = page.elements.filter((e) => this.app.selectedIds.has(e.id) && !e.locked);
        const clones = cloneElementsWithBindings(origEls, { x: 0, y: 0 });
        page.elements.push(...clones);
        this.app.selectedIds = new Set(clones.map((c) => c.id));
        this.didMutate = true;
      } else {
        this.didMutate = false;
      }

      // Gather all moving elements (including container children if moving a frame)
      const moveIdSet = new Set(this.app.selectedIds);
      for (const id of Array.from(moveIdSet)) {
        const el = page.elements.find((e) => e.id === id);
        if (el && el.type === 'frame') {
          for (const child of getContainerChildren(page, el.id)) {
            if (!child.locked) moveIdSet.add(child.id);
          }
        }
      }

      this.movingElements = page.elements.filter((e) => moveIdSet.has(e.id) && !e.locked);
      this.mode = 'move';
      this.startWorld = { ...world };
      this.lastWorld = { ...world };
      this.app.updateUI();
      this.app.requestRender();
      return;
    }

    // 4. Empty space clicked -> start marquee selection
    if (!ev.shiftKey) {
      this.app.selectedIds.clear();
    }
    this.mode = 'marquee';
    this.startWorld = { ...world };
    this.lastWorld = { ...world };
    this.app.marqueeBox = { x: world.x, y: world.y, w: 0, h: 0 };
    this.app.updateUI();
    this.app.requestRender();
  }

  onPointerMove(world, ev) {
    const page = this.app.getPage();

    if (!this.mode) {
      // Hover detection for connection ports and cursor feedback
      const port = findHoverPort(page, world.x, world.y, 18 / page.camera.zoom);
      this.app.hoveredPort = port;
      if (port) {
        this.app.hoveredElement = port.element;
      } else {
        const hit = hitTestScene(page, world.x, world.y, { includeLocked: false });
        this.app.hoveredElement =
          hit && hit.type !== 'line' && hit.type !== 'arrow' && hit.type !== 'pen' && hit.type !== 'highlighter'
            ? hit
            : null;
      }
      this.app.requestRender();
      return;
    }

    if (this.mode === 'crop' && this.app.cropState) {
      const el = this.app.cropState.element;
      const rx = Math.max(el.x, Math.min(this.startWorld.x, world.x));
      const ry = Math.max(el.y, Math.min(this.startWorld.y, world.y));
      const rw = Math.min(el.x + el.w - rx, Math.abs(world.x - this.startWorld.x));
      const rh = Math.min(el.y + el.h - ry, Math.abs(world.y - this.startWorld.y));
      this.app.cropState.rect = { x: rx, y: ry, w: Math.max(16, rw), h: Math.max(16, rh) };
      this.app.requestRender();
      return;
    }

    if (this.mode === 'move') {
      let dx = world.x - this.lastWorld.x;
      let dy = world.y - this.lastWorld.y;
      if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return;

      for (const el of this.movingElements) {
        translateElement(el, dx, dy);
      }
      this.lastWorld = { ...world };

      // Smart guides & object snapping
      const settings = this.app.scene.settings;
      this.app.smartGuides = [];
      if (settings.snapToObjects && this.movingElements.length > 0 && !ev.altKey) {
        const movingSet = new Set(this.movingElements.map((e) => e.id));
        const candidates = page.elements.filter(
          (e) => !e.hidden && !movingSet.has(e.id) && e.type !== 'pen' && e.type !== 'highlighter'
        );
        const mb = getSelectionBounds(this.movingElements);
        if (mb && candidates.length > 0) {
          const snap = computeSmartGuides(mb, candidates, 5 / page.camera.zoom);
          if (snap.dx || snap.dy) {
            for (const el of this.movingElements) {
              translateElement(el, snap.dx, snap.dy);
            }
            this.lastWorld.x += snap.dx;
            this.lastWorld.y += snap.dy;
          }
          this.app.smartGuides = snap.guides;
        }
      }

      updateConnectorBindings(
        page,
        this.movingElements.map((e) => e.id)
      );
      this.didMutate = true;
      this.app.requestRender();
      return;
    }

    if (this.mode === 'resize' && this.targetElement) {
      this.applyResize(this.targetElement, this.activeHandle.id, world, ev);
      updateConnectorBindings(page, [this.targetElement.id]);
      this.didMutate = true;
      this.app.requestRender();
      return;
    }

    if (this.mode === 'rotate' && this.targetElement) {
      const el = this.targetElement;
      const cx = el.x + el.w / 2;
      const cy = el.y + el.h / 2;
      let angle = Math.atan2(world.y - cy, world.x - cx) + Math.PI / 2;
      if (ev.shiftKey) {
        angle = snapAngle(angle, 15);
      }
      el.rotation = angle;
      updateConnectorBindings(page, [el.id]);
      this.didMutate = true;
      this.app.requestRender();
      return;
    }

    if (this.mode === 'connector-handle' && this.targetElement) {
      const conn = this.targetElement;
      const hid = this.activeHandle.id;
      if (hid === 'start' || hid === 'end') {
        const portHit = findHoverPort(page, world.x, world.y, 18 / page.camera.zoom, conn.id);
        this.app.hoveredPort = portHit;
        this.app.hoveredElement = portHit ? portHit.element : null;
        if (portHit) {
          bindConnectorEndpoint(conn, hid, portHit.element, portHit.port);
        } else {
          unbindConnectorEndpoint(conn, hid);
          if (hid === 'start') {
            conn.x = world.x;
            conn.y = world.y;
          } else {
            conn.x2 = world.x;
            conn.y2 = world.y;
          }
        }
      } else if (hid === 'mid') {
        if (conn.routing === 'curved') {
          conn.controlPoint = { x: world.x, y: world.y };
        } else {
          const midX = (conn.x + conn.x2) / 2;
          const midY = (conn.y + conn.y2) / 2;
          if (this.activeHandle.axis === 'x') {
            conn.elbowOffset = world.x - midX;
          } else {
            conn.elbowOffset = world.y - midY;
          }
        }
      } else if (hid === 'label') {
        conn.labelT = projectPointOntoConnectorT(conn, world.x, world.y, page);
      }
      updateConnectorBindings(page, [conn.id]);
      this.didMutate = true;
      this.app.requestRender();
      return;
    }

    if (this.mode === 'marquee') {
      const x = Math.min(this.startWorld.x, world.x);
      const y = Math.min(this.startWorld.y, world.y);
      const w = Math.abs(world.x - this.startWorld.x);
      const h = Math.abs(world.y - this.startWorld.y);
      this.app.marqueeBox = { x, y, w, h };

      const hitIds = [];
      for (const el of page.elements) {
        if (el.hidden || el.locked || el.isBackground) continue;
        const b = getElementBounds(el);
        if (boxesIntersect(this.app.marqueeBox, b)) {
          hitIds.push(el.id);
        }
      }
      this.app.selectedIds = new Set(expandSelectionWithGroups(page, hitIds));
      this.app.requestRender();
    }
  }

  onPointerUp() {
    const page = this.app.getPage();
    if (this.mode === 'move' && this.didMutate && this.app.scene.settings.snapToGrid) {
      if (this.movingElements.length === 1) {
        const el = this.movingElements[0];
        if (el.type !== 'pen' && el.type !== 'highlighter' && el.type !== 'line' && el.type !== 'arrow') {
          const snapped = snapPointToGrid(el.x, el.y, this.app.scene.settings.gridSize || 20);
          translateElement(el, snapped.x - el.x, snapped.y - el.y);
          updateConnectorBindings(page, [el.id]);
        }
      }
    }

    if (this.didMutate) {
      this.app.commitChange();
    }

    this.mode = null;
    this.activeHandle = null;
    this.targetElement = null;
    this.movingElements = [];
    this.didMutate = false;
    this.app.marqueeBox = null;
    this.app.smartGuides = [];
    this.app.updateUI();
    this.app.requestRender();
  }

  applyResize(el, handleId, world, ev) {
    const box = this.initialBox;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const local = unrotatePoint(world.x, world.y, cx, cy, el.rotation || 0);

    let nx = box.x;
    let ny = box.y;
    let nw = box.w;
    let nh = box.h;

    if (handleId.includes('e')) nw = Math.max(20, local.x - box.x);
    if (handleId.includes('s')) nh = Math.max(20, local.y - box.y);
    if (handleId.includes('w')) {
      const right = box.x + box.w;
      nx = Math.min(right - 20, local.x);
      nw = right - nx;
    }
    if (handleId.includes('n')) {
      const bottom = box.y + box.h;
      ny = Math.min(bottom - 20, local.y);
      nh = bottom - ny;
    }

    // Aspect ratio lock for images or when Shift is held
    const baseLock = el.type === 'image' ? Boolean(el.lockAspectRatio) : false;
    const lockRatio = ev.shiftKey ? !baseLock : baseLock;
    if (lockRatio && box.w > 0 && box.h > 0) {
      const ratio = box.w / box.h;
      if (handleId === 'n' || handleId === 's') {
        nw = nh * ratio;
      } else {
        nh = nw / ratio;
      }
    }

    if (this.app.scene.settings.snapToGrid && !ev.altKey) {
      const g = this.app.scene.settings.gridSize || 20;
      nw = Math.max(20, Math.round(nw / (g / 2)) * (g / 2));
      nh = Math.max(20, Math.round(nh / (g / 2)) * (g / 2));
    }

    el.x = nx;
    el.y = ny;
    el.w = nw;
    el.h = nh;
    if (el.type === 'frame' && !el.collapsed) {
      el.expandedHeight = nh;
    }
  }
}
