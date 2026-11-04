// scene/table.js — table mutation helpers shared by the inspector, the context
// menu and the insertion dialog. All of them keep `cells` a rectangular grid so
// no caller has to defend against a ragged document.
import { fitTableToContent } from '../render/shapes.js';

// Horizontal alignments a cell may override. '' means "inherit the table-level
// default" (el.textAlign), so an untouched table serializes exactly as before.
export const CELL_ALIGNS = ['left', 'center', 'right'];

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
  // Per-cell style grids are created lazily by the setters below, but once one
  // exists it must stay rectangular through every structural change or the
  // renderer would read a stale override for a shifted cell.
  if (Array.isArray(el.cellAligns)) el.cellAligns = normalizeStyleGrid(el.cellAligns, rows, cols);
  if (Array.isArray(el.cellColors)) el.cellColors = normalizeStyleGrid(el.cellColors, rows, cols);
  return { cells: el.cells, rows, cols };
}

// Pads/trims a parallel style grid back to rows × cols, padding with ''.
function normalizeStyleGrid(grid, rows, cols) {
  const out = grid.slice(0, rows);
  for (let r = 0; r < rows; r++) {
    const row = Array.isArray(out[r]) ? out[r].slice(0, cols) : [];
    while (row.length < cols) row.push('');
    row.length = cols;
    out[r] = row;
  }
  out.length = rows;
  return out;
}

// Creates a style grid on first write so tables that never use per-cell styles
// never carry the extra arrays through a save/load cycle.
function styleGridForWrite(el, key) {
  const { rows, cols } = ensureCellGrid(el);
  if (!Array.isArray(el[key])) {
    el[key] = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  }
  return el[key];
}

// Keeps the per-cell style grids in step with a `cells` splice. A new row or
// column inherits the alignment/colour of the neighbour it was inserted next
// to, so a styled table stays visually consistent as it grows.
function spliceCellStyleGrids(el, { rowAt = -1, colAt = -1, insert = false, templateRow = -1, templateCol = -1, rows = 0, cols = 0 }) {
  for (const key of ['cellAligns', 'cellColors']) {
    if (!Array.isArray(el[key])) continue;
    if (rowAt >= 0) {
      if (insert) {
        const src = templateRow >= 0 ? (el[key][templateRow] ?? []) : [];
        el[key].splice(rowAt, 0, Array.from({ length: cols }, (_, c) => src[c] ?? ''));
      } else {
        el[key].splice(rowAt, 1);
      }
    }
    if (colAt >= 0) {
      for (let r = 0; r < rows; r++) {
        if (insert) {
          const src = templateCol >= 0 ? (el[key][r]?.[templateCol] ?? '') : '';
          (el[key][r] ?? []).splice(colAt, 0, src);
        } else {
          (el[key][r] ?? []).splice(colAt, 1);
        }
      }
    }
  }
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
  // New rows start empty but keep the alignment/colour of the row above.
  spliceCellStyleGrids(el, { rowAt: at, insert: true, templateRow: Math.max(0, at - 1), cols });
  el.rows = rows + 1;
  resetSpans(el);
}

export function insertTableCol(el, position = 1) {
  if (!el || el.type !== 'table') return;
  const { cells, rows, cols } = ensureCellGrid(el);
  const at = position < 0 ? 0 : cols;
  for (let r = 0; r < rows; r++) cells[r].splice(at, 0, '');
  // New columns keep the alignment/colour of the column on their left (or the
  // first column when inserting at the very start).
  spliceCellStyleGrids(el, { colAt: at, insert: true, templateCol: Math.max(0, at - 1), rows });
  el.cols = cols + 1;
  resetSpans(el);
}

export function deleteTableRow(el, position = 1) {
  if (!el || (el.rows || 1) <= 1) return;
  const { cells, rows } = ensureCellGrid(el);
  const headerOffset = el.headerRow === false ? 0 : 1;
  const at = position < 0 ? Math.max(headerOffset, rows - 2) : rows - 1;
  cells.splice(at, 1);
  spliceCellStyleGrids(el, { rowAt: at });
  el.rows = rows - 1;
  if (el.rows === 1) el.headerRow = false;
  resetSpans(el);
}

export function deleteTableCol(el, position = 1) {
  if (!el || (el.cols || 1) <= 1) return;
  const { cells, rows, cols } = ensureCellGrid(el);
  const at = position < 0 ? 0 : cols - 1;
  for (let r = 0; r < rows; r++) cells[r].splice(at, 1);
  spliceCellStyleGrids(el, { colAt: at, rows });
  el.cols = cols - 1;
  resetSpans(el);
}

export function equalizeTableSpans(el) {
  if (!el || el.type !== 'table') return;
  el.colWidths = null;
  el.rowHeights = null;
}

// Per-cell alignment. '' clears the override so the cell falls back to the
// table-level default. Returns false (and changes nothing) on bad input.
export function setCellAlignment(el, r, c, align) {
  if (!el || el.type !== 'table' || !CELL_ALIGNS.includes(align)) return false;
  const { rows, cols } = ensureCellGrid(el);
  if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
  styleGridForWrite(el, 'cellAligns')[r][c] = align;
  return true;
}

export function setRowAlignment(el, r, align) {
  if (!el || el.type !== 'table' || !CELL_ALIGNS.includes(align)) return false;
  const { rows, cols } = ensureCellGrid(el);
  if (r < 0 || r >= rows) return false;
  const grid = styleGridForWrite(el, 'cellAligns');
  for (let c = 0; c < cols; c++) grid[r][c] = align;
  return true;
}

export function setColAlignment(el, c, align) {
  if (!el || el.type !== 'table' || !CELL_ALIGNS.includes(align)) return false;
  const { rows, cols } = ensureCellGrid(el);
  if (c < 0 || c >= cols) return false;
  const grid = styleGridForWrite(el, 'cellAligns');
  for (let r = 0; r < rows; r++) grid[r][c] = align;
  return true;
}

// Whole-table alignment: sets the default and clears every per-cell override,
// so "align the whole table" beats a cell-level exception instead of hiding it.
export function setTableAlignment(el, align) {
  if (!el || el.type !== 'table' || !CELL_ALIGNS.includes(align)) return false;
  el.textAlign = align;
  if (Array.isArray(el.cellAligns)) {
    const { rows, cols } = ensureCellGrid(el);
    el.cellAligns = Array.from({ length: rows }, () => Array.from({ length: cols }, () => ''));
  }
  return true;
}

// Per-cell fill colour. '' clears the override (transparent / inherit).
export function setCellColor(el, r, c, color) {
  if (!el || el.type !== 'table') return false;
  const { rows, cols } = ensureCellGrid(el);
  if (r < 0 || c < 0 || r >= rows || c >= cols) return false;
  styleGridForWrite(el, 'cellColors')[r][c] = color || '';
  return true;
}

// --- Rubber-band cell ranges (Excel-like multi-cell selection) ---
// A range is the inclusive rectangle {r0, c0, r1, c1}, always normalized so
// r0 <= r1 and c0 <= c1. Ranges target the selection the user dragged, not a
// scope button: when a range exists, alignment and fill apply to it.

export function normalizeCellRange(r0, c0, r1, c1) {
  return {
    r0: Math.min(r0, r1),
    c0: Math.min(c0, c1),
    r1: Math.max(r0, r1),
    c1: Math.max(c0, c1),
  };
}

// Clamps a range to the table's real grid so a drag that left the bounds
// still produces a valid selection, never an out-of-grid write. Read-only:
// display paths call this on every render, so it must not normalize the
// element the way the setters do.
export function clampCellRange(el, range) {
  if (!el || el.type !== 'table' || !range) return null;
  const rows = Math.max(1, el.rows || 1);
  const cols = Math.max(1, el.cols || 1);
  const r0 = Math.max(0, Math.min(range.r0, rows - 1));
  const r1 = Math.max(0, Math.min(range.r1, rows - 1));
  const c0 = Math.max(0, Math.min(range.c0, cols - 1));
  const c1 = Math.max(0, Math.min(range.c1, cols - 1));
  return normalizeCellRange(r0, c0, r1, c1);
}

export function cellRangeArea(range) {
  if (!range) return 0;
  return (range.r1 - range.r0 + 1) * (range.c1 - range.c0 + 1);
}

export function setCellRangeAlignment(el, range, align) {
  if (!el || el.type !== 'table' || !CELL_ALIGNS.includes(align)) return false;
  const r = clampCellRange(el, range);
  if (!r) return false;
  const grid = styleGridForWrite(el, 'cellAligns');
  for (let row = r.r0; row <= r.r1; row++) {
    for (let col = r.c0; col <= r.c1; col++) grid[row][col] = align;
  }
  return true;
}

export function setCellRangeColor(el, range, color) {
  if (!el || el.type !== 'table') return false;
  const r = clampCellRange(el, range);
  if (!r) return false;
  const grid = styleGridForWrite(el, 'cellColors');
  for (let row = r.r0; row <= r.r1; row++) {
    for (let col = r.c0; col <= r.c1; col++) grid[row][col] = color || '';
  }
  return true;
}


export function setRowColor(el, r, color) {
  if (!el || el.type !== 'table') return false;
  const { rows, cols } = ensureCellGrid(el);
  if (r < 0 || r >= rows) return false;
  const grid = styleGridForWrite(el, 'cellColors');
  for (let c = 0; c < cols; c++) grid[r][c] = color || '';
  return true;
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

// Replaces the whole table with the pasted grid: exact rows/columns, no leftover
// cells from the previous shape. The undoable, data-destroying counterpart of
// `pasteTsvIntoTable`, which fills from a start cell and only grows.
export function replaceTsvIntoTable(el, text) {
  if (!el || el.type !== 'table') return { filled: 0, rows: el?.rows || 0, cols: el?.cols || 0 };
  const lines = String(text ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/\n+$/, '')
    .split('\n');
  if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
    return { filled: 0, rows: el.rows || 0, cols: el.cols || 0 };
  }
  const grid = lines.map((line) => line.split('\t'));
  const rows = Math.max(1, Math.min(200, grid.length));
  const cols = Math.max(1, Math.min(200, Math.max(...grid.map((r) => r.length))));
  el.rows = rows;
  el.cols = cols;
  el.cells = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => String(grid[r]?.[c] ?? ''))
  );
  // The old per-cell styles no longer line up with the replaced grid; keep only
  // what still fits (top-left region) and pad the rest back to the default.
  ensureCellGrid(el);
  resetSpans(el);
  const filled = el.cells.reduce((n, row) => n + row.filter((v) => v !== '').length, 0);
  return { filled, rows, cols };
}

export function createTableElementData({ rows = 3, cols = 3, headerRow = true, striped = false, textAlign = 'center' } = {}) {
  const r = Math.min(200, Math.max(1, Math.round(rows) || 3));
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
