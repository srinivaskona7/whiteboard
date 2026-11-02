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
  isElementInViewport,
  getConnectionPorts,
} from '../scene/geometry.js';
import { getElementHandles } from '../scene/hit.js';

export class CanvasRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.imageCache = new Map();
    this.onImageLoad = null;
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

  render(appState) {
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
    } = appState;

    const ctx = this.ctx;
    const dpr = this.dpr || 1;
    const theme = getThemeTokens(scene.theme);
    const cam = page.camera;

    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = theme.canvasBg;
    ctx.fillRect(0, 0, this.width, this.height);
    this.drawBackgroundPattern(ctx, page.background, cam, theme, scene.settings?.gridSize || 20);

    ctx.save();
    ctx.translate(cam.x, cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    const vpBounds = this.getViewportWorldBounds(cam);
    const now = Date.now();

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
      if (el.hidden) continue;
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

      if (clipFrame) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(clipFrame.x, clipFrame.y, clipFrame.w, clipFrame.h);
        ctx.clip();
      }
      this.drawSingleElement(ctx, el, page, scene, theme, now, editingElementId, presentState);
      if (clipFrame) ctx.restore();
    }

    if (smartGuides && smartGuides.length > 0) {
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
    }

    if (hoveredElement && !presentState?.active) {
      this.drawConnectionPorts(ctx, hoveredElement, hoveredPort, cam.zoom, theme);
    }

    if (!presentState?.active && selectedIds.size > 0) {
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
          ctx.strokeRect(gb.x - 4, gb.y - 4, gb.w + 8, gb.h + 8);
          ctx.restore();
        }
      }
    }

    if (cropState && cropState.element) {
      this.drawCropOverlay(ctx, cropState, cam.zoom);
    }

    if (marqueeBox) {
      ctx.save();
      ctx.fillStyle = theme.selectionFill;
      ctx.strokeStyle = theme.selectionStroke;
      ctx.lineWidth = 1.2 / cam.zoom;
      ctx.fillRect(marqueeBox.x, marqueeBox.y, marqueeBox.w, marqueeBox.h);
      ctx.strokeRect(marqueeBox.x, marqueeBox.y, marqueeBox.w, marqueeBox.h);
      ctx.restore();
    }

    if (laserTrail && laserTrail.length > 1) {
      this.drawLaserTrail(ctx, laserTrail, cam.zoom, now);
    }

    ctx.restore();

    if (spotlight && spotlight.active) {
      this.drawSpotlightAndMagnifier(ctx, spotlight);
    }
    ctx.restore();
  }

  drawBackgroundPattern(ctx, bgType, cam, theme, gridSize = 20) {
    if (bgType === 'plain') return;
    const step = gridSize * cam.zoom;
    if (step < 6) return;
    const offsetX = ((cam.x % step) + step) % step;
    const offsetY = ((cam.y % step) + step) % step;

    ctx.save();
    if (bgType === 'grid') {
      ctx.strokeStyle = theme.gridMinor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = offsetX; x < this.width; x += step) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, this.height);
      }
      for (let y = offsetY; y < this.height; y += step) {
        ctx.moveTo(0, y);
        ctx.lineTo(this.width, y);
      }
      ctx.stroke();
    } else if (bgType === 'dots') {
      ctx.fillStyle = theme.dotsColor;
      const r = Math.max(1, Math.min(2.2, cam.zoom * 1.2));
      for (let x = offsetX; x < this.width; x += step) {
        for (let y = offsetY; y < this.height; y += step) {
          ctx.fillRect(x - r / 2, y - r / 2, r, r);
        }
      }
    }
    ctx.restore();
  }

  drawSingleElement(ctx, el, page, scene, theme, now, editingElementId, presentState) {
    ctx.save();
    let alpha = el.opacity ?? 1;
    if (el.fading && el.createdAt) {
      const elapsed = now - el.createdAt;
      if (elapsed > 2200) alpha *= Math.max(0, 1 - (elapsed - 2200) / 800);
    }
    ctx.globalAlpha = alpha;

    const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
    if (el.rotation && el.type !== 'line' && el.type !== 'arrow' && el.type !== 'pen' && el.type !== 'highlighter') {
      const cx = el.x + el.w / 2;
      const cy = el.y + h / 2;
      ctx.translate(cx, cy);
      ctx.rotate(el.rotation);
      ctx.translate(-cx, -cy);
    }

    if (el.type === 'pen' || el.type === 'highlighter') {
      this.drawFreehand(ctx, el, theme);
    } else if (el.type === 'line' || el.type === 'arrow') {
      drawConnectorElement(ctx, el, page, theme);
    } else if (el.type === 'frame') {
      this.drawFrame(ctx, el, theme);
    } else if (el.type === 'image') {
      this.drawImageElement(ctx, el, scene.files, theme);
    } else if (el.type === 'text') {
      if (editingElementId !== el.id) drawElementText(ctx, el, theme.name, 4);
    } else if (el.type === 'table') {
      drawTableElement(ctx, el, theme.name);
    } else if (el.type === 'code') {
      drawCodeElement(ctx, el);
    } else if (el.type === 'stamp') {
      drawStamp(ctx, el);
    } else if (el.type === 'math') {
      drawMathTool(ctx, el);
    } else {
      const cloneForRender = editingElementId === el.id ? { ...el, text: '' } : el;
      drawShapeElement(ctx, cloneForRender, theme);
    }

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
    const slidePrefix = el.slideOrder ? `#${el.slideOrder} ` : '';
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
      ctx.save();
      ctx.fillStyle = '#2563eb';
      ctx.beginPath();
      ctx.roundRect(b.maxX - 22, b.minY + 4, 18, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('↗', b.maxX - 13, b.minY + 13);
      ctx.restore();
    }
    if (el.revealStep > 0) {
      ctx.save();
      ctx.fillStyle = '#7c3aed';
      ctx.beginPath();
      ctx.roundRect(b.minX + 4, b.minY + 4, 22, 18, 4);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`S${el.revealStep}`, b.minX + 15, b.minY + 13);
      ctx.restore();
    }
  }

  drawConnectionPorts(ctx, el, hoveredPort, zoom, theme) {
    const ports = getConnectionPorts(el);
    if (ports.length === 0) return;
    const r = 5.5 / zoom;
    ctx.save();
    for (const p of ports) {
      const isHover = hoveredPort && hoveredPort.elementId === el.id && hoveredPort.port === p.port;
      ctx.fillStyle = isHover ? theme.portHoverFill : theme.portFill;
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.arc(p.x, p.y, isHover ? r * 1.35 : r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawSelectionHandles(ctx, el, page, zoom, theme) {
    ctx.save();
    ctx.strokeStyle = theme.selectionStroke;
    ctx.lineWidth = 1.5 / zoom;

    if (el.type !== 'line' && el.type !== 'arrow') {
      const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
      const cx = el.x + el.w / 2;
      const cy = el.y + h / 2;
      ctx.save();
      if (el.rotation) {
        ctx.translate(cx, cy);
        ctx.rotate(el.rotation);
        ctx.translate(-cx, -cy);
      }
      ctx.strokeRect(el.x, el.y, el.w, h);
      if (!el.locked) {
        ctx.beginPath();
        ctx.moveTo(cx, el.y);
        ctx.lineTo(cx, el.y - 28);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (el.locked) {
      ctx.restore();
      return;
    }

    const handles = getElementHandles(el, page);
    const size = 8 / zoom;
    for (const hd of handles) {
      ctx.fillStyle = hd.id === 'mid' ? '#f59e0b' : hd.id === 'label' ? '#10b981' : theme.handleFill;
      ctx.strokeStyle = theme.handleStroke;
      ctx.lineWidth = 1.6 / zoom;
      ctx.beginPath();
      if (hd.id === 'rotate' || hd.id === 'mid' || hd.id === 'start' || hd.id === 'end' || hd.id === 'label') {
        ctx.arc(hd.x, hd.y, size * 0.65, 0, Math.PI * 2);
      } else {
        ctx.rect(hd.x - size / 2, hd.y - size / 2, size, size);
      }
      ctx.fill();
      ctx.stroke();
    }
    ctx.restore();
  }

  drawCropOverlay(ctx, cropState, zoom) {
    const { element, rect } = cropState;
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
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = 1; i < trail.length; i++) {
      const p0 = trail[i - 1];
      const p1 = trail[i];
      const age = now - p1.t;
      const alpha = Math.max(0, 1 - age / 900);
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(239, 68, 68, ${alpha})`;
      ctx.lineWidth = (6 * alpha) / zoom;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.stroke();
    }
    const last = trail[trail.length - 1];
    if (now - last.t < 200) {
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(last.x, last.y, 6 / zoom, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  drawSpotlightAndMagnifier(ctx, spotlight) {
    const { x, y, radius = 130, magnifier = false } = spotlight;
    ctx.save();
    if (magnifier) {
      const dpr = this.dpr || 1;
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.clip();
      const srcR = radius / 2;
      ctx.drawImage(
        this.canvas,
        (x - srcR) * dpr,
        (y - srcR) * dpr,
        srcR * 2 * dpr,
        srcR * 2 * dpr,
        x - radius,
        y - radius,
        radius * 2,
        radius * 2
      );
      ctx.restore();
    }

    ctx.fillStyle = 'rgba(2, 6, 23, 0.72)';
    ctx.beginPath();
    ctx.rect(0, 0, this.width, this.height);
    ctx.arc(x, y, radius, 0, Math.PI * 2, true);
    ctx.fill('evenodd');

    ctx.strokeStyle = magnifier ? '#38bdf8' : '#facc15';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
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
