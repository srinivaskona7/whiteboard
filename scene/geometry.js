// scene/geometry.js

export const PORTS = ['top', 'right', 'bottom', 'left'];

export function isFiniteNumber(val) {
  return typeof val === 'number' && Number.isFinite(val);
}

export function isValidElementGeometry(el) {
  if (!el || typeof el !== 'object' || !el.id || !el.type) return false;
  if (!isFiniteNumber(el.x) || !isFiniteNumber(el.y)) return false;
  if (!isFiniteNumber(el.w) || !isFiniteNumber(el.h) || el.w < 0 || el.h < 0) return false;
  if (el.rotation !== undefined && !isFiniteNumber(el.rotation)) return false;

  if (el.type === 'line' || el.type === 'arrow') {
    if (!isFiniteNumber(el.x2) || !isFiniteNumber(el.y2)) return false;
    if (el.controlPoint) {
      if (!isFiniteNumber(el.controlPoint.x) || !isFiniteNumber(el.controlPoint.y)) return false;
    }
    if (Array.isArray(el.waypoints)) {
      for (const wp of el.waypoints) {
        if (!wp || !isFiniteNumber(wp.x) || !isFiniteNumber(wp.y)) return false;
      }
    }
  } else if (el.type === 'pen' || el.type === 'highlighter') {
    if (!Array.isArray(el.points)) return false;
    for (const pt of el.points) {
      if (!pt || !isFiniteNumber(pt.x) || !isFiniteNumber(pt.y)) return false;
    }
  } else {
    if (el.w <= 0 || el.h <= 0) return false;
  }
  return true;
}

export function validateElementsBatch(elements) {
  if (!Array.isArray(elements) || elements.length === 0) {
    return { valid: false, reason: 'No elements provided in batch.' };
  }
  const seenIds = new Set();
  for (let i = 0; i < elements.length; i++) {
    const el = elements[i];
    if (!el || !el.id) {
      return { valid: false, reason: `Element at index ${i} is missing a unique ID.` };
    }
    if (seenIds.has(el.id)) {
      return { valid: false, reason: `Duplicate element ID "${el.id}" in batch.` };
    }
    seenIds.add(el.id);
    if (!isValidElementGeometry(el)) {
      return {
        valid: false,
        reason: `Invalid non-finite geometry on element "${el.name || el.type || el.id}".`,
      };
    }
  }
  return { valid: true, reason: '' };
}

export function screenToWorldPoint(
  clientX,
  clientY,
  canvasRect = { left: 0, top: 0, width: 1280, height: 800 },
  camera = { x: 0, y: 0, zoom: 1 }
) {
  const left = isFiniteNumber(canvasRect?.left) ? canvasRect.left : 0;
  const top = isFiniteNumber(canvasRect?.top) ? canvasRect.top : 0;
  const camX = isFiniteNumber(camera?.x) ? camera.x : 0;
  const camY = isFiniteNumber(camera?.y) ? camera.y : 0;
  const zoom = isFiniteNumber(camera?.zoom) && camera.zoom > 0.01 ? camera.zoom : 1;
  const sx = (isFiniteNumber(clientX) ? clientX : left) - left;
  const sy = (isFiniteNumber(clientY) ? clientY : top) - top;
  return {
    x: (sx - camX) / zoom,
    y: (sy - camY) / zoom,
  };
}

export function worldToScreenPoint(
  worldX,
  worldY,
  canvasRect = { left: 0, top: 0 },
  camera = { x: 0, y: 0, zoom: 1 }
) {
  const left = isFiniteNumber(canvasRect?.left) ? canvasRect.left : 0;
  const top = isFiniteNumber(canvasRect?.top) ? canvasRect.top : 0;
  const camX = isFiniteNumber(camera?.x) ? camera.x : 0;
  const camY = isFiniteNumber(camera?.y) ? camera.y : 0;
  const zoom = isFiniteNumber(camera?.zoom) && camera.zoom > 0.01 ? camera.zoom : 1;
  return {
    x: left + worldX * zoom + camX,
    y: top + worldY * zoom + camY,
  };
}

export function getUsableViewportCenterWorld(
  viewportWidth = 1280,
  viewportHeight = 800,
  camera = { x: 0, y: 0, zoom: 1 },
  insets = { left: 0, right: 0, top: 0, bottom: 0 }
) {
  const vw = isFiniteNumber(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1280;
  const vh = isFiniteNumber(viewportHeight) && viewportHeight > 0 ? viewportHeight : 800;
  const leftInset = Math.max(0, Math.min(vw * 0.65, Number(insets?.left) || 0));
  const rightInset = Math.max(0, Math.min(vw * 0.65, Number(insets?.right) || 0));
  const topInset = Math.max(0, Math.min(vh * 0.5, Number(insets?.top) || 0));
  const bottomInset = Math.max(0, Math.min(vh * 0.5, Number(insets?.bottom) || 0));

  const usableLeft = leftInset;
  const usableRight = Math.max(usableLeft + 64, vw - rightInset);
  const usableTop = topInset;
  const usableBottom = Math.max(usableTop + 64, vh - bottomInset);

  const screenCx = (usableLeft + usableRight) / 2;
  const screenCy = (usableTop + usableBottom) / 2;
  return screenToWorldPoint(screenCx, screenCy, { left: 0, top: 0 }, camera);
}

export function rotatePoint(px, py, cx, cy, angle) {
  if (!angle) return { x: px, y: py };
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = px - cx;
  const dy = py - cy;
  return {
    x: cx + dx * cos - dy * sin,
    y: cy + dx * sin + dy * cos,
  };
}

export function unrotatePoint(px, py, cx, cy, angle) {
  return rotatePoint(px, py, cx, cy, -angle);
}

export function syncFreehandBounds(el) {
  if (!el || (el.type !== 'pen' && el.type !== 'highlighter')) return el;
  const pts = el.points || [];
  const pad = Math.max(2, (el.strokeWidth || 2) / 2);
  if (pts.length === 0) {
    el.w = Math.max(4, pad * 2);
    el.h = Math.max(4, pad * 2);
    return el;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const p of pts) {
    if (!isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!Number.isFinite(minX)) return el;
  el.x = minX - pad;
  el.y = minY - pad;
  el.w = Math.max(4, maxX - minX + pad * 2);
  el.h = Math.max(4, maxY - minY + pad * 2);
  return el;
}

export function getElementCenter(el) {
  if (!el) return { x: 0, y: 0 };
  if (el.type === 'line' || el.type === 'arrow') {
    return { x: (el.x + el.x2) / 2, y: (el.y + el.y2) / 2 };
  }
  if (el.type === 'pen' || el.type === 'highlighter') {
    syncFreehandBounds(el);
  }
  const h = el.type === 'frame' && el.collapsed ? 42 : el.h || 0;
  return { x: el.x + (el.w || 0) / 2, y: el.y + h / 2 };
}

export function getElementBounds(el) {
  if (!el) return { x: 0, y: 0, w: 0, h: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };

  if (el.type === 'pen' || el.type === 'highlighter') {
    syncFreehandBounds(el);
    const x = Number(el.x) || 0;
    const y = Number(el.y) || 0;
    const w = Math.max(4, Number(el.w) || 4);
    const h = Math.max(4, Number(el.h) || 4);
    if (!el.rotation) {
      return { x, y, w, h, minX: x, minY: y, maxX: x + w, maxY: y + h };
    }
    const cx = x + w / 2;
    const cy = y + h / 2;
    const corners = [
      rotatePoint(x, y, cx, cy, el.rotation),
      rotatePoint(x + w, y, cx, cy, el.rotation),
      rotatePoint(x + w, y + h, cx, cy, el.rotation),
      rotatePoint(x, y + h, cx, cy, el.rotation),
    ];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const c of corners) {
      if (c.x < minX) minX = c.x;
      if (c.y < minY) minY = c.y;
      if (c.x > maxX) maxX = c.x;
      if (c.y > maxY) maxY = c.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const pts = [
      { x: Number(el.x) || 0, y: Number(el.y) || 0 },
      { x: Number(el.x2) || 0, y: Number(el.y2) || 0 },
      ...(Array.isArray(el.waypoints) ? el.waypoints : []),
    ];
    if (el.routing === 'curved' && el.controlPoint) {
      pts.push(el.controlPoint);
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (!p || !isFiniteNumber(p.x) || !isFiniteNumber(p.y)) continue;
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    if (!Number.isFinite(minX)) {
      return { x: 0, y: 0, w: 0, h: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };
    }
    const pad = Math.max(4, (el.strokeWidth || 2) * 2);
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(8, maxX - minX + pad * 2),
      h: Math.max(8, maxY - minY + pad * 2),
      minX: minX - pad,
      minY: minY - pad,
      maxX: maxX + pad,
      maxY: maxY + pad,
    };
  }

  const rawH = el.type === 'frame' && el.collapsed ? 42 : Number(el.h) || 0;
  const rawW = Number(el.w) || 0;
  const rawX = Number(el.x) || 0;
  const rawY = Number(el.y) || 0;
  const x = Math.min(rawX, rawX + rawW);
  const y = Math.min(rawY, rawY + rawH);
  const w = Math.abs(rawW);
  const absH = Math.abs(rawH);

  if (!el.rotation) {
    return { x, y, w, h: absH, minX: x, minY: y, maxX: x + w, maxY: y + absH };
  }

  const cx = x + w / 2;
  const cy = y + absH / 2;
  const corners = [
    rotatePoint(x, y, cx, cy, el.rotation),
    rotatePoint(x + w, y, cx, cy, el.rotation),
    rotatePoint(x + w, y + absH, cx, cy, el.rotation),
    rotatePoint(x, y + absH, cx, cy, el.rotation),
  ];
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const c of corners) {
    if (c.x < minX) minX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.x > maxX) maxX = c.x;
    if (c.y > maxY) maxY = c.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

export function getSelectionBounds(elements) {
  if (!elements || elements.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    if (!el) continue;
    const b = getElementBounds(el);
    if (!isFiniteNumber(b.minX) || !isFiniteNumber(b.minY)) continue;
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  if (!Number.isFinite(minX)) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

export function boxesIntersect(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function pointInPolygon(pt, polygon = []) {
  if (!pt || !Array.isArray(polygon) || polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function boxIntersectsLasso(box, polygon = []) {
  if (!box || !Array.isArray(polygon) || polygon.length < 3) return false;
  const samplePoints = [
    { x: box.x + box.w / 2, y: box.y + box.h / 2 },
    { x: box.x, y: box.y },
    { x: box.x + box.w, y: box.y },
    { x: box.x + box.w, y: box.y + box.h },
    { x: box.x, y: box.y + box.h },
  ];
  for (const pt of samplePoints) {
    if (pointInPolygon(pt, polygon)) return true;
  }
  return false;
}

export function isElementInViewport(el, viewportBounds) {
  const b = getElementBounds(el);
  return boxesIntersect(b, viewportBounds);
}

export function getConnectionPorts(el) {
  if (
    !el ||
    el.type === 'line' ||
    el.type === 'arrow' ||
    el.type === 'pen' ||
    el.type === 'highlighter'
  ) {
    return [];
  }
  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const cx = el.x + el.w / 2;
  const cy = el.y + h / 2;
  const raw = [
    { port: 'top', x: cx, y: el.y, nx: 0, ny: -1 },
    { port: 'right', x: el.x + el.w, y: cy, nx: 1, ny: 0 },
    { port: 'bottom', x: cx, y: el.y + h, nx: 0, ny: 1 },
    { port: 'left', x: el.x, y: cy, nx: -1, ny: 0 },
  ];
  if (!el.rotation) return raw;
  const cos = Math.cos(el.rotation);
  const sin = Math.sin(el.rotation);
  return raw.map((p) => {
    const rp = rotatePoint(p.x, p.y, cx, cy, el.rotation);
    return {
      port: p.port,
      x: rp.x,
      y: rp.y,
      nx: p.nx * cos - p.ny * sin,
      ny: p.nx * sin + p.ny * cos,
    };
  });
}

export function getPortPoint(el, portName = 'right', customRatio = null) {
  if (!el) return { x: 0, y: 0, nx: 1, ny: 0, port: 'right' };
  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  if (portName === 'custom' && customRatio && isFiniteNumber(customRatio.rx) && isFiniteNumber(customRatio.ry)) {
    const lx = el.x + Math.max(0, Math.min(1, customRatio.rx)) * el.w;
    const ly = el.y + Math.max(0, Math.min(1, customRatio.ry)) * h;
    const cx = el.x + el.w / 2;
    const cy = el.y + h / 2;
    const rp = rotatePoint(lx, ly, cx, cy, el.rotation || 0);
    return { port: 'custom', x: rp.x, y: rp.y, nx: 0, ny: 0 };
  }
  const ports = getConnectionPorts(el);
  return ports.find((p) => p.port === portName) || ports[0] || getElementCenter(el);
}

export function getNearestPort(el, px, py) {
  const ports = getConnectionPorts(el);
  let best = null;
  let bestDist = Infinity;
  for (const p of ports) {
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < bestDist) {
      bestDist = d;
      best = p;
    }
  }
  return best ? { ...best, distance: bestDist } : null;
}

export function chooseBestCardinalPort(el, targetX, targetY) {
  if (!el) return 'right';
  const c = getElementCenter(el);
  const dx = targetX - c.x;
  const dy = targetY - c.y;
  const hw = Math.max(1, (el.w || 140) / 2);
  const hh = Math.max(1, (el.h || 90) / 2);
  // Compare normalized directional dominance relative to aspect ratio
  if (Math.abs(dx) / hw >= Math.abs(dy) / hh) {
    return dx >= 0 ? 'right' : 'left';
  }
  return dy >= 0 ? 'bottom' : 'top';
}

export function getEdgePointToward(el, targetX, targetY) {
  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const cx = el.x + el.w / 2;
  const cy = el.y + h / 2;
  const localTarget = unrotatePoint(targetX, targetY, cx, cy, el.rotation || 0);
  const dx = localTarget.x - cx;
  const dy = localTarget.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return getPortPoint(el, 'right');
  }
  const hw = Math.max(1, el.w / 2);
  const hh = Math.max(1, h / 2);

  let localEdge;
  if (el.type === 'ellipse') {
    const angle = Math.atan2(dy, dx);
    localEdge = { x: cx + hw * Math.cos(angle), y: cy + hh * Math.sin(angle) };
  } else if (el.type === 'diamond') {
    const denom = Math.abs(dx) / hw + Math.abs(dy) / hh;
    const t = denom > 0 ? 1 / denom : 0;
    localEdge = { x: cx + dx * t, y: cy + dy * t };
  } else {
    const tx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
    const ty = dy !== 0 ? hh / Math.abs(dy) : Infinity;
    const t = Math.min(tx, ty);
    localEdge = { x: cx + dx * t, y: cy + dy * t };
  }
  return rotatePoint(localEdge.x, localEdge.y, cx, cy, el.rotation || 0);
}

export function snapAngle(angleRad, stepDeg = 15) {
  const step = (stepDeg * Math.PI) / 180;
  return Math.round(angleRad / step) * step;
}

export function snapPointToGrid(x, y, gridSize = 20) {
  return {
    x: Math.round(x / gridSize) * gridSize,
    y: Math.round(y / gridSize) * gridSize,
  };
}

export function distanceToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x1, py - y1);
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x1 + t * dx;
  const projY = y1 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

export function simplifyFreehandPoints(points, tolerance = 1.5) {
  if (!points || points.length <= 2) return points || [];
  const smoothed = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    const mx = (prev.x + curr.x * 2 + next.x) / 4;
    const my = (prev.y + curr.y * 2 + next.y) / 4;
    const last = smoothed[smoothed.length - 1];
    if (Math.hypot(mx - last.x, my - last.y) >= tolerance * 0.5) {
      smoothed.push({ x: mx, y: my });
    }
  }
  smoothed.push(points[points.length - 1]);
  return smoothed;
}

export function alignElements(elements, mode) {
  if (!elements || elements.length < 2) return;
  const boundsList = elements.map((el) => ({ el, b: getElementBounds(el) }));
  const overall = getSelectionBounds(elements);
  if (!overall) return;

  for (const { el, b } of boundsList) {
    if (el.locked) continue;
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = overall.minX - b.minX;
    else if (mode === 'center') dx = overall.minX + overall.w / 2 - (b.minX + b.w / 2);
    else if (mode === 'right') dx = overall.maxX - b.maxX;
    else if (mode === 'top') dy = overall.minY - b.minY;
    else if (mode === 'middle') dy = overall.minY + overall.h / 2 - (b.minY + b.h / 2);
    else if (mode === 'bottom') dy = overall.maxY - b.maxY;
    translateElement(el, dx, dy);
  }
}

export function distributeElements(elements, axis = 'horizontal') {
  if (!elements || elements.length < 3) return;
  const items = elements
    .filter((el) => !el.locked)
    .map((el) => ({ el, b: getElementBounds(el) }));
  if (items.length < 3) return;

  if (axis === 'horizontal') {
    items.sort((a, b) => a.b.minX - b.b.minX);
    const minX = items[0].b.minX;
    const maxX = items[items.length - 1].b.maxX;
    const totalW = items.reduce((s, it) => s + it.b.w, 0);
    const gap = (maxX - minX - totalW) / (items.length - 1);
    let cursor = minX;
    for (const item of items) {
      const dx = cursor - item.b.minX;
      translateElement(item.el, dx, 0);
      cursor += item.b.w + gap;
    }
  } else {
    items.sort((a, b) => a.b.minY - b.b.minY);
    const minY = items[0].b.minY;
    const maxY = items[items.length - 1].b.maxY;
    const totalH = items.reduce((s, it) => s + it.b.h, 0);
    const gap = (maxY - minY - totalH) / (items.length - 1);
    let cursor = minY;
    for (const item of items) {
      const dy = cursor - item.b.minY;
      translateElement(item.el, 0, dy);
      cursor += item.b.h + gap;
    }
  }
}

export function matchElementSize(elements, mode = 'both') {
  if (!elements || elements.length < 2) return;
  const ref = elements[0];
  for (let i = 1; i < elements.length; i++) {
    const el = elements[i];
    if (el.locked || el.type === 'line' || el.type === 'arrow') continue;
    if (mode === 'width' || mode === 'both') el.w = ref.w;
    if (mode === 'height' || mode === 'both') el.h = ref.h;
  }
}

export function arrangeElements(elements, mode = 'grid', gapX = 48, gapY = 42) {
  if (!elements || elements.length < 2) return;
  const movable = elements.filter(
    (el) => !el.locked && el.type !== 'line' && el.type !== 'arrow'
  );
  if (movable.length < 2) return;

  const overall = getSelectionBounds(movable);
  if (!overall) return;
  const startX = overall.minX;
  const startY = overall.minY;

  const cols =
    mode === 'row'
      ? movable.length
      : mode === 'column'
        ? 1
        : Math.max(2, Math.ceil(Math.sqrt(movable.length)));

  const maxW = Math.max(...movable.map((e) => Math.abs(e.w || 140)));
  const maxH = Math.max(...movable.map((e) => Math.abs(e.h || 90)));

  movable.forEach((el, idx) => {
    const c = idx % cols;
    const r = Math.floor(idx / cols);
    const targetX = startX + c * (maxW + gapX);
    const targetY = startY + r * (maxH + gapY);
    translateElement(el, targetX - el.x, targetY - el.y);
  });
}

export function translateElement(el, dx, dy) {
  if (!dx && !dy) return;
  if (!isFiniteNumber(dx) || !isFiniteNumber(dy)) return;
  el.x += dx;
  el.y += dy;
  if (el.type === 'line' || el.type === 'arrow') {
    el.x2 += dx;
    el.y2 += dy;
    if (el.controlPoint) {
      el.controlPoint.x += dx;
      el.controlPoint.y += dy;
    }
    if (Array.isArray(el.waypoints)) {
      el.waypoints = el.waypoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    }
  }
  if (Array.isArray(el.points)) {
    el.points = el.points.map((p) => ({ x: p.x + dx, y: p.y + dy }));
  }
}

// Equal-gap snap: while the moving bounds sit between two candidates on one
// axis, snap to the position that makes both gaps equal. Returns the best
// snap (smallest delta) as { diff, delta, guides }, or null when none applies.
function findEqualGapSnap(movingBounds, candidates, threshold, axis) {
  const horiz = axis === 'x';
  const center = horiz
    ? movingBounds.minX + movingBounds.w / 2
    : movingBounds.minY + movingBounds.h / 2;
  const size = horiz ? movingBounds.w : movingBounds.h;
  const nears = [];
  const fars = [];
  for (const cand of candidates) {
    const cb = getElementBounds(cand);
    // Cross-axis overlap: only candidates the element could sit between.
    if (horiz) {
      if (cb.maxY < movingBounds.minY || cb.minY > movingBounds.maxY) continue;
    } else {
      if (cb.maxX < movingBounds.minX || cb.minX > movingBounds.maxX) continue;
    }
    const nearEdge = horiz ? cb.maxX : cb.maxY;
    const farEdge = horiz ? cb.minX : cb.minY;
    if (nearEdge <= center) nears.push(cb);
    else if (farEdge >= center) fars.push(cb);
  }

  let best = null;
  for (const near of nears) {
    for (const far of fars) {
      const nearEdge = horiz ? near.maxX : near.maxY;
      const farEdge = horiz ? far.minX : far.minY;
      const span = farEdge - nearEdge;
      if (span < size) continue; // element does not fit between
      const targetMin = nearEdge + (span - size) / 2;
      const minNow = horiz ? movingBounds.minX : movingBounds.minY;
      const delta = targetMin - minNow;
      if (Math.abs(delta) > threshold) continue;
      if (best && Math.abs(delta) >= best.diff) continue;
      if (horiz) {
        best = {
          diff: Math.abs(delta),
          delta,
          guides: [
            {
              type: 'vertical',
              x: nearEdge,
              y1: Math.min(movingBounds.minY, near.minY, far.minY) - 16,
              y2: Math.max(movingBounds.maxY, near.maxY, far.maxY) + 16,
            },
            {
              type: 'vertical',
              x: farEdge,
              y1: Math.min(movingBounds.minY, near.minY, far.minY) - 16,
              y2: Math.max(movingBounds.maxY, near.maxY, far.maxY) + 16,
            },
          ],
        };
      } else {
        best = {
          diff: Math.abs(delta),
          delta,
          guides: [
            {
              type: 'horizontal',
              y: nearEdge,
              x1: Math.min(movingBounds.minX, near.minX, far.minX) - 16,
              x2: Math.max(movingBounds.maxX, near.maxX, far.maxX) + 16,
            },
            {
              type: 'horizontal',
              y: farEdge,
              x1: Math.min(movingBounds.minX, near.minX, far.minX) - 16,
              x2: Math.max(movingBounds.maxX, near.maxX, far.maxX) + 16,
            },
          ],
        };
      }
    }
  }
  return best;
}

export function computeSmartGuides(movingBounds, candidates, threshold = 6) {
  const guides = [];
  let snapDx = 0;
  let snapDy = 0;
  let bestX = threshold + 1;
  let bestY = threshold + 1;

  const mx = [movingBounds.minX, movingBounds.minX + movingBounds.w / 2, movingBounds.maxX];
  const my = [movingBounds.minY, movingBounds.minY + movingBounds.h / 2, movingBounds.maxY];

  for (const cand of candidates) {
    const cb = getElementBounds(cand);
    const cx = [cb.minX, cb.minX + cb.w / 2, cb.maxX];
    const cy = [cb.minY, cb.minY + cb.h / 2, cb.maxY];

    for (const mVal of mx) {
      for (const cVal of cx) {
        const diff = cVal - mVal;
        if (Math.abs(diff) < bestX) {
          bestX = Math.abs(diff);
          snapDx = diff;
          guides.push({
            type: 'vertical',
            x: cVal,
            y1: Math.min(movingBounds.minY, cb.minY) - 16,
            y2: Math.max(movingBounds.maxY, cb.maxY) + 16,
          });
        }
      }
    }

    for (const mVal of my) {
      for (const cVal of cy) {
        const diff = cVal - mVal;
        if (Math.abs(diff) < bestY) {
          bestY = Math.abs(diff);
          snapDy = diff;
          guides.push({
            type: 'horizontal',
            y: cVal,
            x1: Math.min(movingBounds.minX, cb.minX) - 16,
            x2: Math.max(movingBounds.maxX, cb.maxX) + 16,
          });
        }
      }
    }
  }

  // Equal-gap snaps compete only when strictly closer than edge/midpoint
  // snaps, so existing behavior keeps priority. When one wins, it replaces
  // the guides of its axis with one guide per gap it equalizes.
  const gapX = findEqualGapSnap(movingBounds, candidates, threshold, 'x');
  if (gapX && gapX.diff < bestX) {
    bestX = gapX.diff;
    snapDx = gapX.delta;
    for (let i = guides.length - 1; i >= 0; i--) {
      if (guides[i].type === 'vertical') guides.splice(i, 1);
    }
    guides.push(...gapX.guides);
  }

  const gapY = findEqualGapSnap(movingBounds, candidates, threshold, 'y');
  if (gapY && gapY.diff < bestY) {
    bestY = gapY.diff;
    snapDy = gapY.delta;
    for (let i = guides.length - 1; i >= 0; i--) {
      if (guides[i].type === 'horizontal') guides.splice(i, 1);
    }
    guides.push(...gapY.guides);
  }

  return {
    dx: bestX <= threshold ? snapDx : 0,
    dy: bestY <= threshold ? snapDy : 0,
    guides: guides.slice(-4),
  };
}
