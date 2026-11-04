// tests/table-range.test.js — Excel-like rubber-band cell ranges: pure
// range helpers in scene/table.js and the Ctrl/Cmd+drag gesture in the
// select tool. Inspector/overlay wiring is browser-verified separately.
import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { createPage, createElement } from '../scene/model.js';
import {
  normalizeCellRange,
  clampCellRange,
  cellRangeArea,
  setCellRangeAlignment,
  setCellRangeColor,
  setCellAlignment,
} from '../scene/table.js';
import { SelectTool } from '../tools/select.js';

const makeTable = (rows = 4, cols = 3) => {
  const el = createElement('table', { x: 100, y: 100, w: 300, h: 160, rows, cols });
  el.cells = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  return el;
};

describe('Cell range helpers', () => {
  test('normalizeCellRange orders corners in either drag direction', () => {
    assert.deepEqual(normalizeCellRange(2, 3, 0, 1), { r0: 0, c0: 1, r1: 2, c1: 3 });
    assert.deepEqual(normalizeCellRange(0, 1, 2, 3), { r0: 0, c0: 1, r1: 2, c1: 3 });
  });

  test('clampCellRange pins to the grid and never mutates the table', () => {
    const tbl = makeTable(3, 3);
    const clamped = clampCellRange(tbl, { r0: -2, c0: 0, r1: 9, c1: 12 });
    assert.deepEqual(clamped, { r0: 0, c0: 0, r1: 2, c1: 2 });
    assert.equal(tbl.cellAligns, undefined, 'display-path clamp must not create style grids');
    assert.equal(tbl.cellColors, undefined);
    assert.equal(clampCellRange({ type: 'rect' }, { r0: 0, c0: 0, r1: 1, c1: 1 }), null);
    assert.equal(clampCellRange(tbl, null), null);
  });

  test('cellRangeArea counts inclusive cells', () => {
    assert.equal(cellRangeArea({ r0: 0, c0: 0, r1: 1, c1: 1 }), 4);
    assert.equal(cellRangeArea({ r0: 2, c0: 1, r1: 2, c1: 1 }), 1);
    assert.equal(cellRangeArea(null), 0);
  });

  test('range alignment and fill write every cell and only those cells', () => {
    const tbl = makeTable(4, 3);
    setCellRangeAlignment(tbl, { r0: 1, c0: 0, r1: 2, c1: 2 }, 'right');
    for (let r = 1; r <= 2; r++) {
      for (let c = 0; c <= 2; c++) assert.equal(tbl.cellAligns[r][c], 'right', `cell ${r},${c}`);
    }
    assert.equal(tbl.cellAligns[0][0], '', 'outside the range stays untouched');

    setCellRangeColor(tbl, { r0: 0, c0: 2, r1: 0, c1: 2 }, '#fde68a');
    assert.equal(tbl.cellColors[0][2], '#fde68a');
    assert.equal(tbl.cellColors[0][0], '');

    setCellAlignment(tbl, 3, 0, 'left'); // not part of any range
    assert.equal(tbl.cellAligns[3][0], 'left');
  });

  test('out-of-grid ranges clamp inside the setters, never throw', () => {
    const tbl = makeTable(2, 2);
    assert.equal(setCellRangeAlignment(tbl, { r0: -5, c0: -5, r1: 5, c1: 5 }, 'center'), true);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) assert.equal(tbl.cellAligns[r][c], 'center');
    assert.equal(setCellRangeAlignment(tbl, { r0: 0, c0: 0, r1: 0, c1: 0 }, 'diagonal'), false);
    assert.equal(setCellRangeColor({ type: 'rect' }, { r0: 0, c0: 0, r1: 0, c1: 0 }, '#fff'), false);
  });
});

describe('Ctrl/Cmd+drag cell rubber band (select tool)', () => {
  const makeApp = () => {
    const page = createPage('Range');
    const table = makeTable(3, 3);
    page.elements.push(table);
    const app = {
      getPage: () => page,
      getCamera: () => ({ zoom: 1, x: 0, y: 0 }),
      selectedIds: new Set(),
      hoveredPort: null,
      marqueeBox: null,
      lassoPoints: null,
      smartGuides: [],
      tableSelection: null,
      lastTableCell: null,
      cropState: null,
      textTool: { isOpen: () => false },
      presentState: { active: false },
      activeTool: 'select',
      collab: { canEditBoard: () => true },
      scene: { settings: { snapToGrid: false } },
      connectorTool: { activeConnector: null },
      updateUI: () => {},
      requestRender: () => {},
    };
    return { app, page, table };
  };

  test('Ctrl+drag over a table builds a normalized, clamped cell range', () => {
    const { app, table } = makeApp();
    const tool = new SelectTool(app);

    // Press on cell (0,0), drag to (2,2).
    tool.onPointerDown({ x: 110, y: 110 }, { ctrlKey: true });
    assert.equal(app.mode ?? tool.mode, 'table-cells');
    assert.equal(app.selectedIds.has(table.id), true, 'the table becomes the selection');
    assert.deepEqual(app.tableSelection, { elId: table.id, r0: 0, c0: 0, r1: 0, c1: 0 });

    tool.onPointerMove({ x: 380, y: 250 }, {});
    assert.deepEqual(app.tableSelection, { elId: table.id, r0: 0, c0: 0, r1: 2, c1: 2 });
    tool.onPointerUp();
    assert.deepEqual(app.tableSelection, { elId: table.id, r0: 0, c0: 0, r1: 2, c1: 2 }, 'pointer-up keeps the range');
  });

  test('a drag out of the table pins the range at the boundary', () => {
    const { app } = makeApp();
    const tool = new SelectTool(app);
    tool.onPointerDown({ x: 110, y: 110 }, { metaKey: true });
    // Way past the bottom-right corner: the last in-table cell wins.
    tool.onPointerMove({ x: 900, y: 900 }, {});
    assert.equal(app.tableSelection.r1, 2);
    assert.equal(app.tableSelection.c1, 2);
    tool.onPointerUp();
  });

  test('reverse drags normalize (start bottom-right, end top-left)', () => {
    const { app } = makeApp();
    const tool = new SelectTool(app);
    tool.onPointerDown({ x: 380, y: 250 }, { ctrlKey: true });
    tool.onPointerMove({ x: 110, y: 110 }, {});
    assert.deepEqual(clampCellRange(app.getPage().elements[0], app.tableSelection), {
      r0: 0,
      c0: 0,
      r1: 2,
      c1: 2,
    });
    tool.onPointerUp();
  });

  test('a plain drag never starts a cell range, and other presses clear a stale one', () => {
    const { app, page, table } = makeApp();
    const tool = new SelectTool(app);
    tool.onPointerDown({ x: 110, y: 110 }, {});
    assert.notEqual(tool.mode, 'table-cells', 'plain drag moves the table');
    assert.equal(app.tableSelection, null);

    // Stale range: press on another element clears it.
    app.tableSelection = { elId: table.id, r0: 0, c0: 0, r1: 1, c1: 1 };
    const sticky = createElement('sticky', { x: 500, y: 500, w: 120, h: 120, text: 'x' });
    page.elements.push(sticky);
    tool.onPointerDown({ x: 560, y: 560 }, {});
    assert.equal(app.tableSelection, null, 'pressing another element drops the range');

    // Empty space clears it too.
    app.tableSelection = { elId: table.id, r0: 0, c0: 0, r1: 1, c1: 1 };
    tool.onPointerUp();
    tool.onPointerDown({ x: 900, y: 900 }, {});
    assert.equal(app.tableSelection, null);
    tool.onPointerUp();
  });

  test('a linked table keeps Ctrl+click for the link; Shift+Ctrl takes the range', () => {
    const opened = [];
    const prevWindow = globalThis.window;
    globalThis.window = { open: (url) => opened.push(url) }; // Node has no window
    try {
      const { app, table } = makeApp();
      const tool = new SelectTool(app);
      table.link = 'https://example.com';

      tool.onPointerDown({ x: 110, y: 110 }, { ctrlKey: true });
      assert.notEqual(tool.mode, 'table-cells', 'Ctrl+click on a linked table must not start a range');
      assert.equal(app.tableSelection, null);
      assert.deepEqual(opened, ['https://example.com'], 'the Ctrl+click opens the link');
      tool.onPointerUp();

      tool.onPointerDown({ x: 110, y: 110 }, { ctrlKey: true, shiftKey: true });
      assert.equal(tool.mode, 'table-cells', 'Shift+Ctrl forces the range on a linked table');
      assert.ok(app.tableSelection);
      tool.onPointerUp();

      // And a plain table is unaffected by the Shift combination too.
      table.link = null;
      app.tableSelection = null;
      tool.onPointerDown({ x: 110, y: 110 }, { metaKey: true, shiftKey: true });
      assert.equal(tool.mode, 'table-cells');
      tool.onPointerUp();
    } finally {
      if (prevWindow === undefined) delete globalThis.window;
      else globalThis.window = prevWindow;
    }
  });
});
