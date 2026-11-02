// tools/draw.js
import { createElement } from '../scene/model.js';
import { simplifyFreehandPoints, snapPointToGrid } from '../scene/geometry.js';
import { hitTestScene } from '../scene/hit.js';
import { updateConnectorBindings } from '../scene/bindings.js';

export class DrawTool {
  constructor(app) {
    this.app = app;
    this.activeElement = null;
    this.startWorld = { x: 0, y: 0 };
    this.erasedAny = false;
  }

  onPointerDown(world, ev) {
    const tool = this.app.activeTool;
    const page = this.app.getPage();
    const style = this.app.currentStyle;

    if (tool === 'eraser') {
      this.erasedAny = false;
      this.eraseAt(world);
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      const isFading = Boolean(this.app.annotationMode && this.app.fadingInk);
      const el = createElement(tool, {
        x: world.x,
        y: world.y,
        stroke: tool === 'highlighter' ? '#facc15' : style.stroke,
        strokeWidth: tool === 'highlighter' ? 20 : style.strokeWidth,
        opacity: tool === 'highlighter' ? 0.42 : style.opacity,
        points: [{ x: world.x, y: world.y }],
        fading: isFading,
        createdAt: Date.now(),
      });
      page.elements.push(el);
      this.activeElement = el;
      this.app.requestRender();
      return;
    }

    // Shape creation: 'rect', 'rounded-rect', 'ellipse', 'diamond', 'sticky', 'frame', 'table', 'code'
    const startPt =
      this.app.scene.settings.snapToGrid && !ev.altKey
        ? snapPointToGrid(world.x, world.y, this.app.scene.settings.gridSize || 20)
        : world;
    this.startWorld = { ...startPt };

    const existingFrames = page.elements.filter((e) => e.type === 'frame').length;
    const el = createElement(tool, {
      x: startPt.x,
      y: startPt.y,
      w: 4,
      h: 4,
      stroke: style.stroke,
      fill:
        tool === 'sticky'
          ? style.fill !== 'transparent'
            ? style.fill
            : '#fef08a'
          : tool === 'code'
            ? '#0f172a'
            : style.fill,
      strokeWidth: style.strokeWidth,
      strokeStyle: style.strokeStyle,
      roundness: tool === 'rounded-rect' ? Math.max(14, style.roundness) : style.roundness,
      sloppy: style.sloppy,
      fontFamily: tool === 'code' ? 'mono' : style.fontFamily,
      fontSize: tool === 'code' ? 14 : style.fontSize,
      text:
        tool === 'frame'
          ? `Slide ${existingFrames + 1}`
          : tool === 'sticky'
            ? 'Sticky Note'
            : tool === 'code'
              ? `function solve(x) {
  return x * 2;
}`
              : '',
      slideOrder: tool === 'frame' ? existingFrames + 1 : undefined,
    });

    page.elements.push(el);
    this.activeElement = el;
    this.app.selectedIds = new Set([el.id]);
    this.app.requestRender();
  }

  onPointerMove(world, ev) {
    const tool = this.app.activeTool;

    if (tool === 'eraser') {
      this.eraseAt(world);
      return;
    }

    if (!this.activeElement) return;

    if (tool === 'pen' || tool === 'highlighter') {
      this.activeElement.points.push({ x: world.x, y: world.y });
      this.app.requestRender();
      return;
    }

    // Shape drag sizing
    const targetPt =
      this.app.scene.settings.snapToGrid && !ev.altKey
        ? snapPointToGrid(world.x, world.y, this.app.scene.settings.gridSize || 20)
        : world;

    let x = Math.min(this.startWorld.x, targetPt.x);
    let y = Math.min(this.startWorld.y, targetPt.y);
    let w = Math.abs(targetPt.x - this.startWorld.x);
    let h = Math.abs(targetPt.y - this.startWorld.y);

    if (ev.shiftKey) {
      const side = Math.max(w, h);
      w = side;
      h = side;
    }

    this.activeElement.x = x;
    this.activeElement.y = y;
    this.activeElement.w = Math.max(12, w);
    this.activeElement.h = Math.max(12, h);
    if (this.activeElement.type === 'frame') {
      this.activeElement.expandedHeight = this.activeElement.h;
    }
    this.app.requestRender();
  }

  onPointerUp() {
    const tool = this.app.activeTool;
    const page = this.app.getPage();

    if (tool === 'eraser') {
      if (this.erasedAny) {
        this.app.commitChange();
      }
      this.erasedAny = false;
      return;
    }

    if (!this.activeElement) return;
    const el = this.activeElement;
    this.activeElement = null;

    if (tool === 'pen' || tool === 'highlighter') {
      el.points = simplifyFreehandPoints(el.points, 1.5);
      if (!el.fading) {
        this.app.commitChange();
      } else {
        this.app.scheduleFadingCleanup();
      }
      this.app.requestRender();
      return;
    }

    // If user just clicked without dragging, give shape a sensible default size
    if (el.w < 20 && el.h < 20) {
      if (el.type === 'sticky') {
        el.w = 180;
        el.h = 180;
      } else if (el.type === 'frame') {
        el.w = 480;
        el.h = 320;
        el.expandedHeight = 320;
      } else if (el.type === 'table') {
        el.w = 360;
        el.h = 160;
      } else if (el.type === 'code') {
        el.w = 320;
        el.h = 160;
      } else {
        el.w = 140;
        el.h = 90;
      }
    }

    this.app.commitChange();
    if (!this.app.toolLock) {
      this.app.setTool('select');
    }
    this.app.updateUI();
    this.app.requestRender();
  }

  eraseAt(world) {
    const page = this.app.getPage();
    const hit = hitTestScene(page, world.x, world.y, { includeLocked: false, tolerance: 10 });
    if (hit && !hit.locked) {
      page.elements = page.elements.filter((e) => e.id !== hit.id);
      this.app.selectedIds.delete(hit.id);
      updateConnectorBindings(page);
      this.erasedAny = true;
      this.app.requestRender();
    }
  }
}
