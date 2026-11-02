// scene/hit.js
import {
  unrotatePoint,
  rotatePoint,
  getElementBounds,
  distanceToSegment,
} from './geometry.js';
import {
  getConnectorPoints,
  getConnectorMidpointHandle,
  getPointAlongConnector,
} from './routing.js';

export const RESIZE_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];

export function getElementHandles(el, page = null) {
  if (!el) return [];
  if (el.type === 'line' || el.type === 'arrow') {
    const mid = getConnectorMidpointHandle(el, page);
    const handles = [
      { id: 'start', x: el.x, y: el.y, cursor: 'move' },
      { id: 'mid', x: mid.x, y: mid.y, cursor: 'grab', axis: mid.axis },
      { id: 'end', x: el.x2, y: el.y2, cursor: 'move' },
    ];
    if (el.text) {
      const lp = getPointAlongConnector(el, el.labelT ?? 0.5, page);
      handles.push({ id: 'label', x: lp.x, y: lp.y, cursor: 'ew-resize' });
    }
    return handles;
  }

  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const x = el.x;
  const y = el.y;
  const w = el.w;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const raw = [
    { id: 'nw', x: x, y: y, cursor: 'nwse-resize' },
    { id: 'n', x: cx, y: y, cursor: 'ns-resize' },
    { id: 'ne', x: x + w, y: y, cursor: 'nesw-resize' },
    { id: 'e', x: x + w, y: cy, cursor: 'ew-resize' },
    { id: 'se', x: x + w, y: y + h, cursor: 'nwse-resize' },
    { id: 's', x: cx, y: y + h, cursor: 'ns-resize' },
    { id: 'sw', x: x, y: y + h, cursor: 'nesw-resize' },
    { id: 'w', x: x, y: cy, cursor: 'ew-resize' },
    { id: 'rotate', x: cx, y: y - 28, cursor: 'grab' },
  ];

  if (!el.rotation) return raw;
  return raw.map((hd) => {
    const rp = rotatePoint(hd.x, hd.y, cx, cy, el.rotation);
    return { ...hd, x: rp.x, y: rp.y };
  });
}

export function hitTestHandle(el, px, py, zoom = 1, page = null) {
  if (!el || el.locked) return null;
  const tol = 10 / Math.max(0.25, zoom);
  const handles = getElementHandles(el, page);
  for (const hd of handles) {
    if (Math.hypot(px - hd.x, py - hd.y) <= tol) {
      return hd;
    }
  }
  return null;
}

export function hitTestElement(el, px, py, page = null, tolerance = 7) {
  if (!el || el.hidden) return false;

  if (el.type === 'pen' || el.type === 'highlighter') {
    const pts = el.points || [];
    const hitTol = Math.max(tolerance, (el.strokeWidth || 2) / 2 + 4);
    if (pts.length === 1) {
      return Math.hypot(px - pts[0].x, py - pts[0].y) <= hitTol;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= hitTol) {
        return true;
      }
    }
    return false;
  }

  if (el.type === 'line' || el.type === 'arrow') {
    const hitTol = Math.max(tolerance, (el.strokeWidth || 2) / 2 + 5);
    if (el.text) {
      const lp = getPointAlongConnector(el, el.labelT ?? 0.5, page);
      const lw = Math.max(36, el.text.length * ((el.fontSize || 16) * 0.6) + 12);
      const lh = (el.fontSize || 16) + 10;
      if (
        px >= lp.x - lw / 2 &&
        px <= lp.x + lw / 2 &&
        py >= lp.y - lh / 2 &&
        py <= lp.y + lh / 2
      ) {
        return true;
      }
    }
    const pts = getConnectorPoints(el, page);
    if (el.routing === 'curved' && pts.length === 3) {
      let prev = pts[0];
      for (let step = 1; step <= 16; step++) {
        const t = step / 16;
        const curr = getPointAlongConnector(el, t, page);
        if (distanceToSegment(px, py, prev.x, prev.y, curr.x, curr.y) <= hitTol) {
          return true;
        }
        prev = curr;
      }
      return false;
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (distanceToSegment(px, py, pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y) <= hitTol) {
        return true;
      }
    }
    return false;
  }

  const h = el.type === 'frame' && el.collapsed ? 42 : el.h;
  const cx = el.x + el.w / 2;
  const cy = el.y + h / 2;
  const local = unrotatePoint(px, py, cx, cy, el.rotation || 0);

  const minX = Math.min(el.x, el.x + el.w);
  const maxX = Math.max(el.x, el.x + el.w);
  const minY = Math.min(el.y, el.y + h);
  const maxY = Math.max(el.y, el.y + h);

  if (el.type === 'ellipse') {
    const rx = Math.max(1, Math.abs(el.w) / 2 + tolerance * 0.5);
    const ry = Math.max(1, Math.abs(h) / 2 + tolerance * 0.5);
    const norm = (local.x - cx) ** 2 / rx ** 2 + (local.y - cy) ** 2 / ry ** 2;
    return norm <= 1;
  }

  if (el.type === 'diamond') {
    const rx = Math.max(1, Math.abs(el.w) / 2 + tolerance * 0.5);
    const ry = Math.max(1, Math.abs(h) / 2 + tolerance * 0.5);
    return Math.abs(local.x - cx) / rx + Math.abs(local.y - cy) / ry <= 1;
  }

  return (
    local.x >= minX - tolerance * 0.5 &&
    local.x <= maxX + tolerance * 0.5 &&
    local.y >= minY - tolerance * 0.5 &&
    local.y <= maxY + tolerance * 0.5
  );
}

export function hitTestScene(page, px, py, options = {}) {
  if (!page || !Array.isArray(page.elements)) return null;
  const includeLocked = Boolean(options.includeLocked);
  const tolerance = options.tolerance ?? 7;

  // First pass: non-frame, non-background elements from top to bottom
  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i];
    if (el.hidden) continue;
    if (el.locked && !includeLocked) continue;
    if (el.type === 'frame' || el.isBackground) continue;
    if (hitTestElement(el, px, py, page, tolerance)) {
      return el;
    }
  }

  // Second pass: frames (hit header or border, or body if no child hit)
  for (let i = page.elements.length - 1; i >= 0; i--) {
    const el = page.elements[i];
    if (el.hidden) continue;
    if (el.locked && !includeLocked) continue;
    if (el.type === 'frame' && hitTestElement(el, px, py, page, tolerance)) {
      return el;
    }
  }

  // Third pass: background images if includeLocked is true
  if (includeLocked) {
    for (let i = page.elements.length - 1; i >= 0; i--) {
      const el = page.elements[i];
      if (!el.hidden && el.isBackground && hitTestElement(el, px, py, page, tolerance)) {
        return el;
      }
    }
  }

  return null;
}

export function hitTestFrameCollapseButton(el, px, py) {
  if (!el || el.type !== 'frame' || el.hidden) return false;
  const bx = el.x + el.w - 30;
  const by = el.y + 8;
  return px >= bx && px <= bx + 22 && py >= by && py <= by + 22;
}

export function hitTestHyperlinkBadge(el, px, py) {
  if (!el || !el.link || el.hidden) return false;
  const b = getElementBounds(el);
  const bx = b.maxX - 22;
  const by = b.minY + 4;
  return px >= bx - 4 && px <= bx + 22 && py >= by - 4 && py <= by + 22;
}

export function getTableCellAtPoint(el, px, py) {
  if (!el || el.type !== 'table') return null;
  const rows = Math.max(1, el.rows || 3);
  const cols = Math.max(1, el.cols || 3);
  const cx = el.x + el.w / 2;
  const cy = el.y + el.h / 2;
  const local = unrotatePoint(px, py, cx, cy, el.rotation || 0);
  if (local.x < el.x || local.x > el.x + el.w || local.y < el.y || local.y > el.y + el.h) {
    return null;
  }
  const cellW = el.w / cols;
  const cellH = el.h / rows;
  const col = Math.min(cols - 1, Math.max(0, Math.floor((local.x - el.x) / cellW)));
  const row = Math.min(rows - 1, Math.max(0, Math.floor((local.y - el.y) / cellH)));
  return {
    row,
    col,
    x: el.x + col * cellW,
    y: el.y + row * cellH,
    w: cellW,
    h: cellH,
  };
}
