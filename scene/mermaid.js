// scene/mermaid.js
import { createElement, autoGrowShapeForText } from './model.js';
import { getSelectionBounds } from './geometry.js';
import { bindConnectorEndpoint } from './bindings.js';

export function computeNonOverlappingOrigin(page, viewportCenter = { x: 400, y: 260 }) {
  const visible = (page?.elements || []).filter((e) => !e.hidden);
  if (visible.length === 0) {
    return {
      x: Math.round(viewportCenter.x - 180),
      y: Math.round(viewportCenter.y - 140),
    };
  }
  const bounds = getSelectionBounds(visible);
  if (!bounds) {
    return { x: 120, y: 100 };
  }
  return {
    x: Math.round(bounds.maxX + 96),
    y: Math.round(bounds.minY),
  };
}

export function parseMermaidDiagram(sourceText, startX = 120, startY = 100) {
  const rawLines = String(sourceText || '')
    .split(String.fromCharCode(10))
    .map((l, idx) => ({ text: l.trim(), lineNumber: idx + 1 }))
    .filter((l) => l.text.length > 0 && !l.text.startsWith('%%'));

  if (rawLines.length === 0) {
    return { elements: [], warnings: ['Empty Mermaid input.'] };
  }

  const header = rawLines[0].text;
  const flowMatch = header.match(/^(?:flowchart|graph)\s*(TD|TB|BT|LR|RL)?$/i);
  if (flowMatch) {
    const dir = (flowMatch[1] || 'TD').toUpperCase();
    return parseFlowchart(rawLines.slice(1), dir, startX, startY);
  }

  if (/^sequenceDiagram$/i.test(header)) {
    return parseSequenceDiagram(rawLines.slice(1), startX, startY);
  }

  return {
    elements: [],
    warnings: [
      `Line 1: Unsupported diagram header "${header}". Supported headers: "flowchart TD/LR" (or "graph TD/LR") and "sequenceDiagram".`,
    ],
  };
}

function parseNodeToken(token) {
  const trimmed = token.trim();
  // Match ID + shape brackets: A[Label], B(Label), C{Label}, D((Label)), E[(Label)]
  const dbMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\[\((.+)\)\]$/);
  if (dbMatch) {
    return { id: dbMatch[1], label: dbMatch[2].trim(), shape: 'stencil', stencilId: 'flow-database' };
  }
  const circleMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\(\((.+)\)\)$/);
  if (circleMatch) {
    return { id: circleMatch[1], label: circleMatch[2].trim(), shape: 'ellipse' };
  }
  const diamondMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\{(.+)\}$/);
  if (diamondMatch) {
    return { id: diamondMatch[1], label: diamondMatch[2].trim(), shape: 'diamond' };
  }
  const roundMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\((.+)\)$/);
  if (roundMatch) {
    return { id: roundMatch[1], label: roundMatch[2].trim(), shape: 'rounded-rect' };
  }
  const rectMatch = trimmed.match(/^([A-Za-z0-9_.-]+)\[(.+)\]$/);
  if (rectMatch) {
    return { id: rectMatch[1], label: rectMatch[2].trim(), shape: 'rect' };
  }
  const plainMatch = trimmed.match(/^([A-Za-z0-9_.-]+)$/);
  if (plainMatch) {
    return { id: plainMatch[1], label: plainMatch[1], shape: 'rect', implicit: true };
  }
  return null;
}

function parseFlowchart(lines, direction, startX, startY) {
  const warnings = [];
  const nodes = new Map(); // id -> { id, label, shape, stencilId, level }
  const edges = [];

  const registerNode = (parsed) => {
    if (!nodes.has(parsed.id)) {
      nodes.set(parsed.id, {
        id: parsed.id,
        label: parsed.label,
        shape: parsed.shape,
        stencilId: parsed.stencilId || null,
      });
    } else if (!parsed.implicit) {
      const existing = nodes.get(parsed.id);
      existing.label = parsed.label;
      existing.shape = parsed.shape;
      existing.stencilId = parsed.stencilId || null;
    }
  };

  for (const { text, lineNumber } of lines) {
    const clean = text.replace(/;$/, '').trim();
    if (/^(subgraph|end|style|classDef|class|click|linkStyle)\b/i.test(clean)) {
      warnings.push(`Line ${lineNumber}: Unsupported flowchart directive "${clean}".`);
      continue;
    }

    // Edge pattern: LeftNode -- label --> RightNode OR LeftNode -->|label| RightNode
    const edgeMatch = clean.match(
      /^(.+?)\s*(?:--\s*([^-=>]+?)\s*(-->|---)|(-?\.->|==>|-->|---)\s*(?:\|([^|]+)\|)?)\s*(.+)$/
    );

    if (edgeMatch) {
      const leftRaw = edgeMatch[1].trim();
      const inlineLabel = edgeMatch[2] ? edgeMatch[2].trim() : '';
      const arrowToken = edgeMatch[3] || edgeMatch[4] || '-->';
      const pipeLabel = edgeMatch[5] ? edgeMatch[5].trim() : '';
      const rightRaw = edgeMatch[6].trim();

      const leftNode = parseNodeToken(leftRaw);
      const rightNode = parseNodeToken(rightRaw);

      if (!leftNode || !rightNode) {
        warnings.push(`Line ${lineNumber}: Could not parse node definition in "${clean}".`);
        continue;
      }

      registerNode(leftNode);
      registerNode(rightNode);

      edges.push({
        from: leftNode.id,
        to: rightNode.id,
        label: inlineLabel || pipeLabel || '',
        dashed: arrowToken.includes('.'),
        directed: arrowToken.includes('>'),
      });
      continue;
    }

    const standalone = parseNodeToken(clean);
    if (standalone) {
      registerNode(standalone);
    } else {
      warnings.push(`Line ${lineNumber}: Unsupported syntax "${clean}".`);
    }
  }

  // Compute topological rank for neat grid layout
  const ranks = new Map();
  for (const id of nodes.keys()) ranks.set(id, 0);
  for (let iter = 0; iter < nodes.size; iter++) {
    for (const e of edges) {
      const rFrom = ranks.get(e.from) ?? 0;
      const rTo = ranks.get(e.to) ?? 0;
      if (rTo <= rFrom) {
        ranks.set(e.to, rFrom + 1);
      }
    }
  }

  const byRank = new Map();
  for (const [id, r] of ranks.entries()) {
    if (!byRank.has(r)) byRank.set(r, []);
    byRank.get(r).push(id);
  }

  const isHorizontal = direction === 'LR' || direction === 'RL';
  const elements = [];
  const nodeElementMap = new Map();

  for (const [rank, ids] of byRank.entries()) {
    ids.forEach((id, idx) => {
      const info = nodes.get(id);
      const x = isHorizontal ? startX + rank * 260 : startX + idx * 240;
      const y = isHorizontal ? startY + idx * 160 : startY + rank * 170;
      const el = createElement(info.shape, {
        x,
        y,
        w: info.shape === 'diamond' ? 180 : 156,
        h: info.shape === 'diamond' ? 114 : 76,
        text: info.label,
        stencilId: info.stencilId || undefined,
        fill: '#f8fafc',
        stroke: '#1e293b',
      });
      autoGrowShapeForText(el, info.label);
      nodeElementMap.set(id, el);
      elements.push(el);
    });
  }

  for (const e of edges) {
    const fromEl = nodeElementMap.get(e.from);
    const toEl = nodeElementMap.get(e.to);
    if (!fromEl || !toEl) continue;
    const conn = createElement(e.directed ? 'arrow' : 'line', {
      x: fromEl.x + fromEl.w / 2,
      y: fromEl.y + fromEl.h / 2,
      x2: toEl.x + toEl.w / 2,
      y2: toEl.y + toEl.h / 2,
      text: e.label,
      strokeStyle: e.dashed ? 'dashed' : 'solid',
      routing: 'orthogonal',
      endArrow: e.directed ? 'arrow' : 'none',
    });
    const startPort = isHorizontal ? 'right' : 'bottom';
    const endPort = isHorizontal ? 'left' : 'top';
    bindConnectorEndpoint(conn, 'start', fromEl, startPort);
    bindConnectorEndpoint(conn, 'end', toEl, endPort);
    elements.push(conn);
  }

  return { elements, warnings };
}

function parseSequenceDiagram(lines, startX, startY) {
  const warnings = [];
  const participants = new Map(); // id -> { id, label, kind }
  const messages = [];

  const ensureParticipant = (id, label = null, kind = 'participant') => {
    if (!participants.has(id)) {
      participants.set(id, { id, label: label || id, kind });
    } else if (label) {
      participants.get(id).label = label;
    }
  };

  for (const { text, lineNumber } of lines) {
    const clean = text.replace(/;$/, '').trim();
    const partMatch = clean.match(/^(participant|actor)\s+([A-Za-z0-9_.-]+)(?:\s+as\s+(.+))?$/i);
    if (partMatch) {
      ensureParticipant(partMatch[2], partMatch[3]?.trim(), partMatch[1].toLowerCase());
      continue;
    }

    const msgMatch = clean.match(/^([A-Za-z0-9_.-]+)\s*(-->>|->>|-->|->)\s*([A-Za-z0-9_.-]+)\s*:\s*(.+)$/);
    if (msgMatch) {
      const from = msgMatch[1];
      const arrow = msgMatch[2];
      const to = msgMatch[3];
      const label = msgMatch[4].trim();
      ensureParticipant(from);
      ensureParticipant(to);
      messages.push({
        from,
        to,
        label,
        dashed: arrow.startsWith('--'),
      });
      continue;
    }

    warnings.push(`Line ${lineNumber}: Unsupported sequenceDiagram syntax "${clean}".`);
  }

  const elements = [];
  const partCols = new Map();
  const totalHeight = Math.max(240, messages.length * 70 + 120);
  let idx = 0;

  for (const [id, p] of participants.entries()) {
    const cx = startX + idx * 220;
    partCols.set(id, cx + 65);
    const headerBox = createElement('rounded-rect', {
      x: cx,
      y: startY,
      w: 130,
      h: 54,
      text: p.label,
      fill: '#eff6ff',
      stroke: '#2563eb',
    });
    const lifeline = createElement('line', {
      x: cx + 65,
      y: startY + 54,
      x2: cx + 65,
      y2: startY + totalHeight,
      strokeStyle: 'dashed',
      stroke: '#64748b',
      routing: 'straight',
    });
    elements.push(headerBox, lifeline);
    idx++;
  }

  messages.forEach((m, mIdx) => {
    const x1 = partCols.get(m.from) ?? startX;
    const x2 = partCols.get(m.to) ?? startX + 220;
    const y = startY + 105 + mIdx * 65;
    const msgArrow = createElement('arrow', {
      x: x1,
      y,
      x2,
      y2: y,
      text: m.label,
      routing: 'straight',
      strokeStyle: m.dashed ? 'dashed' : 'solid',
      endArrow: 'arrow',
    });
    elements.push(msgArrow);
  });

  return { elements, warnings };
}
