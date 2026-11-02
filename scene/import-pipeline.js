// scene/import-pipeline.js — Validated Import Pipeline, Sanitizers, Converters & Support Matrix
import { createElement, uid, migrateSceneData, cloneElementsWithBindings } from './model.js';
import { validateElementsBatch, getSelectionBounds } from './geometry.js';
import { bindConnectorEndpoint, updateConnectorBindings } from './bindings.js';
import { parseMermaidDiagram } from './mermaid.js';

export const IMPORT_EXPORT_SUPPORT_MATRIX = [
  {
    format: 'StudioBoard JSON (.whiteboard.json)',
    direction: 'Import & Export',
    category: 'editable-diagram',
    status: 'Tested',
    details: 'Full lossless multi-page scene, bindings, containers, questions, and embedded files.',
  },
  {
    format: 'StudioBoard Library (.library.json)',
    direction: 'Import & Export',
    category: 'reusable-library',
    status: 'Tested',
    details: 'Reusable connected groups and custom stencil collections.',
  },
  {
    format: 'PNG / JPEG / WebP (Single & Multi-file)',
    direction: 'Import & Export',
    category: 'image-insertion',
    status: 'Tested',
    details: 'Raster image insertion with grid/row batch placement; 1x/2x/3x high-DPI PNG export with optional scene metadata.',
  },
  {
    format: 'Sanitized SVG (.svg)',
    direction: 'Import & Export',
    category: 'image-insertion',
    status: 'Tested',
    details: 'Strips scripts, event handlers, and external fetches on import; faithful vector SVG export.',
  },
  {
    format: 'Mermaid Diagram (flowchart / sequenceDiagram)',
    direction: 'Import',
    category: 'editable-diagram',
    status: 'Tested',
    details: 'Converts flowchart TD/LR and sequenceDiagram syntax into editable shapes and bound connectors with line-level diagnostics.',
  },
  {
    format: 'Excalidraw Scene & Library (.excalidraw / .excalidrawlib)',
    direction: 'Import',
    category: 'editable-diagram',
    status: 'Partial',
    details: 'Converts rectangles, ellipses, diamonds, arrows, lines, freedraw, text, groups, and bindings; maps fonts to StudioBoard stacks.',
  },
  {
    format: 'draw.io / mxGraph XML (.drawio / .xml)',
    direction: 'Import',
    category: 'editable-diagram',
    status: 'Partial',
    details: 'Converts mxCell vertices, containers, edges, labels, geometry, and colors; reports unsupported custom shape styles.',
  },
  {
    format: 'Multi-Page PDF Handout',
    direction: 'Export & Page Raster Import',
    category: 'image-insertion',
    status: 'Flattened',
    details: 'Exports multi-page print handouts; imported PDF pages are inserted as rasterized background/worksheet layers, not editable vectors.',
  },
  {
    format: 'Remote Image URL (https://...)',
    direction: 'Import',
    category: 'image-insertion',
    status: 'Backend Required',
    details: 'Works directly for CORS-enabled image hosts; arbitrary cross-origin URLs require a backend proxy to avoid tainted canvas exports.',
  },
  {
    format: 'PPTX / Visio (.vsdx) / Proprietary Miro Backup',
    direction: 'Import',
    category: 'editable-diagram',
    status: 'Unsupported',
    details: 'Dedicated binary/archive parsers are not bundled. Export from Miro or Visio to draw.io XML, SVG, or PDF first.',
  },
];

export function sanitizeSvgMarkup(rawSvg = '') {
  const input = String(rawSvg || '').trim();
  if (!input.includes('<svg')) {
    throw new Error('Invalid SVG markup: missing <svg> root element.');
  }

  let removedScripts = 0;
  let removedEventHandlers = 0;
  let removedExternalRefs = 0;
  const warnings = [];

  let cleaned = input.replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, () => {
    removedScripts++;
    return '';
  });
  cleaned = cleaned.replace(/<script[^>]*\/>/gi, () => {
    removedScripts++;
    return '';
  });
  cleaned = cleaned.replace(/<foreignObject[\s\S]*?>[\s\S]*?<\/foreignObject>/gi, () => {
    removedScripts++;
    warnings.push('Removed <foreignObject> HTML payload for security.');
    return '';
  });

  // Remove inline event handlers (onload, onerror, onclick, etc.)
  cleaned = cleaned.replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, () => {
    removedEventHandlers++;
    return '';
  });

  // Neutralize javascript: or data:text/html URIs in href / xlink:href
  cleaned = cleaned.replace(
    /\s+(?:xlink:)?href\s*=\s*(?:"\s*(?:javascript:|vbscript:|data:text\/html)[^"]*"|'\s*(?:javascript:|vbscript:|data:text\/html)[^']*')/gi,
    () => {
      removedEventHandlers++;
      return '';
    }
  );

  // Prevent automatic fetching of arbitrary remote http(s) resources inside SVG
  cleaned = cleaned.replace(
    /\s+(?:xlink:)?href\s*=\s*(?:"https?:\/\/[^"]*"|'https?:\/\/[^']*')/gi,
    () => {
      removedExternalRefs++;
      return '';
    }
  );

  if (removedScripts > 0) {
    warnings.push(`Stripped ${removedScripts} embedded <script>/<foreignObject> block(s).`);
  }
  if (removedEventHandlers > 0) {
    warnings.push(`Stripped ${removedEventHandlers} inline script/event attribute(s).`);
  }
  if (removedExternalRefs > 0) {
    warnings.push(`Blocked ${removedExternalRefs} external remote URL reference(s) inside SVG.`);
  }

  return {
    sanitizedSvg: cleaned,
    dataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(cleaned)}`,
    removedScripts,
    removedEventHandlers,
    removedExternalRefs,
    warnings,
  };
}

export function convertExcalidrawJson(rawInput, origin = { x: 100, y: 100 }) {
  const parsed = typeof rawInput === 'string' ? JSON.parse(rawInput) : rawInput;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Invalid Excalidraw JSON payload.');
  }

  // Handle .excalidrawlib reusable library format
  if (parsed.type === 'excalidrawlib' || Array.isArray(parsed.libraryItems)) {
    const rawItems = Array.isArray(parsed.libraryItems) ? parsed.libraryItems : [];
    const libraryItems = [];
    const warnings = [];
    for (let i = 0; i < rawItems.length; i++) {
      const item = rawItems[i];
      const rawEls = Array.isArray(item) ? item : Array.isArray(item?.elements) ? item.elements : [];
      const conv = convertExcalidrawElements(rawEls, { x: 0, y: 0 });
      if (conv.elements.length > 0) {
        libraryItems.push({
          id: item.id || uid('lib'),
          name: item.name || `Excalidraw Group ${i + 1}`,
          elements: conv.elements,
        });
      }
      warnings.push(...conv.report.warnings);
    }
    return {
      kind: 'reusable-library',
      format: 'excalidrawlib',
      libraryItems,
      report: {
        format: 'Excalidraw Library (.excalidrawlib)',
        category: 'reusable-library',
        status: warnings.length > 0 ? 'Partial' : 'Tested',
        importedCount: libraryItems.length,
        skippedCount: 0,
        unsupportedTypes: [],
        warnings,
      },
    };
  }

  const rawElements = Array.isArray(parsed.elements) ? parsed.elements : null;
  if (!rawElements) {
    throw new Error('Excalidraw file is missing an "elements" array.');
  }
  const conv = convertExcalidrawElements(rawElements, origin);
  return {
    kind: 'editable-diagram',
    format: 'excalidraw',
    elements: conv.elements,
    files: parsed.files || {},
    report: conv.report,
  };
}

function convertExcalidrawElements(rawElements, origin = { x: 100, y: 100 }) {
  const active = rawElements.filter((e) => e && !e.isDeleted);
  const textByContainer = new Map();
  for (const el of active) {
    if (el.type === 'text' && el.containerId) {
      textByContainer.set(el.containerId, String(el.text || el.originalText || ''));
    }
  }

  const out = [];
  const idMap = new Map();
  const unsupportedTypes = new Set();
  const warnings = [];
  let fontMappedCount = 0;

  // Compute minX/minY to place cleanly around origin if needed
  let minX = Infinity;
  let minY = Infinity;
  for (const el of active) {
    if (Number.isFinite(el.x) && el.x < minX) minX = el.x;
    if (Number.isFinite(el.y) && el.y < minY) minY = el.y;
  }
  const offsetX = Number.isFinite(minX) && origin ? (origin.x ?? minX) - minX : 0;
  const offsetY = Number.isFinite(minY) && origin ? (origin.y ?? minY) - minY : 0;

  const pendingConnectors = [];

  for (const raw of active) {
    if (raw.type === 'text' && raw.containerId && active.some((a) => a.id === raw.containerId)) {
      // Bound label already merged into parent shape/connector
      continue;
    }

    const baseX = (Number(raw.x) || 0) + offsetX;
    const baseY = (Number(raw.y) || 0) + offsetY;
    const w = Math.max(12, Math.abs(Number(raw.width) || 120));
    const h = Math.max(12, Math.abs(Number(raw.height) || 72));
    const stroke = raw.strokeColor || '#1e293b';
    const fill =
      raw.backgroundColor && raw.backgroundColor !== 'transparent'
        ? raw.backgroundColor
        : 'transparent';
    const strokeWidth = Number(raw.strokeWidth) || 2;
    const strokeStyle = ['solid', 'dashed', 'dotted'].includes(raw.strokeStyle)
      ? raw.strokeStyle
      : 'solid';
    const sloppy = Number(raw.roughness) > 0;
    const groupId = Array.isArray(raw.groupIds) && raw.groupIds.length > 0 ? raw.groupIds[0] : null;
    const label = textByContainer.get(raw.id) ?? String(raw.text || '');

    if (raw.fontFamily && ![1, 2, 3].includes(raw.fontFamily)) {
      fontMappedCount++;
    }
    const fontFamily = raw.fontFamily === 3 ? 'mono' : raw.fontFamily === 2 ? 'serif' : 'sans';

    let mappedType = null;
    if (raw.type === 'rectangle') {
      mappedType = raw.roundness ? 'rounded-rect' : 'rect';
    } else if (raw.type === 'ellipse') {
      mappedType = 'ellipse';
    } else if (raw.type === 'diamond') {
      mappedType = 'diamond';
    } else if (raw.type === 'text') {
      mappedType = 'text';
    } else if (raw.type === 'frame') {
      mappedType = 'frame';
    } else if (raw.type === 'freedraw') {
      mappedType = 'pen';
    } else if (raw.type === 'arrow' || raw.type === 'line') {
      mappedType = raw.type === 'arrow' ? 'arrow' : 'line';
    } else if (raw.type === 'image') {
      mappedType = 'image';
    } else {
      unsupportedTypes.add(String(raw.type || 'unknown'));
      continue;
    }

    if (mappedType === 'pen') {
      const pts = Array.isArray(raw.points)
        ? raw.points.map((pt) => ({
            x: baseX + (Array.isArray(pt) ? Number(pt[0]) || 0 : Number(pt.x) || 0),
            y: baseY + (Array.isArray(pt) ? Number(pt[1]) || 0 : Number(pt.y) || 0),
          }))
        : [
            { x: baseX, y: baseY },
            { x: baseX + 20, y: baseY + 20 },
          ];
      const created = createElement('pen', {
        id: raw.id || uid('pen'),
        points: pts,
        stroke,
        strokeWidth,
        opacity: (Number(raw.opacity) || 100) / 100,
        groupId,
      });
      idMap.set(raw.id, created);
      out.push(created);
      continue;
    }

    if (mappedType === 'arrow' || mappedType === 'line') {
      const pts = Array.isArray(raw.points) ? raw.points : [];
      const lastPt = pts.length > 1 ? pts[pts.length - 1] : [w, 0];
      const dx = Array.isArray(lastPt) ? Number(lastPt[0]) || 0 : Number(lastPt.x) || 0;
      const dy = Array.isArray(lastPt) ? Number(lastPt[1]) || 0 : Number(lastPt.y) || 0;
      const conn = createElement(mappedType, {
        id: raw.id || uid(mappedType),
        x: baseX,
        y: baseY,
        x2: baseX + (dx || 120),
        y2: baseY + dy,
        stroke,
        strokeWidth,
        strokeStyle,
        text: label,
        routing: raw.elbowed ? 'orthogonal' : pts.length > 2 ? 'curved' : 'straight',
        startArrow: raw.startArrowhead ? 'arrow' : 'none',
        endArrow: raw.endArrowhead === null ? 'none' : mappedType === 'arrow' ? 'arrow' : 'none',
        groupId,
      });
      pendingConnectors.push({ conn, raw });
      idMap.set(raw.id, conn);
      out.push(conn);
      continue;
    }

    const el = createElement(mappedType, {
      id: raw.id || uid(mappedType),
      name: raw.name || label || mappedType,
      x: baseX,
      y: baseY,
      w,
      h,
      rotation: Number(raw.angle) || 0,
      stroke,
      fill,
      strokeWidth,
      strokeStyle,
      sloppy,
      text: mappedType === 'frame' ? raw.name || label || 'Imported Frame' : label,
      fontFamily,
      fontSize: Number(raw.fontSize) || 18,
      groupId,
      fileId: raw.fileId || null,
    });
    idMap.set(raw.id, el);
    out.push(el);
  }

  for (const { conn, raw } of pendingConnectors) {
    if (raw.startBinding?.elementId && idMap.has(raw.startBinding.elementId)) {
      bindConnectorEndpoint(conn, 'start', idMap.get(raw.startBinding.elementId), 'auto');
    }
    if (raw.endBinding?.elementId && idMap.has(raw.endBinding.elementId)) {
      bindConnectorEndpoint(conn, 'end', idMap.get(raw.endBinding.elementId), 'auto');
    }
  }

  if (fontMappedCount > 0) {
    warnings.push(`Mapped ${fontMappedCount} custom Excalidraw font setting(s) to StudioBoard font stacks.`);
  }
  if (unsupportedTypes.size > 0) {
    warnings.push(`Skipped unsupported element types: ${Array.from(unsupportedTypes).join(', ')}.`);
  }

  return {
    elements: out,
    report: {
      format: 'Excalidraw Scene (.excalidraw)',
      category: 'editable-diagram',
      status: unsupportedTypes.size > 0 || warnings.length > 0 ? 'Partial' : 'Tested',
      importedCount: out.length,
      skippedCount: active.length - out.length - textByContainer.size,
      preservedIdsCount: idMap.size,
      unsupportedTypes: Array.from(unsupportedTypes),
      warnings,
    },
  };
}

function parseXmlAttributes(attrStr = '') {
  const attrs = {};
  const re = /([a-zA-Z0-9_:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    attrs[m[1]] = decodeXmlEntities(m[2] ?? m[3] ?? '');
  }
  return attrs;
}

function decodeXmlEntities(str = '') {
  return String(str)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/<br\s*\/?>/gi, String.fromCharCode(10))
    .replace(/<[^>]+>/g, '')
    .trim();
}

function parseDrawioStyleString(styleStr = '') {
  const map = {};
  for (const part of String(styleStr || '').split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) {
      map[trimmed] = true;
    } else {
      map[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
    }
  }
  return map;
}

export function convertDrawioXml(xmlText, origin = { x: 100, y: 100 }) {
  const input = String(xmlText || '').trim();
  if (!input.includes('<mxCell') && !input.includes('<mxfile') && !input.includes('<mxGraphModel')) {
    throw new Error('Invalid draw.io XML: no <mxCell> or <mxGraphModel> elements found.');
  }

  // Extract all <mxCell ...>...</mxCell> or self-closing <mxCell .../>
  const cellRegex = /<mxCell\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxCell>)/gi;
  const cells = [];
  let match;
  while ((match = cellRegex.exec(input)) !== null) {
    const attrs = parseXmlAttributes(match[1]);
    const inner = match[2] || '';
    const geomMatch = /<mxGeometry\b([^>]*?)(?:\/>|>([\s\S]*?)<\/mxGeometry>)/i.exec(inner);
    const geom = geomMatch ? parseXmlAttributes(geomMatch[1]) : {};
    cells.push({ attrs, geom });
  }

  const cellById = new Map();
  for (const c of cells) {
    if (c.attrs.id) cellById.set(c.attrs.id, c);
  }

  // Resolve parent offsets for nested container coordinates in mxGraph
  const getAbsoluteOffset = (parentId, depth = 0) => {
    if (!parentId || parentId === '0' || parentId === '1' || depth > 8) return { x: 0, y: 0 };
    const parent = cellById.get(parentId);
    if (!parent) return { x: 0, y: 0 };
    const anc = getAbsoluteOffset(parent.attrs.parent, depth + 1);
    return {
      x: anc.x + (Number(parent.geom.x) || 0),
      y: anc.y + (Number(parent.geom.y) || 0),
    };
  };

  const vertices = [];
  const edges = [];
  const unsupportedStyles = new Set();
  const warnings = [];

  for (const c of cells) {
    const { attrs, geom } = c;
    if (attrs.id === '0' || attrs.id === '1') continue;
    if (attrs.vertex === '1') vertices.push(c);
    else if (attrs.edge === '1') edges.push(c);
  }

  let minX = Infinity;
  let minY = Infinity;
  for (const v of vertices) {
    const pOff = getAbsoluteOffset(v.attrs.parent);
    const vx = pOff.x + (Number(v.geom.x) || 0);
    const vy = pOff.y + (Number(v.geom.y) || 0);
    if (vx < minX) minX = vx;
    if (vy < minY) minY = vy;
  }
  const shiftX = Number.isFinite(minX) && origin ? (origin.x ?? minX) - minX : 0;
  const shiftY = Number.isFinite(minY) && origin ? (origin.y ?? minY) - minY : 0;

  const createdById = new Map();
  const out = [];

  for (const v of vertices) {
    const { attrs, geom } = v;
    const style = parseDrawioStyleString(attrs.style || '');
    const pOff = getAbsoluteOffset(attrs.parent);
    const x = pOff.x + (Number(geom.x) || 0) + shiftX;
    const y = pOff.y + (Number(geom.y) || 0) + shiftY;
    const w = Math.max(24, Number(geom.width) || 140);
    const h = Math.max(24, Number(geom.height) || 80);
    const label = attrs.value || '';

    const isContainer = Boolean(style.swimlane || style.container === '1' || style.group);
    let type = 'rect';
    if (isContainer) {
      type = 'frame';
    } else if (style.ellipse || style.shape === 'ellipse') {
      type = 'ellipse';
    } else if (style.rhombus || style.shape === 'rhombus') {
      type = 'diamond';
    } else if (style.text) {
      type = 'text';
    } else if (style.rounded === '1') {
      type = 'rounded-rect';
    } else if (style.shape && !['rect', 'rectangle', 'box', 'process'].includes(style.shape)) {
      unsupportedStyles.add(style.shape);
      type = 'rounded-rect';
    }

    const el = createElement(type, {
      id: `drawio_${attrs.id}`,
      name: label || attrs.id,
      x,
      y,
      w,
      h,
      text: label || (type === 'frame' ? 'Container' : ''),
      stroke: style.strokeColor && style.strokeColor !== 'none' ? style.strokeColor : '#1e293b',
      fill:
        style.fillColor && style.fillColor !== 'none'
          ? style.fillColor
          : type === 'frame'
            ? 'rgba(148, 163, 184, 0.08)'
            : '#ffffff',
      strokeStyle: style.dashed === '1' ? 'dashed' : 'solid',
      containerId:
        attrs.parent && attrs.parent !== '0' && attrs.parent !== '1'
          ? `drawio_${attrs.parent}`
          : null,
    });
    createdById.set(attrs.id, el);
    out.push(el);
  }

  for (const edge of edges) {
    const { attrs, geom } = edge;
    const style = parseDrawioStyleString(attrs.style || '');
    const sourceEl = attrs.source ? createdById.get(attrs.source) : null;
    const targetEl = attrs.target ? createdById.get(attrs.target) : null;

    let routing = 'orthogonal';
    if (style.curved === '1') routing = 'curved';
    else if (style.rounded === '1' && style.edgeStyle?.includes('orthogonal')) routing = 'rounded-elbow';
    else if (!style.edgeStyle || style.edgeStyle === 'none') routing = 'straight';

    const conn = createElement('arrow', {
      id: `drawio_${attrs.id}`,
      x: sourceEl ? sourceEl.x + sourceEl.w / 2 : (Number(geom.x) || 100) + shiftX,
      y: sourceEl ? sourceEl.y + sourceEl.h / 2 : (Number(geom.y) || 100) + shiftY,
      x2: targetEl ? targetEl.x + targetEl.w / 2 : (Number(geom.x) || 240) + shiftX,
      y2: targetEl ? targetEl.y + targetEl.h / 2 : (Number(geom.y) || 100) + shiftY,
      text: attrs.value || '',
      routing,
      stroke: style.strokeColor && style.strokeColor !== 'none' ? style.strokeColor : '#1e293b',
      strokeStyle: style.dashed === '1' ? 'dashed' : 'solid',
      startArrow: style.startArrow && style.startArrow !== 'none' ? 'arrow' : 'none',
      endArrow: style.endArrow === 'none' ? 'none' : 'arrow',
    });

    if (sourceEl) bindConnectorEndpoint(conn, 'start', sourceEl, 'auto');
    if (targetEl) bindConnectorEndpoint(conn, 'end', targetEl, 'auto');
    out.push(conn);
  }

  if (unsupportedStyles.size > 0) {
    warnings.push(
      `Mapped custom draw.io shape style(s) [${Array.from(unsupportedStyles).join(', ')}] to editable rounded rectangles.`
    );
  }

  return {
    kind: 'editable-diagram',
    format: 'drawio',
    elements: out,
    report: {
      format: 'draw.io XML (.drawio)',
      category: 'editable-diagram',
      status: unsupportedStyles.size > 0 ? 'Partial' : 'Tested',
      importedCount: out.length,
      skippedCount: 0,
      preservedIdsCount: createdById.size + edges.length,
      unsupportedTypes: Array.from(unsupportedStyles),
      warnings,
    },
  };
}

export function runImportPipeline({
  format,
  content,
  fileName = '',
  origin = { x: 100, y: 100 },
} = {}) {
  const lowerName = String(fileName || '').toLowerCase();
  const inferredFormat =
    format ||
    (lowerName.endsWith('.drawio') || lowerName.endsWith('.xml')
      ? 'drawio'
      : lowerName.endsWith('.excalidraw') || lowerName.endsWith('.excalidrawlib')
        ? 'excalidraw'
        : lowerName.endsWith('.svg')
          ? 'svg'
          : lowerName.endsWith('.mmd') || lowerName.endsWith('.mermaid')
            ? 'mermaid'
            : 'json');

  if (inferredFormat === 'svg') {
    const sanitized = sanitizeSvgMarkup(content);
    const fileId = uid('file_svg');
    const el = createElement('image', {
      x: origin.x,
      y: origin.y,
      w: 280,
      h: 200,
      name: fileName || 'Sanitized SVG',
      fileId,
      naturalWidth: 280,
      naturalHeight: 200,
    });
    return {
      kind: 'image-insertion',
      format: 'svg',
      elements: [el],
      files: {
        [fileId]: {
          id: fileId,
          dataUrl: sanitized.dataUrl,
          mimeType: 'image/svg+xml',
          width: 280,
          height: 200,
          created: Date.now(),
        },
      },
      report: {
        format: 'Sanitized SVG (.svg)',
        category: 'image-insertion',
        status: 'Tested',
        importedCount: 1,
        skippedCount: 0,
        unsupportedTypes: [],
        warnings: sanitized.warnings,
      },
    };
  }

  if (inferredFormat === 'mermaid') {
    const parsed = parseMermaidDiagram(String(content || ''), origin);
    const check = validateElementsBatch(parsed.elements);
    if (!check.valid) throw new Error(check.reason);
    return {
      kind: 'editable-diagram',
      format: 'mermaid',
      elements: parsed.elements,
      files: {},
      report: {
        format: 'Mermaid Diagram',
        category: 'editable-diagram',
        status: parsed.warnings.length > 0 ? 'Partial' : 'Tested',
        importedCount: parsed.elements.length,
        skippedCount: parsed.warnings.length,
        unsupportedTypes: [],
        warnings: parsed.warnings,
      },
    };
  }

  if (inferredFormat === 'drawio') {
    const res = convertDrawioXml(content, origin);
    const check = validateElementsBatch(res.elements);
    if (!check.valid) throw new Error(check.reason);
    return res;
  }

  if (inferredFormat === 'excalidraw') {
    const res = convertExcalidrawJson(content, origin);
    if (res.kind === 'editable-diagram') {
      const check = validateElementsBatch(res.elements);
      if (!check.valid) throw new Error(check.reason);
    }
    return res;
  }

  // Auto-detect JSON subtype (StudioBoard scene, StudioBoard library, or Excalidraw JSON)
  const rawObj = typeof content === 'string' ? JSON.parse(content) : content;
  if (rawObj?.type === 'excalidraw' || rawObj?.type === 'excalidrawlib' || Array.isArray(rawObj?.libraryItems)) {
    return convertExcalidrawJson(rawObj, origin);
  }
  if (rawObj?.type === 'whiteboard-library' || (Array.isArray(rawObj?.items) && !rawObj?.pages)) {
    const items = Array.isArray(rawObj.items) ? rawObj.items : [];
    return {
      kind: 'reusable-library',
      format: 'studio-library',
      libraryItems: items,
      report: {
        format: 'StudioBoard Library (.library.json)',
        category: 'reusable-library',
        status: 'Tested',
        importedCount: items.length,
        skippedCount: 0,
        unsupportedTypes: [],
        warnings: [],
      },
    };
  }

  const migrated = migrateSceneData(rawObj);
  const firstPage = migrated.pages[0];
  const cloned = cloneElementsWithBindings(firstPage.elements || [], { x: 0, y: 0 });
  updateConnectorBindings({ elements: cloned });
  return {
    kind: 'editable-diagram',
    format: 'studioboard-json',
    scene: migrated,
    elements: cloned,
    files: migrated.files || {},
    report: {
      format: 'StudioBoard JSON (.whiteboard.json)',
      category: 'editable-diagram',
      status: 'Tested',
      importedCount: migrated.pages.reduce((acc, p) => acc + (p.elements?.length || 0), 0),
      pageCount: migrated.pages.length,
      skippedCount: 0,
      unsupportedTypes: [],
      warnings: [],
    },
  };
}
