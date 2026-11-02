// scene/history.js

export class HistoryManager {
  constructor(maxDepth = 100) {
    this.maxDepth = maxDepth;
    // pageId -> { undoStack: string[], redoStack: string[], currentSnapshot: string }
    this.stacks = new Map();
  }

  _ensurePage(page) {
    if (!page || !page.id) return null;
    if (!this.stacks.has(page.id)) {
      const snap = JSON.stringify(page.elements || []);
      this.stacks.set(page.id, {
        undoStack: [],
        redoStack: [],
        currentSnapshot: snap,
      });
    }
    return this.stacks.get(page.id);
  }

  initPage(page) {
    if (!page || !page.id) return;
    const snap = JSON.stringify(page.elements || []);
    this.stacks.set(page.id, {
      undoStack: [],
      redoStack: [],
      currentSnapshot: snap,
    });
  }

  commit(page) {
    const state = this._ensurePage(page);
    if (!state) return false;
    const nextSnap = JSON.stringify(page.elements || []);
    if (nextSnap === state.currentSnapshot) {
      return false; // No change -> do not pollute undo stack
    }
    state.undoStack.push(state.currentSnapshot);
    if (state.undoStack.length > this.maxDepth) {
      state.undoStack.shift();
    }
    state.currentSnapshot = nextSnap;
    state.redoStack = [];
    return true;
  }

  canUndo(page) {
    const state = this._ensurePage(page);
    return Boolean(state && state.undoStack.length > 0);
  }

  canRedo(page) {
    const state = this._ensurePage(page);
    return Boolean(state && state.redoStack.length > 0);
  }

  undo(page) {
    const state = this._ensurePage(page);
    if (!state || state.undoStack.length === 0) return false;
    state.redoStack.push(state.currentSnapshot);
    const prevSnap = state.undoStack.pop();
    state.currentSnapshot = prevSnap;
    page.elements = JSON.parse(prevSnap);
    return true;
  }

  redo(page) {
    const state = this._ensurePage(page);
    if (!state || state.redoStack.length === 0) return false;
    state.undoStack.push(state.currentSnapshot);
    const nextSnap = state.redoStack.pop();
    state.currentSnapshot = nextSnap;
    page.elements = JSON.parse(nextSnap);
    return true;
  }

  removePage(pageId) {
    this.stacks.delete(pageId);
  }

  duplicatePageHistory(sourcePageId, targetPage) {
    this.initPage(targetPage);
  }
}
