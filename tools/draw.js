// tools/draw.js
import { createElement, handleAnchorDeletion } from '../scene/model.js';
import { simplifyFreehandPoints, snapPointToGrid, syncFreehandBounds } from '../scene/geometry.js';
import { hitTestScene } from '../scene/hit.js';
import { updateConnectorBindings } from '../scene/bindings.js';
import { getBrushPreset, resolveBrush } from '../scene/brushes.js';

const MAX_RAW_POINTS = 1500;

// Speed-aware jitter filter. Corners (large direction change) pass through unfiltered
// so handwriting keeps its sharp turns.
function smoothPoint(previous, raw, mode) {
  if (mode === 'off' || !previous) return { x: raw.x, y: raw.y };
  const dx = raw.x - previous.x;
  const dy = raw.y - previous.y;
  const dist = Math.hypot(dx, dy);
  if (mode === 'stabilizer') {
    const alpha = 0.34;
    return { x: previous.x + dx * alpha, y: previous.y + dy * alpha };
  }
  // adaptive: fast movement follows closely, slow movement is filtered more
  const alpha = Math.max(0.32, Math.min(0.92, 0.32 + dist / 28));
  return { x: previous.x + dx * alpha, y: previous.y + dy * alpha };
}

export class DrawTool {
  constructor(app) {
    this.app = app;
    this.activeElement = null;
    this.activePointerType = null;
    this.startWorld = { x: 0, y: 0 };
    this.isErasing = false;
    this.erasedAny = false;
    this.lastFiltered = null;
    this.rawPoints = [];
  }

  brushForCurrentTool() {
    const tool = this.app.activeTool;
    const presetId =
      this.app.currentBrush && this.app.currentBrush !== 'eraser'
        ? this.app.currentBrush
        : tool === 'highlighter'
          ? 'highlighter'
          : 'technical';
    return getBrushPreset(presetId) || resolveBrush({ type: tool });
  }

  eraserSettings() {
    return (
      this.app.eraserSettings || { size: 12, mode: 'object', scope: 'all' }
    );
  }

  onPointerDown(world, ev = {}) {
    if (this.activeElement && this.activePointerType === 'pen' && ev?.pointerType === 'touch') {
      return; // Palm rejection while stylus pen is active
    }
    this.activePointerType = ev?.pointerType || 'mouse';
    const tool = this.app.activeTool;
    const page = this.app.getPage();
    const style = this.app.currentStyle;

    if (tool === 'eraser') {
      this.isErasing = true;
      this.erasedAny = false;
      this.app.eraserCursor = { x: world.x, y: world.y, active: true };
      this.eraseAt(world);
      return;
    }

    if (tool === 'pen' || tool === 'highlighter') {
      const isFading = Boolean(this.app.annotationMode || this.app.fadingInk);
      const preset = this.brushForCurrentTool();
      const isPenInput = ev?.pointerType === 'pen';
      const pressure =
        isPenInput && Number.isFinite(ev?.pressure) && ev.pressure > 0 ? ev.pressure : undefined;
      const smoothing = this.app.brushSmoothing || preset.smoothing || 'adaptive';
      const overrides = this.app.brushOverrides || {};
      const brushWidth = overrides.strokeWidth ?? preset.strokeWidth;
      const brushOpacity = overrides.opacity ?? preset.opacity;
      const pressureRange = {};
      if (Number.isFinite(overrides.minWidthRatio)) pressureRange.minWidthRatio = overrides.minWidthRatio;
      if (Number.isFinite(overrides.maxWidthRatio)) pressureRange.maxWidthRatio = overrides.maxWidthRatio;
      this.lastFiltered = { x: world.x, y: world.y };
      this.rawPoints = [{ x: world.x, y: world.y, ...(pressure !== undefined ? { p: pressure } : {}) }];
      const el = createElement(tool, {
        x: world.x,
        y: world.y,
        stroke: tool === 'highlighter' ? '#facc15' : style.stroke,
        strokeWidth: brushWidth,
        opacity: brushOpacity,
        brush: preset.id,
        smoothing,
        ...pressureRange,
        points: [{ x: world.x, y: world.y, ...(pressure !== undefined ? { p: pressure } : {}) }],
        fading: isFading,
        createdAt: Date.now(),
      });
      syncFreehandBounds(el);
      page.elements.push(el);
      this.activeElement = el;
      this.app.requestRender();
      return;
    }

    // Shape creation: 'rect', 'rounded-rect', 'ellipse', 'diamond', 'sticky', 'frame', 'table', 'code'
    const startPt =
      this.app.scene.settings.snapToGrid && !ev?.altKey
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

  onPointerMove(world, ev = {}) {
    const tool = this.app.activeTool;

    if (tool === 'eraser') {
      this.app.eraserCursor = { x: world.x, y: world.y, active: true };
      if (this.isErasing) {
        this.eraseAt(world);
      } else {
        this.app.requestRender();
      }
      return;
    }

    if (!this.activeElement) return;

    if (tool === 'pen' || tool === 'highlighter') {
      // Shift-straighten (MS-Whiteboard-style ink-to-line): holding Shift
      // collapses the stroke to a two-point line from the press point to the
      // cursor; releasing Shift resumes freehand from the line's end.
      if (ev?.shiftKey && this.activeElement.points.length > 0) {
        this.activeElement.points[1] = { x: world.x, y: world.y };
        if (this.activeElement.points.length > 2) {
          this.activeElement.points.length = 2;
        }
        // Keep the smoothing anchor at the line end so releasing Shift
        // resumes freehand from here, not from the pre-Shift position.
        this.lastFiltered = { x: world.x, y: world.y };
        syncFreehandBounds(this.activeElement);
        this.app.requestRender();
        return;
      }
      const mode = this.activeElement.smoothing || 'adaptive';
      const isPenInput = ev?.pointerType === 'pen';
      const addSample = (raw, pressure) => {
        const point = smoothPoint(this.lastFiltered, raw, mode);
        if (mode === 'stabilizer' && this.lastFiltered) {
          const d = Math.hypot(point.x - this.lastFiltered.x, point.y - this.lastFiltered.y);
          if (d < 0.35) return;
        }
        this.lastFiltered = point;
        this.activeElement.points.push({
          x: point.x,
          y: point.y,
          ...(pressure !== undefined ? { p: pressure } : {}),
        });
        if (this.rawPoints.length < MAX_RAW_POINTS) {
          this.rawPoints.push({
            x: raw.x,
            y: raw.y,
            ...(pressure !== undefined ? { p: pressure } : {}),
          });
        }
      };

      const coalesced = typeof ev?.getCoalescedEvents === 'function' ? ev.getCoalescedEvents() : null;
      if (coalesced && coalesced.length > 1) {
        for (const ce of coalesced) {
          const cw = this.app.screenToWorld(ce.clientX, ce.clientY);
          const cp =
            isPenInput && Number.isFinite(ce.pressure) && ce.pressure > 0 ? ce.pressure : undefined;
          addSample(cw, cp);
        }
      } else {
        const p =
          isPenInput && Number.isFinite(ev?.pressure) && ev.pressure > 0 ? ev.pressure : undefined;
        addSample(world, p);
      }
      syncFreehandBounds(this.activeElement);
      this.app.requestRender();
      return;
    }

    // Shape drag sizing
    const targetPt =
      this.app.scene.settings.snapToGrid && !ev?.altKey
        ? snapPointToGrid(world.x, world.y, this.app.scene.settings.gridSize || 20)
        : world;

    let x = Math.min(this.startWorld.x, targetPt.x);
    let y = Math.min(this.startWorld.y, targetPt.y);
    let w = Math.abs(targetPt.x - this.startWorld.x);
    let h = Math.abs(targetPt.y - this.startWorld.y);

    if (ev?.shiftKey) {
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

    if (tool === 'eraser') {
      this.isErasing = false;
      this.app.eraserCursor = { ...(this.app.eraserCursor || {}), active: false };
      if (this.erasedAny) {
        this.app.commitChange();
      }
      this.erasedAny = false;
      this.app.requestRender();
      return;
    }

    if (!this.activeElement) return;
    const el = this.activeElement;
    this.activeElement = null;

    if (tool === 'pen' || tool === 'highlighter') {
      el.points = simplifyFreehandPoints(el.points, 1.5);
      // Keep a bounded copy of the pre-simplification samples so a stroke can be
      // inspected or re-filtered without changing what is rendered.
      if (this.rawPoints.length > el.points.length && this.rawPoints.length <= MAX_RAW_POINTS) {
        el.rawPoints = this.rawPoints.slice(0, MAX_RAW_POINTS);
      }
      this.rawPoints = [];
      this.lastFiltered = null;
      syncFreehandBounds(el);
      if (!el.fading) {
        this.app.commitChange();
      } else {
        this.app.scheduleFadingCleanup?.();
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

  cancel() {
    this.isErasing = false;
    this.erasedAny = false;
    if (this.activeElement) {
      const page = this.app.getPage();
      const targetId = this.activeElement.id;
      page.elements = page.elements.filter((e) => e.id !== targetId);
      this.app.selectedIds.delete(targetId);
      this.activeElement = null;
      this.app.requestRender();
    }
  }

  eraseAt(world) {
    const page = this.app.getPage();
    const { size = 12, mode = 'object', scope = 'all' } = this.eraserSettings();
    const radius = Math.max(3, Number(size) || 12) / 2;

    const touches = (el) => {
      const pad = Math.max(0, (Number(el.strokeWidth) || 2) / 2);
      return (el.points || []).some(
        (p) => Math.hypot(p.x - world.x, p.y - world.y) <= radius + pad
      );
    };

    // Ink is trimmed only in Trim-Ink mode; Whole Object mode deletes the stroke
    // outright, which is what the mode name promises.
    const trimInk = scope !== 'objects' && mode === 'stroke';
    if (trimInk) {
      let changed = false;
      const inkEls = page.elements.filter(
        (e) => (e.type === 'pen' || e.type === 'highlighter') && !e.locked && !e.hidden
      );
      for (const el of inkEls) {
        if (!touches(el)) continue;
        const runs = [];
        let run = [];
        for (const p of el.points || []) {
          if (Math.hypot(p.x - world.x, p.y - world.y) <= radius + (Number(el.strokeWidth) || 2) / 2) {
            if (run.length > 1) runs.push(run);
            run = [];
          } else {
            run.push(p);
          }
        }
        if (run.length > 1) runs.push(run);
        page.elements = page.elements.filter((x) => x.id !== el.id);
        runs.forEach((pts, idx) => {
          const piece = createElement(el.type, {
            ...el,
            id: idx === 0 ? el.id : undefined,
            points: pts,
            rawPoints: undefined,
          });
          syncFreehandBounds(piece);
          page.elements.push(piece);
        });
        changed = true;
      }
      if (changed) {
        updateConnectorBindings(page);
        this.erasedAny = true;
        this.app.requestRender();
      }
    }

    if (trimInk) return;

    const hit = hitTestScene(page, world.x, world.y, {
      includeLocked: false,
      tolerance: Math.max(8, radius),
    });
    const isInk = hit && (hit.type === 'pen' || hit.type === 'highlighter');
    const scopeAllows =
      !hit ||
      scope === 'all' ||
      (scope === 'ink' && isInk) ||
      (scope === 'objects' && !isInk);
    if (hit && !hit.locked && scopeAllows) {
      handleAnchorDeletion(page, [hit.id]);
      page.elements = page.elements.filter((e) => e.id !== hit.id);
      this.app.selectedIds.delete(hit.id);
      updateConnectorBindings(page);
      this.erasedAny = true;
      this.app.requestRender();
    }
  }
}

export const ShapeTool = DrawTool;
export const EraserTool = DrawTool;
