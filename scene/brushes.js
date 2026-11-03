// scene/brushes.js — canonical drawing-preset definitions shared by the pen tool,
// the canvas renderer and the SVG exporter. One preset id is stored on the element,
// so a stroke looks the same after reload, during replay and in exported files.

export const BRUSH_PRESETS = [
  {
    id: 'technical',
    name: 'Technical Pen',
    kind: 'pen',
    description: 'Crisp monoline for diagram annotations',
    strokeWidth: 2,
    opacity: 1,
    smoothing: 'adaptive',
    pressure: false,
    grain: 0,
    nib: null,
  },
  {
    id: 'pressure-ink',
    name: 'Pressure Ink',
    kind: 'pen',
    description: 'Expressive handwriting with pen pressure',
    strokeWidth: 3,
    opacity: 1,
    smoothing: 'adaptive',
    pressure: true,
    minWidthRatio: 0.45,
    maxWidthRatio: 1.35,
    grain: 0,
    nib: null,
  },
  {
    id: 'pencil',
    name: 'Pencil',
    kind: 'pen',
    description: 'Subtle textured sketching',
    strokeWidth: 2,
    opacity: 0.75,
    smoothing: 'off',
    pressure: true,
    minWidthRatio: 0.6,
    maxWidthRatio: 1.15,
    grain: 0.55,
    nib: null,
  },
  {
    id: 'chisel',
    name: 'Chisel Marker',
    kind: 'pen',
    description: 'Broad angled nib for headings',
    strokeWidth: 8,
    opacity: 0.85,
    smoothing: 'adaptive',
    pressure: false,
    grain: 0,
    nib: { angle: 45, aspect: 0.42 },
  },
  {
    id: 'highlighter',
    name: 'Highlighter',
    kind: 'highlighter',
    description: 'Translucent emphasis that never self-darkens',
    strokeWidth: 18,
    opacity: 0.28,
    smoothing: 'adaptive',
    pressure: false,
    grain: 0,
    nib: null,
  },
  {
    id: 'chalk',
    name: 'Chalk',
    kind: 'pen',
    description: 'Dry textured strokes for dark boards',
    strokeWidth: 5,
    opacity: 0.9,
    smoothing: 'adaptive',
    pressure: true,
    minWidthRatio: 0.55,
    maxWidthRatio: 1.2,
    grain: 0.9,
    nib: null,
  },
];

const PRESET_MAP = new Map(BRUSH_PRESETS.map((p) => [p.id, p]));

export const DEFAULT_BRUSH_FOR_TOOL = {
  pen: 'technical',
  highlighter: 'highlighter',
};

export function getBrushPreset(id) {
  return PRESET_MAP.get(id) || null;
}

export function resolveBrush(el) {
  if (!el) return BRUSH_PRESETS[0];
  return (
    getBrushPreset(el.brush) ||
    getBrushPreset(DEFAULT_BRUSH_FOR_TOOL[el.type]) ||
    BRUSH_PRESETS[0]
  );
}

// Deterministic PRNG so pencil/chalk grain is identical on every redraw and export.
export function seededRandom(seed) {
  let s = (seed >>> 0) || 1;
  return function next() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function brushSeed(el) {
  const text = `${el?.id || ''}:${el?.createdAt || 0}`;
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pressureOf(point) {
  const p = Number(point?.p);
  return Number.isFinite(p) && p > 0 ? Math.min(1, Math.max(0.05, p)) : 0.5;
}

// Segment model: [{ x1, y1, x2, y2, width }]. One logical route, widths vary per
// segment; roughening/grain never introduces new routing bends.
export function buildStrokeSegments(el) {
  const pts = Array.isArray(el?.points) ? el.points : [];
  if (pts.length < 2) return [];
  const preset = resolveBrush(el);
  const base = Math.max(0.5, Number(el.strokeWidth) || preset.strokeWidth);
  const usePressure = preset.pressure && pts.some((p) => Number.isFinite(Number(p.p)));
  const minR = Number.isFinite(el.minWidthRatio) ? el.minWidthRatio : (preset.minWidthRatio ?? 0.7);
  const maxR = Number.isFinite(el.maxWidthRatio) ? el.maxWidthRatio : (preset.maxWidthRatio ?? 1.15);
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y) || !Number.isFinite(b.x) || !Number.isFinite(b.y)) {
      continue;
    }
    const ratio = usePressure
      ? minR + (maxR - minR) * ((pressureOf(a) + pressureOf(b)) / 2)
      : 1;
    out.push({ x1: a.x, y1: a.y, x2: b.x, y2: b.y, width: Math.max(0.5, base * ratio) });
  }
  return out;
}

// Deterministic speckle points used by pencil/chalk. Positions sit on the logical
// stroke and never affect geometry, hit testing or arrow routes.
export function buildGrainPoints(el, segments) {
  const preset = resolveBrush(el);
  if (!preset.grain || segments.length === 0) return [];
  const rnd = seededRandom(brushSeed(el));
  const base = Math.max(1, Number(el.strokeWidth) || preset.strokeWidth);
  const count = Math.min(420, Math.floor(segments.length * 1.6 + 6));
  const out = [];
  for (let i = 0; i < count; i++) {
    const seg = segments[Math.floor(rnd() * segments.length)];
    const t = rnd();
    const nx = -(seg.y2 - seg.y1);
    const ny = seg.x2 - seg.x1;
    const len = Math.hypot(nx, ny) || 1;
    const spread = (rnd() - 0.5) * base * 1.4;
    out.push({
      x: seg.x1 + (seg.x2 - seg.x1) * t + (nx / len) * spread,
      y: seg.y1 + (seg.y2 - seg.y1) * t + (ny / len) * spread,
      r: Math.max(0.35, base * (0.05 + rnd() * 0.1)),
      a: 0.12 + rnd() * 0.28 * preset.grain,
    });
  }
  return out;
}

export function strokeOpacity(el) {
  const o = Number(el?.opacity);
  return Number.isFinite(o) ? Math.min(1, Math.max(0.02, o)) : 1;
}

// Nib offset pairs let the canvas and SVG exporters share the chisel look.
export function buildNibOffsets(el) {
  const preset = resolveBrush(el);
  if (!preset.nib) return [];
  const w = Math.max(2, Number(el.strokeWidth) || preset.strokeWidth);
  const half = (((preset.nib.aspect ?? 0.4) * w) / 2) * 0.55;
  return [-half, half];
}

export function brushStyleFromPreset(presetId, overrides = {}) {
  const preset = getBrushPreset(presetId) || BRUSH_PRESETS[0];
  return {
    brush: preset.id,
    strokeWidth: preset.strokeWidth,
    opacity: preset.opacity,
    smoothing: preset.smoothing,
    pressure: preset.pressure,
    ...overrides,
  };
}
