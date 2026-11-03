// scene/table.js — table mutation helpers shared by the inspector, the context
// menu and the insertion dialog. All of them keep `cells` a rectangular grid so
// no caller has to defend against a ragged document.
import { fitTableToContent } from '../render/shapes.js';

export function ensureCellGrid(el) {
  const rows = Math.max(1, el.rows || 1);
  const cols = Math.max(1, el.cols || 1);
  const cells = Array.isArray(el.cells) ? el.cells : [];
  for (let r = 0; r < rows; r++) {
    if (!Array.isArray(cells[r])) cells[r] = [];
    while (cells[r].length < cols) cells[r].push('');
    cells[r].length = cols;
  }
  el.cells = cells.slice(0, rows);
  return { cells: el.cells, rows, cols };
}

// Resets the relative spans after a structural change so the table keeps its
// previous total size instead of jumping when a row/column appears.
function resetSpans(el) {
  el.colWidths = null;
  el.rowHeights = null;
}

export function insertTableRow(el, position = 1) {
  if (!el || el.type !== 'table') return;
  const { cells, rows, cols } = ensureCellGrid(el);
  const headerOffset = el.headerRow === false ? 0 : 1;
  const at = position < 0 ? headerOffset : rows;
  cells.splice(at, 0, Array(cols).fill(''));
  el.rows = rows + 1;
  resetSpans(el);
}

export function insertTableCol(el, position = 1) {
  if (!el || el.type !== 'table') return;
  const { cells, rows, cols } = ensureCellGrid(el);
  const at = position < 0 ? 0 : cols;
  for (let r = 0; r < rows; r++) cells[r].splice(at, 0, '');
  el.cols = cols + 1;
  resetSpans(el);
}

export function deleteTableRow(el, position = 1) {
  if (!el || (el.rows || 1) <= 1) return;
  const { cells, rows } = ensureCellGrid(el);
  const headerOffset = el.headerRow === false ? 0 : 1;
  const at = position < 0 ? Math.max(headerOffset, rows - 2) : rows - 1;
  cells.splice(at, 1);
  el.rows = rows - 1;
  if (el.rows === 1) el.headerRow = false;
  resetSpans(el);
}

export function deleteTableCol(el, position = 1) {
  if (!el || (el.cols || 1) <= 1) return;
  const { cells, rows, cols } = ensureCellGrid(el);
  const at = position < 0 ? 0 : cols - 1;
  for (let r = 0; r < rows; r++) cells[r].splice(at, 1);
  el.cols = cols - 1;
  resetSpans(el);
}

export function equalizeTableSpans(el) {
  if (!el || el.type !== 'table') return;
  el.colWidths = null;
  el.rowHeights = null;
}

export function fitTable(ctx, el) {
  if (!el || el.type !== 'table' || !ctx) return null;
  return fitTableToContent(ctx, el);
}

// Fills the table from tab-separated clipboard text. Starting at (row, col);
// grows the grid instead of dropping cells beyond the current bounds.
export function pasteTsvIntoTable(el, text, startRow = 0, startCol = 0) {
  if (!el || el.type !== 'table') return { filled: 0 };
  const { cells, rows, cols } = ensureCellGrid(el);
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n');
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) return { filled: 0 };

  const grid = lines.map((line) => line.split('\t'));
  const neededRows = Math.max(rows, startRow + grid.length);
  const neededCols = Math.max(cols, startCol + Math.max(...grid.map((r) => r.length)));
  el.rows = neededRows;
  el.cols = neededCols;
  const grown = ensureCellGrid(el);

  let filled = 0;
  grid.forEach((rowCells, r) => {
    rowCells.forEach((value, c) => {
      const rr = startRow + r;
      const cc = startCol + c;
      if (rr >= grown.rows || cc >= grown.cols) return;
      grown.cells[rr][cc] = value;
      filled += 1;
    });
  });
  resetSpans(el);
  return { filled, rows: el.rows, cols: el.cols };
}

export function createTableElementData({ rows = 3, cols = 3, headerRow = true, striped = false, textAlign = 'center' } = {}) {
  const r = Math.min(50, Math.max(1, Math.round(rows) || 3));
  const c = Math.min(20, Math.max(1, Math.round(cols) || 3));
  return {
    rows: r,
    cols: c,
    cells: Array.from({ length: r }, () => Array.from({ length: c }, () => '')),
    headerRow,
    striped,
    textAlign,
  };
}
