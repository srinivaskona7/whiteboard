// render/canvas.js
import { getThemeTokens, FONT_MAP, resolveThemeColor } from './themes.js';
import {
  getDashArray,
  drawShapeElement,
  drawConnectorElement,
  drawElementText,
  drawStamp,
  drawMathTool,
  drawTableElement,
  drawCodeElement,
} from './shapes.js';
import {
  getElementBounds,
  getSelectionBounds,
  syncFreehandBounds,
  isElementInViewport,
  getConnectionPorts,
} from '../scene/geometry.js';
import { getElementHandles, getMultiSelectionHandles } from '../scene/hit.js';

export class CanvasRenderer {
  constructor(canvas, minimapCanvas = null) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.minimapCanvas = minimapCanvas;
    this.minimapCtx = minimapCanvas ? minimapCanvas.getContext('2d') : null;
    this.imageCache = new Map();
    this.onImageLoad = null;
    this.onRenderError = null;
    this._lastErrorTime = 0;
  }

  _reportRenderError(scope, err) {
    const now = Date.now();
    if (now - this._lastErrorTime > 4000) {
      this._lastErrorTime = now;
      if (typeof this.onRenderError === 'function') {
        this.onRenderError(scope, err);
      }
    }
  }

  getImage(fileId, filesMap) {
    if (!fileId || !filesMap || !filesMap[fileId]) return null;
    if (this.imageCache.has(fileId)) return this.imageCache.get(fileId);
    const fileEntry = filesMap[fileId];
    if (!fileEntry.dataUrl || typeof Image === 'undefined') return null;
    const img = new Image();
    img.onload = () => {
      if (this.onImageLoad) this.onImageLoad();
    };
    img.src = fileEntry.dataUrl;
    this.imageCache.set(fileId, img);
    return img;
  }

  resize(width, height, dpr = window.devicePixelRatio || 1) {
    this.dpr = dpr;
    this.width = width;
    this.height = height;
    this.canvas.width = Math.floor(width * dpr);
    this.canvas.height = Math.floor(height * dpr);
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
  }

  getViewportWorldBounds(camera) {
    const invZ = 1 / camera.zoom;
    return {
      x: -camera.x * invZ - 80,
      y: -camera.y * invZ - 80,
      w: this.width * invZ + 160,
      h: this.height * invZ + 160,
    };
  }

  render(sceneOrState, maybeState = null) {
    const appState = maybeState
      ? {
          ...maybeState,
          scene: sceneOrState,
          page:
            maybeState.page ||
            sceneOrState.pages.find((p) => p.id === sceneOrState.activePageId) ||
            sceneOrState.pages[0],
        }
      : sceneOrState;
    const {
      scene,
      page,
      selectedIds = new Set(),
      hoveredElement = null,
      hoveredPort = null,
      marqueeBox = null,
      smartGuides = [],
      laserTrail = [],
      spotlight = null,
      presentState = null,
      cropState = null,
      editingElementId = null,
      minimapOpen = false,
    } = appState;

    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const theme = getThemeTokens(scene.theme);
    const cam = page.camera;
    const now = appState.now || Date.now();

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawBackgroundPattern(ctx, page.background, cam, theme, scene.settings?.gridSize || 20);

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    const vpBounds = this.getViewportWorldBounds(cam);

    const clippingFrames = new Map();
    for (const el of page.elements) {
      if (el.type === 'frame' && el.clip && !el.hidden && !el.collapsed) {
        clippingFrames.set(el.id, el);
      }
    }

    const ordered = [
      ...page.elements.filter((e) => e.isBackground),
      ...page.elements.filter((e) => !e.isBackground),
    ];

    for (const el of ordered) {
      if (!el || el.hidden) continue;
      if (!Number.isFinite(el.x) || !Number.isFinite(el.y)) continue;
      if (presentState?.active && el.revealStep > 0 && el.revealStep > presentState.revealStep) {
        continue;
      }
      if (!isElementInViewport(el, vpBounds)) continue;

      let clipFrame = null;
      if (el.containerId && clippingFrames.has(el.containerId)) {
        clipFrame = clippingFrames.get(el.containerId);
      } else if (el.type !== 'frame') {
        for (const f of clippingFrames.values()) {
          const cx = el.x + (el.w || 0) / 2;
          const cy = el.y + (el.h || 0) / 2;
          if (cx >= f.x && cx <= f.x + f.w && cy >= f.y && cy <= f.y + f.h) {
            clipFrame = f;
            break;
          }
        }
      }

      try {
        if (clipFrame) {
          ctx.save();
          ctx.beginPath();
          ctx.rect(clipFrame.x, clipFrame.y, clipFrame.w, clipFrame.h);
          ctx.clip();
        }
        this.drawSingleElement(ctx, el, page, scene, theme, now, editingElementId, presentState);
      } catch (err) {
        this._reportRenderError(`element:${el.id}`, err);
      } finally {
        if (clipFrame) ctx.restore();
      }
    }

    if (smartGuides && smartGuides.length > 0) {
      try {
        ctx.save();
        ctx.strokeStyle = theme.guideStroke;
        ctx.lineWidth = 1.2 / cam.zoom;
        ctx.setLineDash([5 / cam.zoom, 4 / cam.zoom]);
        for (const g of smartGuides) {
          ctx.beginPath();
          if (g.type === 'vertical') {
            ctx.moveTo(g.x, g.y1);
            ctx.lineTo(g.x, g.y2);
          } else {
            ctx.moveTo(g.x1, g.y);
            ctx.lineTo(g.x2, g.y);
          }
          ctx.stroke();
        }
        ctx.restore();
      } catch (err) {
        this._reportRenderError('smartGuides', err);
      }
    }

    if (hoveredElement && !presentState?.active) {
      try {
        this.drawConnectionPorts(ctx, hoveredElement, hoveredPort, cam.zoom, theme);
      } catch (err) {
        this._reportRenderError('hoveredPorts', err);
      }
    }

    if (appState.connectorPreview && !presentState?.active) {
      try {
        const { startPort, endPort } = appState.connectorPreview;
        if (startPort?.element) {
          this.drawConnectionPorts(ctx, startPort.element, startPort, cam.zoom, theme);
        }
        if (endPort?.element && endPort.element !== startPort?.element) {
          this.drawConnectionPorts(ctx, endPort.element, endPort, cam.zoom, theme);
        }
      } catch (err) {
        this._reportRenderError('connectorPreview', err);
      }
    }

    if (appState.placementPreview?.elements?.length && !presentState?.active) {
      try {
        this.drawPlacementPreview(ctx, appState.placementPreview, page, scene, theme, cam.zoom);
      } catch (err) {
        this._reportRenderError('placementPreview', err);
      }
    }

    if (appState.remoteCursors && appState.remoteCursors.length > 0) {
      try {
        this.drawRemoteCursors(ctx, appState.remoteCursors, page, cam.zoom);
      } catch (err) {
        this._reportRenderError('remoteCursors', err);
      }
    }

    if (!presentState?.active && selectedIds.size > 0) {
      try {
        const selectedEls = page.elements.filter((e) => selectedIds.has(e.id) && !e.hidden);
        if (selectedEls.length === 1) {
          this.drawSelectionHandles(ctx, selectedEls[0], page, cam.zoom, theme);
        } else if (selectedEls.length > 1) {
          const gb = getSelectionBounds(selectedEls);
          if (gb) {
            ctx.save();
            ctx.strokeStyle = theme.selectionStroke;
            ctx.lineWidth = 1.5 / cam.zoom;
            ctx.setLineDash([6 / cam.zoom, 4 / cam.zoom]);
            ctx.strokeRect(gb.x, gb.y, gb.w, gb.h);
            ctx.setLineDash([]);
            const hs = 7.5 / cam.zoom;
            for (const hd of getMultiSelectionHandles(gb)) {
              ctx.fillStyle = theme.handleFill;
              ctx.strokeStyle = theme.handleStroke;
              ctx.fillRect(hd.x - hs / 2, hd.y - hs / 2, hs, hs);
              ctx.strokeRect(hd.x - hs / 2, hd.y - hs / 2, hs, hs);
            }
            ctx.restore();
          }
        }
      } catch (err) {
        this._reportRenderError('selectionHandles', err);
      }
    }

    const pointers = appState.classroomPointers || appState.studentPointers;
    if (pointers && pointers.length > 0) {
      try {
        this.drawClassroomPointers(ctx, pointers, page, cam.zoom, now);
      } catch (err) {
        this._reportRenderError('classroomPointers', err);
      }
    }

    if (cropState && cropState.element) {
      try {
        this.drawCropOverlay(ctx, cropState, cam.zoom);
      } catch (err) {
        this._reportRenderError('cropOverlay', err);
      }
    }

    if (marqueeBox) {
      try {
        ctx.save();
        ctx.fillStyle = theme.selectionFill;
        ctx.strokeStyle = theme.selectionStroke;
        ctx.lineWidth = 1.2 / cam.zoom;
        ctx.fillRect(marqueeBox.x, marqueeBox.y, marqueeBox.w, marqueeBox.h);
        ctx.strokeRect(marqueeBox.x, marqueeBox.y, marqueeBox.w, marqueeBox.h);
        ctx.restore();
      } catch (err) {
        this._reportRenderError('marquee', err);
      }
    }

    if (Array.isArray(appState.lassoPoints) && appState.lassoPoints.length >= 2) {
      try {
        ctx.save();
        ctx.fillStyle = theme.selectionFill;
        ctx.strokeStyle = theme.selectionStroke;
        ctx.lineWidth = 1.4 / cam.zoom;
        ctx.setLineDash([5 / cam.zoom, 4 / cam.zoom]);
        ctx.beginPath();
        ctx.moveTo(appState.lassoPoints[0].x, appState.lassoPoints[0].y);
        for (let i = 1; i < appState.lassoPoints.length; i++) {
          ctx.lineTo(appState.lassoPoints[i].x, appState.lassoPoints[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();
      } catch (err) {
        this._reportRenderError('lasso', err);
      }
    }

    if (laserTrail && laserTrail.length > 0) {
      try {
        this.drawLaserTrail(ctx, laserTrail, cam.zoom, now);
      } catch (err) {
        this._reportRenderError('laserTrail', err);
      }
    }

    ctx.restore();

    if (spotlight && (spotlight.active || spotlight.magnifierOnly)) {
      try {
        this.drawSpotlightAndMagnifier(ctx, spotlight, page, scene, theme, now, presentState);
      } catch (err) {
        this._reportRenderError('spotlight', err);
      }
    }
    ctx.restore();

    try {
      this.drawMinimap(page, scene, theme, Boolean(minimapOpen && !presentState?.active));
    } catch (err) {
      this._reportRenderError('minimap', err);
    }
  }

  drawBackgroundPattern(ctx, bgType, cam, theme, gridSize = 20) {
    if (bgType === 'plain') return;
    const step = gridSize * cam.zoom;
    if (step < 6) return;
    const offsetX = ((cam.x % step) + step) % step, offsetY = ((cam.y % step) + step) % step;
    ctx.save();
    if (bgType === 'grid') {
      ctx.strokeStyle = theme.gridMinor; ctx.lineWidth = 1; ctx.beginPath();
      for (let x = offsetX; x < this.width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, this.height); }
      for (let y = offsetY; y < this.height; y += step) { ctx.moveTo(0, y); ctx.lineTo(this.width, y); }
      ctx.stroke();
    } else if (bgType === 'dots') {
      ctx.fillStyle = theme.dotsColor;
      const r = Math.max(1, Math.min(2.2, cam.zoom * 1.2));
      for (let x = offsetX; x < this.width; x += step) {
        for (let y = offsetY; y < this.height; y += step) ctx.fillRect(x - r / 2, y - r / 2, r, r);
      }
    }
    ctx.restore();
  }

  drawSingleElement(ctx, el, page, scene, theme, now, editingElementId, presentState) {
    ctx.save();
    let alpha = el.opacity ?? 1;
    if (el.fading && el.createdAt && now - el.createdAt > 2200) {
      alpha *= Math.max(0, 1 - (now - el.createdAt - 2200) / 800);
    }
    ctx.globalAlpha = alpha;
    if (el.type === 'pen' || el.type === 'highlighter') syncFreehandBounds(el);
    const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
    if (el.rotation && el.type !== 'line' && el.type !== 'arrow') {
      const cx = el.x + el.w / 2, cy = el.y + h / 2;
      ctx.translate(cx, cy); ctx.rotate(el.rotation); ctx.translate(-cx, -cy);
    }
    if (el.type === 'pen' || el.type === 'highlighter') this.drawFreehand(ctx, el, theme);
    else if (el.type === 'line' || el.type === 'arrow') drawConnectorElement(ctx, el, page, theme);
    else if (el.type === 'frame') this.drawFrame(ctx, el, theme);
    else if (el.type === 'image') this.drawImageElement(ctx, el, scene.files, theme);
    else if (el.type === 'text') { if (editingElementId !== el.id) drawElementText(ctx, el, theme.name, 4); }
    else if (el.type === 'table') drawTableElement(ctx, el, theme.name);
    else if (el.type === 'code') drawCodeElement(ctx, el);
    else if (el.type === 'stamp') drawStamp(ctx, el);
    else if (el.type === 'math') drawMathTool(ctx, el);
    else drawShapeElement(ctx, editingElementId === el.id ? { ...el, text: '' } : el, theme);

    if (!presentState?.active) this.drawElementBadges(ctx, el);
    ctx.restore();
  }

  drawFreehand(ctx, el, theme) {
    const pts = el.points || [];
    if (pts.length === 0) return;
    const stroke =
      el.type === 'highlighter'
        ? el.stroke || '#facc15'
        : resolveThemeColor(el.stroke || '#1e293b', theme.name, 'stroke');

    ctx.save();
    ctx.strokeStyle = stroke;
    ctx.fillStyle = stroke;
    ctx.lineWidth = el.strokeWidth || 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.setLineDash(getDashArray(el.strokeStyle, el.strokeWidth || 3));

    if (pts.length === 1) {
      ctx.beginPath();
      ctx.arc(pts[0].x, pts[0].y, (el.strokeWidth || 3) / 2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length - 1; i++) {
        const mx = (pts[i].x + pts[i + 1].x) / 2;
        const my = (pts[i].y + pts[i + 1].y) / 2;
        ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
      }
      ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawFrame(ctx, el, theme) {
    const h = el.collapsed ? 42 : el.h;
    ctx.save();
    ctx.fillStyle = el.fill && el.fill !== 'transparent' ? el.fill : theme.frameBg;
    ctx.strokeStyle = theme.frameBorder;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, h, 8);
    ctx.fill();
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = theme.frameHeaderBg;
    ctx.beginPath();
    ctx.roundRect(el.x, el.y, el.w, 36, [8, 8, 0, 0]);
    ctx.fill();

    ctx.fillStyle = theme.frameTitle;
    ctx.font = `600 13px ${FONT_MAP.sans}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const slidePrefix = el.excludeFromPresentation
      ? '[Optional] '
      : el.slideOrder
        ? `#${el.slideOrder} `
        : '';
    ctx.fillText(`${slidePrefix}${el.text || 'Frame'}`, el.x + 12, el.y + 18);

    const bx = el.x + el.w - 28;
    const by = el.y + 9;
    ctx.strokeStyle = theme.frameTitle;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(bx, by, 18, 18);
    ctx.beginPath();
    ctx.moveTo(bx + 4, by + 9);
    ctx.lineTo(bx + 14, by + 9);
    if (el.collapsed) {
      ctx.moveTo(bx + 9, by + 4);
      ctx.lineTo(bx + 9, by + 14);
    }
    ctx.stroke();
    ctx.restore();
  }

  drawImageElement(ctx, el, filesMap, theme) {
    const img = this.getImage(el.fileId, filesMap);
    ctx.save();
    if (img && img.complete && img.naturalWidth > 0) {
      if (el.crop) {
        const sx = el.crop.x * img.naturalWidth;
        const sy = el.crop.y * img.naturalHeight;
        const sw = el.crop.w * img.naturalWidth;
        const sh = el.crop.h * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, el.x, el.y, el.w, el.h);
      } else {
        ctx.drawImage(img, el.x, el.y, el.w, el.h);
      }
    } else {
      ctx.fillStyle = theme.frameHeaderBg;
      ctx.strokeStyle = theme.frameBorder;
      ctx.fillRect(el.x, el.y, el.w, el.h);
      ctx.strokeRect(el.x, el.y, el.w, el.h);
      ctx.fillStyle = theme.frameTitle;
      ctx.font = `13px ${FONT_MAP.sans}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Image', el.x + el.w / 2, el.y + el.h / 2);
    }
    ctx.restore();
  }

  drawElementBadges(ctx, el) {
    const b = getElementBounds(el);
    if (el.link) {
      ctx.save(); ctx.fillStyle = '#2563eb'; ctx.beginPath(); ctx.roundRect(b.maxX - 22, b.minY + 4, 18, 18, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('↗', b.maxX - 13, b.minY + 13); ctx.restore();
    }
    if (el.revealStep > 0) {
      ctx.save(); ctx.fillStyle = '#7c3aed'; ctx.beginPath(); ctx.roundRect(b.minX + 4, b.minY + 4, 22, 18, 4); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`S${el.revealStep}`, b.minX + 15, b.minY + 13); ctx.restore();
    }
  }

  drawConnectionPorts(ctx, el, hoveredPort, zoom, theme) {
    const ports = getConnectionPorts(el);
    if (!ports.length) return;
    const r = 5.5 / zoom;
    ctx.save();
    for (const p of ports) {
      const isHover = hoveredPort && hoveredPort.elementId === el.id && hoveredPort.port === p.port;
      ctx.fillStyle = isHover ? theme.portHoverFill : theme.portFill;
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath(); ctx.arc(p.x, p.y, isHover ? r * 1.35 : r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawSelectionHandles(ctx, el, page, zoom, theme) {
    ctx.save();
    ctx.strokeStyle = theme.selectionStroke; ctx.lineWidth = 1.5 / zoom;
    if (el.type === 'pen' || el.type === 'highlighter') syncFreehandBounds(el);
    if (el.type !== 'line' && el.type !== 'arrow') {
      const h = el.type === 'frame' && el.collapsed ? 42 : el.h, cx = el.x + el.w / 2, cy = el.y + h / 2;
      ctx.save();
      if (el.rotation) { ctx.translate(cx, cy); ctx.rotate(el.rotation); ctx.translate(-cx, -cy); }
      ctx.strokeRect(el.x, el.y, el.w, h);
      if (!el.locked) { ctx.beginPath(); ctx.moveTo(cx, el.y); ctx.lineTo(cx, el.y - 28); ctx.stroke(); }
      ctx.restore();
    }
    if (el.locked) { ctx.restore(); return; }
    const handles = getElementHandles(el, page), size = 8 / zoom;
    for (const hd of handles) {
      ctx.fillStyle = hd.id === 'mid' ? '#f59e0b' : hd.id === 'label' ? '#10b981' : theme.handleFill;
      ctx.strokeStyle = theme.handleStroke; ctx.lineWidth = 1.6 / zoom; ctx.beginPath();
      if (hd.id === 'rotate' || hd.id === 'mid' || hd.id === 'start' || hd.id === 'end' || hd.id === 'label') {
        ctx.arc(hd.x, hd.y, size * 0.65, 0, Math.PI * 2);
      } else {
        ctx.rect(hd.x - size / 2, hd.y - size / 2, size, size);
      }
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  drawCropOverlay(ctx, cropState, zoom) {
    const element = cropState.element;
    const rect = cropState.rect || cropState.box;
    if (!element || !rect) return;
    ctx.save();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
    ctx.fillRect(element.x, element.y, element.w, element.h);
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2 / zoom;
    ctx.setLineDash([5 / zoom, 3 / zoom]);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
    ctx.restore();
  }

  drawLaserTrail(ctx, trail, zoom, now) {
    if (!Array.isArray(trail) || trail.length === 0) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = Math.max(0, now - (p1.time ?? p1.t ?? now));
      const alpha = Math.max(0, 1 - age / 1200);
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = (6 * alpha) / zoom;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    const tip = trail[trail.length - 1];
    const tipAge = Math.max(0, now - (tip.time ?? tip.t ?? now));
    const tipAlpha = Math.max(0, 1 - tipAge / 1200);
    if (tipAlpha > 0 && Number.isFinite(tip.x) && Number.isFinite(tip.y)) {
      ctx.fillStyle = `rgba(239, 68, 68, ${tipAlpha})`;
      ctx.beginPath();
      ctx.arc(tip.x, tip.y, 4.5 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawClassroomPointers(ctx, pointers, page, zoom, now) {
    ctx.save();
    for (const pt of pointers) {
      const ts = pt.createdAt ?? pt.time ?? now;
      if (now - ts > 12000) continue;
      let px = pt.x;
      let py = pt.y;
      if (pt.targetElementId) {
        const target = page.elements.find((e) => e.id === pt.targetElementId);
        if (target) {
          px = target.x + target.w / 2;
          py = target.y + target.h / 2;
          ctx.strokeStyle = pt.color || '#ec4899';
          ctx.lineWidth = 3 / zoom;
          ctx.strokeRect(target.x - 4, target.y - 4, target.w + 8, target.h + 8);
        }
      }
      const pulse = 10 + ((now % 1000) / 1000) * 14;
      ctx.strokeStyle = pt.color || '#ec4899';
      ctx.lineWidth = 2.5 / zoom;
      ctx.beginPath();
      ctx.arc(px, py, pulse / zoom, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = pt.color || '#ec4899';
      ctx.beginPath();
      ctx.arc(px, py, 5 / zoom, 0, Math.PI * 2);
      ctx.fill();
      const targetName = pt.targetElementName || pt.targetLabel || '';
      const label = `${pt.authorName || 'Student'}${targetName ? ` → ${targetName}` : ''}`;
      ctx.font = `bold ${Math.round(12 / zoom)}px ${FONT_MAP.sans}`;
      const lw = ctx.measureText(label).width + 14 / zoom;
      const lh = 20 / zoom;
      ctx.beginPath();
      ctx.roundRect(px + 8 / zoom, py - lh - 4 / zoom, lw, lh, 6 / zoom);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, px + 15 / zoom, py - lh / 2 - 4 / zoom);
    }
    ctx.restore();
  }

  drawPlacementPreview(ctx, preview, page, scene, theme, zoom) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    const previewPage = { ...page, elements: [...page.elements, ...preview.elements] };
    for (const el of preview.elements) {
      this.drawSingleElement(ctx, el, previewPage, scene, theme, Date.now(), null, null);
    }
    const b = getSelectionBounds(preview.elements);
    if (b) {
      ctx.globalAlpha = 0.9;
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 1.5 / zoom;
      ctx.setLineDash([6 / zoom, 4 / zoom]);
      ctx.strokeRect(b.x - 8, b.y - 8, b.w + 16, b.h + 16);
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  drawRemoteCursors(ctx, remoteCursors, page, zoom) {
    ctx.save();
    for (const rc of remoteCursors) {
      const color = rc.color || '#2563eb';
      if (Array.isArray(rc.selectionIds) && rc.selectionIds.length > 0) {
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([4 / zoom, 3 / zoom]);
        for (const sid of rc.selectionIds) {
          const target = page.elements.find((e) => e.id === sid && !e.hidden);
          if (target) {
            ctx.strokeRect(target.x - 3, target.y - 3, (target.w || 40) + 6, (target.h || 40) + 6);
          }
        }
        ctx.restore();
      }

      const s = 1 / zoom;
      ctx.save();
      ctx.translate(rc.x, rc.y);
      ctx.scale(s, s);
      ctx.fillStyle = color;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, 15);
      ctx.lineTo(4.2, 11.5);
      ctx.lineTo(10.5, 13.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      const label = rc.name || 'Participant';
      ctx.font = `600 11px ${FONT_MAP.sans}`;
      const lw = ctx.measureText(label).width + 12;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.roundRect(10, 12, lw, 19, 5);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, 16, 21.5);
      ctx.restore();
    }
    ctx.restore();
  }

  drawSpotlightAndMagnifier(ctx, spotlight, page = null, scene = null, theme = null, now = Date.now(), presentState = null) {
    const {
      x,
      y,
      radius = 130,
      magnifier = false,
      magnifierScale = 2,
      dimOpacity = 0.72,
      dimBackground = true,
    } = spotlight;
    ctx.save();
    if (magnifier && page && scene && theme) {
      const cam = page.camera;
      const lensZoom = Math.max(1.5, Math.min(4, Number(magnifierScale) || 2));
      const worldX = (x - cam.x) / cam.zoom;
      const worldY = (y - cam.y) / cam.zoom;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = theme.canvasBg;
      ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
      ctx.translate(x, y);
      ctx.scale(cam.zoom * lensZoom, cam.zoom * lensZoom);
      ctx.translate(-worldX, -worldY);
      for (const el of page.elements) {
        if (!el || el.hidden) continue;
        if (presentState?.active && el.revealStep > 0 && el.revealStep > presentState.revealStep) continue;
        this.drawSingleElement(ctx, el, page, scene, theme, now, null, presentState);
      }
      ctx.restore();
    }

    if (dimBackground !== false) {
      const alpha = Math.max(0.2, Math.min(0.92, Number(dimOpacity) || 0.72));
      ctx.fillStyle = `rgba(2, 6, 23, ${alpha})`;
      ctx.beginPath();
      ctx.rect(0, 0, this.width, this.height);
      ctx.arc(x, y, radius, 0, Math.PI * 2, true);
      ctx.fill('evenodd');
    }

    ctx.strokeStyle = magnifier ? '#38bdf8' : '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  drawMinimap(page, scene, theme, minimapOpen = false) {
    if (!this.minimapCanvas || !this.minimapCtx) return;
    this.minimapCanvas.classList?.toggle('wb-hidden', !minimapOpen);
    if (!minimapOpen) return;

    const mctx = this.minimapCtx;
    const mw = this.minimapCanvas.width || 180;
    const mh = this.minimapCanvas.height || 120;
    mctx.clearRect(0, 0, mw, mh);
    mctx.fillStyle = theme.canvasBg;
    mctx.fillRect(0, 0, mw, mh);

    const visible = page.elements.filter((e) => !e.hidden);
    const vp = this.getViewportWorldBounds(page.camera);
    const contentBounds = getSelectionBounds(visible);
    const minX = contentBounds ? Math.min(contentBounds.x - 100, vp.x) : vp.x;
    const minY = contentBounds ? Math.min(contentBounds.y - 100, vp.y) : vp.y;
    const maxX = contentBounds
      ? Math.max(contentBounds.x + contentBounds.w + 100, vp.x + vp.w)
      : vp.x + vp.w;
    const maxY = contentBounds
      ? Math.max(contentBounds.y + contentBounds.h + 100, vp.y + vp.h)
      : vp.y + vp.h;
    const worldW = Math.max(400, maxX - minX);
    const worldH = Math.max(300, maxY - minY);
    const scale = Math.min((mw - 12) / worldW, (mh - 12) / worldH);
    const ox = (mw - worldW * scale) / 2 - minX * scale;
    const oy = (mh - worldH * scale) / 2 - minY * scale;

    mctx.save();
    mctx.translate(ox, oy);
    mctx.scale(scale, scale);

    for (const el of visible) {
      const b = getElementBounds(el);
      mctx.fillStyle =
        el.fill && el.fill !== 'transparent' ? resolveThemeColor(el.fill, scene.theme) : 'rgba(100, 116, 139, 0.25)';
      mctx.strokeStyle = resolveThemeColor(el.stroke || '#475569', scene.theme);
      mctx.lineWidth = Math.max(1 / scale, 1);
      mctx.fillRect(b.x, b.y, Math.max(6, b.w), Math.max(6, b.h));
      mctx.strokeRect(b.x, b.y, Math.max(6, b.w), Math.max(6, b.h));
    }

    mctx.strokeStyle = '#2563eb';
    mctx.lineWidth = 1.8 / scale;
    mctx.fillStyle = 'rgba(37, 99, 235, 0.08)';
    mctx.fillRect(vp.x + 80, vp.y + 80, Math.max(20, vp.w - 160), Math.max(20, vp.h - 160));
    mctx.strokeRect(vp.x + 80, vp.y + 80, Math.max(20, vp.w - 160), Math.max(20, vp.h - 160));
    mctx.restore();
  }

  exportToPngCanvas(scene, page, options = {}) {
    const { scale = 2, transparent = false, selectionOnly = false, selectedIds = new Set() } = options;
    const elements = selectionOnly
      ? page.elements.filter((e) => selectedIds.has(e.id) && !e.hidden)
      : page.elements.filter((e) => !e.hidden);
    const bounds = getSelectionBounds(elements) || { x: 0, y: 0, w: 800, h: 600 };
    const pad = 32;
    const exportW = Math.max(64, Math.ceil(bounds.w + pad * 2));
    const exportH = Math.max(64, Math.ceil(bounds.h + pad * 2));

    const offscreen = document.createElement('canvas');
    offscreen.width = exportW * scale;
    offscreen.height = exportH * scale;
    const octx = offscreen.getContext('2d');
    const theme = getThemeTokens(scene.theme);

    octx.save();
    octx.scale(scale, scale);
    if (!transparent) {
      octx.fillStyle = theme.canvasBg;
      octx.fillRect(0, 0, exportW, exportH);
    }
    octx.translate(-bounds.x + pad, -bounds.y + pad);
    const now = Date.now();
    for (const el of elements) {
      this.drawSingleElement(octx, el, page, scene, theme, now, null, null);
    }
    octx.restore();
    return offscreen;
  }
}
