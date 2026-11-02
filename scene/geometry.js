// scene/geometry.js

export const PORTS = ['top', 'right', 'bottom', 'left'];

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

export function getElementCenter(el) {
  if (el.type === 'line' || el.type === 'arrow') {
    return { x: (el.x + el.x2) / 2, y: (el.y + el.y2) / 2 };
  }
  return { x: el.x + el.w / 2, y: el.y + el.h / 2 };
}

export function getElementBounds(el) {
  if (!el) return { x: 0, y: 0, w: 0, h: 0, minX: 0, minY: 0, maxX: 0, maxY: 0 };

  if (el.type === 'pen' || el.type === 'highlighter') {
    const pts = el.points || [];
    if (pts.length === 0) {
      return { x: el.x, y: el.y, w: 4, h: 4, minX: el.x, minY: el.y, maxX: el.x + 4, maxY: el.y + 4 };
    }
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    const pad = (el.strokeWidth || 2) / 2;
    minX -= pad;
    minY -= pad;
    maxX += pad;
    maxY += pad;
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const pts = [{ x: el.x, y: el.y }, { x: el.x2, y: el.y2 }, ...(el.waypoints || [])];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const p of pts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }
    return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
  }

  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const x = Math.min(el.x, el.x + el.w);
  const y = Math.min(el.y, el.y + h);
  const w = Math.abs(el.w);
  const absH = Math.abs(h);

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
    const b = getElementBounds(el);
    if (b.minX < minX) minX = b.minX;
    if (b.minY < minY) minY = b.minY;
    if (b.maxX > maxX) maxX = b.maxX;
    if (b.maxY > maxY) maxY = b.maxY;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY, minX, minY, maxX, maxY };
}

export function boxesIntersect(a, b) {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

export function isElementInViewport(el, viewportBounds) {
  const b = getElementBounds(el);
  return boxesIntersect(b, viewportBounds);
}

export function getConnectionPorts(el) {
  if (!el || el.type === 'line' || el.type === 'arrow' || el.type === 'pen' || el.type === 'highlighter') {
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

export function getPortPoint(el, portName = 'right') {
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

export function getEdgePointToward(el, targetX, targetY) {
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const localTarget = unrotatePoint(targetX, targetY, cx, cy, el.rotation || 0);
  const dx = localTarget.x - cx;
  const dy = localTarget.y - cy;
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) {
    return getPortPoint(el, 'right');
  }
  const hw = Math.max(1, el.w / 2);
  const hh = Math.max(1, el.h / 2);

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

export function translateElement(el, dx, dy) {
  if (!dx && !dy) return;
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

  return {
    dx: bestX <= threshold ? snapDx : 0,
    dy: bestY <= threshold ? snapDy : 0,
    guides: guides.slice(-4),
  };
}
