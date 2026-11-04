// tests/table.test.js — Excel-like table ops: structure mutations keep the
// per-cell style grids rectangular, and the setters survive a save/load cycle.
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { createElement, createScene } from '../scene/model.js';
import {
  CELL_ALIGNS,
  ensureCellGrid,
  insertTableRow,
  insertTableCol,
  deleteTableRow,
  deleteTableCol,
  setCellAlignment,
  setRowAlignment,
  setColAlignment,
  setTableAlignment,
  setCellColor,
  setRowColor,
  replaceTsvIntoTable,
} from '../scene/table.js';
import { serializeScene, parseSceneJson } from '../scene/storage.js';
import { validateElementsBatch } from '../scene/geometry.js';

function makeTable() {
  return createElement('table', { x: 10, y: 20, rows: 3, cols: 3 });
}

function isRect(grid, rows, cols) {
  return (
    Array.isArray(grid) &&
    grid.length === rows &&
    grid.every((row) => Array.isArray(row) && row.length === cols)
  );
}

describe('table structure ops vs per-cell style grids', () => {
  test('ensureCellGrid repairs a ragged style grid without inventing one', () => {
    const el = makeTable();
    ensureCellGrid(el);
    assert.equal(el.cellAligns, undefined, 'untouched tables stay free of style grids');
    el.cellAligns = [['left'], [], ['right', 'right', 'right', 'left']];
    ensureCellGrid(el);
    assert.deepEqual(el.cellAligns, [
      ['left', '', ''],
      ['', '', ''],
      ['right', 'right', 'right'],
    ]);
  });

  test('insertTableRow copies the previous row alignment and colour into the new row', () => {
    const el = makeTable();
    setRowAlignment(el, 2, 'right');
    setRowColor(el, 2, '#bbf7d0');
    insertTableRow(el); // appends below row 2
    assert.equal(el.rows, 4);
    assert.equal(el.cells[3].every((v) => v === ''), true, 'new row content stays empty');
    assert.deepEqual(el.cellAligns[3], ['right', 'right', 'right']);
    assert.deepEqual(el.cellColors[3], ['#bbf7d0', '#bbf7d0', '#bbf7d0']);
  });

  test('insertTableCol copies the previous column styles and keeps header text', () => {
    const el = makeTable();
    setColAlignment(el, 2, 'left'); // last column: the new one inherits its style
    setCellColor(el, 0, 2, '#fecaca');
    const headerBefore = el.cells[0].slice();
    insertTableCol(el); // appends after the last column
    assert.equal(el.cols, 4);
    assert.deepEqual(el.cells[0].slice(0, 3), headerBefore, 'header row preserved');
    assert.deepEqual(
      el.cellAligns.map((row) => row[3]),
      ['left', 'left', 'left']
    );
    assert.equal(el.cellColors[0][3], '#fecaca');
  });

  test('deleteRow / deleteCol splice the style grids along with the cells', () => {
    const el = makeTable();
    setCellColor(el, 2, 0, '#fef08a');
    setCellAlignment(el, 0, 2, 'left');
    deleteTableRow(el); // removes the last (styled) row
    assert.equal(el.rows, 2);
    assert.equal(isRect(el.cellColors, 2, 3), true);
    assert.equal(el.cellColors.some((row) => row.includes('#fef08a')), false);
    deleteTableCol(el); // removes the rightmost (styled) column
    assert.equal(el.cols, 2);
    assert.equal(isRect(el.cellAligns, 2, 2), true);
    assert.equal(el.cellAligns.some((row) => row.includes('left')), false);
  });

  test('replaceTsvIntoTable trims stale overrides back to the new shape', () => {
    const el = makeTable();
    setRowColor(el, 0, '#fed7aa');
    replaceTsvIntoTable(el, 'a\tb\nc\td\ne\tf');
    assert.equal(el.rows, 3);
    assert.equal(el.cols, 2);
    assert.deepEqual(el.cells[0], ['a', 'b']);
    assert.deepEqual(el.cellColors, [
      ['#fed7aa', '#fed7aa'],
      ['', ''],
      ['', ''],
    ]);
  });
});

describe('per-cell alignment and colour setters', () => {
  test('setCellAlignment sets and clears a single cell', () => {
    const el = makeTable();
    assert.equal(setCellAlignment(el, 1, 1, 'right'), true);
    assert.equal(el.cellAligns[1][1], 'right');
    assert.equal(setCellAlignment(el, 1, 1, ''), false, "'' is not an alignment");
    assert.equal(setCellAlignment(el, 1, 1, 'justify'), false, 'unknown alignment rejected');
    assert.equal(el.cellAligns[1][1], 'right');
    assert.equal(setCellAlignment(el, 9, 0, 'left'), false, 'out-of-bounds rejected');
    assert.equal(setCellAlignment(el, 0, 0, 'left'), true);
    setCellColor(el, 1, 1, '');
    assert.equal(el.cellColors[1][1], '');
  });

  test('setRowAlignment and setColAlignment fill whole lines', () => {
    const el = makeTable();
    setRowAlignment(el, 0, 'left');
    assert.deepEqual(el.cellAligns[0], ['left', 'left', 'left']);
    setColAlignment(el, 2, 'right');
    assert.deepEqual(
      el.cellAligns.map((row) => row[2]),
      ['right', 'right', 'right']
    );
  });

  test('setTableAlignment replaces the default and clears every override', () => {
    const el = makeTable();
    setCellAlignment(el, 1, 1, 'left');
    setTableAlignment(el, 'right');
    assert.equal(el.textAlign, 'right');
    assert.deepEqual(el.cellAligns, [
      ['', '', ''],
      ['', '', ''],
      ['', '', ''],
    ]);
  });

  test('setCellColor / setRowColor accept palette colours and reject bad indices', () => {
    const el = makeTable();
    assert.equal(setCellColor(el, 0, 0, '#fecaca'), true);
    assert.equal(setRowColor(el, 2, '#bbf7d0'), true);
    assert.deepEqual(el.cellColors[2], ['#bbf7d0', '#bbf7d0', '#bbf7d0']);
    assert.equal(setCellColor(el, -1, 0, '#ffffff'), false);
    assert.equal(setRowColor(el, 7, '#ffffff'), false);
  });

  test('CELL_ALIGNS is exactly the three horizontal alignments', () => {
    assert.deepEqual(CELL_ALIGNS, ['left', 'center', 'right']);
  });
});

describe('persistence round trip', () => {
  test('cell content, per-cell alignment and colour survive serialize/parse', () => {
    const scene = createScene();
    const el = makeTable();
    el.cells[0][0] = 'Service';
    setCellAlignment(el, 1, 0, 'left');
    setRowColor(el, 2, '#fef08a');
    scene.pages[0].elements.push(el);

    const reloaded = parseSceneJson(serializeScene(scene));
    const back = reloaded.pages[0].elements[0];
    assert.equal(back.cells[0][0], 'Service');
    assert.equal(back.cellAligns[1][0], 'left');
    assert.deepEqual(back.cellColors[2], ['#fef08a', '#fef08a', '#fef08a']);
    assert.equal(validateElementsBatch([back]).valid, true);
  });

  test('a table without overrides round-trips without style grids', () => {
    const scene = createScene();
    scene.pages[0].elements.push(makeTable());
    const back = parseSceneJson(serializeScene(scene)).pages[0].elements[0];
    assert.equal(back.cellAligns, undefined);
    assert.equal(back.cellColors, undefined);
  });
});

test('SVG export carries the per-cell fills and alignment the canvas shows', async () => {
  const { exportToSvgString } = await import('../render/svg-export.js');
  const { createScene } = await import('../scene/model.js');
  const scene = createScene();
  const page = scene.pages[0];
  const table = createElement('table', {
    x: 0,
    y: 0,
    w: 300,
    h: 90,
    rows: 2,
    cols: 2,
    cells: [
      ['H1', 'H2'],
      ['a', 'b'],
    ],
  });
  table.cellColors = [
    [null, null],
    ['#facc15', null],
  ];
  table.cellAligns = [
    [null, null],
    ['right', null],
  ];
  page.elements.push(table);
  const svg = exportToSvgString(scene, page);
  assert.ok(svg.includes('#facc15'), 'the per-cell fill must survive SVG export');
  // Right-aligned cell: text anchored at the cell's right edge, minus padding.
  assert.ok(
    /text-anchor="end"/.test(svg),
    'the per-cell right alignment must survive SVG export'
  );
  // Sanity: the table default is centre alignment, so without the override
  // every cell would be text-anchor="middle".
  assert.ok(!svg.includes('text-anchor="start"') || table.cellAligns.flat().includes('left'));
});
