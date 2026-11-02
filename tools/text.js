// tools/text.js
import { createElement, autoGrowShapeForText } from '../scene/model.js';
import { FONT_MAP } from '../render/themes.js';
import { getPointAlongConnector } from '../scene/routing.js';
import { updateConnectorBindings } from '../scene/bindings.js';
import { getTableCellAtPoint } from '../scene/hit.js';

export class TextTool {
  constructor(app) {
    this.app = app;
    this.editorEl = null;
    this.editingElement = null;
    this.editingTableCell = null;
    this._createEditorDom();
  }

  _createEditorDom() {
    if (typeof document === 'undefined') return;
    const ta = document.createElement('textarea');
    ta.className = 'wb-inline-text-editor';
    ta.setAttribute('aria-label', 'Inline text editor');
    ta.style.display = 'none';
    document.body.appendChild(ta);

    ta.addEventListener('input', () => {
      if (!this.editingElement) return;
      if (this.editingTableCell) {
        const { row, col } = this.editingTableCell;
        if (this.editingElement.cells?.[row]) {
          this.editingElement.cells[row][col] = ta.value;
        }
      } else {
        this.editingElement.text = ta.value;
        autoGrowShapeForText(this.editingElement, ta.value);
        updateConnectorBindings(this.app.getPage(), [this.editingElement.id]);
      }
      this.app.requestRender();
    });

    ta.addEventListener('keydown', (ev) => {
      ev.stopPropagation();
      if (ev.key === 'Escape') {
        ev.preventDefault();
        this.commitAndClose();
      } else if (ev.key === 'Enter' && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        this.commitAndClose();
      }
    });

    ta.addEventListener('blur', () => {
      this.commitAndClose();
    });

    this.editorEl = ta;
  }

  get editingEl() {
    return this.editingElement;
  }

  isOpen() {
    return Boolean(this.editingElement);
  }

  commit() {
    return this.commitAndClose();
  }

  cancel() {
    if (this.isOpen()) {
      this.commitAndClose();
    }
  }

  onPointerMove() {}

  onPointerUp() {}

  onPointerDown(world) {
    if (this.app.collab && !this.app.collab.canEditBoard()) return;
    if (this.isOpen()) {
      this.commitAndClose();
      return;
    }
    const page = this.app.getPage();
    const style = this.app.currentStyle;
    const el = createElement('text', {
      x: world.x,
      y: world.y - 16,
      w: 160,
      h: 36,
      text: '',
      fontFamily: style.fontFamily,
      fontSize: style.fontSize || 22,
      textColor: style.stroke,
      stroke: style.stroke,
      textAlign: 'left',
      autoGrow: true,
    });
    page.elements.push(el);
    this.app.selectedIds = new Set([el.id]);
    this.openEditorForElement(el);
  }

  openEditorForElement(el, worldPoint = null) {
    if (!el || el.locked || !this.editorEl) return;
    if (this.app.collab && !this.app.collab.canEditBoard()) return;
    const page = this.app.getPage();
    const cam = page.camera;
    const rect = this.app.canvas.getBoundingClientRect();

    this.editingElement = el;
    this.editingTableCell = null;
    this.app.editingElementId = el.id;

    let screenX;
    let screenY;
    let width;
    let height;
    let initialText = el.text || '';

    if (el.type === 'table' && worldPoint) {
      const cell = getTableCellAtPoint(el, worldPoint.x, worldPoint.y);
      if (cell) {
        this.editingTableCell = cell;
        screenX = rect.left + cell.x * cam.zoom + cam.x;
        screenY = rect.top + cell.y * cam.zoom + cam.y;
        width = Math.max(60, cell.w * cam.zoom);
        height = Math.max(30, cell.h * cam.zoom);
        initialText = el.cells?.[cell.row]?.[cell.col] ?? '';
      }
    }

    if (!this.editingTableCell) {
      if (el.type === 'line' || el.type === 'arrow') {
        const lp = getPointAlongConnector(el, el.labelT ?? 0.5, page);
        width = 160;
        height = 42;
        screenX = rect.left + lp.x * cam.zoom + cam.x - width / 2;
        screenY = rect.top + lp.y * cam.zoom + cam.y - height / 2;
      } else {
        screenX = rect.left + el.x * cam.zoom + cam.x;
        screenY = rect.top + el.y * cam.zoom + cam.y;
        width = Math.max(90, el.w * cam.zoom);
        height = Math.max(40, el.h * cam.zoom);
      }
    }

    const ta = this.editorEl;
    ta.value = initialText;
    ta.style.display = 'block';
    ta.style.left = `${Math.round(screenX)}px`;
    ta.style.top = `${Math.round(screenY)}px`;
    ta.style.width = `${Math.round(width)}px`;
    ta.style.height = `${Math.round(height)}px`;
    ta.style.fontFamily = FONT_MAP[el.fontFamily || 'sans'] || FONT_MAP.sans;
    ta.style.fontSize = `${Math.max(12, Math.round((el.fontSize || 18) * cam.zoom))}px`;
    ta.style.textAlign = el.type === 'code' ? 'left' : el.textAlign || 'center';

    setTimeout(() => {
      ta.focus();
      ta.select();
    }, 0);
    this.app.requestRender();
  }

  commitAndClose() {
    if (!this.editingElement) return;
    const el = this.editingElement;
    const page = this.app.getPage();
    const val = this.editorEl.value;

    if (this.editingTableCell) {
      const { row, col } = this.editingTableCell;
      if (el.cells?.[row]) el.cells[row][col] = val;
    } else {
      el.text = val;
      if (el.type === 'text' && !val.trim()) {
        page.elements = page.elements.filter((e) => e.id !== el.id);
        this.app.selectedIds.delete(el.id);
      } else {
        autoGrowShapeForText(el, val);
        updateConnectorBindings(page, [el.id]);
      }
    }

    this.editingElement = null;
    this.editingTableCell = null;
    this.app.editingElementId = null;
    this.editorEl.style.display = 'none';

    this.app.commitChange();
    if (this.app.activeTool === 'text' && !this.app.toolLock) {
      this.app.setTool('select');
    }
    this.app.updateUI();
    this.app.requestRender();
  }
}
