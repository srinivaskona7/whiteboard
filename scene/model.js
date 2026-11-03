// scene/model.js
export const SCHEMA_VERSION = 2;

let counter = 0;
export function uid(prefix = 'el') {
  counter = (counter + 1) % 1000000;
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}_${rand}`;
}

export const DEFAULT_STYLE = {
  stroke: '#1e293b',
  fill: 'transparent',
  strokeWidth: 2,
  strokeStyle: 'solid', // 'solid' | 'dashed' | 'dotted'
  fillPattern: 'solid', // 'solid' | 'hachure' | 'cross-hatch'
  opacity: 1,
  fontFamily: 'sans', // 'sans' | 'serif' | 'mono' | 'hand'
  fontSize: 18,
  textColor: '#1e293b',
  textAlign: 'center', // 'left' | 'center' | 'right'
  roundness: 0,
  sloppy: false,
  autoGrow: true,
  brush: null, // drawing-preset id for pen/highlighter strokes
  smoothing: 'adaptive', // 'off' | 'adaptive' | 'stabilizer'
  startArrow: 'none', // 'none' | 'arrow' | 'triangle' | 'diamond' | 'circle' | 'bar'
  endArrow: 'arrow',
  routing: 'orthogonal', // 'straight' | 'orthogonal' | 'curved' | 'rounded-elbow' | 'auto'
};

export function createElement(type, props = {}) {
  const isConnector = type === 'line' || type === 'arrow';
  const isFreehand = type === 'pen' || type === 'highlighter';
  const isSticky = type === 'sticky';
  const isFrame = type === 'frame';
  const isTable = type === 'table';
  const isCode = type === 'code';

  const base = {
    id: props.id || uid(type),
    type,
    name: props.name || `${type.charAt(0).toUpperCase() + type.slice(1)}`,
    x: props.x ?? 0,
    y: props.y ?? 0,
    w: props.w ?? (isSticky ? 180 : isFrame ? 480 : isTable ? 360 : isCode ? 320 : 140),
    h: props.h ?? (isSticky ? 180 : isFrame ? 320 : isTable ? 160 : isCode ? 180 : 90),
    rotation: props.rotation ?? 0,
    stroke: props.stroke ?? (type === 'highlighter' ? '#facc15' : DEFAULT_STYLE.stroke),
    fill:
      props.fill ??
      (isSticky
        ? '#fef08a'
        : isFrame
          ? 'rgba(148, 163, 184, 0.08)'
          : isCode
            ? '#0f172a'
            : isTable
              ? '#ffffff'
              : DEFAULT_STYLE.fill),
    strokeWidth: props.strokeWidth ?? (type === 'highlighter' ? 18 : DEFAULT_STYLE.strokeWidth),
    strokeStyle: props.strokeStyle ?? DEFAULT_STYLE.strokeStyle,
    fillPattern: props.fillPattern ?? DEFAULT_STYLE.fillPattern,
    opacity: props.opacity ?? (type === 'highlighter' ? 0.42 : DEFAULT_STYLE.opacity),
    roundness: props.roundness ?? (type === 'rounded-rect' ? 16 : DEFAULT_STYLE.roundness),
    sloppy: props.sloppy ?? DEFAULT_STYLE.sloppy,
    text:
      props.text ??
      (isFrame
        ? 'Frame 1'
        : isCode
          ? `function hello() {
  return 42;
}`
          : ''),
    fontFamily: props.fontFamily ?? (isCode ? 'mono' : DEFAULT_STYLE.fontFamily),
    fontSize: props.fontSize ?? (type === 'text' ? 22 : isCode ? 14 : DEFAULT_STYLE.fontSize),
    textAlign: props.textAlign ?? (type === 'text' || isCode ? 'left' : DEFAULT_STYLE.textAlign),
    textColor: props.textColor ?? (isCode ? '#f8fafc' : DEFAULT_STYLE.textColor),
    autoGrow: props.autoGrow ?? DEFAULT_STYLE.autoGrow,
    brush: props.brush ?? (isFreehand ? (type === 'highlighter' ? 'highlighter' : 'technical') : null),
    smoothing: props.smoothing ?? DEFAULT_STYLE.smoothing,
    groupId: props.groupId ?? null,
    containerId: props.containerId ?? null,
    locked: Boolean(props.locked),
    hidden: Boolean(props.hidden),
    link: props.link ?? '',
    revealStep: props.revealStep ?? 0,
    teacherNotes: props.teacherNotes ?? '',
    isJunction: Boolean(props.isJunction),
  };
  if (isFreehand) {
    base.points = Array.isArray(props.points)
      ? props.points.map((p) => ({
          x: p.x,
          y: p.y,
          ...(Number.isFinite(p.p) ? { p: p.p } : {}),
        }))
      : [];
    base.fading = Boolean(props.fading);
    base.createdAt = props.createdAt ?? Date.now();
    if (base.points.length > 0 && props.w === undefined && props.h === undefined) {
      const pad = Math.max(2, (base.strokeWidth || 2) / 2);
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const p of base.points) {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      }
      base.x = minX - pad;
      base.y = minY - pad;
      base.w = Math.max(4, maxX - minX + pad * 2);
      base.h = Math.max(4, maxY - minY + pad * 2);
    } else if (props.w === undefined && props.h === undefined) {
      base.w = Math.max(4, base.strokeWidth || 4);
      base.h = Math.max(4, base.strokeWidth || 4);
    }
  }

  if (isConnector) {
    base.x2 = props.x2 ?? base.x + 140;
    base.y2 = props.y2 ?? base.y;
    base.w = Math.abs(base.x2 - base.x);
    base.h = Math.abs(base.y2 - base.y);
    base.routing = props.routing ?? (type === 'arrow' ? 'orthogonal' : 'straight');
    base.cornerRadius = Number.isFinite(Number(props.cornerRadius))
      ? Math.max(2, Math.min(48, Number(props.cornerRadius)))
      : 14;
    base.startArrow = props.startArrow ?? 'none';
    base.endArrow = props.endArrow ?? (type === 'arrow' ? 'arrow' : 'none');
    base.startBinding = props.startBinding ? { ...props.startBinding } : null;
    base.endBinding = props.endBinding ? { ...props.endBinding } : null;
    base.elbowOffset = props.elbowOffset ?? 0;
    base.controlPoint = props.controlPoint ? { ...props.controlPoint } : null;
    base.waypoints = Array.isArray(props.waypoints)
      ? props.waypoints.map((p) => ({ x: p.x, y: p.y }))
      : [];
    base.labelT = props.labelT ?? 0.5;
    base.startLabel = props.startLabel ?? '';
    base.endLabel = props.endLabel ?? '';
    base.manualRoute = Boolean(props.manualRoute);
  }

  if (type === 'image') {
    base.fileId = props.fileId ?? null;
    base.naturalWidth = props.naturalWidth ?? base.w;
    base.naturalHeight = props.naturalHeight ?? base.h;
    base.lockAspectRatio = props.lockAspectRatio ?? true;
    base.crop = props.crop ? { ...props.crop } : null;
    base.isBackground = Boolean(props.isBackground);
    if (base.isBackground && props.locked === undefined) {
      base.locked = true;
    }
  }

  if (type === 'stencil') {
    base.stencilId = props.stencilId ?? 'flow-process';
    base.category = props.category ?? 'flowchart';
    base.isBoundary = Boolean(props.isBoundary);
    base.isContainer = Boolean(props.isContainer ?? props.isBoundary);
    base.moveChildren = props.moveChildren !== false;
  }

  if (isFrame) {
    const excluded =
      props.includeInPresentation === false || Boolean(props.excludeFromPresentation);
    base.clip = Boolean(props.clip);
    base.collapsed = Boolean(props.collapsed);
    base.expandedHeight = props.expandedHeight ?? base.h;
    base.slideOrder = props.slideOrder ?? 1;
    base.excludeFromPresentation = excluded;
    base.includeInPresentation = !excluded;
    base.isContainer = true;
    base.moveChildren = props.moveChildren !== false;
  }

  if (isTable) {
    // A document can contain anything; rows/cols must be whole numbers in range or
    // Array.from throws / OOMs and the canvas stops rendering entirely.
    const dim = (v, fallback) => {
      const n = Math.floor(Number(v));
      if (!Number.isFinite(n)) return fallback;
      return Math.max(1, Math.min(200, n));
    };
    const rows = dim(props.rows, 3);
    const cols = dim(props.cols, 3);
    base.rows = rows;
    base.cols = cols;
    base.cells =
      props.cells ??
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (__, c) => (r === 0 ? `Header ${c + 1}` : `Cell ${r},${c + 1}`))
      );
    base.headerRow = props.headerRow !== false;
    base.striped = Boolean(props.striped);
    base.valign = props.valign ?? 'middle';
    if (Number.isFinite(props.cellPadding)) base.cellPadding = props.cellPadding;
    if (Array.isArray(props.colWidths)) base.colWidths = props.colWidths.map(Number);
    if (Array.isArray(props.rowHeights)) base.rowHeights = props.rowHeights.map(Number);
  }

  if (isCode) {
    base.highlightLines = props.highlightLines ?? '2';
  }

  if (type === 'stamp') {
    base.stampKind = props.stampKind ?? 'tick';
    base.badgeValue = props.badgeValue ?? 1;
    base.w = props.w ?? 56;
    base.h = props.h ?? 56;
  }

  if (type === 'math') {
    base.mathKind = props.mathKind ?? 'ruler';
    base.w = props.w ?? (base.mathKind === 'ruler' ? 360 : 240);
    base.h = props.h ?? (base.mathKind === 'ruler' ? 64 : 140);
  }

  if (type === 'question') {
    base.authorName = props.authorName ?? 'Student';
    base.targetElementId = props.targetElementId ?? null;
    base.targetElementName = props.targetElementName ?? '';
    base.offsetX = props.offsetX ?? 0;
    base.offsetY = props.offsetY ?? 0;
    base.anchorRx = props.anchorRx ?? 0.85;
    base.anchorRy = props.anchorRy ?? 0;
    base.anchorDeleted = Boolean(props.anchorDeleted);
    base.resolved = Boolean(props.resolved);
    base.reply = props.reply ?? '';
    base.createdAt = props.createdAt ?? Date.now();
    base.w = props.w ?? 210;
    base.h = props.h ?? 74;
    base.fill = props.fill ?? '#fef3c7';
    base.stroke = props.stroke ?? '#d97706';
  }

  base.updatedAt = props.updatedAt ?? Date.now();
  // Unknown-but-stored fields (code language/wrap, raw pressure samples, future
  // additions) must survive a load/save cycle; normalised fields still win.
  return { ...props, ...base };
}

export function getConnectorDirectionPreset(el) {
  if (!el) return 'one-way';
  const hasStart = el.startArrow && el.startArrow !== 'none';
  const hasEnd = el.endArrow && el.endArrow !== 'none';
  if (!hasStart && !hasEnd) return 'plain';
  if (hasStart && hasEnd) return 'two-way';
  return 'one-way';
}

export function applyConnectorDirectionPreset(el, preset = 'one-way') {
  if (!el) return el;
  if (preset === 'plain') {
    el.startArrow = 'none';
    el.endArrow = 'none';
  } else if (preset === 'two-way') {
    el.startArrow = el.startArrow && el.startArrow !== 'none' ? el.startArrow : 'arrow';
    el.endArrow = el.endArrow && el.endArrow !== 'none' ? el.endArrow : 'arrow';
  } else {
    el.startArrow = 'none';
    el.endArrow = el.endArrow && el.endArrow !== 'none' ? el.endArrow : 'arrow';
  }
  return el;
}

export function handleAnchorDeletion(page, deletedIds) {
  if (!page || !Array.isArray(page.elements)) return;
  const delSet = deletedIds instanceof Set ? deletedIds : new Set(deletedIds || []);
  if (delSet.size === 0) return;
  for (const el of page.elements) {
    if (el.type === 'question' && el.targetElementId && delSet.has(el.targetElementId)) {
      const prevTarget = page.elements.find((t) => t.id === el.targetElementId);
      if (prevTarget && Number.isFinite(prevTarget.x) && Number.isFinite(prevTarget.y)) {
        el.x = prevTarget.x + (el.offsetX ?? Math.max(0, (prevTarget.w || 140) - 30));
        el.y = prevTarget.y + (el.offsetY ?? -36);
      }
      el.targetElementId = null;
      el.anchorDeleted = true;
    }
    if ((el.type === 'line' || el.type === 'arrow')) {
      if (el.startBinding && delSet.has(el.startBinding.elementId)) {
        el.startBinding = null;
      }
      if (el.endBinding && delSet.has(el.endBinding.elementId)) {
        el.endBinding = null;
      }
    }
  }
}

export function createPage(name = 'Page 1', id = uid('page')) {
  return {
    id,
    name,
    elements: [],
    camera: { x: 0, y: 0, zoom: 1 },
    background: 'dots', // 'plain' | 'grid' | 'dots'
    width: 1280,
    height: 720,
    teacherNotes: '',
  };
}

export function createJunctionElement(x = 0, y = 0, props = {}) {
  return createElement('ellipse', {
    x: x - 9,
    y: y - 9,
    w: 18,
    h: 18,
    name: props.name || 'Flow Junction',
    text: '',
    fill: props.fill || '#1e293b',
    stroke: props.stroke || '#1e293b',
    strokeWidth: 2,
    isJunction: true,
    autoGrow: false,
    ...props,
  });
}

export function getElementContainmentPath(page, elementOrId) {
  if (!page || !Array.isArray(page.elements)) return [];
  const target =
    typeof elementOrId === 'string' ? findElement(page, elementOrId) : elementOrId;
  if (!target) return [];

  const containers = page.elements.filter(
    (c) =>
      c &&
      !c.hidden &&
      c.id !== target.id &&
      (c.type === 'frame' || c.isContainer || c.isBoundary)
  );

  const cx =
    target.type === 'line' || target.type === 'arrow'
      ? (target.x + target.x2) / 2
      : target.x + (target.w || 0) / 2;
  const cy =
    target.type === 'line' || target.type === 'arrow'
      ? (target.y + target.y2) / 2
      : target.y + (target.h || 0) / 2;

  const enclosing = containers
    .filter((c) => {
      if (target.containerId === c.id) return true;
      const fh = c.type === 'frame' && c.collapsed ? 42 : c.h || 0;
      return cx >= c.x && cx <= c.x + (c.w || 0) && cy >= c.y && cy <= c.y + fh;
    })
    .sort((a, b) => (b.w || 0) * (b.h || 0) - (a.w || 0) * (a.h || 0));

  const path = enclosing.map((c) => ({
    id: c.id,
    name: c.text ? String(c.text).split('\n')[0] : c.name || c.type,
    kind: c.type === 'frame' ? 'frame' : 'container',
    type: c.type,
  }));

  if (target.groupId) {
    path.push({
      id: target.id,
      groupId: target.groupId,
      name: `Group (${target.groupId.slice(-4)})`,
      kind: 'group',
      type: 'group',
    });
  }

  path.push({
    id: target.id,
    name: target.text ? String(target.text).split('\n')[0] : target.name || target.type,
    kind: target.type === 'frame' ? 'frame' : target.isContainer || target.isBoundary ? 'container' : 'element',
    type: target.type,
  });

  return path;
}

export function isFrameIncludedInPresentation(el) {
  if (!el || el.type !== 'frame' || el.hidden) return false;
  if (el.includeInPresentation === false || el.excludeFromPresentation === true) return false;
  return true;
}

export const getContainerHierarchy = getElementContainmentPath;

export function syncContainerMemberships(page, movedElements = []) {
  if (!page || !Array.isArray(page.elements)) return;
  const movedSet = new Set((movedElements || []).map((e) => e.id));
  const containers = page.elements.filter(
    (c) => c && !c.hidden && (c.type === 'frame' || c.isContainer || c.isBoundary)
  );
  for (const el of movedElements) {
    if (!el || el.type === 'line' || el.type === 'arrow') continue;
    // If parent container moved together with this child, keep its explicit membership
    if (el.containerId && movedSet.has(el.containerId)) continue;
    const cx = el.x + (el.w || 0) / 2;
    const cy = el.y + (el.h || 0) / 2;
    const elArea = Math.max(1, (el.w || 1) * (el.h || 1));
    const candidates = containers
      .filter((c) => {
        if (c.id === el.id) return false;
        const fh = c.type === 'frame' && c.collapsed ? 42 : c.h || 0;
        const cArea = (c.w || 0) * fh;
        if (cArea <= elArea) return false;
        return cx >= c.x && cx <= c.x + (c.w || 0) && cy >= c.y && cy <= c.y + fh;
      })
      .sort((a, b) => (a.w || 0) * (a.h || 0) - (b.w || 0) * (b.h || 0));
    el.containerId = candidates.length > 0 ? candidates[0].id : null;
  }
}

export function createScene(preferredTheme = 'light') {
  const firstPage = createPage('Page 1');
  return {
    version: SCHEMA_VERSION,
    title: 'StudioBoard Lesson',
    theme: preferredTheme === 'dark' ? 'dark' : 'light',
    activePageId: firstPage.id,
    pages: [firstPage],
    files: {}, // fileId -> { id, dataUrl, mimeType, width, height, created }
    settings: {
      snapToGrid: true,
      snapToObjects: true,
      snapToAngle: true,
      gridSize: 20,
    },
  };
}

export function getActivePage(scene) {
  return scene.pages.find((p) => p.id === scene.activePageId) || scene.pages[0];
}

export function findElement(page, id) {
  if (!page || !id) return null;
  return page.elements.find((e) => e.id === id) || null;
}

function normalizeOffset(offsetOrDx = { x: 24, y: 24 }, dy = null) {
  if (typeof offsetOrDx === 'number') {
    const dxVal = Number.isFinite(offsetOrDx) ? offsetOrDx : 0;
    const dyVal = typeof dy === 'number' && Number.isFinite(dy) ? dy : dxVal;
    return { x: dxVal, y: dyVal };
  }
  const ox = Number.isFinite(offsetOrDx?.x) ? offsetOrDx.x : 0;
  const oy = Number.isFinite(offsetOrDx?.y) ? offsetOrDx.y : 0;
  return { x: ox, y: oy };
}

export function cloneElement(el, offset = { x: 24, y: 24 }, idMap = null) {
  const normOffset = normalizeOffset(offset);
  const copy = structuredClone(el);
  const newId = uid(el.type);
  if (idMap && typeof idMap.set === 'function') idMap.set(el.id, newId);
  copy.id = newId;
  copy.x += normOffset.x;
  copy.y += normOffset.y;
  if (copy.type === 'line' || copy.type === 'arrow') {
    copy.x2 += normOffset.x;
    copy.y2 += normOffset.y;
    if (copy.controlPoint) {
      copy.controlPoint.x += normOffset.x;
      copy.controlPoint.y += normOffset.y;
    }
    if (Array.isArray(copy.waypoints)) {
      copy.waypoints = copy.waypoints.map((p) => ({
        x: p.x + normOffset.x,
        y: p.y + normOffset.y,
      }));
    }
  }
  if (Array.isArray(copy.points)) {
    copy.points = copy.points.map((p) => ({
      x: p.x + normOffset.x,
      y: p.y + normOffset.y,
    }));
  }
  return copy;
}

export function cloneElementsWithBindings(elements, offset = { x: 24, y: 24 }, dy = null) {
  const normOffset = normalizeOffset(offset, dy);
  const idMap = new Map();
  const groupMap = new Map();
  const clones = (elements || []).map((el) => cloneElement(el, normOffset, idMap));

  for (const copy of clones) {
    if (copy.groupId) {
      if (!groupMap.has(copy.groupId)) {
        groupMap.set(copy.groupId, uid('grp'));
      }
      copy.groupId = groupMap.get(copy.groupId);
    }
    if (copy.containerId && idMap.has(copy.containerId)) {
      copy.containerId = idMap.get(copy.containerId);
    }
    if (copy.startBinding) {
      if (idMap.has(copy.startBinding.elementId)) {
        copy.startBinding.elementId = idMap.get(copy.startBinding.elementId);
      } else {
        copy.startBinding = null;
      }
    }
    if (copy.endBinding) {
      if (idMap.has(copy.endBinding.elementId)) {
        copy.endBinding.elementId = idMap.get(copy.endBinding.elementId);
      } else {
        copy.endBinding = null;
      }
    }
  }
  return clones;
}

export function groupElements(page, ids) {
  if (!ids || ids.length < 2) return null;
  const gid = uid('grp');
  const set = new Set(ids);
  for (const el of page.elements) {
    if (set.has(el.id) && !el.locked) {
      el.groupId = gid;
    }
  }
  return gid;
}

export function ungroupElements(page, ids) {
  const set = new Set(ids);
  const groupIds = new Set();
  for (const el of page.elements) {
    if (set.has(el.id) && el.groupId) {
      groupIds.add(el.groupId);
    }
  }
  for (const el of page.elements) {
    if (set.has(el.id) || (el.groupId && groupIds.has(el.groupId))) {
      el.groupId = null;
    }
  }
}

export function expandSelectionWithGroups(page, selectedIds) {
  const result = new Set(selectedIds);
  const groupIds = new Set();
  for (const el of page.elements) {
    if (result.has(el.id) && el.groupId) {
      groupIds.add(el.groupId);
    }
  }
  if (groupIds.size > 0) {
    for (const el of page.elements) {
      if (el.groupId && groupIds.has(el.groupId) && !el.hidden) {
        result.add(el.id);
      }
    }
  }
  return Array.from(result);
}

export function getContainerChildren(page, containerId, options = {}) {
  const frame = findElement(page, containerId);
  if (!frame) return [];
  if (options.forDrag && frame.moveChildren === false) return [];
  const fh = frame.type === 'frame' && frame.collapsed ? 42 : frame.h;
  const childNodes = page.elements.filter((el) => {
    if (el.id === containerId || el.hidden) return false;
    if (el.type === 'line' || el.type === 'arrow') return false;
    if (el.containerId === containerId) return true;
    const cx = el.x + (el.w || 0) / 2;
    const cy = el.y + (el.h || 0) / 2;
    return cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + fh;
  });
  const childIdSet = new Set(childNodes.map((n) => n.id));
  const internalConnectors = page.elements.filter((el) => {
    if (el.hidden || (el.type !== 'line' && el.type !== 'arrow')) return false;
    if (el.containerId === containerId) return true;
    const startInside = el.startBinding && childIdSet.has(el.startBinding.elementId);
    const endInside = el.endBinding && childIdSet.has(el.endBinding.elementId);
    if (startInside && endInside) return true;
    const cx = (el.x + el.x2) / 2;
    const cy = (el.y + el.y2) / 2;
    return !el.startBinding && !el.endBinding && cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + fh;
  });
  return [...childNodes, ...internalConnectors];
}

export function toggleFrameCollapse(page, frameId) {
  const frame = findElement(page, frameId);
  if (!frame || frame.type !== 'frame') return false;
  const children = getContainerChildren(page, frameId);
  if (!frame.collapsed) {
    frame.expandedHeight = frame.h;
    frame.collapsed = true;
    frame.h = 42;
    for (const child of children) {
      child.containerId = frame.id;
      child._hiddenByContainer = true;
      child.hidden = true;
    }
  } else {
    frame.collapsed = false;
    frame.h = frame.expandedHeight || 320;
    for (const el of page.elements) {
      if (el.containerId === frame.id && el._hiddenByContainer) {
        el.hidden = false;
        delete el._hiddenByContainer;
      }
    }
  }
  return frame.collapsed;
}

export function reorderElement(page, id, direction) {
  const idx = page.elements.findIndex((e) => e.id === id);
  if (idx === -1) return false;
  const [item] = page.elements.splice(idx, 1);
  if (direction === 'front') {
    page.elements.push(item);
  } else if (direction === 'back') {
    page.elements.unshift(item);
  } else if (direction === 'forward') {
    page.elements.splice(Math.min(page.elements.length, idx + 1), 0, item);
  } else if (direction === 'backward') {
    page.elements.splice(Math.max(0, idx - 1), 0, item);
  } else {
    page.elements.splice(idx, 0, item);
    return false;
  }
  return true;
}

export function extractStyle(el) {
  if (!el) return null;
  return {
    stroke: el.stroke,
    fill: el.fill,
    strokeWidth: el.strokeWidth,
    strokeStyle: el.strokeStyle,
    fillPattern: el.fillPattern,
    opacity: el.opacity,
    fontFamily: el.fontFamily,
    fontSize: el.fontSize,
    textColor: el.textColor,
    textAlign: el.textAlign,
    roundness: el.roundness,
    sloppy: el.sloppy,
    startArrow: el.startArrow,
    endArrow: el.endArrow,
    routing: el.routing,
  };
}

export function applyStyle(el, style) {
  if (!el || !style) return;
  const keys = [
    'stroke',
    'fill',
    'strokeWidth',
    'strokeStyle',
    'fillPattern',
    'opacity',
    'fontFamily',
    'fontSize',
    'textColor',
    'textAlign',
    'roundness',
    'sloppy',
  ];
  for (const k of keys) {
    if (style[k] !== undefined) el[k] = style[k];
  }
  if (el.type === 'line' || el.type === 'arrow') {
    if (style.startArrow !== undefined) el.startArrow = style.startArrow;
    if (style.endArrow !== undefined) el.endArrow = style.endArrow;
    if (style.routing !== undefined) el.routing = style.routing;
  }
}

export function wrapShapeTextLines(el, rawText = el?.text) {
  const str = String(rawText ?? '');
  if (!str) return [];
  const paragraphs = str.split(String.fromCharCode(10));
  if (!el || el.type === 'text' || el.type === 'code' || el.type === 'frame' || el.type === 'line' || el.type === 'arrow') {
    return paragraphs;
  }
  const fontSize = el.fontSize || 18;
  const approxCharW = fontSize * 0.52;
  const usableW =
    el.type === 'diamond'
      ? Math.max(76, (el.w || 160) * 0.56)
      : el.type === 'ellipse'
        ? Math.max(84, (el.w || 140) * 0.72)
        : Math.max(88, (el.w || 140) - 16);
  const maxChars = Math.max(13, Math.floor(usableW / approxCharW));

  const out = [];
  for (const para of paragraphs) {
    if (para.length <= maxChars || !para.includes(' ')) {
      out.push(para);
      continue;
    }
    const words = para.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (next.length > maxChars && current) {
        out.push(current);
        current = word;
      } else {
        current = next;
      }
    }
    if (current) out.push(current);
  }
  return out;
}

export function autoGrowShapeForText(el, text) {
  if (!el || !el.autoGrow) return;
  if (el.type === 'line' || el.type === 'arrow' || el.type === 'pen' || el.type === 'highlighter') {
    return;
  }
  const rawLines = String(text ?? el.text ?? '').split(String.fromCharCode(10));
  const fontSize = el.fontSize || 18;
  const lineHeight = fontSize * 1.35;
  const approxCharWidth = fontSize * 0.62;

  if (el.type === 'diamond') {
    // Wrap long single-line labels at ~15 chars per line for balanced diamond geometry
    const wrapped = [];
    for (const line of rawLines) {
      if (line.length > 15 && line.includes(' ')) {
        const words = line.split(/\s+/);
        let cur = '';
        for (const w of words) {
          const next = cur ? `${cur} ${w}` : w;
          if (next.length > 15 && cur) {
            wrapped.push(cur);
            cur = w;
          } else {
            cur = next;
          }
        }
        if (cur) wrapped.push(cur);
      } else {
        wrapped.push(line);
      }
    }
    const maxChars = wrapped.reduce((m, l) => Math.max(m, l.length), 0);
    const innerW = maxChars * approxCharWidth + 28;
    const innerH = wrapped.length * lineHeight + 22;
    // Inscribed rectangle in a diamond satisfies (innerW / W) + (innerH / H) <= 1
    const neededW = Math.max(168, Math.ceil(innerW * 1.95));
    const neededH = Math.max(108, Math.ceil(innerH * 1.95));
    if (neededW > el.w) {
      const dw = neededW - el.w;
      el.x -= dw / 2;
      el.w = neededW;
    }
    if (neededH > el.h) {
      const dh = neededH - el.h;
      el.y -= dh / 2;
      el.h = neededH;
    }
    return;
  }

  const maxChars = rawLines.reduce((m, l) => Math.max(m, l.length), 0);
  const paddingX = el.type === 'ellipse' ? 44 : 32;
  const paddingY = el.type === 'ellipse' ? 36 : 28;
  const neededW = Math.ceil(maxChars * approxCharWidth + paddingX);
  const neededH = Math.ceil(rawLines.length * lineHeight + paddingY);

  if (el.type === 'text') {
    el.w = Math.max(40, neededW - 16);
    el.h = Math.max(28, neededH - 12);
    return;
  }

  // Code blocks keep a fixed top-left anchor. Growing symmetrically used to push the
  // block left, underneath the tool rail, where the content could not be reached.
  if (el.type === 'code') {
    if (el.codeWrap) {
      // Wrapped code keeps its width and grows only vertically. Estimate the visual
      // rows with the same character metric the renderer's monospace font uses.
      const innerW = Math.max(8, (el.w || 320) - 52);
      const charsPerLine = Math.max(8, Math.floor(innerW / (fontSize * 0.6)));
      let visualRows = 0;
      for (const line of rawLines) {
        visualRows += Math.max(1, Math.ceil(line.length / charsPerLine));
      }
      const codeH = Math.ceil(visualRows * fontSize * 1.45 + 52);
      el.h = Math.max(el.h, codeH);
      return;
    }
    const codeW = Math.ceil(maxChars * fontSize * 0.62 + 64);
    const codeH = Math.ceil(rawLines.length * lineHeight + 52);
    el.w = Math.max(el.w, codeW);
    el.h = Math.max(el.h, codeH);
    return;
  }

  if (neededW > el.w) {
    const dw = neededW - el.w;
    el.x -= dw / 2;
    el.w = neededW;
  }
  if (neededH > el.h) {
    const dh = neededH - el.h;
    el.y -= dh / 2;
    el.h = neededH;
  }
}
