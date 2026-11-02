// scene/routing.js
import { getElementBounds, getPortPoint } from './geometry.js';

const PORT_DIRS = {
  top: { dx: 0, dy: -1 },
  right: { dx: 1, dy: 0 },
  bottom: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
};

function expandBox(b, pad = 16) {
  return {
    minX: b.minX - pad,
    minY: b.minY - pad,
    maxX: b.maxX + pad,
    maxY: b.maxY + pad,
  };
}

function segmentIntersectsBox(x1, y1, x2, y2, box) {
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);

  if (Math.abs(x1 - x2) < 0.5) {
    // Vertical segment
    return x1 > box.minX && x1 < box.maxX && maxY > box.minY && minY < box.maxY;
  }
  if (Math.abs(y1 - y2) < 0.5) {
    // Horizontal segment
    return y1 > box.minY && y1 < box.maxY && maxX > box.minX && minX < box.maxX;
  }
  return false;
}

function pathIntersectsBoxes(pts, boxes) {
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    for (const box of boxes) {
      if (segmentIntersectsBox(a.x, a.y, b.x, b.y, box)) {
        return true;
      }
    }
  }
  return false;
}

function pathLength(pts) {
  let len = 0;
  let bends = Math.max(0, pts.length - 2);
  for (let i = 0; i < pts.length - 1; i++) {
    len += Math.abs(pts[i + 1].x - pts[i].x) + Math.abs(pts[i + 1].y - pts[i].y);
  }
  return len + bends * 30;
}

function deduplicateCollinear(pts) {
  if (pts.length <= 2) return pts;
  const cleaned = [pts[0]];
  for (let i = 1; i < pts.length; i++) {
    const last = cleaned[cleaned.length - 1];
    if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) > 0.5) {
      cleaned.push(pts[i]);
    }
  }
  if (cleaned.length <= 2) return cleaned;
  const out = [cleaned[0]];
  for (let i = 1; i < cleaned.length - 1; i++) {
    const prev = out[out.length - 1];
    const curr = cleaned[i];
    const next = cleaned[i + 1];
    const sameX = Math.abs(prev.x - curr.x) < 0.5 && Math.abs(curr.x - next.x) < 0.5;
    const sameY = Math.abs(prev.y - curr.y) < 0.5 && Math.abs(curr.y - next.y) < 0.5;
    if (!sameX && !sameY) {
      out.push(curr);
    }
  }
  out.push(cleaned[cleaned.length - 1]);
  return out;
}

export function computeOrthogonalPath(connector, startEl = null, endEl = null, obstacles = []) {
  const start = { x: connector.x, y: connector.y };
  const end = { x: connector.x2, y: connector.y2 };
  const margin = 24;

  const startPort = connector.startBinding?.port || inferDirection(start, end, true);
  const endPort = connector.endBinding?.port || inferDirection(start, end, false);
  const sDir = PORT_DIRS[startPort] || { dx: 1, dy: 0 };
  const eDir = PORT_DIRS[endPort] || { dx: -1, dy: 0 };

  const sStub = {
    x: start.x + sDir.dx * margin,
    y: start.y + sDir.dy * margin,
  };
  const eStub = {
    x: end.x + eDir.dx * margin,
    y: end.y + eDir.dy * margin,
  };

  const obstacleBoxes = [];
  const collectSet = new Set();
  if (startEl) collectSet.add(startEl);
  if (endEl) collectSet.add(endEl);
  for (const obs of obstacles) {
    if (obs && obs.type !== 'line' && obs.type !== 'arrow' && obs.type !== 'frame') {
      collectSet.add(obs);
    }
  }
  for (const el of collectSet) {
    obstacleBoxes.push(expandBox(getElementBounds(el), 12));
  }

  const offset = connector.elbowOffset || 0;

  // Candidate orthogonal bridges between sStub and eStub
  const candidates = [];

  // 1. Mid-X bridge (H-V-H)
  const midX = (sStub.x + eStub.x) / 2 + offset;
  candidates.push([
    start,
    sStub,
    { x: midX, y: sStub.y },
    { x: midX, y: eStub.y },
    eStub,
    end,
  ]);

  // 2. Mid-Y bridge (V-H-V)
  const midY = (sStub.y + eStub.y) / 2 + offset;
  candidates.push([
    start,
    sStub,
    { x: sStub.x, y: midY },
    { x: eStub.x, y: midY },
    eStub,
    end,
  ]);

  // 3. Single L-bend options
  candidates.push([start, sStub, { x: eStub.x, y: sStub.y }, eStub, end]);
  candidates.push([start, sStub, { x: sStub.x, y: eStub.y }, eStub, end]);

  // 4. Detour tracks around all obstacle bounds (top, bottom, left, right channels)
  if (obstacleBoxes.length > 0) {
    const extraXs = new Set();
    const extraYs = new Set();
    for (const b of obstacleBoxes) {
      extraXs.add(b.minX - 10 + offset);
      extraXs.add(b.maxX + 10 + offset);
      extraYs.add(b.minY - 10 + offset);
      extraYs.add(b.maxY + 10 + offset);
    }
    for (const yTrack of extraYs) {
      candidates.push([
        start,
        sStub,
        { x: sStub.x, y: yTrack },
        { x: eStub.x, y: yTrack },
        eStub,
        end,
      ]);
    }
    for (const xTrack of extraXs) {
      candidates.push([
        start,
        sStub,
        { x: xTrack, y: sStub.y },
        { x: xTrack, y: eStub.y },
        eStub,
        end,
      ]);
    }
    for (const xTrack of extraXs) {
      for (const yTrack of extraYs) {
        candidates.push([
          start,
          sStub,
          { x: xTrack, y: sStub.y },
          { x: xTrack, y: yTrack },
          { x: eStub.x, y: yTrack },
          eStub,
          end,
        ]);
        candidates.push([
          start,
          sStub,
          { x: sStub.x, y: yTrack },
          { x: xTrack, y: yTrack },
          { x: xTrack, y: eStub.y },
          eStub,
          end,
        ]);
      }
    }
  }

  let bestClean = null;
  let bestCleanCost = Infinity;
  let bestFallback = candidates[0];
  let bestFallbackCost = Infinity;

  for (const raw of candidates) {
    const innerSegments = deduplicateCollinear(raw.slice(1, -1));
    const collides =
      innerSegments.length >= 2 && pathIntersectsBoxes(innerSegments, obstacleBoxes);
    const pts = deduplicateCollinear(raw);
    const cost = pathLength(pts);
    if (!collides && cost < bestCleanCost) {
      bestCleanCost = cost;
      bestClean = pts;
    }
    if (cost < bestFallbackCost) {
      bestFallbackCost = cost;
      bestFallback = pts;
    }
  }

  return bestClean || deduplicateCollinear(bestFallback);
}

function inferDirection(start, end, isStart) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (isStart) return dx >= 0 ? 'right' : 'left';
    return dx >= 0 ? 'left' : 'right';
  }
  if (isStart) return dy >= 0 ? 'bottom' : 'top';
  return dy >= 0 ? 'top' : 'bottom';
}

export function getConnectorPoints(connector, page = null) {
  const start = { x: connector.x, y: connector.y };
  const end = { x: connector.x2, y: connector.y2 };
  const routing = connector.routing || 'straight';

  if (routing === 'straight') {
    return [start, end];
  }

  if (routing === 'curved') {
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const nx = -dy * 0.22;
    const ny = dx * 0.22;
    const offset = connector.elbowOffset || 0;
    const len = Math.hypot(dx, dy) || 1;
    const cp = connector.controlPoint || {
      x: mx + nx + (-dy / len) * offset,
      y: my + ny + (dx / len) * offset,
    };
    return [start, cp, end];
  }

  // Orthogonal routing
  const startEl =
    page && connector.startBinding
      ? page.elements.find((e) => e.id === connector.startBinding.elementId)
      : null;
  const endEl =
    page && connector.endBinding
      ? page.elements.find((e) => e.id === connector.endBinding.elementId)
      : null;
  const obstacles = page
    ? page.elements.filter(
        (e) =>
          !e.hidden &&
          e.id !== connector.id &&
          e.type !== 'line' &&
          e.type !== 'arrow' &&
          e.type !== 'pen' &&
          e.type !== 'highlighter' &&
          e.type !== 'frame'
      )
    : [];
  const pts = computeOrthogonalPath(connector, startEl, endEl, obstacles);
  connector.waypoints = pts;
  return pts;
}

export function getConnectorMidpointHandle(connector, page = null) {
  const pts = getConnectorPoints(connector, page);
  if (connector.routing === 'curved' && pts.length === 3) {
    // Point on quadratic bezier at t=0.5
    const [p0, cp, p2] = pts;
    return {
      x: 0.25 * p0.x + 0.5 * cp.x + 0.25 * p2.x,
      y: 0.25 * p0.y + 0.5 * cp.y + 0.25 * p2.y,
      axis: 'free',
    };
  }
  if (pts.length >= 4) {
    const midIdx = Math.floor((pts.length - 1) / 2);
    const a = pts[midIdx];
    const b = pts[midIdx + 1];
    const isVert = Math.abs(a.x - b.x) < 1;
    return {
      x: (a.x + b.x) / 2,
      y: (a.y + b.y) / 2,
      axis: isVert ? 'x' : 'y',
      segmentIndex: midIdx,
    };
  }
  return {
    x: (connector.x + connector.x2) / 2,
    y: (connector.y + connector.y2) / 2,
    axis: 'free',
  };
}

export function getPointAlongConnector(connector, t = 0.5, page = null) {
  const clampedT = Math.max(0.05, Math.min(0.95, t));
  const pts = getConnectorPoints(connector, page);
  if (connector.routing === 'curved' && pts.length === 3) {
    const [p0, cp, p2] = pts;
    const u = 1 - clampedT;
    return {
      x: u * u * p0.x + 2 * u * clampedT * cp.x + clampedT * clampedT * p2.x,
      y: u * u * p0.y + 2 * u * clampedT * cp.y + clampedT * clampedT * p2.y,
    };
  }
  let total = 0;
  const segLengths = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segLengths.push(d);
    total += d;
  }
  if (total === 0) return { x: pts[0].x, y: pts[0].y };
  let target = total * clampedT;
  for (let i = 0; i < segLengths.length; i++) {
    if (target <= segLengths[i] || i === segLengths.length - 1) {
      const ratio = segLengths[i] > 0 ? target / segLengths[i] : 0;
      return {
        x: pts[i].x + (pts[i + 1].x - pts[i].x) * ratio,
        y: pts[i].y + (pts[i + 1].y - pts[i].y) * ratio,
      };
    }
    target -= segLengths[i];
  }
  return { x: pts[0].x, y: pts[0].y };
}

export function projectPointOntoConnectorT(connector, px, py, page = null) {
  const pts = getConnectorPoints(connector, page);
  if (connector.routing === 'curved' && pts.length === 3) {
    let bestT = 0.5;
    let bestDist = Infinity;
    for (let i = 1; i <= 19; i++) {
      const t = i / 20;
      const p = getPointAlongConnector(connector, t, page);
      const d = Math.hypot(p.x - px, p.y - py);
      if (d < bestDist) {
        bestDist = d;
        bestT = t;
      }
    }
    return bestT;
  }
  let total = 0;
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const d = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y);
    segs.push({ a: pts[i], b: pts[i + 1], len: d, startDist: total });
    total += d;
  }
  if (total === 0) return 0.5;
  let bestDist = Infinity;
  let bestT = 0.5;
  for (const s of segs) {
    const dx = s.b.x - s.a.x;
    const dy = s.b.y - s.a.y;
    const lenSq = dx * dx + dy * dy;
    let localT = lenSq > 0 ? ((px - s.a.x) * dx + (py - s.a.y) * dy) / lenSq : 0;
    localT = Math.max(0, Math.min(1, localT));
    const projX = s.a.x + localT * dx;
    const projY = s.a.y + localT * dy;
    const d = Math.hypot(px - projX, py - projY);
    if (d < bestDist) {
      bestDist = d;
      bestT = (s.startDist + localT * s.len) / total;
    }
  }
  return Math.max(0.08, Math.min(0.92, bestT));
}
