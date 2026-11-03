// tests/drawing.test.js — drawing presets, stroke pipeline, arrow presets and table wrapping.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  BRUSH_PRESETS,
  getBrushPreset,
  buildStrokeSegments,
  buildGrainPoints,
  buildNibOffsets,
  seededRandom,
} from '../scene/brushes.js';
import { ARROW_QUICK_PRESETS, applyArrowQuickPreset } from '../scene/arrow-presets.js';
import { createElement, createScene, autoGrowShapeForText } from '../scene/model.js';
import { wrapCellLines, tableGeometry, fitTableToContent } from '../render/shapes.js';
import { getTableCellAtPoint } from '../scene/hit.js';
import {
  pasteTsvIntoTable,
  insertTableRow,
  insertTableCol,
  deleteTableRow,
  deleteTableCol,
} from '../scene/table.js';
import { exportToSvgString } from '../render/svg-export.js';
import {
  serializeScene,
  parseSceneJson,
  saveSceneToLocalStorage,
  loadSceneFromLocalStorage,
  loadWorkspacePrefs,
  saveWorkspacePrefs,
} from '../scene/storage.js';

function makeStroke(brush, props = {}) {
  const preset = getBrushPreset(brush);
  return createElement('pen', {
    brush,
    strokeWidth: preset.strokeWidth,
    opacity: preset.opacity,
    points: [
      { x: 0, y: 0, p: 0.2 },
      { x: 20, y: 10, p: 0.5 },
      { x: 40, y: 0, p: 0.9 },
    ],
    ...props,
  });
}

describe('Drawing presets and stroke pipeline', () => {
  test('six presets exist with distinct tuning', () => {
    assert.equal(BRUSH_PRESETS.length, 6);
    const signatures = BRUSH_PRESETS.map((p) =>
      [p.strokeWidth, p.opacity, Boolean(p.pressure), p.grain, Boolean(p.nib)].join('|')
    );
    assert.equal(new Set(signatures).size, BRUSH_PRESETS.length);
  });

  test('pressure ink varies segment width; technical pen stays monoline', () => {
    const ink = makeStroke('pressure-ink');
    const inkSegs = buildStrokeSegments(ink);
    const widths = new Set(inkSegs.map((s) => Math.round(s.width * 100)));
    assert.ok(widths.size > 1, 'pressure ink should not be a constant width');

    const technical = makeStroke('technical');
    const techSegs = buildStrokeSegments(technical);
    assert.equal(new Set(techSegs.map((s) => s.width)).size, 1);
  });

  test('grain is deterministic for the same element and seed', () => {
    const stroke = makeStroke('pencil');
    const segs = buildStrokeSegments(stroke);
    const a = buildGrainPoints(stroke, segs);
    const b = buildGrainPoints(stroke, segs);
    assert.deepEqual(a, b);
    assert.ok(a.length > 0);
    const rnd = seededRandom(42);
    assert.equal(rnd(), seededRandom(42)());
  });

  test('chisel and highlighter resolve their specialised geometry', () => {
    const chisel = makeStroke('chisel');
    assert.equal(buildNibOffsets(chisel).length, 2);
    const highlighter = createElement('highlighter', {
      brush: 'highlighter',
      points: [
        { x: 0, y: 0 },
        { x: 50, y: 0 },
      ],
    });
    assert.equal(buildNibOffsets(highlighter).length, 0);
    const svg = exportToSvgString(
      { ...createScene(), theme: 'light', files: {} },
      {
        id: 'p1',
        width: 400,
        height: 300,
        background: 'plain',
        elements: [highlighter],
      }
    );
    assert.match(svg, /stroke="#facc15"/);
  });

  test('preset appearance survives an SVG round trip', () => {
    const scene = createScene();
    const page = scene.pages[0];
    const stroke = makeStroke('pressure-ink', { opacity: 0.6 });
    page.elements.push(stroke);
    const svg = exportToSvgString(scene, page);
    assert.match(svg, /<line /, 'pressure strokes export as width-varying segments');
    assert.ok(svg.includes('opacity="0.6"'), 'non-opaque strokes export their opacity');
  });

  test('a per-element pressure curve overrides the preset ratios', () => {
    const base = makeStroke('pressure-ink');
    const tuned = makeStroke('pressure-ink', { minWidthRatio: 0.2, maxWidthRatio: 0.9 });
    const widest = (el) => Math.max(...buildStrokeSegments(el).map((s) => s.width));
    const lowest = (el) => Math.min(...buildStrokeSegments(el).map((s) => s.width));
    assert.ok(widest(tuned) < widest(base), 'tuned curve should cap the widest segment');
    assert.ok(lowest(tuned) <= lowest(base), 'tuned curve should keep its floor at or below the preset');
  });

  test('code auto-growth keeps a fixed top-left anchor', () => {    const code = createElement('code', { x: 100, y: 80, w: 320, h: 160 });
    autoGrowShapeForText(code, Array.from({ length: 40 }, (_, i) => `line ${i}`).join('\n'));
    assert.equal(code.x, 100);
    assert.equal(code.y, 80);
    assert.ok(code.h > 160);
  });
});

describe('Arrow quick presets', () => {
  test('each preset applies a documented independent combination', () => {
    assert.equal(ARROW_QUICK_PRESETS.length, 6);
    for (const preset of ARROW_QUICK_PRESETS) {
      const arrow = createElement('arrow', { x: 0, y: 0, x2: 100, y2: 0 });
      applyArrowQuickPreset(arrow, preset.id);
      for (const [key, value] of Object.entries(preset.apply)) {
        assert.equal(arrow[key], value, `${preset.id}.${key}`);
      }
    }
  });

  test('dashed two-way preset sets heads on both ends', () => {
    const arrow = createElement('arrow', {});
    applyArrowQuickPreset(arrow, 'dashed-two-way');
    assert.equal(arrow.startArrow, 'arrow');
    assert.equal(arrow.endArrow, 'arrow');
    assert.equal(arrow.strokeStyle, 'dashed');
  });
});

describe('Table cell text wrapping', () => {
  test('wraps words to the available width without dropping content', () => {
    const ctx = { measureText: (s) => ({ width: String(s).length * 7 }) };
    const source = 'kubectl get pods in namespace';
    const lines = wrapCellLines(ctx, source, 70);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(' '), source);
    for (const line of lines) assert.ok(line.length * 7 <= 70);
  });

  test('hard-breaks an over-long token instead of clipping', () => {
    const ctx = { measureText: (s) => ({ width: String(s).length * 7 }) };
    const token = 'a'.repeat(40);
    const lines = wrapCellLines(ctx, token, 70);
    assert.ok(lines.length > 1);
    assert.equal(lines.join(''), token);
  });

  test('preserves explicit blank lines', () => {
    const ctx = { measureText: (s) => ({ width: String(s).length * 7 }) };
    const lines = wrapCellLines(ctx, 'first\n\nsecond', 200);
    assert.deepEqual(lines, ['first', '', 'second']);
  });
});

describe('Durable save status', () => {
  test('a quota failure is reported instead of looking saved', () => {
    const scene = createScene();
    let reported = null;
    const full = {
      setItem() {
        const err = new Error('QuotaExceededError');
        err.name = 'QuotaExceededError';
        throw err;
      },
      getItem: () => null,
    };
    const ok = saveSceneToLocalStorage(scene, (err) => (reported = err), full);
    assert.equal(ok, false);
    assert.equal(reported?.name, 'QuotaExceededError');
  });

  test('a corrupt stored document falls back to an empty scene instead of throwing', () => {
    const store = { getItem: () => '{not json', setItem: () => {} };
    const scene = loadSceneFromLocalStorage('light', store);
    assert.equal(scene.pages.length, 1);
    assert.equal(scene.pages[0].elements.length, 0);
  });
});

describe('Table structure, spanning and TSV paste', () => {
  const fakeCtx = () => {
    const ctx = { measureText: (s) => ({ width: String(s).length * 7 }) };
    ctx.save = () => {};
    ctx.restore = () => {};
    ctx.font = '';
    return ctx;
  };

  test('non-uniform column weights become absolute spans that fill the width', () => {
    const el = createElement('table', { x: 10, y: 20, w: 300, h: 100, rows: 2, cols: 3 });
    el.colWidths = [2, 1, 1];
    const geo = tableGeometry(el);
    assert.deepEqual(
      geo.cellW.map((v) => Math.round(v)),
      [150, 75, 75]
    );
    assert.equal(geo.xs[0], 10);
    assert.equal(Math.round(geo.xs[3]), 310);
  });

  test('invalid weights fall back to equal spans instead of collapsing a cell', () => {
    const el = createElement('table', { x: 0, y: 0, w: 300, h: 90, rows: 3, cols: 3 });
    el.colWidths = [0, -2, 'x'];
    const geo = tableGeometry(el);
    assert.deepEqual(
      geo.cellW.map((v) => Math.round(v)),
      [100, 100, 100]
    );
  });

  test('fit-to-content grows rows and columns so no cell is clipped', () => {
    const el = createElement('table', { x: 40, y: 40, w: 120, h: 40, rows: 2, cols: 2 });
    el.cells = [
      ['component', 'status'],
      ['kubernetes control plane', 'healthy'],
    ];
    const before = { w: el.w, h: el.h };
    fitTableToContent(fakeCtx(), el);
    assert.ok(el.w > before.w);
    assert.ok(el.h > before.h);
    assert.equal(el.colWidths.length, 2);
    assert.ok(el.colWidths.every((v) => v > 0));
  });

  test('TSV paste fills the grid and grows it rather than dropping cells', () => {
    const el = createElement('table', { rows: 2, cols: 2, cells: [['a', 'b'], ['c', 'd']] });
    const res = pasteTsvIntoTable(el, 'x\ty\tz\n1\t2\t3', 0, 0);
    assert.equal(res.filled, 6);
    assert.equal(el.cols, 3);
    assert.deepEqual(el.cells[0], ['x', 'y', 'z']);
    assert.deepEqual(el.cells[1], ['1', '2', '3']);
  });

  test('row/column inserts keep the grid rectangular', () => {
    const el = createElement('table', { rows: 2, cols: 2, cells: [['a', 'b'], ['c', 'd']] });
    insertTableRow(el, 1);
    insertTableCol(el, 1);
    assert.equal(el.rows, 3);
    assert.equal(el.cols, 3);
    assert.ok(el.cells.every((row) => row.length === 3));
    deleteTableRow(el, 1);
    deleteTableCol(el, 1);
    assert.equal(el.rows, 2);
    assert.equal(el.cols, 2);
  });

  test('striping and header shading reach the SVG export', () => {
    const scene = createScene();
    const el = createElement('table', {
      x: 0,
      y: 0,
      w: 300,
      h: 120,
      rows: 3,
      cols: 2,
      striped: true,
      headerRow: true,
    });
    el.cells = [['name', 'state'], ['api', 'running'], ['db', 'ready']];
    scene.pages[0].elements.push(el);
    const svg = exportToSvgString(scene, scene.pages[0]);
    assert.match(svg, /rgba\(241,245,249,0\.85\)/, 'stripe band exported');
    assert.match(svg, /rgba\(226,232,240,0\.7\)/, 'header tint exported');
    assert.match(svg, /font-weight="600"/, 'header row is bold');
  });

  test('a table without a header row exports no header tint', () => {
    const scene = createScene();
    const el = createElement('table', { x: 0, y: 0, w: 200, h: 80, rows: 2, cols: 2, headerRow: false });
    scene.pages[0].elements.push(el);
    const svg = exportToSvgString(scene, scene.pages[0]);
    assert.doesNotMatch(svg, /rgba\(226,232,240,0\.7\)/);
  });

  test('table layout and code editor settings survive save and reload', () => {
    const scene = createScene();
    const table = createElement('table', {
      x: 0,
      y: 0,
      w: 300,
      h: 120,
      rows: 2,
      cols: 2,
      headerRow: false,
      striped: true,
      valign: 'top',
      cellPadding: 10,
    });
    table.colWidths = [2, 1];
    const code = createElement('code', {
      x: 400,
      y: 0,
      codeLanguage: 'bash',
      codeWrap: true,
      text: 'kubectl get pods',
    });
    scene.pages[0].elements.push(table, code);
    const reloaded = parseSceneJson(serializeScene(scene));
    const rTable = reloaded.pages[0].elements.find((e) => e.type === 'table');
    const rCode = reloaded.pages[0].elements.find((e) => e.type === 'code');
    assert.equal(rTable.headerRow, false);
    assert.equal(rTable.striped, true);
    assert.equal(rTable.valign, 'top');
    assert.equal(rTable.cellPadding, 10);
    assert.deepEqual(rTable.colWidths, [2, 1]);
    assert.equal(rCode.codeLanguage, 'bash');
    assert.equal(rCode.codeWrap, true);
    assert.equal(rCode.text, 'kubectl get pods');
  });
});

describe('Regression guards — persistence, geometry parity and hostile documents', () => {
  const memoryStorage = () => {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
    };
  };

  test('workspace preferences round-trip brush, eraser and inspector state', () => {
    const storage = memoryStorage();
    saveWorkspacePrefs(
      {
        brush: 'pencil',
        brushSmoothing: 'stabilizer',
        brushOverrides: { strokeWidth: 4, minWidthRatio: 0.25 },
        eraserSize: 30,
        eraserMode: 'stroke',
        eraserScope: 'ink',
        inspectorPinned: true,
      },
      storage
    );
    const prefs = loadWorkspacePrefs(storage);
    assert.equal(prefs.brush, 'pencil');
    assert.equal(prefs.brushSmoothing, 'stabilizer');
    assert.deepEqual(prefs.brushOverrides, { strokeWidth: 4, minWidthRatio: 0.25 });
    assert.equal(prefs.eraserSize, 30);
    assert.equal(prefs.eraserMode, 'stroke');
    assert.equal(prefs.eraserScope, 'ink');
    assert.equal(prefs.inspectorPinned, true);
  });

  test('a hostile rows value cannot break table geometry', () => {
    const fractional = createElement('table', { rows: 2.5, cols: 1e9 });
    assert.equal(fractional.rows, 2);
    assert.equal(fractional.cols, 200);
    assert.doesNotThrow(() => tableGeometry(fractional));
    const negative = createElement('table', { rows: -4, cols: Number.NaN });
    assert.equal(negative.rows, 1);
    assert.equal(negative.cols, 3);
  });

  test('fit to content leaves the renderer its full line budget', () => {
    const ctx = {
      measureText: (s) => ({ width: String(s).length * 7 }),
      save() {},
      restore() {},
    };
    const table = createElement('table', {
      rows: 1,
      cols: 1,
      cellPadding: 0,
      cells: [['alpha beta gamma delta epsilon zeta eta theta iota kappa']],
    });
    fitTableToContent(ctx, table);
    const lineH = (table.fontSize || 15) * 1.25;
    const lines = wrapCellLines(ctx, table.cells[0][0], table.w - 2).length;
    const rendererBudget = Math.floor((table.rowHeights[0] - 8) / lineH);
    assert.ok(rendererBudget >= lines, `budget ${rendererBudget} < ${lines} lines`);
  });

  test('table hit-testing follows custom column weights', () => {
    const table = createElement('table', {
      x: 0,
      y: 0,
      w: 100,
      h: 40,
      rows: 1,
      cols: 2,
      colWidths: [3, 1],
    });
    assert.equal(getTableCellAtPoint(table, 10, 20).col, 0);
    assert.equal(getTableCellAtPoint(table, 80, 20).col, 1);
  });

  test('SVG keeps table text colour and single-point ink opacity', () => {
    const scene = createScene();
    const table = createElement('table', {
      x: 0,
      y: 0,
      w: 200,
      h: 60,
      rows: 1,
      cols: 1,
      cells: [['red text']],
      textColor: '#dc2626',
    });
    const dot = createElement('highlighter', {
      x: 10,
      y: 10,
      points: [{ x: 10, y: 10 }],
      strokeWidth: 18,
      opacity: 0.28,
    });
    scene.pages[0].elements.push(table, dot);
    const svg = exportToSvgString(scene, scene.pages[0]);
    assert.match(svg, /fill="#dc2626"/);
    assert.match(svg, /<g opacity="0.28">/);
  });
});
