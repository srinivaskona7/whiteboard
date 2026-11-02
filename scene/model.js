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
  opacity: 1,
  fontFamily: 'sans', // 'sans' | 'serif' | 'mono' | 'hand'
  fontSize: 18,
  textColor: '#1e293b',
  textAlign: 'center', // 'left' | 'center' | 'right'
  roundness: 0,
  sloppy: false,
  autoGrow: true,
  startArrow: 'none', // 'none' | 'arrow' | 'triangle' | 'diamond' | 'circle' | 'bar'
  endArrow: 'arrow',
  routing: 'orthogonal', // 'straight' | 'orthogonal' | 'curved'
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
    groupId: props.groupId ?? null,
    containerId: props.containerId ?? null,
    locked: Boolean(props.locked),
    hidden: Boolean(props.hidden),
    link: props.link ?? '',
    revealStep: props.revealStep ?? 0,
  };

  if (isFreehand) {
    base.points = Array.isArray(props.points) ? props.points.map((p) => ({ x: p.x, y: p.y })) : [];
    base.fading = Boolean(props.fading);
    base.createdAt = props.createdAt ?? Date.now();
  }

  if (isConnector) {
    base.x2 = props.x2 ?? base.x + 140;
    base.y2 = props.y2 ?? base.y;
    base.w = Math.abs(base.x2 - base.x);
    base.h = Math.abs(base.y2 - base.y);
    base.routing = props.routing ?? (type === 'arrow' ? 'orthogonal' : 'straight');
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
  }

  if (isFrame) {
    base.clip = Boolean(props.clip);
    base.collapsed = Boolean(props.collapsed);
    base.expandedHeight = props.expandedHeight ?? base.h;
    base.slideOrder = props.slideOrder ?? 1;
  }

  if (isTable) {
    const rows = props.rows ?? 3;
    const cols = props.cols ?? 3;
    base.rows = rows;
    base.cols = cols;
    base.cells =
      props.cells ??
      Array.from({ length: rows }, (_, r) =>
        Array.from({ length: cols }, (__, c) => (r === 0 ? `Header ${c + 1}` : `Cell ${r},${c + 1}`))
      );
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

  return base;
}

export function createPage(name = 'Page 1', id = uid('page')) {
  return {
    id,
    name,
    elements: [],
    camera: { x: 0, y: 0, zoom: 1 },
    background: 'grid', // 'plain' | 'grid' | 'dots'
  };
}

export function createScene(preferredTheme = 'light') {
  const firstPage = createPage('Page 1');
  return {
    version: SCHEMA_VERSION,
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

export function cloneElement(el, offset = { x: 24, y: 24 }, idMap = null) {
  const copy = structuredClone(el);
  const newId = uid(el.type);
  if (idMap) idMap.set(el.id, newId);
  copy.id = newId;
  copy.x += offset.x;
  copy.y += offset.y;
  if (copy.type === 'line' || copy.type === 'arrow') {
    copy.x2 += offset.x;
    copy.y2 += offset.y;
    if (copy.controlPoint) {
      copy.controlPoint.x += offset.x;
      copy.controlPoint.y += offset.y;
    }
    if (Array.isArray(copy.waypoints)) {
      copy.waypoints = copy.waypoints.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
    }
  }
  if (Array.isArray(copy.points)) {
    copy.points = copy.points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y }));
  }
  return copy;
}

export function cloneElementsWithBindings(elements, offset = { x: 24, y: 24 }) {
  const idMap = new Map();
  const groupMap = new Map();
  const clones = elements.map((el) => cloneElement(el, offset, idMap));

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

export function getContainerChildren(page, containerId) {
  const frame = findElement(page, containerId);
  if (!frame) return [];
  return page.elements.filter((el) => {
    if (el.id === containerId || el.hidden) return false;
    if (el.containerId === containerId) return true;
    const cx = el.type === 'line' || el.type === 'arrow' ? (el.x + el.x2) / 2 : el.x + el.w / 2;
    const cy = el.type === 'line' || el.type === 'arrow' ? (el.y + el.y2) / 2 : el.y + el.h / 2;
    const fh = frame.collapsed ? 42 : frame.h;
    return cx >= frame.x && cx <= frame.x + frame.w && cy >= frame.y && cy <= frame.y + fh;
  });
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

export function autoGrowShapeForText(el, text) {
  if (!el || !el.autoGrow) return;
  if (el.type === 'line' || el.type === 'arrow' || el.type === 'pen' || el.type === 'highlighter') {
    return;
  }
  const lines = String(text ?? el.text ?? '').split(String.fromCharCode(10));
  const fontSize = el.fontSize || 18;
  const lineHeight = fontSize * 1.35;
  const maxChars = lines.reduce((m, l) => Math.max(m, l.length), 0);
  const approxCharWidth = fontSize * 0.62;
  const paddingX = el.type === 'diamond' ? 56 : 32;
  const paddingY = el.type === 'diamond' ? 48 : 28;
  const neededW = Math.ceil(maxChars * approxCharWidth + paddingX);
  const neededH = Math.ceil(lines.length * lineHeight + paddingY);

  if (el.type === 'text') {
    el.w = Math.max(40, neededW - 16);
    el.h = Math.max(28, neededH - 12);
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
